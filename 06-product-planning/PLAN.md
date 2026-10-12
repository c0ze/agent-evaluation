# Offline Inspection Sync — Product & Engineering Plan

**Input:** `BRIEF.md` (only product input). **Audience:** mobile, backend, security/compliance,
and the pilot supervisor group. **Status:** draft for decision, not yet approved.

This plan deliberately contains **no calendar dates and no staffing estimates**. Sequencing is
expressed as milestone dependencies and exit criteria only; capacity planning is a separate
exercise that should happen after the decisions in §16 are closed.

---

## 1. Goal and non-goals

**Goal:** An inspector can open an assigned inspection on a company-managed tablet with no
network, complete forms, capture up to 40 photos and a signature, and have every change reach
the server intact and auditable — even if connectivity only returns intermittently — while
supervisors continue to edit the same inspection from the web.

**Explicitly not in scope (matches "does not want a full collaborative editor"):**

- No real-time co-editing, presence, cursors, or live cursors/OT/CRDT merge.
- No peer-to-peer tablet-to-tablet sync.
- No offline creation of *new* inspections (assignment is a supervisor/server act).
- No offline editing of inspections assigned to someone else.
- No offline report generation/PDF rendering beyond what exists today.
- No rewriting of the web supervisor experience (it stays a normal online REST client).

**Deferred but designed-for (must not be blocked by this work):** bulk/multi-inspection
offline pre-fetch policies, offline signature *verification*, and cross-device handover of a
partially completed inspection.

---

## 2. Assumptions

Assumptions are numbered because later sections reference them. Each is either **Verifiable**
(check before M1) or **Load-bearing** (design collapses or changes materially if false).

| ID | Assumption | Type | Consequence if false |
|----|------------|------|----------------------|
| A1 | Inspections are assigned server-side; a tablet only ever works on inspections assigned to the signed-in inspector. | Verifiable | Need an entitlement model + offline reassignment handling (§6.6). |
| A2 | Inspector-owned fields and supervisor-owned fields are **mostly disjoint**; concurrent edits to the *same* field are rare. | **Load-bearing** | Auto-merge (§7) is not viable; every concurrent edit becomes a human-resolved conflict, which changes the UX and the pilot's success criteria. |
| A3 | Existing server integer record versions are **per-inspection** and there is **no global change cursor**. | Verifiable | If a change log already exists, M3 shrinks to an adapter; if not, M3 is a real server migration. |
| A4 | The current SQLite read-through cache holds **no unsaved user edits** — every prior edit was either synced or lost. | Verifiable | Requires a one-time salvage pass in M1 (see §10.2). |
| A5 | Field-level *last-writer-wins* is **not** acceptable for findings/measurements because the audit history is regulatory. | Verifiable | Silent overwrite risk; §7 would need to be renegotiated with compliance. |
| A6 | Tablets are company-managed (MDM), full-disk-encrypted, and remotely wipeable. | Verifiable | Local encryption design (§9.2) escalates to application-level crypto. |
| A7 | A photo captured on a modern tablet is ~2–6 MB; 40 photos ≈ 80–240 MB per inspection. | Verifiable | Storage quota and eviction (§8.4) must be re-sized. |
| A8 | Field connectivity, when it returns, is good enough to upload a full inspection's attachments **within a working session**, or can resume across sessions without restarting. | **Load-bearing** | Resumable chunked upload (§8.3) becomes mandatory for M5 rather than a hardening item, and "submit" may need to be splittable. |
| A9 | "Accepted" is a **server-side** state transition; a client cannot accept its own inspection offline. | Verifiable | The 24-hour clock (§9.4) has no trustworthy start point. |
| A10 | Regulatory "removal of local customer data within 24 hours" means cryptographic/secure deletion of local rows and files, and permits retaining a non-PII audit skeleton. | **Load-bearing** | If *all* traces including audit metadata must go, the audit design (§7.4, §9.5) must be reworked to be server-only with no local residue. |
| A11 | The device clock cannot be trusted for compliance timestamps. | Verifiable | Requires server-anchored time (§9.4) with skew correction. |
| A12 | An inspection's form schema is versioned and the tablet has the correct schema version cached before going offline. | Verifiable | Offline form rendering can mismatch; needs a schema bundle in the pre-fetch step (§4.1). |

---

## 3. User flow

### 3.1 Pre-fetch (online, before leaving signal)
1. Inspector opens the app on Wi-Fi. App pulls the assigned worklist and, for each inspection
   marked *prepared*, downloads: inspection header, current answers, **form schema bundle**,
   site metadata, and the current server version.
2. A per-inspection "ready offline" badge is shown. An inspection without a successful
   pre-fetch cannot be opened offline (fail loudly, early — not silently).
3. Pre-fetch is opportunistic: any successful foreground sync also refreshes the prepared set.

### 3.2 Offline working (the core flow)
1. Inspector opens a prepared inspection. **All reads come from SQLite.** The network is never
   on the critical path for rendering or for saving.
2. Each edit is written locally **and** appended to the outbox in the same transaction, so a
   crash or a killed process can never produce "edited but not queued" or vice versa.
3. Photos are captured to app-private storage and enqueued as attachment uploads; capture never
   waits on the network.
4. Signature is captured last, stored locally, and marks the inspection as *ready to submit*.
5. Submit is a local state change (`submitted`) plus an outbox op. If offline, the UI states
   plainly: "Saved on this device. Will send when you have signal." It does **not** claim the
   inspection is accepted.

### 3.3 Intermittent connectivity
1. Sync triggers on: connectivity regained, app foreground, completion of a submit, periodic
   timer, and explicit "Sync now".
2. Sync is chunked and resumable (§6). Losing signal mid-sync leaves the outbox consistent and
   the next attempt continues; nothing is lost and nothing is double-applied.
3. The UI shows a single honest status per inspection: *Pending · Syncing (n/m) · Synced ·
   Needs your attention (conflict)*.

### 3.4 Conflict
1. If the supervisor changed something contested, the inspection moves to **Needs attention**.
2. The inspector sees a field-level diff: their value, the supervisor's value, and who changed
   it. They pick one (or escalate). The choice is written to the audit history.
3. Uncontested supervisor changes (e.g. reschedule) are merged in silently and surfaced as a
   passive notice.

### 3.5 Acceptance and purge
1. Server accepts → status `accepted`, server timestamp recorded.
2. Inspection becomes read-only on the device immediately.
3. A retention job removes local customer data at `accepted_at + 24h` (§9.4), writes a purge
   receipt, and reports it to the server so compliance has evidence.

---

## 4. Scope boundaries (contract with neighbouring teams)

**Mobile owns:** local schema, outbox, sync engine, conflict UI, capture, purge, client telemetry.
**Backend owns:** `/v2/sync` batch endpoint, change log/cursor, idempotency store, attachment
registration and presigned upload, server-side authoritative audit store, purge-receipt ingestion.
**Security/compliance owns:** threat model sign-off, retention semantics, purge evidence format.
**Out of everyone's scope:** real-time collaboration, offline reassignment UI (deferred).

**Hard boundary:** the existing REST API stays untouched for existing clients. Everything new is
additive under `/v2`. No existing endpoint's behaviour changes.

---

## 5. Local data model

SQLite remains the store, but it stops being a cache and becomes the **source of truth for the
device's working set**. The server remains authoritative for acceptance and for the audit record.

**Identity:** every locally created entity gets a client-generated **UUIDv7** (time-ordered,
sortable) as its primary key. `server_id` is nullable until first push. This removes all
offline ID allocation and collision problems.

| Table | Key columns | Notes |
|-------|-------------|-------|
| `inspection` | `client_id` PK, `server_id`, `server_version`, `status`, `assigned_to`, `form_schema_version`, `payload` JSON, `dirty`, `prefetch_complete`, `accepted_at_server`, `purge_due_at`, `purged_at` | One row per assigned inspection. `purge_due_at` derived from server time (§9.4). |
| `answer` | `client_id` PK, `inspection_id`, `field_id`, `value`, `server_version`, `updated_at_local`, `updated_by`, `dirty` | Field-level rows — required for field-level merge (§7). |
| `attachment` | `client_id` PK, `inspection_id`, `capture_order`, `local_path`, `byte_size`, `sha256`, `content_type`, `upload_state` (`queued/uploading/uploaded/failed`), `uploaded_bytes`, `server_attachment_id`, `captured_at` | Append-only. Photos have no conflict semantics. |
| `signature` | `inspection_id` PK, `blob_path`, `signer_name`, `captured_at`, `upload_state` | One per inspection; immutable once captured. |
| `outbox` | `seq` (monotonic), `op_id` UUIDv7 PK, `entity_type`, `entity_client_id`, `op` (`create/update/delete`), `base_version`, `payload`, `created_at`, `attempts`, `last_error`, `state`, `pushed` | The single source of unsent work. Never compacted while `pushed = 0`. |
| `audit_event` | `seq`, `event_id`, `inspection_id`, `actor_id`, `device_id`, `action`, `field_id`, `old_value_hash`, `new_value_hash`, `occurred_at`, `prev_hash`, `hash`, `synced` | Local hash chain (tamper-*evident*, not tamper-*proof*). Server copy is authoritative. |
| `conflict` | `inspection_id`, `field_id`, `local_value`, `server_value`, `server_actor`, `server_version`, `detected_at`, `resolution`, `resolved_at` | Human-resolution queue; drives the Needs-attention state. |
| `sync_state` | `key`, `value` | Pull cursor, last successful sync time, server clock offset, schema versions. |
| `purge_receipt` | `inspection_id`, `due_at`, `purged_at`, `method`, `rows_deleted`, `files_deleted`, `reported` | Evidence for the 24-hour obligation (§9.4). |

**Invariants (enforced in code and asserted in tests):**
- I1: A local mutation is visible locally immediately and is durable before the UI reports success.
- I2: `outbox` is append-only; an op is removed only after the server confirms it (or it is
  superseded by an explicit user discard).
- I3: An inspection with a non-empty outbox is never purged.
- I4: `answer` rows exist per field even when empty, so merge never has to guess "absent vs cleared".
- I5: Every row in `inspection`/`answer`/`attachment` is either `dirty=0` (matches server at
  `server_version`) or has at least one outbox op referencing it.

---

## 6. Sync protocol

Transport stays **REST + JSON** (matches existing server), with one new batch endpoint.

### 6.1 Pull (server → device)
- `GET /v2/inspections/changes?cursor=<change_seq>&limit=N` → ordered list of
  `{entity_type, entity_id, change_seq, version, deleted, payload}`, plus `next_cursor`.
- Requires a server-side **monotonic change log** (M3). If A3 is false, this becomes a
  per-inspection version comparison — acceptable, just less efficient.
- Pull is resumable via cursor; a partial page is safe to re-fetch.
- Applied locally by writing mirror rows and advancing the cursor **in one transaction**, so an
  interrupted pull never leaves half-applied state.

### 6.2 Push (device → server)
- `POST /v2/sync` with a batch:
  `{device_id, ops:[{op_id, entity_type, entity_client_id, op, base_version, payload}], attachments:[...]}`
- Server processes ops **in `seq` order per entity**, and for each returns exactly one of:
  - `applied` → `{server_id, version}`
  - `conflict` → `{current_version, current_field_values}` (client opens a `conflict` row)
  - `rejected` → `{reason}` (validation/business rule; surfaced to the user, never retried blindly)
- **Idempotency:** `op_id` is the idempotency key. The server stores applied `op_id`s for a
  retention window and replays the original response on duplicates. This is what makes
  intermittent connectivity safe: retries are free.
- On `applied`, the client updates `server_id`/`server_version` and rebases subsequent pending
  ops onto the new version.

### 6.3 Ordering and batching
- Ops are sent per-inspection, ordered by local `seq`. Cross-inspection order is irrelevant.
- Batch size is adaptive (start small; grow on success, shrink on failure) so a weak connection
  can still make progress rather than always timing out on a large batch.
- Record ops and attachment uploads are **independent queues**. A stuck photo never blocks
  answers or the signature from syncing, and vice versa.

### 6.4 Retry and backoff
- Exponential backoff with jitter; cap attempts; after cap, mark op `failed` and surface it
  (do not retry forever in the background and drain the battery).
- Retry policy distinguishes: network error (retry), 4xx validation (no retry), 409 conflict
  (no retry — needs a human), 5xx (retry with backoff).
- Transport-level coalescing only: contiguous un-pushed updates to the same field may be sent
  as one op, with superseded values preserved in `audit_event`. The outbox itself is not
  compacted until the ops are `pushed`.

### 6.5 Triggers
Connectivity-regained, app foreground, post-submit, periodic (while dirty), manual. Sync is
cancellable and safe to interrupt at any point.

### 6.6 Staleness and reassignment
If a pull reveals the inspection is reassigned away, or the form schema version changed, the
device blocks further local edits, preserves unsent work in the outbox, and tells the inspector
to contact their supervisor. It never silently discards work.

---

## 7. Conflict policy

**Policy:** deterministic, ownership-based **auto-merge** for disjoint field domains; explicit
**human resolution** for contested fields; **never** a silent overwrite. Whole-record
last-writer-wins is rejected because the audit history is regulatory (A5).

### 7.1 Ownership model (decided in §16-D2, but the plan assumes it)
- **Inspector owns:** findings, measurements, condition ratings, comments, photos, signature,
  completion state.
- **Supervisor owns:** assignment, schedule, scope/template, priority, and the accept/reject act.
- **Contested (never auto-merged):** any field in both domains, and any *acceptance* transition.

### 7.2 Detection
Server compares `base_version` from the op with the record's current version:
- Equal → apply.
- Not equal → fetch the field-level diff since `base_version`. For each field the op touches:
  - supervisor did not change it → apply.
  - supervisor changed it and it is inspector-owned → **conflict**, surface it.
  - supervisor changed a supervisor-owned field → their value wins, inspector's change is
    rejected with a clear notice (not silent).
This requires **field-level change metadata** server-side. If only record-level versions exist
today, M3 must add per-field `updated_at`/`updated_by` (see §16-D3).

### 7.3 Resolution
- Conflict row → "Needs attention" → field-level diff UI → inspector chooses *mine / theirs /
  escalate*. The choice is recorded in `audit_event` with both values retained.
- Resolution creates a new op with the **current** `base_version`, so it applies cleanly.
- An inspection with an unresolved conflict cannot be submitted. This is deliberate: it is
  better to block than to lose a supervisor's edit.

### 7.4 Audit
Every apply, merge, rejection, conflict, and resolution appends to `audit_event` locally
(hash-chained) and to the server on sync. The server's copy is the authoritative regulatory
record; the local chain exists so a device can prove it did not tamper with its own history
before upload.

---

## 8. Attachments and signature

### 8.1 Capture
- Photos go to **app-private storage**, never the shared camera roll (prevents leakage into
  gallery/backup and keeps them inside the purge boundary).
- Capture is local-only and never blocks on network. Each photo is assigned `capture_order`
  (client sequence) — order is preserved and never re-derived from timestamps.

### 8.2 Queue
- Separate `attachment` queue with `upload_state` and `uploaded_bytes`.
- `sha256` computed at capture for server-side dedupe and integrity verification.
- Uploads are ordered oldest-first but may be interleaved with record ops.

### 8.3 Upload
- **Presigned direct-to-object-store** upload (recommended, §16-D6): client requests an upload
  slot, PUTs the bytes, then registers the attachment via the sync endpoint. Keeps large payloads
  off the API tier.
- **Resumable/chunked** uploads with per-attachment progress, so intermittent connectivity
  resumes rather than restarts (this is what makes A8 survivable).
- A photo may be uploaded before, during, or after the record ops; the inspection's submit is
  only *complete* when all attachments report `uploaded`.

### 8.4 Storage and quota
- Budget per device (assuming A7): cap total attachment bytes and warn at a threshold.
- Eviction order: (1) purged inspections, (2) accepted-and-synced inspections, (3) oldest
  synced. **Never** evict anything with a non-empty outbox or an unpurged PII payload.
- Low-storage behaviour is explicit: block capture with a clear message rather than fail mid-write.

### 8.5 Signature
- Captured as a vector/bitmap blob plus signer name and capture time; treated as an immutable,
  single, non-conflicting artifact.
- Stored like an attachment (private storage, queued upload) but semantically part of the
  inspection record — the inspection cannot reach `submitted` without it.

---

## 9. Security and privacy

### 9.1 Threat model (owned by security; summarized here)
Adversary: someone with physical access to a lost/stolen tablet, or a malicious app on a
non-compliant device. Out of scope: a compromised server, a rooted device with live attacker.
Mitigation relies on MDM + platform encryption + short retention + remote wipe (A6).

### 9.2 At-rest protection
- OS-level encrypted storage + app-private file locations; no data in shared/backup-visible
  locations; `android:allowBackup`/iCloud backup excluded for the database and attachment dir.
- **Recommendation:** rely on platform encryption (simpler, well-tested) and add SQLCipher only
  if the threat model review concludes platform protection is insufficient (§16-D5).
- Credentials in the platform keystore/keychain; no tokens in SQLite or in logs.

### 9.3 Access control
- Offline session duration is bounded and MDM-configurable (§16-D4). After expiry the app
  requires re-authentication and **freezes** editing; already-captured data stays encrypted and
  unsynced rather than being discarded.
- Server-side kill switch: on next sync, the device honours a "wipe local data" directive
  (independent of MDM, for devices that are online but decommissioned).

### 9.4 The 24-hour local purge (compliance-critical)
- Clock starts at the **server-confirmed** `accepted_at` (A9, A11). The device stores
  `purge_due_at = accepted_at_server + 24h` using the server-anchored timestamp, not device time.
- Purge runs locally and **does not require network** — an offline device still purges on time.
- Purge deletes: inspection/answer rows, site PII, attachment and signature files, thumbnails,
  and derived caches; then writes a `purge_receipt` (non-PII: IDs, counts, timestamps, method)
  which is uploaded as compliance evidence.
- **Blocking rule (I3):** if the outbox for that inspection is still non-empty at the deadline,
  the purge does **not** silently delete and does **not** silently retain. It: (a) alerts the
  supervisor and compliance channel, (b) moves the data to an encrypted quarantine area, and
  (c) requires a supervised drain. This is the one place where the design accepts manual
  intervention in exchange for never losing an inspector's accepted work.
- Purge is verified by a test that reads back the freed space (§14).

### 9.5 Audit integrity
- Local `audit_event` chain: `hash = H(prev_hash || canonical(event))`. Tamper-evident, and any
  break is reported in telemetry. The **server** copy is the record that regulation relies on.
- No customer PII in logs, crash reports, analytics, or telemetry payloads.

---

## 10. Migration and backfill

### 10.1 Local schema
- Versioned migration runner (`schema_version` in `sync_state`), forward-only.
- New offline-authoritative tables are added **alongside** the existing cache tables; a short
  dual-read window validates parity before cutover, then cache tables are dropped in a later
  migration.
- **Downgrade rule:** a downgrade wipes the local mirror and re-pulls from the server. It is
  **blocked while the outbox is non-empty** — this is the one case where we refuse an
  automatic rollback (§13).

### 10.2 Backfill
- No historical offline data exists to migrate (A4): today's cache holds only synced state, so
  backfill is "re-pull from server", not "convert local edits".
- If A4 turns out to be false, M1 gains a one-time **salvage pass** that scans the cache for
  rows with local modifications and replays them as outbox ops before cutover. This must be
  settled before M1 exits.
- Pre-fetch backfill: on first launch after upgrade, the device re-pulls the assigned worklist
  and the form schema bundle so an inspector is never offline with a stale schema (A12).

### 10.3 Server
- Additive: change log table + `change_seq`, `op_id` idempotency store, attachment registration,
  `/v2/sync`. Backfill `change_seq` for existing rows in a batched offline job.
- Existing `/v1` endpoints unchanged; old clients keep working throughout.

---

## 11. Observability

**Client telemetry (no PII):**
- Sync: attempts, success/failure by result class, batch sizes, duration, retry counts.
- Outbox: age histogram, depth, oldest-op age (the single best "is someone stuck?" signal).
- Conflicts: count, per-field, resolution choice, time-to-resolution.
- Attachments: bytes uploaded, resume count, failure rate by stage.
- Storage: free space, attachment bytes, quota breaches.
- Purge: due count, purged count, **failures**, quarantine events.
- Audit: chain-verification failures (any occurrence is an incident).

**Server:** `/v2/sync` latency and result-code mix, idempotency replay rate (a rising replay
rate is a client retry bug, not a server bug), conflict rate per inspection, attachment upload
completion rate, purge-receipt ingestion lag.

**Dashboards and alerts (exit criteria for M9):**
- Alert: oldest outbox op older than threshold (someone cannot get their work in).
- **Page:** any purge failure or missed deadline — this is a compliance obligation, not a
  reliability metric.
- Alert: conflict rate spike (indicates the ownership model in §16-D2 is wrong).
- Alert: quota breach, audit chain break, idempotency replay spike.
- A compliance report listing, per inspection: accepted-at, purged-at, receipt received.

---

## 12. Staged rollout

Feature flags (server-controlled, per-cohort): `offline_enabled`, `sync_v2`, `attachment_resumable`,
`conflict_ui`, `purge_v2`. Each flag is independently killable.

1. **Internal:** engineering + QA on real tablets with an offline simulator (link conditioner).
   Exit: scripted scenario suite green, including kill-mid-sync and low-storage.
2. **Shadow:** inspectors in the pilot region run the new build with `offline_enabled` on but
   with sync *observability only*; no behaviour change for the server. Exit: telemetry shows
   pulls/pushes behave as predicted and no new crash class.
3. **Pilot:** a small, named, opt-in cohort of inspectors with a named supervisor, in the
   region that actually has basements. Exit criteria agreed up front: zero data-loss incidents,
   zero missed purge deadlines, conflict rate below the agreed threshold, and qualitative
   sign-off from the pilot supervisor.
4. **Percentage expansion:** ramp by cohort, holding at each step until the pilot exit metrics
   hold for a full inspection cycle.
5. **Broad:** flag on by default; keep the kill switch for one full cycle afterwards.

Each stage has **explicit exit criteria above**, not a date. The plan does not assert how long
any stage takes.

---

## 13. Rollback

- **Level 1 — flag off:** `offline_enabled=false` returns the app to today's online-only
  read-through behaviour for *new* sessions. Unsycned work is preserved and the app offers a
  drain: it blocks new offline edits and retries sync. Rollback at this level is blocked if any
  device reports a non-empty outbox that cannot drain (escalate → quarantine/export instead of
  discard).
- **Level 2 — server:** `/v2` endpoints are additive and versioned; disabling them affects only
  flagged clients. The idempotency store and change log are inert if unused and can be dropped
  after the migration window with no impact on `/v1`.
- **Level 3 — client schema:** forward-only rollback means wiping the local mirror and re-pulling.
  **Refused automatically while the outbox is non-empty** (§10.1). This is the only rollback step
  with data-loss potential, so it is gated, not automatic.
- **Drill requirement:** a rollback drill (including a non-empty-outbox rollback, which must
  *refuse*) is an exit criterion for M10, not an afterthought.

---

## 14. Testing strategy

- **Unit:** merge rules per ownership class; outbox ordering; retention clock arithmetic with
  skew; purge receipt generation; schema migration up/down.
- **Property-based / convergence:** generate random interleavings of inspector edits, supervisor
  edits, network drops, and retries; assert all replicas converge to the same state once sync
  completes and that no acknowledged write is lost. This is where conflict bugs actually surface.
- **Integration with a scripted fake server:** drop, throttle, HTTP 5xx, partial responses,
  duplicate deliveries (idempotency), out-of-order responses, killed app mid-sync, battery death.
- **Contract tests** for `/v2/sync` and attachment registration, run in CI for both sides.
- **Device/soak:** 40-photo inspection captured fully offline; low storage; low battery;
  background/killed app; airplane-mode toggling every few seconds during upload.
- **Security:** verify no PII in logs/backups/gallery; verify attachment files are unreadable
  after purge; verify offline session expiry behaviour.
- **Compliance:** purge fires within 24h across reboot, clock skew, device offline at the
  deadline, and app-never-reopened; assert bytes are actually unrecoverable.
- **Manual field test:** a real basement with no signal, using the pilot tablets — non-negotiable
  before stage 3 of §12.
- **Regression floor:** the existing online-only path must remain green throughout; offline is
  additive.

---

## 15. Milestones, dependencies, acceptance criteria

Sequence is dependency-ordered. Parallel tracks are marked. **No dates, no staffing.**

| # | Milestone | Depends on | Acceptance criteria |
|---|-----------|-----------|---------------------|
| M0 | Decisions closed: ownership matrix, threat model, retention semantics, sync contract spec | — | §16 decisions D1–D8 have written answers; threat model signed off; spec reviewed by mobile + backend. |
| M1 | Local persistence: offline-authoritative schema, migration runner, dual-read window | M0 | New tables land on an existing device without data loss; A4 verified or salvage pass shipped; rollback-blocked-on-outbox rule implemented and tested. |
| M2 | Outbox + sync engine (pull/push, idempotency, retry/backoff, adaptive batching) | M1, M3 | Scripted network suite passes; duplicate delivery never double-applies; interrupted sync resumes; convergence property tests green. |
| M3 | Server `/v2/sync`, change log/cursor, `op_id` idempotency, field-level change metadata | M0 *(parallel with M1)* | `/v1` untouched; idempotent replay returns the original response; `change_seq` backfilled for all existing rows; contract tests in CI. |
| M4 | Conflict detection + resolution UI + audit entries | M2, M3 | Every conflict class in §7.2 produces the predicted outcome; unresolved conflict blocks submit; both values recorded in the audit history. |
| M5 | Attachments: capture, private storage, queue, resumable chunked upload | M2, M3 *(parallel with M4/M6)* | 40 photos captured offline upload fully across simulated drops; resume never restarts from zero; a stuck photo does not block record sync. |
| M6 | Signature capture + immutable submission gate | M1 *(parallel with M5)* | Signature captured offline, persisted across app kill, uploaded once, inspection cannot submit without it. |
| M7 | Audit history: local hash chain + server-authoritative store | M2, M3 | Every mutation/merge/conflict/resolution appears server-side; chain break detected and reported; no PII in telemetry. |
| M8 | Retention: 24h purge, quarantine path, purge receipts | M1, M7 | Purge verified within 24h offline, across reboot and clock skew; outbox-non-empty path alerts and quarantines instead of deleting; receipts ingested and reportable. |
| M9 | Observability: client telemetry, server metrics, dashboards, alerts, compliance report | M2 *(start early, land here)* | All §11 signals emitted; purge-failure alert pages; outbox-age and conflict-rate alerts firing correctly in a drill. |
| M10 | Rollout readiness: flags, kill switch, rollback drills, field test | M4–M9 | Rollback drill passes including the *refused* rollback case; basement field test complete; pilot exit criteria written and agreed with the pilot supervisor. |
| M11 | Pilot → staged expansion | M10 | Each §12 stage meets its exit criteria before advancing. Broad rollout only after a full cycle at the previous step. |

**Critical path:** M0 → M3 → M2 → M4 → M10 → M11. M5/M6/M8 are the main parallelizable risk.
M8 is on the critical path for *compliance* even though it is not for the happy path.

---

## 16. Decisions required before implementation

Each row: the question, why it blocks, and the recommendation. **These must be answered before
M0 exits**; several change the size of M3 and M4.

| ID | Decision | Why it blocks | Recommendation |
|----|----------|---------------|----------------|
| D1 | Conflict granularity: field-level or record-level? | Determines whether M3 needs field-level change metadata and whether M4 is a diff UI or a "start over" prompt. | **Field-level.** Record-level would force discarding an entire inspection on any concurrent supervisor edit; that fails the audit requirement and would sink the pilot. |
| D2 | Who owns which field? (the ownership matrix) | The entire auto-merge policy (§7.1) is empty without it. This is the highest-value 30 minutes of the whole project. | Write an explicit matrix with the supervisor group: inspector owns findings/measurements/photos/signature; supervisor owns assignment/schedule/scope/acceptance; contested fields listed by name. |
| D3 | Does the server have field-level `updated_at`/`updated_by` today? | If not, M3 grows a real migration. | Assume **no**; budget M3 to add it. Verify in M0 — it is cheap to check and expensive to assume wrong. |
| D4 | Maximum offline session length before re-auth? | Affects auth token lifetime, MDM config, and the "frozen but not discarded" behaviour. | **7 days, MDM-configurable**, with immediate re-auth required after a device wipe signal or on policy change. Pick a number that is defensible to compliance, not convenient. |
| D5 | Platform encryption only, or add SQLCipher? | Drives M1 work and key management. | **Platform encryption + app-private storage**, with SQLCipher only if the threat model review says otherwise. Do not add application crypto on a hunch. |
| D6 | Attachment upload: via API or presigned direct-to-blob? | Affects API tier load and whether chunking is feasible. | **Presigned direct-to-object-store** with resumable chunks. Proxying ~150 MB per inspection through the API tier will not hold up. |
| D7 | Photo fidelity: full-resolution upload, or compressed + thumbnail-first? | Storage, bandwidth, and whether regulations accept anything less than the original. | **Full resolution is the record; upload a thumbnail first** for supervisor preview, then full-res. Confirm with compliance that the original must be retained server-side. |
| D8 | What is the authoritative start of the 24-hour clock? | Compliance; A11 says the device clock is unusable. | **Server-confirmed `accepted_at`.** The device schedules purge from the server timestamp with skew correction. |
| D9 | Purge vs unsynced accepted work (I3 conflict)? | The one case where compliance and data preservation collide. | **Never silently delete, never silently retain:** alert, quarantine encrypted, require supervised drain. Get written compliance sign-off on this path. |
| D10 | Submit offline, or must it sync first? | Shapes the status model and whether "accepted" exists offline. | **Allow queued submit offline**, but `accepted` is server-only (A9). The UI must never imply acceptance while offline. |
| D11 | Does the audit requirement permit a non-PII purge receipt? | If not, §9.4 and M8 must be redesigned to leave zero residue. | Assume **yes** (A10) and confirm in M0; if no, escalate before M1 — this changes the data model. |
| D12 | Device storage quota and eviction order? | Prevents a tablet filling up mid-inspection. | Cap total attachment bytes; evict purged → accepted+synced → oldest synced; never evict unsynced or unpurged. |

**Not blocking, but should be answered during M0:** pilot cohort selection and size; which
region has real basements; and whether offline reassignment (§6.6) needs a UI or a support
runbook for the pilot.

---

## 17. Known gaps

- This plan assumes the server can add a change log and idempotency store. If the backend is
  constrained, push must fall back to per-entity version comparison and the pull cursor becomes
  per-inspection — workable, but M3 grows.
- Signature *verification* and anti-fraud controls are out of scope here; if regulation requires
  stronger signature assurance, that is a separate milestone.
- The plan does not cover the web supervisor's view of "inspection is being edited offline."
  A minimal signal (last device sync time) is recommended but is not specified here.
