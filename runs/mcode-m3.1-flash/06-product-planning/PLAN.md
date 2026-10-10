# Plan — Offline inspection sync (tablet app)

Input: `BRIEF.md` only. This plan is derived solely from the brief. Where the brief is
silent, the point is recorded as an **assumption** (§2) or an **open decision** (§13) rather
than invented as fact.

No dates, durations, or headcount appear in this document. Sequencing is expressed as
dependency order between milestones (§12) plus measurable gates. Effort estimation requires
knowing the team's composition and is deliberately left out rather than guessed at.

---

## 1. Summary

Make the tablet app **offline-first for the inspector's working copy** and keep the server as
the system of record. Local SQLite stops being a read-through cache and becomes a durable
working store with a transactional outbox. Sync is push-then-pull over additive REST
endpoints built on the existing integer record versions. Conflicts are resolved by **data
class** — union for append-only data, three-way field merge with a *recorded conflict* (never
silent loss) for scalar fields, server-authoritative for protected fields. Photos upload over a
separate resumable channel that never blocks form data. Rollout is capability-flagged by
cohort, gated on measured health thresholds, with a rehearsed rollback that does not strand
queued work.

The three load-bearing bets, in order: the server can be extended additively and its integer
version is enforced (A2); the 24-hour removal rule is interpreted the way this plan assumes
(A7/A8); and supervisor edits are field-scoped and infrequent enough that field-level merge is
sufficient (A9/A12). All three are summarised in `RESPONSE.md`.

---

## 2. Assumptions

Each assumption is stated so it can be *falsified*. Confidence is my judgement, not evidence.
A1–A4 and A7/A8 are the ones that would invalidate large parts of the plan if wrong.

| # | Assumption | If false |
|---|---|---|
| A1 | An inspector syncs at least once in coverage before entering a no-signal area, so **assignments and the form definition are already cached** and the inspection can be opened offline. | The feature cannot start work offline at all — the exact failure the project exists to fix. Needs a separate assignment-distribution design. |
| A2 | The server can be **extended additively** (delta feed, idempotency key, conditional mutation on the existing integer version) and that version is **enforced**, i.e. a stale write is rejected rather than silently overwriting. | The whole transport and merge foundation changes. If the version is not enforced server-side, three-way merge has no trustworthy base and a new sync service is needed. |
| A3 | **Up to 40 photos** per inspection on a tablet that can hold them, and photos — not form data — are the throughput and storage driver on a weak link. | If real inspections are much larger, the storage/purge/time budgets in §6 and §8 need rework. |
| A4 | Tablets are company-managed with a known MDM baseline (encryption, OS floor, remote wipe, app container excluded from OS backup). | The security model in §9 and the purge guarantee in §8 both weaken; unmanaged or rooted devices may need to be blocked from offline mode entirely. |
| A5 | Normally **one inspector on one device** works an inspection; two tablets on the same inspection is rare. | The merge rules still hold across devices, but conflict frequency and the signature/status rules need extra cases. |
| A6 | Connectivity returns **intermittently but within hours**, and inspectors re-enter coverage before the end of the shift. | Devices stay dark for days; staleness UX, supervisor visibility of "in progress", and purge timing all degrade. |
| A7 | The 24-hour removal clock starts at **server-side acceptance**, not at inspector submission, and the device is the obligated party. | Purging too early destroys work; too late is a violation. Direction of the error is decided by legal, not by engineering. |
| A8 | **Photos and signature images are customer data** subject to that rule (audit evidence is separate, server-side). | Over-purge (we destroy our own evidence) or under-purge (violation). |
| A9 | Supervisor edits from the web are **field-scoped and infrequent**, not wholesale form restructuring. | Conflict volume and the orphaned-field problem (§6.3) grow; field-level merge may be the wrong design. |
| A10 | The current SQLite store is a **disposable read-through cache** with no durable user-authored content. | Backfill of in-flight local work becomes a workstream in its own right (§10). |
| A11 | Audit history is **append-only and server-authoritative**; a device cannot author a trusted audit entry, only a provisional one. | The audit model in §6.5 and the "unconfirmed audit" label need rework. |
| A12 | A **full collaborative editor is genuinely out of scope**; supervisors and inspectors are not co-authoring the same text in real time. | Field-level merge plus conflict records becomes untenable, and the product constraint itself must be revisited. |
| A13 | The OS **suspends the app** when backgrounded, so sync cannot be assumed to run in the background. | If the target platform permits reliable background execution, a background sync trigger becomes available and improves first-upload latency. |
| A14 | The integer version **increments on every accepted mutation** and is visible to clients, not merely a server-internal ETag. | Version-based rebasing and delta feeds cannot be built on it. |
| A15 | A person may use **multiple devices**, and a device is enrolled and identifiable server-side (user × device). | Sync identity and audit attribution need a different model. |

### 2.1 Platform note

The brief does not name a platform. This plan is deliberately platform-agnostic. The two
platform-specific consequences called out are: app suspension in the background (A13) and
per-user vs per-device encryption keys if tablets are shared between inspectors (D4).

---

## 3. User flow

### 3.1 First run / after a long gap

1. Inspector opens the app in coverage. The app syncs: assignment index first, then form
   definitions and inspection details, lazily per inspection. A progress surface says
   "12 inspections ready for offline use", not a spinner.
2. The app then states what is available offline and when it was last verified. The inspector
   does not have to think about connectivity; they only need to know work will not be lost.

### 3.2 Core offline loop (basement, no signal)

1. **Open** — inspector picks an assigned inspection from the cached list. The header shows
   `Assigned · not yet synced since <time>`. Opening does not require a network round trip.
2. **Fill** — every keystroke and toggle is applied locally and appended to the outbox in a
   single transaction. A quiet indicator reads `Saved on this tablet`; there is no
   "saving…/offline" flicker, because there is nothing to wait for.
3. **Photo** — shutter capture writes the file to encrypted app-private storage first, then the
   row. The photo is immediately durable, so an app kill, battery pull, or reboot loses
   nothing. A per-inspection counter shows `7 / 40`.
4. **Sign** — capture stroke or finger signature. The rendered image is bound to a hash of the
   inspection content at signing time, so later edits visibly invalidate consent rather than
   silently reusing an old signature. The inspector sees the signatory name, timestamp, and
   consent text before accepting.
5. **Submit for review** — this is an offline action and means *"submitted, awaiting
   review"*, not *"accepted"*. The app says so explicitly. The device is not blocked by
   photos still waiting to upload; it reports exactly how many are outstanding (see D10).
6. **Leave** — nothing to flush. The outbox survives process death, reboot, and app update.

### 3.3 Reconnection

On app foreground, on network regain, on a foreground timer, and on pull-to-refresh, the app
drains its outbox, then pulls what changed, then reconciles. Progress is visible but never
blocking; the inspector can keep working. When everything is drained the indicator goes
`All work synced · <time>`.

### 3.4 Supervisor loop (web)

Supervisors see device state without touching the device: last sync time, pending op count,
conflicts awaiting resolution, and any device that has not checked in. They resolve conflicts
by accepting the authoritative value or pulling in the device's preserved variant, and the
resolution is itself audited.

### 3.5 After acceptance

The device learns the acceptance, computes its purge deadline from the **server** timestamp,
and purges local customer payloads within the required window, logging evidence of the purge.
The inspector keeps a minimal, non-customer receipt (ids, hashes, timestamps) that supports
the audit history without holding customer content (§8.3).

---

## 4. Scope boundaries

### In scope

- Offline open, edit, and submit of **assigned** inspections
- Offline photo capture (up to 40 per inspection) with resumable upload
- Offline signature capture
- Offline *request* to submit for review
- Delta pull, three-way merge, conflict detection, conflict records
- Supervisor-side conflict resolution and variant retrieval
- Compliance purge with deadline enforcement, including the device-offline-past-deadline case
- Per-cohort capability flags, kill switch, and support tooling
- A migration path for the existing read-through cache

### Out of scope (stated so it is not smuggled in)

- **Real-time collaborative editing** — no CRDT/OT, no character-level merge, no live cursors.
  Product has said no and the plan respects that (A12).
- Offline authoring of **unassigned, archived, or historical** inspections
- Offline **supervisor** editing — the web client is assumed online
- Media beyond photos (video, audio) — not in the brief
- Offline PDF/report generation — the server can produce the report after acceptance
- Relying on **background** execution while suspended (A13); sync is foreground-triggered
- PKI-backed digital certificates for signatures (D7)
- Any rewrite of the existing REST surface beyond additive endpoints (§5.2)
- Analytics that carry customer content of any kind (§11.3)

### Deferred, with the trigger that would reopen each

| Deferred | Trigger to reopen |
|---|---|
| Video evidence | Regulatory or product requirement, or observed need in pilot field notes |
| Offline PDF/report | Field complaint after pilot that inspectors need a local artefact before coverage |
| Real-time co-editing | Measured concurrent supervisor/inspector edit rate in pilot exceeds the level field-level merge handles cleanly |
| Offline history browsing | Supervisor request for offline access to accepted inspections (this materially expands the local store and the purge surface) |

---

## 5. Sync protocol

### 5.1 Client write path (the one rule that matters most)

**Every** local mutation goes through a single write path that, in one transaction:
1. applies the change to the local tables, and
2. appends an outbox row describing the intended server mutation.

No screen, form, or photo component writes directly to SQLite. This is what makes the
invariant in §5.4 true. A hidden local mutation with no outbox entry would be invisible to
sync and would be permanently lost data.

### 5.2 Transport

Additive REST on the existing API, reusing the existing integer record version (A2, A14).
Two families:

**Push** — `POST /v2/sync/ops` with a batch of op envelopes:

```json
{
  "op_id": "uuidv7",              // idempotency key, generated once at enqueue
  "inspection_id": "…",
  "entity": "answer|photo_ref|signature|submit_request|delete_request",
  "field": "form.q3.notes",       // field ops
  "value": { },
  "base_version": 47,             // last server version the client saw for this record
  "client_seq": 128,              // device-local monotonic counter
  "device_id": "…",
  "captured_at": "…",             // device clock, advisory only
  "form_def_version": 3
}
```

The server answers each op individually with exactly one of:

- `applied` → `{ new_version }`
- `duplicate` → same result as the original application (safe retry, no side effect)
- `conflict` → `{ current_record, current_version }`
- `rejected` → validation failure, with a machine-readable code

`op_id` is retained server-side for a window at least as long as a device might plausibly
retry (documented explicitly, not left implicit), so a retry after a lost response is safe.

**Pull** — a change feed, then detail:

- `GET /v2/sync/feed?since=<token>&scope=assigned` → changed inspections with `id`,
  `new_version`, changed-field mask, and current `form_def_version`
- `GET /v2/inspections/{id}?since_version=<v>` → delta if the client's base is usable, full
  record if not

If the feed token has expired or the client's base is unusable, the client performs a
defined **full re-sync of the assigned set**. This is a designed, tested path with its own
progress UI — not an error state.

### 5.3 Sync cycle

1. **Reachability probe** — cheap, short timeout, never blocks the UI. Failure is not an
   error state; it just defers the cycle.
2. **Drain outbox** in `client_seq` order, batched by count and by bytes. Independent priority
   queues so that form data and signature are never starved behind 40 photos (§6.4). Retry
   with backoff; validation rejections are quarantined after repeated failure into a visible
   "needs attention" item rather than being retried forever.
3. **On conflict** — record it, rebase the op onto the returned version, and retry **once**. A
   second conflict parks the op as a conflict record. No unbounded merge loop.
4. **Pull and merge** — fetch changed records, run the merge in §6 against the stored base
   (§6.2), persist the new base and version.
5. **Purge evaluation** — check deadline obligations (§8).
6. **Emit local metrics** (§11.1).

### 5.4 Invariant

The displayed state is always a pure function of *(server state, local pending ops)*. If a
state cannot be explained that way, it is a bug. This is asserted by a test, not just a
comment.

### 5.5 Triggers

Foreground resume, app launch, network-regain callback, after each local write (debounced),
a foreground interval timer while the app is visible, and explicit user pull-to-refresh. No
trigger assumes a background execution window (A13). Triggers are idempotent — several firing
at once collapse into one cycle.

---

## 6. Local data model

### 6.1 Tables

| Table | Purpose | Key columns |
|---|---|---|
| `inspections` | Cached assignment list + working state | `id`, `server_version`, `synced_version`, `form_def_version`, `server_accepted_at`, `purge_deadline`, `local_state` |
| `form_answers` | One row per answered field | `inspection_id`, `field_id`, `value_json`, `updated_seq`, `dirty` |
| `form_defs` | Form definition, versioned | `form_def_version`, `definition_json` |
| `photos` | Photo metadata, not bytes | `photo_id` (client UUIDv7), `inspection_id`, `rel_path`, `sha256`, `bytes`, `captured_at`, `upload_state`, `uploaded_bytes` |
| `signatures` | Strokes + rendered image | `inspection_id`, `strokes_json`, `rel_path`, `signed_at`, `signatory`, `content_hash` |
| `outbox` | Ordered pending mutations | `op_id`, `seq`, `payload_json`, `base_version`, `state`, `attempts`, `last_error` |
| `conflicts` | Recorded, unresolved divergences | `inspection_id`, `field_id`, `server_value`, `device_value`, `detected_at`, `resolution`, `resolved_by` |
| `_synced_state` | **Merge base**: last acknowledged server representation | `inspection_id`, `server_version`, `state_json` |
| `audit_local` | Provisional device audit entries | `id`, `inspection_id`, `event`, `at`, `confirmed` |
| `sync_meta` | Device/user identity, tokens' metadata, counters | `device_id`, `last_success_at`, `feed_token` |

The whole database is encrypted at rest (§9).

`_synced_state` is the reason three-way merge works: without the last acknowledged server
value, "changed on both sides" cannot be distinguished from "only changed on one side". It
also makes the merge path uniform — every record merges the same way.

### 6.2 Files on disk

Photos and rendered signature images live as **files** in encrypted app-private storage, not
as BLOBs in SQLite, referenced by relative path from `photos`/`signatures`. BLOBs in the
database would bloat every delta read, defeat the row-level merge, and make the purge a
single large rewrite instead of targeted unlinking.

Durability order for a capture is fixed: **write file → fsync/close → insert row → insert
outbox entry**, all in the order that never leaves a row pointing at a missing file.

### 6.3 Form schema changes while a device is offline

A supervisor can change a form while a tablet is dark. The feed carries `form_def_version`.

- New required field → applied, shown unfilled, inspection marked incomplete rather than
  failing to sync.
- Removed field with a local answer → the answer is **preserved** in an orphaned-answers bucket
  and surfaced to the supervisor. It is never silently dropped.
- Type change → migrate where unambiguous; otherwise orphan rather than coerce destructively.

A filled field an inspector spent time on is customer work. Discarding it is a data-loss
event even if the field no longer exists.

### 6.4 Priority and ordering

Two independent orderings keep photos from starving the rest:

- **Data class** — form answers, then submit request, then signature, then photos. Small
  critical data always drains first.
- **Within a class** — oldest first by capture time.

This is what makes a slow photo upload harmless rather than blocking.

### 6.5 Audit entries

Device-side audit entries are written as `confirmed = 0` and are labelled *provisional* until
the server accepts them; the server then owns the authoritative entry (A11). The device never
presents a provisional entry as final.

---

## 7. Conflict policy

Conflicts are resolved **by data class**, not by one global rule. The server is always
authoritative; the device is authoritative only for its own pending ops.

| Class | Examples | Policy |
|---|---|---|
| **Append-only / set-like** | Photos, audit entries, additional form rows, forward status transitions | **Union merge.** Both sides' rows are kept. No conflict is possible and none is reported. |
| **Scalar editable fields** | Notes, checklist values, free text | **Three-way field merge** against `_synced_state`. Unchanged on one side → take the other. Changed on one side only → take that side. **Changed on both sides → conflict record** (see below). |
| **Protected / regulatory** | Inspection status, acceptance, signatory identity, audit entries, retention markers | **Server-authoritative.** The device may *request* a transition via a role-checked op; it may never set the field directly. |
| **Deletions** | Inspector deletes a photo after upload | **Tombstone op, not a server object removal.** The deletion is an auditable event; the audit history records it. Deleting after submission is a regulated event, not an erasure (D12). |
| **Delete vs edit** | Supervisor deletes an inspection while a device edits it | **Server wins.** The device keeps its local copy marked *pending removal* for the retention window, then purges. **Deleted is never resurrected by a stale device op.** |

### 7.1 Same-field conflict resolution — the recommendation

Both sides changed the same field since the common base:

- The **server value stays canonical** and is what the device displays.
- The **device's value is preserved verbatim** as a conflict record, server-side and visible to
  both the inspector and the supervisor.
- The inspector sees a non-blocking badge: *"Your note differs from the supervisor's update.
  Your version is saved. Review in the web app."* It never blocks their next inspection.
- The supervisor resolves by accepting the authoritative value or pulling in the device variant.
  The resolution is itself audited.

**Why not last-writer-wins:** the device's clock is not trustworthy, and silent LWW in a
basement is indistinguishable from the data loss this project exists to stop. Preserving the
value costs storage and adds a resolution queue, and it is the only option that satisfies both
the audit requirement and the user's actual need.

**Why not device-wins:** supervisors are accountable for record accuracy, and a field can be
marked complete or compliant by them. Letting an offline device overwrite that is worse than
making a human look at a badge.

The honest cost: this creates a queue somebody has to work. That is a real operational
expense, and the pilot must measure its size (§11).

### 7.2 Signature and status special cases

- Two signatures captured on different devices while offline → keep the **earlier**
  `signed_at`, flag for supervisor resolution, retain the later as a conflict record. The
  inspection is not silently re-signed.
- A device cannot sign an inspection the server has already accepted; the op is rejected
  server-side and the device is told why.
- Status transitions are validated server-side against an allowed-transition set, so a stale
  device cannot drive an inspection backwards.

### 7.3 What we deliberately do not build

No merge UI for text, no attempt to auto-merge prose, no block-level structural merge, no
"apply the rest for me" bulk action. Product ruled out a collaborative editor and the
conflict surface is kept correspondingly small and honest.

---

## 8. Attachments (photos, signature images)

### 8.1 Capture

- Local `photo_id` (UUIDv7) generated at shutter time; it is the idempotency key, so a retried
  capture never duplicates.
- SHA-256 of the content for integrity and dedupe.
- EXIF orientation normalised at capture; capture timestamp preserved from the device clock
  alongside a monotonic device sequence, so clock skew cannot reorder history.
- **No location metadata** — these are indoor inspections, so geotagging is needless
  personal-data collection.
- Quota check before capture: the 40-photo per-inspection cap and a device free-space
  threshold. Capture is refused with a clear message rather than failing silently later.

### 8.2 Upload protocol

Separate binary channel. Photo bytes never enter the JSON op payload.

1. `POST /v2/inspections/{id}/photos` with `photo_id` → idempotent create → `upload_id` and
   chunk size.
2. `PUT /v2/uploads/{upload_id}` with `Content-Range` and a per-chunk checksum.
3. `GET /v2/uploads/{upload_id}` → received bytes, for resume.
4. `POST /v2/uploads/{upload_id}/commit` with the whole-file SHA-256 → server verifies →
   returns `photo_ref` and the new record version.

Per-photo state machine: `local → uploading(partial, offset) → uploaded → committed`. Resume
is from the byte offset, so a kill mid-upload resumes rather than restarts. Committed-but-not-
yet-referenced uploads are held server-side as pending and garbage-collected after a documented
window, so a device that dies before its submit op does not leak storage.

### 8.3 Retention and purge (the 24-hour rule)

- Deadline is computed as `server_accepted_at + 24h`, using the **server** timestamp (A7). The
  device never starts its own clock at acceptance; it starts it at the moment it *learns* of
  acceptance, but measures against the server's time so a late-delivered notification does
  not silently extend the window.
- Two-tier retention after purge:
  - **Purged** — photo files, signature image and strokes, free-text answers. This is
    customer data under the assumed reading (A8).
  - **Retained** — a minimal non-customer receipt: inspection id, photo ids and hashes,
    signature hash and timestamp, submit/accept timestamps. This supports the audit history
    and compliance evidence without holding customer content.
- The device **cannot rely on being online** to receive the acceptance. If the local clock
  passes a known deadline, the device purges on its own initiative at the next opportunity —
  app launch, foreground, or scheduled work — and logs the purge as a compliance event.
- If the device is offline past the deadline and the acceptance state is still unknown, the
  safe default is applied to anything **already submitted** (the server holds that copy).
  Unsubmitted work is a separate question and is explicitly an open decision (D3) — it is the
  device's only copy, and destroying it on an unverified assumption would be worse than the
  alternative. This must be confirmed by legal, not decided here.
- MDM remote wipe is the backstop for a device that never returns to coverage; it is a
  complement to, not a replacement for, the local purge.

---

## 9. Security

**Device posture** (A4): company-managed tablet, known MDM, minimum OS version enforced,
app container excluded from OS backup, screen lock required, remote wipe available. Root or
jailbreak detection with a defined consequence — most defensibly, blocking *offline mode*
rather than blocking the whole app, so a flagged device can still read and submit.

**Identity and transport**: short-lived access token with a rotating refresh token in the
platform keystore; long-lived credentials never in SQLite. TLS 1.2+ only, certificate pinning
to the company CA, and mutual-TLS device certificate for device identity and attestation.

**At rest**: SQLCipher for the database, with the data-encryption key held in the hardware
keystore. Photo and signature files encrypted with a key derived per user and per device, with
a re-key path on enrolment change. Key scope is open decision D4 — per-device is simpler,
per-user is correct if tablets are shared.

**Authorisation**: role checks (inspector vs supervisor) and per-inspection ownership are
enforced **server-side on every sync endpoint**. The device is untrusted. Explicit IDOR
testing in §10.

**Audit integrity**: audit entries are append-only and server-signed. A device cannot author a
trusted entry, only a provisional one (§6.5).

**Privacy**: no location, contacts, or advertising SDKs. Analytics and logs carry no field
values, no photo bytes, and no free text (§11.3). The signature screen masks the app-switcher
snapshot and blocks clipboard copy. Signature binding to a content hash means post-hoc content
edits are detectable rather than invisible.

**Offboarding**: unenrolment destroys keys and triggers remote wipe; server-side retention
policy is separate from the device's 24-hour rule and is out of this plan's scope.

---

## 10. Migration and backfill

**The good news, if A10 holds:** the existing store is a read-through cache, so it should hold
no durable user-authored content and there is little to backfill. This must be *verified*,
not assumed — a partially shipped offline draft feature or a user relying on cached text would
turn this into a real backfill workstream.

- **Schema versioning**: `PRAGMA user_version` plus an applied-migrations table. Forward-only,
  idempotent steps, each verified in CI. No automatic downgrade; a device that cannot migrate
  forward takes the defined rebuild path.
- **Rebuild path**: on unrecoverable migration failure, the app offers a logged rebuild. It
  refuses to wipe while the outbox is non-empty unless the user makes an explicit, recorded
  decision — a silent wipe of in-flight field work is the failure mode this project is meant to
  eliminate.
- **Backfill of assignments**: pull the assignment index in full, then details lazily per
  inspection, so first sync on a large assignment list stays fast on a weak link.
- **Cutover**: an `offline_writes` flag scoped by organisation/cohort. With the flag off, the
  sync engine is idle and the old read-through path is unchanged — the read path remains
  testable until the old path is deliberately removed.
- **Existing devices on the old app version** must keep working against the new server. The
  server is backward compatible with at least one previous app version for the whole pilot.
- **Verification**: after migration, run the §5.4 invariant check on a seeded dataset and
  compare read results against the old cache to prove the read path did not change.

---

## 11. Observability

### 11.1 On-device

Counters and timings, written to local structured storage and flushed as metadata only:

- outbox depth and **oldest pending op age** (the one that predicts "an inspector lost work")
- photos pending upload, total pending bytes
- conflicts detected / resolved, and by class
- purge obligations due, overdue, and completed
- last successful sync time, feed token age
- database and file store size, free space
- crashes during a sync cycle, quarantined (poison) ops

Surfaced in-app for the inspector's own device health (*"12 items waiting to upload, oldest 3h"*)
and readable by support.

### 11.2 Server

- per-op apply latency and error class, `conflict` and `rejected` rates
- delta feed size, round-trip count, token-expiry/full-resync frequency
- photo upload throughput, resume frequency, hash-mismatch and dedupe rates
- device funnel: assigned → downloaded → edited → submitted → accepted
- purge acknowledgements; **overdue purge alerts as a compliance page**
- devices that have not connected within a threshold window

### 11.3 Rules

- **No customer content in telemetry** — no field values, no free text, no photo bytes, no
  signature images. Correlation by `op_id` and `inspection_id` only. Enforced by an automated
  redaction scan in test (§10).
- Alerts: oldest pending op age above threshold; purge deadline breach; photo upload failure
  rate; **conflict-rate spike** (a spike means a real workflow problem, and is the signal that
  A9 or the §7.1 policy is wrong).
- Support tooling: a server-side view of a device's last-seen version and pending count, and a
  re-push of an inspection to a device — so support can diagnose a stuck device **without**
  physical access to it.
- Explicit non-goal: no per-keystroke or per-field analytics.

---

## 12. Milestones

Sequenced by technical dependency, not by calendar. Two tracks (device and server) can run in
parallel once M1 is agreed, but each track needs its own accountable owner; this plan does not
assume a particular team size or composition.

| ID | Milestone | Depends on | Acceptance criteria |
|---|---|---|---|
| **M0** | Decisions closed | Product, compliance, security input | Every decision in §13 marked decided with an owner and a recorded outcome. Compliance has explicitly accepted or rejected the §8.3 purge interpretation. A14/version-enforcement behaviour is confirmed in writing by the server owner. |
| **M1** | Sync + merge contract spec | M0 | Written spec covers the op envelope, every response class, the delta feed, token expiry, version semantics, and the merge rule per data class. Reviewed and signed off by both track owners. A shared contract-test suite exists and **fails** against a stub server. |
| **M2** | Durable local store + transactional outbox | M1 | With the server unreachable and networking fully disabled, a full inspection — 40 photos, signature, answers, submit — can be created, edited and submitted, and survives app kill **and** device reboot. Automated crash injection at every write step shows no loss. Read path shows no regression. |
| **M3** | Server sync endpoints (flagged off) | M1 | Contract tests green. Replaying the same `op_id` yields identical server state (idempotency). A stale-version mutation is rejected with the current record returned. No production traffic reaches the endpoints while the flag is off. |
| **M4** | Push/pull engine, merge, conflict records | M2, M3 | Merge property tests hold the invariants: no scalar field is lost without a conflict record, merge is deterministic, re-applying an op is idempotent, and two divergent replicas converge. Two-replica divergence test passes for every data class. |
| **M5** | Attachment channel | M2, M3 | 40 photos upload and resume correctly from an arbitrary byte offset, including after a mid-upload kill, on a constrained and flaky link, within the agreed time budget. Server rejects truncated, corrupted, and hash-mismatched blobs. Duplicate `photo_id` does not duplicate. |
| **M6** | Compliance purge and retention | M0, M2, M4 | Purge completes within the deadline measured from the **server** acceptance timestamp, in every test variant including the device-offline-past-deadline case. Purge produces complete, exportable evidence. Zero customer payloads remain past the deadline in an automated audit. Legal has ruled on D3. |
| **M7** | Security hardening | M1 | Pen-test findings triaged to zero high/critical. Enrolment, unenrolment, remote wipe and key rotation all exercised in staging. Jailbroken-device behaviour verified. Log redaction scan passes against seeded field values. |
| **M8** | Observability and support tooling | M1, M3 | Dashboards live for the §11 metrics. Alerts fire in a rehearsed game-day. A support engineer can diagnose a stuck device and trigger a re-push without device access. Telemetry confirmed content-free. |
| **M9** | Field pilot enablement and UAT | M4, M5, M6, M7, M8 | The scripted offline UAT passes on target tablet hardware with a real inspector: complete a 40-photo signed inspection fully offline, kill the app twice, reconnect, and the server record matches. Runbook, escalation path, and kill switch documented **and rehearsed**. |
| **M10** | Pilot readout and rollout decision | M9 | Gate metrics below measured and reported per cohort. An explicit go / hold / rollback decision recorded with rationale. Per-cohort flag configuration exists for expansion, and the old path is still intact if rollback is chosen. |

### 12.1 Rollout stages and gates

Stages are gated on **measured thresholds**, not on elapsed time.

| Stage | Configuration | Exit gate |
|---|---|---|
| **0 — Internal** | Dev builds, synthetic network shaping, real basement hardware | M2/M3/M4 acceptance green |
| **1 — Shadow** | Sync engine runs; app still writes through the **old** path; engine output is compared, read-only, against what the old path produces | Zero unexplained divergence between pulled data and the old read path |
| **2 — Pilot** | Flag on for a small consenting cohort (one supervisor team) | All of: zero confirmed data-loss reports; ≥ the agreed share of pilot inspections submitted via the offline-first path; p95 oldest-pending-op age under threshold; **purge compliance 100%**; conflict rate below threshold with **every** conflict class observed and understood |
| **3 — Expand** | Enable per team/region, same gates each time | Each expansion independently passes the Stage 2 gate |
| **4 — Default** | Flag default-on; old path removed only after Stage 3 is clean | No regression in the funnel metrics; old path removal is a separate, reversible change |
| **5 — Review** | Post-pilot decision on deferred items | Deferred-items table (§4) revisited with real data |

"Zero confirmed data-loss reports" is the gate that cannot be traded. A threshold miss elsewhere
is a hold; a single data-loss report is a rollback.

### 12.2 Rollback

- **Flag off** returns devices to the read-through path. The outbox is **not** discarded: it is
  parked (`state = parked`) and remains readable.
- If the flag goes off with a non-empty outbox, the app must either drain it first or park it
  explicitly and visibly — never silently drop it.
- The server must accept ops from a parked cohort whenever the flag returns on, so rollback is
  genuinely reversible. This is a hard server-side requirement, not a nice-to-have, and it is
  an acceptance criterion of M3.
- **Kill switch**: a server-side ability to reject ops from a specific app version with a
  graceful, user-readable error, for a data-corrupting bug that must be stopped immediately.
- **Schema migration rollback**: never auto-downgrade. Migrations are idempotent and
  forward-fixable; a bad migration is fixed forward.
- Rollback is rehearsed during M9, not documented and hoped for.

---

## 13. Decisions required before implementation

Each has a recommendation. Recommendations are my judgement given the brief, and the ones
marked **(blocking)** stop M1 if unresolved.

| # | Decision | Recommendation | Why / what it costs |
|---|---|---|---|
| **D1** **(blocking)** | How is a same-field concurrent edit resolved? | Server value canonical, device value preserved as a conflict record, supervisor resolves in the web app. No blocking for the inspector. | Keeps the audit requirement and keeps inspector work. Costs a resolution queue — the pilot must measure its size. See §7.1. |
| **D2** **(blocking)** | Can the server be extended additively, and is the integer version actually enforced (A2/A14)? | Yes — additive endpoints plus `If-Match`-style conditional mutation on the existing integer version. | If the server cannot change, this becomes a separate sync service and the scope of M1–M4 changes materially. If the version is not enforced, three-way merge has no trustworthy base. |
| **D3** **(blocking, legal)** | Do **unsubmitted** local drafts count as customer data under the 24-hour rule? | Exclude never-submitted drafts from the 24-hour clock — they are the only copy and not yet part of the inspection record — but cap their retention and make them explicitly user-deletable. | Purge-first destroys the inspector's only copy. Purge-never risks a violation. This is a compliance determination, not an engineering one. |
| **D4** | Local encryption key scope: per-device or per-user? | Per-user keys, server-wrapped, with re-key on enrolment change. | If each tablet is permanently assigned to one inspector, per-device is simpler and acceptable. The answer depends on the device-sharing policy, which the brief does not state. |
| **D5** | Does a submitted-but-unaccepted inspection block acceptance until its photos finish uploading? | **No.** Allow submit while photos are pending, with a clear outstanding count; let **acceptance** wait server-side until required content is present. | Otherwise an inspector in a basement cannot leave, because 40 photos cannot upload without signal. This is the difference between a usable feature and a trap. |
| **D6** | Photo custody path: is there existing object storage, and do supervisors need photos on the web immediately? | Reuse existing attachment storage behind an additive upload-session endpoint. Do not build new blob infrastructure. | Building new storage is a large, unrequested workstream. |
| **D7** | Signature format: image + metadata, or PKI/certificate signing? | Captured stroke image + audit-bound content hash + signatory attestation, consistent with current e-signature practice. **No PKI.** | Certificates add PKI operations, revocation handling, and trust infrastructure, and give nothing the brief asks for. |
| **D8** | Do supervisors get blocked while a conflict is open? | No. They see it and can accept the authoritative value or pull the device variant. | Blocking the supervisor record would let one offline tablet stall a review queue. |
| **D9** | What happens to a photo the inspector deletes after upload? | A tombstone op; the deletion is an auditable event. | Erasing the server object would break the audit history the regulations require. Needs compliance agreement. |
| **D10** | Does the device need offline access to historical/accepted inspections, or only assigned open ones? | Only assigned open inspections, plus a minimal non-customer receipt. | Offline history expands the local store and the purge surface dramatically. Reopen only on a concrete supervisor request. |
| **D11** | Form schema changes while a device is offline. | Version the form definition; preserve answers to removed fields in an orphaned bucket and surface them; never silently discard a filled field. | Dropping answers an inspector typed is a data-loss event even if the field no longer exists. |
| **D12** | How long may the device hold unsubmitted work? | No hard cap, but a staleness rule: an assignment untouched for an agreed period prompts *"is this still current?"* — no auto-expiry. | Auto-expiry destroys field work; no prompt at all leaves inspectors submitting against stale assignments. |
| **D13** | Is at-rest encryption (SQLCipher + keystore) approved, and is FIPS required? | Confirm early; it is a long-lead item. If FIPS is required, the crypto choice changes and affects both the database and file storage. | Late discovery of a FIPS requirement invalidates the storage design in M2. |
| **D14** | Target platform and its background-execution limits (A13). | Design for foreground-only sync; treat reliable background execution as an optimisation, never a dependency. | Depends on the platform, which the brief does not name. |
| **D15** | Conflict visibility on the inspector's device. | A non-blocking "needs supervisor review" badge with the preserved value; never block the next inspection. | A blocking dialog strands a working inspector for a problem they cannot fix. |

---

## 14. Testing

### 14.1 Offline and durability

- Network shaping: full offline, 200 ms–5 s RTT, packet loss, bandwidth caps, and signal
  flapping **mid-upload**.
- Crash injection: kill the process at **every** step of the write path (M2's core evidence) and
  at every upload chunk boundary; verify no answer, photo, or signature is lost.
- Reboot between capture and sync; low storage; battery saver; clock skew on the device.
- Multi-day darkness (A6): assignment still opens, staleness prompt appears, no data loss.

### 14.2 Merge and protocol

- **Property/fuzz tests** on the merge engine over randomly generated two-replica edit
  sequences, asserting the invariants: no scalar field lost without a conflict record; merge is
  deterministic; re-applying an op is idempotent; divergent replicas converge; delete is never
  resurrected.
- Idempotency: same `op_id` applied twice yields one effect and the same response.
- Version conflict returns the current record; a stale device cannot move status backwards.
- Delta feed correctness under concurrent server-side writes; token expiry forces the defined
  full-resync path and it completes cleanly.
- Cross-device cases (A5): two tablets, one inspection, both offline, then reconnect.
- **Contract tests shared between client and server** so schema drift fails CI rather than
  production.
- The §5.4 invariant is a test, not a comment.

### 14.3 Attachments

- Chunked upload resume from **every** offset, including after a mid-upload kill.
- Truncated, corrupted, and hash-mismatched blobs are rejected; duplicate `photo_id` does not
  duplicate; out-of-order or duplicated chunks are handled; storage-full mid-upload recovers.
- EXIF orientation variants; hash stability across re-encoding; 40-photo upper bound enforced.

### 14.4 Security

- **IDOR testing** on every sync endpoint across inspections, users and roles — the device is
  untrusted and this is the highest-value test in the suite.
- Certificate-pinning bypass, token expiry/rotation mid-session, key rotation mid-visit.
- Rooted/jailbroken device behaviour; app-container backup extraction (must contain nothing
  readable); keystore key extraction attempt.
- Automated log-redaction scan: seed known field values, capture all logs and telemetry, assert
  none appear. Ties to A4 and §11.3.

### 14.5 Compliance

- Purge-within-deadline tests across every state variant, including **device offline past the
  deadline** — the case most likely to be missed.
- Purge evidence completeness: an auditor-facing export that demonstrates the rule was met.
- Assert zero customer payloads persist past the deadline in an automated audit (M6).

### 14.6 Device matrix and regression

- Minimum supported OS, low-memory tablets, MDM-enrolled and unenrolled paths, MDM-push
  interference.
- The old read-through path stays under test until Stage 4, so its removal is a deliberate
  decision rather than an untested assumption.
- **No real customer data in any test environment** — synthetic photos, synthetic names.

### 14.7 Field validation

- Scripted UAT (M9) on real tablet hardware, in a real basement, with a real inspector and a
  timed task.
- The acceptance scenario in one line: *complete a 40-photo signed inspection fully offline,
  kill the app twice, reconnect, and the server record matches what was captured.*
- Performance budgets set before the pilot: first assignment sync time on a weak link, delta
  round-trip count, and 40-photo upload time.

---

## 15. What this plan deliberately does not promise

- No dates or durations. Sequencing is dependency-driven; scheduling needs the team's actual
  composition, which the brief does not provide.
- No headcount. Each milestone names an accountable role, not a number of people.
- No claim that the conflict queue is free. §7.1 is the right trade for a no-data-loss
  requirement, and it creates real operational work that the pilot must quantify.
- No assumption that connectivity is good, that devices are online, or that the server
  behaves better than A2 describes. Each of those is a decision or a gate, not a premise.
