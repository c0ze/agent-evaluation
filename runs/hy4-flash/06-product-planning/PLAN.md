# Plan — Offline inspection sync for company tablets

## 0. Grounding and how to read this plan

The only product input is `BRIEF.md`. Everything below is either a fact stated in the
brief or an explicit engineering assumption, labelled **[A#]**. Where the brief is
silent (definitions, thresholds, server capabilities), this plan states an assumption
and, in §12, the decision that must be confirmed before implementation starts.

The brief's fixed constraints: inspectors work on company-managed tablets with no
signal in basements; today a dropped connection after opening an inspection can
discard notes; required offline capabilities are open assigned inspections, fill
forms, take up to 40 photos, and collect a signature; connectivity is intermittent;
supervisors can edit the same inspection from the web; regulations require an audit
history and removal of local customer data within 24 hours of an inspection being
*accepted*; server APIs are REST with integer record versions; SQLite exists but is a
read-through cache; a pilot precedes broad rollout; no full collaborative editor.

---

## 1. Explicit assumptions

| ID | Assumption | Why it matters / if false |
|----|------------|---------------------------|
| A1 | "Accepted" is a server-side state transition that produces an authoritative acceptance timestamp. | Drives the 24 h deletion clock. If acceptance is local-only or has no timestamp, the compliance design changes (§9, §12-D2). |
| A2 | The 24 h clock is measured from the server acceptance timestamp, but the device can only act on what it has synced. | A device that stays offline past the deadline cannot learn of acceptance. The plan adds an independent capture-time backstop (§9). |
| A3 | All inspection content — form answers, photos, signature, and metadata that identifies a customer/site — counts as "customer data" subject to deletion. Aggregate counts and non-identifying IDs may be retained for compliance proof. | If the definition is broader (e.g. device logs), retention changes (§9, §12-D2). |
| A4 | The REST API can be extended (or wrapped) to expose the integer version on reads, accept a base version on writes and return 409 on mismatch, accept idempotency keys, ingest audit events, and accept blob uploads. | Optimistic concurrency and replay safety depend on this (§5, §12-D3). If not possible, a thin sync service is required. |
| A5 | Inspections and their forms are addressable by a stable form/schema version, and assignments can be fetched while online for offline use. | Needed to render and validate forms offline (§4). |
| A6 | A tablet can cache photos for up to 40 per inspection within device storage, with on-device compression to a configured size. | Bounds storage and upload cost (§7, §12-D6). |
| A7 | Device clocks are not trustworthy (offline drift/skew); both client and server-observed timestamps are recorded. | Affects audit fidelity and the deletion backstop (§9, §11). |
| A8 | The existing SQLite cache contains no unsaved user edits worth migrating; it is derived data. | Migration treats cached rows as read-only base, never as drafts (§10). Must be verified before M1. |
| A9 | Offline auth is possible with a cached, short-lived token and re-authentication on reconnect. | Required to open assigned inspections without signal (§8, §12-D4). |

---

## 2. User flow (offline-first)

1. **Pre-field (online):** app refreshes the list of inspections assigned to the
   inspector and their form definitions; this is the last known-good base.
2. **Enter basement (offline):** inspector opens an assigned inspection. The app
   reads it from the local store; a clear "Working offline — changes saved on this
   device" indicator is shown. Opening the inspection never discards prior notes.
3. **Fill & capture:** form answers are saved locally as they are made (debounced
   writes), not held only in memory. Photos (up to 40) and a signature are captured
   to encrypted local files and registered in the local model. All actions emit local
   audit events.
4. **Intermittent signal:** when connectivity appears, sync runs in the background
   (§5). Partial success is normal; the UI shows per-record state: saved locally /
   syncing / synced / needs review (conflict).
5. **Submit:** the inspector marks the inspection complete; submission is itself a
   queued operation and is confirmed only once acknowledged by the server. Offline
   submission is allowed and reconciled later.
6. **Acceptance & purge:** once the server records acceptance, the device learns of
   it on a later sync and purges local customer data within 24 h (§9). The inspector
   sees a neutral "inspection accepted; local copy removed" state with no customer
   data.

**Non-goals in the flow:** no real-time co-editing, no presence, no simultaneous
character-level merging. Resolution of overlapping edits happens asynchronously on
the web (§6).

---

## 3. Scope boundaries

**In scope:** durable local storage of assigned inspections and drafts; offline form
entry, photos and signature; a resumable sync protocol with optimistic concurrency;
a deterministic conflict policy; attachment lifecycle; local encryption and secure
deletion; audit-event capture and replay; migration of the existing cache;
observability; pilot/rollout, rollback and testing.

**Out of scope (explicit):** building a collaborative editor (OT/CRDT, live cursors);
changing supervisor web UX beyond a conflict-review view; changing the regulatory
definition of acceptance; new server features beyond the minimal sync primitives in
§12-D3 (unless a wrapper service is chosen); support for non-company or rooted devices
(v1); background sync while the app is force-stopped by the OS.

---

## 4. Local data model (SQLite)

The current read-through cache becomes a durable, opinionated local store. New
objects (additive schema migration, §10):

- **`inspection`** — mirror of a server record: `id`, `base_version` (integer version
  from last successful pull), `server_fields` (JSON), `form_schema_version`,
  `sync_state` ∈ {clean, dirty, conflicted, submitted}, `local_updated_at`,
  `last_server_updated_at`. One row per inspection.
- **`form_answers`** — `inspection_id`, `field_id`, `value`, `updated_at`,
  `origin` (inspector/web/base). Stored per-field so the conflict policy (§6) can
  merge at field granularity; answers reference `form_schema_version`.
- **`outbox`** — append-only queue of pending operations: `op_id` (client-generated
  UUID, idempotency key), `inspection_id`, `op_type`, `payload`, `base_version`,
  `client_timestamp`, `attempts`, `status`, `last_error`. Ordered by creation. This is
  the single source of truth for unsynced work.
- **`attachment`** — `attachment_id` (client UUID, idempotency key),
  `inspection_id`, `local_path`, `mime`, `byte_size`, `checksum`, `kind`
  (photo|signature), `capture_timestamp`, `status` ∈ {pending, uploading, uploaded},
  `server_attachment_id`.
- **`audit_event`** — append-only: `event_id` (client UUID), `inspection_id`, `actor`,
  `action`, `client_timestamp`, `sequence`, `details`. Replayed to the server; never
  rewritten.
- **`sync_meta`** — device ID, incremental sync cursor/watermark, last successful
  sync, schema version.
- **`deletion_ledger`** — non-customer-data proof of purge: inspection ID, capture
  and acceptance timestamps, purge timestamp, record hash. Retained after content is
  deleted to demonstrate compliance (§9).

**Invariants:** outbox rows are never deleted until the server acknowledges the op;
an inspection can only leave `conflicted` after resolution; attachment rows are only
deleted after the referenced record is safely synced or after a purge; all writes
that span tables happen in a single SQLite transaction.

**Atomicity with files:** write media file to a temp path, then update the `attachment`
row in a transaction, then rename to final path; an orphan-file sweeper cleans temp
files left by a killed process. The reverse (row without file) is repaired by
discarding the row and re-prompting, never by silently losing a photo.

---

## 5. Sync protocol

**Primitives (assuming A4):** incremental pull (changes since cursor), conditional
write carrying a base integer version, idempotency keys on writes and uploads, audit
event ingestion, and blob upload.

**Cycle** (triggered by connectivity return, app foreground, or manual "Sync now"):

1. **Pull** changes since the stored cursor. Apply clean records; for records with
   local pending ops, retain them and move to conflict evaluation.
2. **Reconcile:** for each dirty inspection, compare `base_version` to the server's
   current version.
   - Equal → local ops can be applied as a fast-forward.
   - Different → mark `conflicted`, pause its outbox ops; do not auto-overwrite (§6).
3. **Push** outbox ops in order for non-conflicted records. Each write carries
   `base_version` and a unique `op_id`. Server applies conditionally; a 409 with the
   current version triggers reconciliation (step 2) rather than a blind retry. Any
   non-error response with the op acknowledged removes the op from the outbox.
4. **Upload** attachments independently, blobs-first, keyed by `attachment_id`;
   already-uploaded blobs are skipped by idempotency. Record commits reference
   server attachment IDs. Orphan blobs from abandoned records are cleaned by a
   server job.
5. **Advance** the pull cursor only after a complete successful cycle. Partial
   progress is safe: outbox and rows are the durable source of truth.

**Intermittent connectivity:** exponential backoff with jitter, immediate retry on
connectivity regained, bounded concurrency, and network-timeout handling that treats
ambiguous outcomes as "unknown" and re-sends with the same idempotency key (safe to
duplicate). Sync never clears local data on failure. A foreground service performs
sync; the OS may still kill it, so every cycle must be restartable from the outbox.

**Audit replay:** local audit events are pushed with the application records; the
server assigns its own receipt timestamp alongside the client timestamp (A7).

---

## 6. Conflict policy (no collaborative editor)

Conflicts arise because supervisors edit from the web while the inspector is
offline. Recommended policy (see §12-D1):

- Use the last successfully pulled server version as the **common base** and perform a
  **deterministic three-way merge at field granularity**. This is auto-merge of
  discrete fields, *not* a collaborative editor.
- Fields changed only by one side are combined automatically and marked `clean`.
- Fields changed by both sides to different values are a **conflict**: the inspection
  is marked `needs review`, becomes read-only on the tablet, and is surfaced to the
  supervisor in a web conflict-review view. Acceptance is blocked until resolved.
- The **signature is atomic and never merged**; any overlapping change to it requires
  supervisor resolution.
- Supervisor edits win *only* where the inspector made no change; inspector edits win
  *only* where the supervisor made no change. No silent last-writer-wins overwrite
  of a known edit.
- Every conflict and its resolution emit audit events.

Rationale: preserves both parties' non-overlapping work, needs no live co-editing, and
keeps the human decision with the supervisor who already works in the web tool.

---

## 7. Attachments (photos and signature)

- Capture writes an encrypted file locally and registers an `attachment` row before
  the UI shows success; losing connection never loses a captured photo.
- Enforce the **40-photo cap** in capture UI and in the data layer; on-device
  compression/resize to a configured maximum bounds storage and upload size (A6).
- Signature is captured as an image plus metadata (signer, timestamp) stored as a
  dedicated attachment; it is atomic (§6).
- Blobs upload first with client-generated IDs and checksum-based dedupe; the record
  commit follows, referencing server IDs. Retries skip uploaded blobs. A server-side
  sweeper removes blobs never referenced by a committed record.
- Attachments are treated as customer data: they are purged locally on the 24 h rule
  (§9) and are covered by encryption and deletion proof.
- Storage guardrails: monitor available space, warn before capture when low, and fail
  capture gracefully rather than corrupting the local DB.

---

## 8. Security

- **At rest:** encrypt local DB and media with keys held in device keystore; prefer
  per-inspection data-encryption keys so deletion can be done by **crypto-shredding**
  (destroy the key → ciphertext unrecoverable) in addition to file removal.
- **No leakage outside the app sandbox:** no OS backup/cloud sync of inspection data,
  no external-storage writes, no customer data in logs, crash reports, or telemetry.
- **In transit:** TLS for all API calls; consider certificate pinning for the managed
  fleet.
- **Auth:** cached short-lived token for offline use, re-authentication on reconnect,
  least-privilege access to assigned inspections only (A9). Define a maximum offline
  session before re-auth is required (§12-D4).
- **Audit integrity:** append-only events with client sequence numbers and both client
  and server-received timestamps (A7); events are never edited or deleted.
- **Device trust:** assume company-managed/enrolled devices for v1; rooted devices are
  out of scope. Remote wipe via fleet management is the last-resort control.

---

## 9. Deletion and compliance (24 h rule)

- On observing a server acceptance event, the device schedules a purge of that
  inspection's customer data (DB rows, media files, keys) no later than 24 h after
  the acceptance timestamp (A1, A2).
- **Offline backstop:** because an offline device cannot know of acceptance, also
  purge any inspection whose *capture* timestamp exceeds a configured maximum age
  (A7, A2). This bounds worst-case retention even if the device never reconnects.
  The exact backstop window needs confirmation (§12-D2).
- Purge uses crypto-shredding plus file removal; a `deletion_ledger` entry (IDs and
  timestamps only, no customer data) is kept as compliance proof.
- The purge job runs on app start, on sync, and periodically; it records each run in
  telemetry without customer data. Failed purges are retried and alerted (§11).
- Definition of customer data and the clock semantics are decisions to lock before
  implementation (§12-D2).

---

## 10. Migration and backfill

- Convert the read-through cache to the durable store via a **versioned, additive
  schema migration** (new tables/columns, no destructive changes to existing cache
  tables). Keep the schema readable by the previous app version for one release to
  allow app rollback (§13).
- Existing cached rows are treated as read-only base data, never as user drafts
  (A8). Verify this assumption against the current app before M1; if unsaved edits
  exist, add a one-time capture step.
- No server data backfill is needed for records (the server is authoritative). Whether
  to backfill historical audit events is a scope decision (§12-D7); default: no.
- Migration is tested against copies of real device databases, including upgrade,
  downgrade-compatibility, and interrupted-migration cases.

---

## 11. Observability

- **Client telemetry** (batched, flushed online, no customer data): sync
  attempts/success/failure, conflict count, outbox depth and age, attachment upload
  failures, local storage used, purge job runs and failures, auth failures, crashes.
- **Server telemetry:** sync endpoint error rates and latency, 409 rate, upload
  success rate, audit-ingestion failures.
- **Alerts:** sync failure-rate spike, growing outbox depth/age on devices (stuck
  drafts), proximity to the 24 h deletion deadline for unpurged records, storage
  exhaustion, purge failures.
- Privacy review of every telemetry field to ensure no PII or customer data leaks.

---

## 12. Decisions required before implementation (with recommendations)

| # | Decision | Options | Recommendation |
|---|----------|---------|----------------|
| D1 | Conflict policy | (a) whole-record last-writer-wins; (b) field-level three-way merge + web resolution for overlaps; (c) inspector always wins | **(b)** — preserves non-overlapping work, is deterministic, needs no collaborative editor, keeps human decisions on the web. |
| D2 | Meaning of "accepted", 24 h clock start, and customer-data definition | clock from server acceptance vs. device observation; narrow vs. broad data definition | Clock from **server acceptance timestamp**; device purges within 24 h of observing it, plus a **capture-time backstop** for offline devices; treat all inspection content incl. photos/signature as customer data; retain only a non-PII deletion ledger. Confirm with compliance owner. |
| D3 | Server API capability | (a) extend existing REST APIs; (b) thin sync wrapper service | Require minimal primitives: version on read, conditional write (409), idempotency keys, incremental changes endpoint, audit-event ingestion, blob upload. Prefer **(a)**; choose **(b)** only if the core APIs cannot be changed. This is a hard dependency for M2. |
| D4 | Offline auth model | cached short-lived token vs. long-lived offline credential | **Cached short-lived token** with re-auth on reconnect and a configured maximum offline session; no long-lived offline secret. |
| D5 | Sync/attachment commit order | blobs-first vs. record-first | **Blobs-first** with client IDs and idempotent uploads, then record commit; accept an orphan-blob cleanup job. |
| D6 | Photo storage/compression | original full-res vs. compressed-to-cap | Enforce 40-photo cap and **compress to a configured maximum** with a device storage budget. |
| D7 | Backfill historical audit events | yes vs. no | **No** for v1; server records remain authoritative. Revisit only if compliance requires history for pre-feature actions. |
| D8 | Rollout/kill-switch mechanism | remote feature flag vs. release-only | **Remote feature flags** with per-cohort targeting and a kill switch that restores current online-only behavior. |

---

## 13. Milestone sequence (dependencies and acceptance criteria)

Ordered, with no dates or staffing estimates. Each milestone's acceptance criteria
are the gate for the next.

- **M0 — Decisions locked.** Depends: review of BRIEF + this plan.
  *Acceptance:* D1–D8 resolved and signed off; server API capability (A4/D3)
  confirmed; compliance sign-off on D2; A8 verified against the current app.

- **M1 — Local persistence foundation.** Depends: M0.
  Deliver additive schema migration, `inspection`, `form_answers`, `outbox`,
  `audit_event`, `attachment`, `sync_meta`, `deletion_ledger`, encryption, atomic
  file/row writes.
  *Acceptance:* drafts survive app kill and force-stop; migration tested on real DB
  copies incl. rollback-compatible schema; no customer data in plaintext.

- **M2 — Sync core.** Depends: M1, D3, D4.
  Deliver pull/push cycle, version-based conditional writes, idempotent outbox
  replay, 409 reconciliation, backoff, resumability.
  *Acceptance:* simulated network loss/latency causes zero data loss; ambiguous
  responses are safe to retry; sync restarts correctly after kill; cursor advances
  only on complete cycles.

- **M3 — Attachments & signature.** Depends: M1, M2, D5, D6.
  Deliver capture, compression, encryption, blobs-first upload, dedupe, 40-cap,
  orphan cleanup.
  *Acceptance:* 40 photos + signature captured offline and uploaded over flaky
  network with no loss or duplicates; storage guardrails behave under low space.

- **M4 — Conflict policy.** Depends: M2, D1.
  Deliver three-way field merge, conflict detection, read-only conflicted state,
  supervisor web conflict-review view, auditable resolution.
  *Acceptance:* non-overlapping edits auto-merge; overlapping edits surface for
  resolution; no silent overwrite; acceptance blocked until resolved.

- **M5 — Security, audit & deletion.** Depends: M1–M4, D2.
  Deliver keystore encryption/crypto-shredding, audit replay with dual timestamps,
  deletion scheduler with offline backstop, deletion ledger, no-data-in-logs review.
  *Acceptance:* forensic check confirms purge within 24 h in both online and
  never-reconnected cases; audit trail complete; privacy review passed.

- **M6 — Observability, rollout controls & rollback.** Depends: M2–M5, D8.
  Deliver telemetry, alerts, feature flags, kill switch, rollback runbook.
  *Acceptance:* dashboards/alerts fire in test scenarios; kill switch restores
  online-only behavior with no loss of queued drafts; runbook reviewed.

- **M7 — Pilot, then staged rollout.** Depends: M0–M6.
  Execute internal validation, then a limited pilot cohort, then broaden behind
  flags. *Acceptance:* pre-agreed pilot exit criteria met — no data-loss incidents,
  sync success and conflict rates within agreed thresholds, deletion compliance
  verified, no unresolved high-severity defects. Broad rollout proceeds only after
  pilot sign-off.

---

## 14. Staged rollout

1. **Internal validation:** lab tests in simulated no-signal conditions before any
   field use.
2. **Pilot:** limited inspectors, devices, and inspection types; monitored closely;
   explicit exit criteria (§13 M7). Fast feedback loop for conflict and sync issues.
3. **Expanded pilot:** broaden cohort and inspection types while keeping flags on.
4. **Broad rollout:** general availability behind per-cohort flags; kill switch stays
   available.

---

## 15. Rollback

- A **remote kill switch** disables offline edit mode and returns the app to its
  current online-only behavior; this is the primary rollback for functional issues.
- **Data safety on rollback:** unsynced outbox rows and drafts are never purged;
  they remain on the device and resume syncing if offline mode is re-enabled or after
  a compatible app upgrade.
- **App/schema rollback:** additive, backward-readable schema for one release lets
  a prior app version run against the migrated DB; a down-migration is a last resort.
- **Server-side toggle** can refuse offline-origin writes if a bad client is in the
  field.
- **Rollback triggers** are defined before rollout (e.g. any data-loss incident,
  deletion-SLA breach, or sync success below the agreed threshold); the runbook in M6
  records who can trigger it and the steps.

---

## 16. Testing strategy

- **Unit:** version comparison, three-way merge, conflict detection, outbox ordering
  and idempotency, encryption/crypto-shredding, deletion scheduling, schema migration.
- **Integration:** mock server with controllable 409s, latency, timeouts, partial
  failure, duplicate delivery, and out-of-order responses.
- **Device/lab:** airplane mode, flaky/intermittent signal, DNS failures, app killed
  mid-sync, device reboot, clock skew (A7), token expiry while offline, low storage,
  40-photo + signature capture, deleting after long offline periods.
- **Compliance:** forensic verification that customer data is unrecoverable within
  24 h (online and never-reconnected paths); audit trail completeness and
  tamper-evidence.
- **Migration:** upgrade from the current DB, downgrade compatibility, interrupted
  migration, and corrupted-DB handling.
- **Performance/load:** 40-photo upload over constrained links, storage bounds, sync
  time and battery impact.
- **Pilot acceptance:** real-world metrics against the M7 exit criteria; no fake
  schedule or staffing figures are assumed here.
