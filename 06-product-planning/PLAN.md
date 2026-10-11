# Plan: Offline Inspection Sync

Input: `BRIEF.md` only. No dates or staffing estimates are given; work is sequenced
as milestones with dependencies instead. Every assumption is stated explicitly so
it can be challenged before implementation.

## 1. Assumptions (explicit)

These are assumptions, not facts. Each is revisited in the "Open decisions"
section where a recommendation is made.

- **A1 — Platform.** "Company-managed tablets" means a managed fleet (MDM-enrolled)
  running a known, recent OS version. The app is native and can access local
  storage, secure keystore, and background OS facilities.
- **A2 — Server extensibility.** The existing REST API can gain new endpoints
  (batch/delta pull, patch push, resumable attachment upload) without breaking
  existing web clients. Integer record versions already give us optimistic
  concurrency control per record.
- **A3 — Single field editor.** An inspection is worked in the field by exactly
one
  inspector at a time; concurrency comes only from supervisors editing from the
  web. Inspectors do not edit each other's inspections.
- **A4 — Conflict rarity.** Supervisor/web edits during an active field session
  are the exception, not the norm. Conflicts will be rare enough that a
  merge-review screen (not a collaborative editor) is acceptable. Product has
  explicitly ruled out a full collaborative editor.
- **A5 — Attachment budget.** "Up to 40 photos" per inspection; assuming ~3–8 MB
  per compressed photo, an inspection's attachments total roughly 100–300 MB.
  Signature is a small image/PDF.
- **A6 — Connectivity pattern.** Offline stretches of hours (basement), then
  short, possibly weak connectivity windows. Sync must make progress in
  windows measured in seconds and must tolerate mid-transfer drops.
- **A7 — Compliance interpretation.** "Removal of local customer data within 24
  hours after acceptance" is satisfiable by purging on the device when the
  acceptance event is observed locally, backed by fleet-level monitoring. This
  is a legal interpretation and must be confirmed with compliance (see D1).
- **A8 — Audit semantics.** Every field change, photo capture, signature capture,
  and state transition must produce an immutable audit event that eventually
  reaches the server; local audit events are as binding as server ones until
  synced.
- **A9 — Forms are versioned.** A form definition is frozen per inspection at
  assignment/checkout; the server does not mutate a form definition under an
  in-progress inspection.
- **A10 — Device check-in expectation.** Fleet policy can require devices to
  reach the network at least once per working day (charging station, vehicle,
  office). This bounds how stale a device and how late a purge can be.

## 2. User flow (field inspector)

1. **Pre-departure (online).** Inspector opens the app; assigned inspections
   ("work package": inspection records + frozen form definitions + customer
   context + prior attachments metadata) sync down and are marked
   *available offline*. UI shows a clear "Ready for offline" state per
   inspection, including attachment completeness.
2. **In the basement (offline).** Inspector opens an assigned inspection, fills
   forms, takes up to 40 photos, collects the signature. Everything is written
   to the local store first (local is the system of record while offline).
   Nothing can be lost on connection drop — the current "lost connection
   discards notes" failure mode is eliminated by construction because writes
   never depend on the network.
3. **Connectivity returns (intermittent).** Sync runs opportunistically in the
   background: audit events and form edits push first (small, high value), then
   attachments upload with resume. Progress is visible in a sync status screen.
   If a supervisor edited the same inspection, a conflict review screen appears
   (see §6).
4. **Acceptance.** Inspection is marked complete/accepted (by supervisor on
   web, per current process). Once the acceptance event is observed on the
   tablet, a 24-hour purge timer starts locally; customer data and attachments
   are deleted and the deletion is itself audit-logged and reported.

Supervisor web flow is unchanged except: (a) a soft indicator when an
inspection is checked out offline, and (b) the conflict/merge behavior in §6.

## 3. Scope boundaries

**In scope**

- Offline open/read of assigned inspections, form fill, photo capture (≤40),
  signature capture.
- Two-way sync of structured edits and attachments for assigned inspections.
- Conflict detection and a review UI (not collaborative editing).
- Audit history for all local mutations; local purge after acceptance.
- Pilot for a limited inspector cohort with a kill switch.

**Out of scope (explicitly)**

- Real-time collaborative editing or presence (ruled out by product).
- Offline access to anything beyond the inspector's assigned work package
  (the store stays a bounded cache for everything else).
- Editing inspections not assigned to the signed-in inspector.
- New backend platform work beyond new REST endpoints; no event bus, no CRDT
  infrastructure.
- Offline user administration, reassignment, or scheduling flows.
- Push notifications / server-initiated commands to offline devices (a device
  only learns about server changes when it pulls).

## 4. Local data model

SQLite stops being a read-through cache and becomes a first-class store for
assigned inspections, with the server still the ultimate system of record.

Tables (logical):

- `inspection` — server fields + `local_state` (synced / dirty / conflicted),
  `base_version` (integer server version per record, used for optimistic
  concurrency), `form_version` (frozen definition).
- `form_answer` — one row per question: `inspection_id`, `question_id`,
  `value`, `base_version`, `dirty`. Row-per-question is what makes field-level
  merge possible without diffing opaque blobs.
- `attachment` — `client_uuid`, `inspection_id`, `kind` (photo | signature),
  `content_hash` (SHA-256), `bytes`, `capture_ts`, `upload_state`
  (pending / uploading / uploaded / failed), `uploaded_chunks`.
- `audit_event` — append-only: `client_uuid`, `inspection_id`, `entity`,
  `entity_id`, `mutation`, `payload_digest`, `client_ts`, `synced` flag. Never
  updated, never compacted locally.
- `outbox` — ordered pending operations with `idempotency_key` (client UUID),
  `type`, `payload`, `attempts`, `next_attempt_at`. All pushes flow through it;
  the audit log records what happened, the outbox records what must still be
  sent (they are not the same thing).
- `meta` — schema version, last-pull cursors per record type, device install
  id.

Attachment bytes: photos live as files in app-private storage with the row
above as metadata; the `content_hash` plus `bytes` lets the server dedupe.
Rationale in D2. Signature is stored the same way but is immutable after
capture (any correction is a new signature plus a supersede audit event).

Migration/backfill of the existing cache (§9) is a schema-version bump that
(1) creates the new tables, (2) keeps existing cached read-only data only if it
is still needed for the work package, and (3) never fabricates `base_version`
values — a record gets a real version only after a pull.

## 5. Sync protocol

Pattern: **pull-delta + push-outbox**, both batched, both idempotent, both
resumable. Server remains authoritative; the client never trusts its own clock
for ordering.

**Pull.** Per record type, "give me everything changed since cursor"
(cursor = max integer version seen for that type, per assignment scope). Pull
runs before push at each sync attempt so the client rebases on fresh state.
Server returns records with versions and soft-deletes/tombstones. Response is
chunked so a weak link can complete a pull in several windows.

**Push.** Outbox drains oldest-first within a priority order: audit events →
form answers → attachment metadata → attachment bytes. Each operation carries a
client-generated idempotency key; the server keeps a short idempotency cache so
replayed operations after a dropped response are safe. Form-answer pushes carry
`base_version`; the server either applies (returning the new version) or
returns 409 with the current server record (see §6).

**Attachments.** Chunked, resumable upload over REST: init (hash, size,
kind) → upload chunks by index with byte-range verification → commit. Chunks
are small enough (order 256 KB–1 MB) that a few seconds of connectivity makes
progress. Downloads of pre-existing attachments use plain HTTP range requests
into the same store. Hash-based dedupe on both sides.

**Cadence.** Sync triggers: app foreground, connectivity change, periodic
backoff while dirty data exists, manual "Sync now". Everything is safe to kill
mid-flight; SQLite commits are transactional per operation batch and chunk
uploads are individually acknowledged.

**Clocks.** Client timestamps are advisory metadata only. Ordering and
conflict detection use server-assigned versions; audit events are ordered by
(client sequence, server receipt). Devices with badly skewed clocks must not be
able to affect any decision.

## 6. Conflict policy

Two sources of concurrency: supervisor (web) vs inspector (tablet), because
A3 rules out inspector-vs-inspector.

- **Different fields:** merge cleanly. Row-per-question answers + integer
  versions make this a non-event; both sides' writes apply.
- **Same field, both changed since the common base:** server rejects the
  tablet's push with 409 + current server value. Client marks the answer
  `conflicted`, keeps both values (local + server), and shows a review screen
  when the inspector next opens the inspection. The reviewer picks one value or
  re-enters it; the resolution is itself an audit event.
- **Structural conflicts** (inspection accepted on web while tablet still
  edits): acceptance wins. Tablet moves to read-only with a clear message;
  unpushed edits are preserved in the audit log and surfaced to the supervisor
  rather than silently dropped.
- **Attachments never conflict.** Photos/signatures are append-only
  (client UUID identity), so concurrent capture is impossible by construction.
- **No last-writer-wins by timestamp, no automatic same-field overwrite.**
  Same-field collisions always surface to a human. This is the "no
  collaborative editor" line: we detect and review, we don't merge prose.

Supervisor side: when an inspection is checked out, the web shows "being edited
in the field" as a soft warning (no hard lock — see D5).

## 7. Security

- **At rest.** Structured data in SQLCipher (or platform equivalent) with the
  key in the hardware-backed keystore/keychain; photo files in app-private
  storage relying on OS per-app file-based encryption, with keys non-exportable
  and unusable on a different device. No customer data in shared storage,
  logs, analytics, or screenshots-able cache locations.
- **In transit.** TLS only, certificate pinning optional (decide with security
  team), no new crypto of our own.
- **Auth.** Existing session mechanism; offline sessions use a locally stored
  token/refresh material per current app policy — flag if tokens expire faster
  than a field day (see D7). No offline auth bypass; the work package is
  scoped to the signed-in inspector.
- **Device loss.** MDM remote wipe + the 24h purge (§8) bound exposure. A
  device reported lost gets its sessions revoked server-side; work-package
  pull tokens can be scoped per assignment so revocation is fast.
- **24-hour purge.** When acceptance is observed locally (via pull), schedule
  purge of that inspection's customer data and attachments at
  `acceptance_observed_ts + 24h` (or earlier at next sync after 24h from
  server-acceptance — see D1). The purge: deletes rows + files, writes a
  `local_purge` audit event, reports purge completion to the server so
  compliance can see devices that are overdue. Nothing is ever "hidden but
  recoverable" — files are overwritten/deleted, not merely unlinked where the
  OS allows.
- **Signature integrity.** Signature image + capture timestamp + inspector
  identity are hash-chained into the audit event so tampering is detectable.

## 8. Migration / backfill

- **Server.** New endpoints are additive (delta pull, outbox apply, chunked
  attachment upload, purge report). Integer-version machinery is reused
  everywhere; existing web clients are untouched. Server must add: idempotency
  cache, per-inspection attachment manifest, form-definition versioning if not
  already present (A9).
- **Client schema migration.** Bump SQLite schema version; create new tables;
  do not attempt to "upgrade" cached rows into versioned editable rows —
  old cache content is discarded and replaced by the first full pull. This
  avoids fabricating versions and keeps the migration trivial to reason about.
- **Backfill.** No server backfill of historical data is needed: offline
  capture only applies to newly assigned inspections. Existing inspections
  in flight at rollout simply stay online-only until they complete.
- **Form freeze.** At rollout, ensure assignment time snapshots the current
  form definition version so A9 holds; if the server doesn't support this
  today, it is a server prerequisite (M1 dependency), not a client concern.

## 9. Observability

Client (batched, uploaded with sync, never blocking it):

- Sync outcomes per attempt (pull ok/fail, push ok/fail/409), queue depths by
  type, oldest unsent item age ("data staleness").
- Attachment upload progress distribution: chunk retries, throughput, time to
  fully sync an inspection after capture.
- Conflict rate: fraction of pushed answers that 409, per inspection.
- Purge: acceptance-observed → purge-completed latency distribution and
  count of overdue purges (the compliance SLA metric).
- Offline session length, storage usage, migration success, crash reports.

Server:

- Idempotency-cache hit rate (replay storms indicate flaky links).
- Delta-pull and chunk-upload success rates and latency; per-device last-seen
  to detect dark devices (feeds D1 risk).
- 409 rate and merge-review completion rate (tells us if A4 is wrong).

Dashboards exist before the pilot (M6), because the pilot's go/no-go depends
on these numbers.

## 10. Staged rollout

1. **Internal dogfood.** Engineering + friendly supervisors with synthetic and
   real assignments; airplane-mode drills are part of normal testing.
2. **Pilot cohort.** One region/team of inspectors, chosen to include the worst
   basements. Explicit success criteria (below) evaluated over multiple weeks
   of real work.
3. **Staged broad rollout.** Percentage/ring-based by team, each ring gated on
   the same metrics with no regression.
4. **Kill switch.** A server-delivered flag disables offline capture and
   reverts the app to the current online-only behavior (store back to
   read-through semantics). The flag must be honored at app start and at sync
   time.

Pilot success criteria (acceptance gate to broad rollout):

- Zero data-loss reports of field-captured content (the current bug class).
- ≥99% of inspections fully synced (including all attachments) within one
  working day of capture, with the long tail understood.
- Conflict rate consistent with A4 (a few percent of inspections at most);
  all conflicts resolved through the review UI without support tickets.
- 100% of accepted inspections purged locally within 24h of observed
  acceptance, with zero compliance findings.
- Crash-free session rate not worse than the online-only baseline.

## 11. Rollback

- **Client.** Kill-switch flag returns the app to online-only; pending outbox
   content is either flushed first (preferred) or preserved on device until
   data can be recovered — never silently deleted by a rollback. The new
   schema must be tolerated by the old code path (additive tables, cache
   tables still populated for read-through).
- **Server.** Additive endpoints can be disabled by flag; old clients never
   call them. Disabling outbox-apply strands pending client data, so server
   rollback pairs with the client kill switch and a comms plan, and uses the
   same outbox-drain-first rule.
- **Data.** The purge is the only destructive client operation; it has its own
   safeguard (audit event + server acknowledgment) and is excluded from
   rollback paths. Server data written by sync is normal audited data; no
   special rollback needed beyond standard correction flows.

## 12. Testing

- **Sync engine unit tests** (deterministic, simulated transport): drop,
  delay, duplicate, and reorder every message; idempotency-key replays;
  cursor rollback; kill mid-batch at every boundary. Property/fuzz tests on
  outbox ordering and priority.
- **Conflict tests** (table-driven): matrix of {web-only, tablet-only, both,
  same-field, different-field, accept-races-edit} — assert exact final state
  and audit content.
- **Clock-skew tests:** devices with skewed clocks cannot win conflicts or
  corrupt audit ordering.
- **Attachment tests:** 40-photo inspections over simulated intermittent
  links; resume after kill at every chunk boundary; dedupe by hash; low-disk
  and corrupted-file handling.
- **Purge tests:** timer firing, purge idempotency, overdue-purge alerting,
  verification that files (not just rows) are gone; purge runs even if the
  device never syncs again until reconnect.
- **Migration tests:** upgrade from the shipping cache schema from every
  recent released version; fresh-install path.
- **Audit correctness tests:** audit log is append-only under adversarial
  sequences; every mutation produces exactly one event; signature hash chain
  verifies.
- **End-to-end/field tests:** scripted airplane-mode drill (open → fill → 40
  photos → signature → offline accept race → reconnect); real basement days
  during dogfood and pilot.
- **Server tests:** idempotency cache under replay; delta pull correctness
  across concurrent version assignment; load test of chunked upload at pilot
  cohort scale.

## 13. Milestones (ordered by dependency; no dates)

- **M0 — Decisions locked.** D1–D8 (below) answered and written down; compliance
  sign-off on the purge interpretation (D1) and security sign-off on §7.
  *Blocks everything.*
- **M1 — Server prerequisites.** Delta-pull endpoints with per-type cursors;
  form-definition freeze at assignment; idempotency cache design;
  attachment manifest. *Depends on M0. AC: web client unaffected; delta pull
  returns correct changes incl. tombstones; form version frozen per
  assignment.*
- **M2 — Local store foundation.** New SQLite schema, migration from shipping
  cache, encryption at rest, append-only audit log, work-package pull (online
  only, no offline editing yet). *Depends on M1. AC: upgrade from shipping
  app version works; work package fully browsable after airplane mode;
  audit events recorded for reads-by-assignment and pushes; zero fabricated
  versions.*
- **M3 — Offline capture.** Forms, photos, signature fully offline via local
  writes; the old "connection loss discards notes" path is removed. *Depends
  on M2. AC: airplane-mode end-to-end capture drill passes; kill the app at
  any point with no loss; 40-photo inspection stored within device budget.*
- **M4 — Sync engine.** Outbox push, 409 handling, chunked resumable
  attachment upload, sync status UI. *Depends on M3 (and M1 endpoints).
  AC: intermittent-link simulation fully drains an inspection including 40
  photos; idempotent replays safe; crash at any boundary resumes.*
- **M5 — Conflicts & supervisor concurrency.** Conflict review UI, web "being
  edited in the field" indicator, accept-races-edit handling. *Depends on M4.
  AC: conflict matrix tests pass end-to-end against real web edits; no
  silent drops; resolution audit-logged.*
- **M6 — Compliance & purge.** 24h purge timer, purge acknowledgment,
  overdue-purge alerting. *Depends on M4 (acceptance arrives via pull).
  AC: purge tests pass; compliance demonstrates the flow on a real device.*
- **M7 — Observability & flags.** Client telemetry, dashboards, kill switch. 
  *Depends on M4 (metrics ride on sync). AC: dashboards live for all §9
  metrics; kill switch verified to revert a pilot build.*
- **M8 — Dogfood.** Internal field use including real basements. *Depends on
  M5–M7. AC: no data loss; drill checklist executed; conflict and purge
  metrics collected.*
- **M9 — Pilot.** External cohort under the §10 criteria. *Depends on M8.
  AC: all five pilot success criteria met; go/no-go review documented.*
- **M10 — Broad rollout.** Ring-based rollout, each ring gated on unchanged
  metrics. *Depends on M9.*

Rollback readiness (verified kill switch + drain-first rule) is an entry
criterion for M9, not an afterthought.

## 14. Open decisions (must be made before implementation)

| # | Decision | Options | Recommendation |
|---|----------|---------|----------------|
| D1 | When does the 24h purge clock start, and what happens if the device is offline past the deadline? | (a) server-acceptance time, device must be forced online; (b) local observation of acceptance; (c) hybrid | **(b) + monitoring**: purge at `observed + 24h`, plus per-device last-seen alerting and a fleet policy requiring daily check-in (A10). Forcing devices online (a) is operationally unrealistic in basements; but get compliance to confirm (b) satisfies the regulation — this is a legal question, not an engineering one. |
| D2 | Photo bytes: SQLite blobs vs files+metadata | (a) blobs in DB; (b) files in app-private storage, metadata in SQLite | **(b)**: 40 photos ≈ 100–300 MB would bloat the DB and WAL, slow commits, and make encrypted backups clumsy; per-file OS encryption (hardware-backed) is simpler and streaming-friendly. Trade-off (two stores to keep transactionally consistent) is manageable with the content-hash as the join key and orphan sweeps. |
| D3 | Same-field conflict resolution | (a) last-writer-wins by timestamp; (b) server 409 + human review screen; (c) field-level 3-way auto-merge | **(b)**: matches "no collaborative editor", keeps humans accountable for audit-relevant answers, and is far cheaper than (c). LWW-by-clock (a) is unacceptable for regulated data given skew. |
| D4 | Should supervisor web edits be blocked while an inspection is checked out? | (a) hard lock; (b) soft indicator only; (c) nothing | **(b)**: hard locks create deadlocks when a tablet is lost/broken; doing nothing invites avoidable conflicts. The soft indicator plus D3 review covers the residual risk. |
| D5 | Attachment upload transport | (a) plain multipart retries; (b) chunked resumable REST upload (tus-like) | **(b)**: with seconds-long connectivity windows, (a) restarts 100 MB uploads on every drop and the pilot will drown in failed syncs. (b) costs one server endpoint and pays for itself in the first basement. |
| D6 | Push ordering guarantee | (a) strict per-inspection FIFO; (b) priority classes (audit → answers → attachments) | **(b)** with FIFO within a class: audit events and answers are tiny and must never be starved behind 300 MB of photos; attachments are idempotent and resumable so reordering them is harmless. |
| D7 | Offline session/token lifetime | extend token TTL vs local re-auth material | Depends on current auth design (unknown from brief). **Recommendation:** verify a session survives a full offline field day; if tokens expire sooner, add a renewable offline credential scoped to the work package rather than extending global token TTL. Needs security sign-off at M0. |
| D8 | Pilot device scope | whole fleet vs newest subset | **Newest-hardware subset** for the pilot: encryption-at-rest guarantees (D2) and storage budgets are safest there; expand rings only after metrics hold. |

## 15. Risks not covered elsewhere

- **Regulatory:** D1 is the largest compliance risk; if compliance insists on
  server-time deadlines, we need forced-sync or cryptographic remote-delete
  designs, which change scope materially.
- **Storage:** worst case (40 photos × many inspections per day) needs a
  device storage budget and an eviction policy for *uploaded* attachments —
  evict-after-upload must not violate the audit requirement (audit events
  remain; bytes can go once the server has acknowledged them).
- **Flaky-clock devices** corrupting ordering — mitigated by server-version
  authority (§5) and tested explicitly (§12).
