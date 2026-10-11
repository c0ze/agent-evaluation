# Plan 06 — Offline inspection sync

**Scope of this document:** an engineering plan for making the tablet inspection app
usable offline. `BRIEF.md` is the only product input. Everything not stated there is
recorded as an assumption (§2) or an open decision with a recommendation (§16).

---

## 1. Problem statement and goal

Inspectors open assigned inspections in basements with no connectivity. Today the local
SQLite store is a **read-through cache**, so a lost connection after opening an
inspection can discard notes.

**Goal:** an inspector can complete an entire assigned inspection — open it, fill the
form, capture and annotate up to 40 photos, and collect a signature — with zero network
access, and have that work durably reach the server when connectivity returns
intermittently, without losing data, without corrupting the regulatory audit history,
and without leaving customer data on the device beyond the 24-hour post-acceptance
window.

**Explicit non-goals** (agreed from the brief's "does not want a full collaborative
editor"):

1. **No real-time co-editing.** There is no live presence, no CRDT, no concurrent
   in-document collaboration between the tablet and the web.
2. **No peer-to-peer sync** between tablets. Devices talk only to the server.
3. **No offline assignment** of new inspections to self. The set of inspections
   available offline is what was synced on the last successful connection.
4. **No offline report generation/PDF export beyond what is already shipped** —
   the completed record syncs, then the server renders.
5. **No offline template authoring** or admin functions; supervisors work online.
6. **No rewrite of the existing REST API surface.** We add sync endpoints and extend
   existing ones; we do not replace the API.
7. **No cross-device continuation** of a single in-progress inspection (start on this
   tablet, finish on that one). See D7; recommended as out of scope for the pilot.

---

## 2. Assumptions

Each assumption is tagged **[load-bearing]** if the design would materially change when
it is falsified. Validation method is given so these can be closed during M0.

| # | Assumption | Confidence | Validation |
|---|---|---|---|
| A1 | Inspectors work on **company-managed, single-user tablets** with a device-level passcode/biometric and MDM available. | High | Confirm with IT; check MDM capability list |
| A2 | Typical offline window is **minutes to a few hours**; the same working day, not multiple days. **[load-bearing]** | Medium | Instrument time-since-last-sync on current builds; field interviews |
| A3 | A typical inspection is a **single inspector**; two inspectors do not independently fill the same inspection record concurrently. **[load-bearing]** | Medium | Review last quarter of assignment data for co-assignment |
| A4 | The full inventory of assigned inspections for the next working day, plus their form templates and photo capacity, **fits in local storage** (assumed order of a few hundred records, well under 1 GB). | High | Measure record + template sizes; measure free disk in fleet |
| A5 | 40 photos per inspection at current camera resolution ≈ **200–400 MB** worst case per inspection before optimisation. **[load-bearing]** | Medium | Measure actual captured file size on target tablet hardware |
| A6 | Upload bandwidth at inspection sites/job trailers is **poor but non-zero** when connectivity returns (cellular or depot Wi-Fi). | Medium | Sample throughput from 3 representative sites |
| A7 | The existing REST API can be **extended** by the backend team within this project; we are not limited to read-only access. **[load-bearing]** | Medium | Confirm with backend owners before M1 |
| A8 | Server-side record versions are **monotonic integers per inspection record**, not per field, and are bumped on every mutation including supervisor edits. | High (from brief) | Read the API/ORM code |
| A9 | "Accepted" is a **server-side status transition** on the inspection (supervisor accepts), and the 24-hour clock starts at the acceptance timestamp, not at sync. **[load-bearing]** | Medium | Confirm legal/ops interpretation in writing |
| A10 | Audit history is **required to be retained** after local customer data is purged, i.e. purge must delete PII while leaving pseudonymous audit entries intact or retained server-side. **[load-bearing]** | Medium | Written confirmation from compliance |
| A11 | Photos and signatures are **immutable once captured**; inspectors correct a bad photo by adding another, not by editing. | High | Confirm with one inspector during field visit |
| A12 | The app already has **authenticated session/token handling** sufficient for background sync, and token lifetime can be extended or renewed without user interaction for at least the offline window. | Medium | Inspect auth module; see D5 |
| A13 | Device clock may be **wrong or skewed**; clients cannot be trusted for ordering. | High | N/A — design treats it as true |
| A14 | The web/supervisor editor is **online-only**, so all supervisor edits pass through the server and get a version bump. | High | Confirm with web team |
| A15 | Lost/stolen devices can be **remotely wiped** by MDM, which is the backstop for the 24-hour purge requirement. | Medium | Confirm MDM supports selective/full wipe |

---

## 3. User flow

### 3.1 Pre-work (online or on any connectivity)
1. App syncs: pulls assigned inspections, their pinned form templates, and site metadata.
2. Inspector taps **"Go offline"** (or the app auto-prepares). App reports readiness:
   *N inspections ready, storage available for M photos, last sync T ago.*
3. App refuses to go offline if a required inspection has an unresolved blocking
   conflict, or if projected storage is insufficient.

### 3.2 Offline
4. Inspector opens an inspection from the local list. Banner: **Offline — changes saved
   on this device.**
5. Form, photos, and signature are written **transactionally to SQLite** and to a
   durable **outbox** in the same transaction. UI never writes to the network path.
6. Per-inspection footer shows pending state: *12 changes, 4 photos, 1 signature not yet
   uploaded.*
7. Inspector taps **Complete** → record moves to `pending_sync` locally. It is **not**
   accepted server-side; acceptance is a supervisor action (A9).

### 3.3 Reconnect
8. Connectivity monitor fires. Sync runs **pull-first, then push** (§6.3):
   pull → detect conflicts → push outbox → upload attachments → confirm.
9. Any **blocking conflict** (supervisor cancelled/reassigned/closed the inspection, or
   the template changed incompatibly) surfaces as a blocking task. The inspector must
   resolve it before that inspection can be submitted. Non-blocking field conflicts are
   queued for the same review and surfaced in-app; the rest of the inspection still syncs.
10. On success the inspector sees *Synced at HH:MM*. The record remains on-device until
    the purge job removes it (§8.3).

### 3.4 Failure modes surfaced to the user
- **Sync partially failing** (form synced, photos stuck): explicit per-item status, with
  a *Retry* action. Never a single opaque "sync failed".
- **Storage full mid-inspection:** hard stop on new photo capture with a clear message
  and pointer to already-captured photos to delete.
- **Session expired:** re-authentication is required; queued work is untouched.

---

## 4. Local data model

The cache becomes an **authoritative local store**. Existing cache tables are migrated
(§10). All identifiers are server ids except locally-generated ones, which are **UUIDv4**
and are the client's permanent handle until the server assigns one.

```
inspections(
  id                INTEGER PK,        -- server id
  template_id       INTEGER NOT NULL,
  template_version  INTEGER NOT NULL,  -- pinned at sync time (D2)
  status            TEXT NOT NULL,     -- assigned|in_progress|pending_sync|submitted|accepted
  version           INTEGER NOT NULL,  -- last server version we know (base version)
  base_version      INTEGER NOT NULL,  -- version our local edits were made against
  site_ref          TEXT NOT NULL,     -- pseudonymous, survives purge
  site_json         TEXT,              -- PII (address, customer name) -- purged (§8.3)
  local_state       TEXT NOT NULL,     -- clean|dirty|conflicted|blocked
  assigned_to       INTEGER,
  accepted_at       INTEGER,           -- server ms, starts purge clock
  purge_after       INTEGER,           -- computed; see §8.3
  updated_at        INTEGER NOT NULL,
  deleted_at        INTEGER
)

form_records(                          -- one row per answered field
  inspection_id  INTEGER NOT NULL,
  field_id       TEXT NOT NULL,
  value_json     TEXT,
  updated_at     INTEGER NOT NULL,     -- corrected client time (§6.5)
  actor_id       INTEGER NOT NULL,
  dirty          INTEGER NOT NULL DEFAULT 0,
  conflict_json  TEXT,                 -- supervisor's divergent value, pending review
  PRIMARY KEY (inspection_id, field_id)
)

attachments(
  local_id       TEXT PK,              -- UUIDv4 generated on capture
  inspection_id  INTEGER NOT NULL,
  server_id      INTEGER,
  kind           TEXT NOT NULL,        -- photo|signature
  sha256         TEXT NOT NULL,        -- content address; used for dedupe+idempotency
  local_path     TEXT NOT NULL,        -- app-private storage
  byte_size      INTEGER NOT NULL,
  exif_stripped  INTEGER NOT NULL,     -- §8.6
  order_index    INTEGER,
  caption        TEXT,
  state          TEXT NOT NULL,        -- pending|captured|uploading|uploaded|failed|orphan
  attempts       INTEGER NOT NULL DEFAULT 0,
  created_at     INTEGER NOT NULL
)

signatures(
  inspection_id INTEGER PK,
  attachment_id TEXT NOT NULL,         -- immutable once captured
  signer_ref    TEXT NOT NULL,         -- pseudonymous: last-4/hash, not the raw name
  signer_name   TEXT,                  -- PII, purged with the record
  captured_at   INTEGER NOT NULL
)

outbox(                                 -- durable, ordered-per-inspection mutation queue
  seq            INTEGER PK AUTOINCREMENT,
  op_id          TEXT UNIQUE NOT NULL,  -- UUIDv4, idempotency key
  inspection_id  INTEGER NOT NULL,
  op_type        TEXT NOT NULL,         -- upsert_field|set_status|capture_signature|delete_photo
  payload_json   TEXT NOT NULL,
  base_version   INTEGER NOT NULL,
  attachment_ref TEXT,                  -- links upload to its metadata op
  state          TEXT NOT NULL,         -- pending|inflight|applied|rejected|conflict|abandoned
  attempts       INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER,
  last_error     TEXT
)

audit_log(                              -- append-only, mirrors server; no PII
  seq           INTEGER PK AUTOINCREMENT,
  inspection_id INTEGER NOT NULL,
  op_id         TEXT NOT NULL,
  actor_id      INTEGER NOT NULL,
  actor_role    TEXT NOT NULL,          -- inspector|supervisor|system
  action        TEXT NOT NULL,
  field_id      TEXT,
  prev_hash     TEXT,                   -- hash of previous value, not the value
  new_hash      TEXT,
  client_ts     INTEGER,
  synced        INTEGER NOT NULL DEFAULT 0
)

sync_state(
  key   TEXT PK,                        -- last_pull_cursor|last_success_at|server_time_offset
  value TEXT
)

conflicts(                              -- surfaced to the inspector for resolution
  id            INTEGER PK AUTOINCREMENT,
  inspection_id INTEGER NOT NULL,
  field_id      TEXT,
  kind          TEXT NOT NULL,          -- blocking|field
  local_json    TEXT,
  server_json   TEXT,
  detected_at   INTEGER NOT NULL,
  resolved_at   INTEGER
)
```

**Two invariants make this tractable:**

1. **Every local mutation is captured as an outbox op in the same SQLite transaction as
   the state change.** If the state change committed, the op exists. There is no
   "scan the tables and diff" reconciliation pass, which is where cache-based designs
   lose data.
2. **Attachments are content-addressed and immutable.** A photo is never edited, so it
   can never conflict — it can only be missing. This removes the hardest class of
   conflict from the design entirely.

---

## 5. Sync protocol

### 5.1 Additions required to the REST API (see D1 — recommendation: build these)

The brief says the API is REST with integer record versions. Integer versions tell us
*that* something changed but not *what* changed, and there is no efficient way to
enumerate "everything assigned to me that changed". Two additive endpoints are needed;
all existing endpoints keep working.

```
GET  /sync/inspections?cursor=<opaque>&limit=200
     → { items: [{ id, version, updated_at, deleted_at, template_version, status }],
         cursor, has_more, server_time }
     Cursor is an opaque (updated_at, id) tuple; stable under concurrent writes.

POST /sync/inspections/{id}/ops
     → per-op results          (batch, ordered, idempotent)
     Request:  { base_version, ops: [{ op_id, op_type, payload, client_ts }] }
     Response: { version, results: [{ op_id, status, server_value?, error?, code? }] }
               status ∈ applied | conflict | rejected | duplicate

GET  /inspections/{id}/changes?since_version=N
     → ordered field-level change entries (for field-level merge)

POST /attachments            → { attachment_id, upload_url }   (idempotent on sha256)
PUT  /attachments/{id}/chunk  → resumable chunk upload (see §7)
```

`POST /sync/inspections/{id}/ops` is deliberately **per-inspection**, not global:
ordering guarantees are only required within an inspection, so this keeps the queue
simple and lets unrelated inspections sync independently.

### 5.2 Pull
Opaque cursor persisted in `sync_state`. Paginated, resumable (cursor advances only
after a page is fully applied in a transaction). Server returns `server_time` on every
response, which the client uses to compute and persist a **clock-offset correction**
(A13). Deletions come back as tombstones and are applied as local hard deletes *after*
the corresponding pending ops are resolved (§6.2, deletion row).

### 5.3 Order of operations per sync cycle
```
1. pull (cursor)            → apply, record conflicts, update base_version
2. resolve blocking conflicts → if any, stop; require user action
3. push outbox ops (batch, per inspection, ordered by seq)
4. upload attachments (metadata op first, then bytes; see §7)
5. confirm: clear applied ops, update sync_state, emit metrics
6. schedule purge job (§8.3)
```
Pull before push is intentional: it surfaces conflicts **before** we spend a slow,
metered upload on data that we already know will be rejected or merged.

### 5.4 Push semantics and idempotency
- Every op carries a client-generated `op_id` (UUIDv4) and the `base_version` it was
  authored against.
- The server keeps `(op_id → result)` for a bounded retention window (recommend 30 days,
  D4) and returns the **original** result for a replayed `op_id` rather than re-applying
  it. This is what makes retries safe on flaky connections, where a request may have
  succeeded but the response was lost.
- Batch results are **per-op**, not all-or-nothing: one poisoned op does not block the
  other 40. Ops that come back `rejected` with a permanent code (validation, permission)
  are moved to `abandoned`, surfaced to the user, and never retried.
- Ops that come back `applied` are deleted from the outbox only **after** the server's
  new `version` is committed locally; otherwise a crash between response and commit
  replays the op harmlessly via the idempotency table.

### 5.5 Retry, backoff, and partial connectivity
- Exponential backoff with full jitter: `min(cap, base * 2^attempt)` randomised, capped;
  honour `Retry-After` when present; reset the attempt counter on a successful cycle.
- A request with no response is retried **as-is** (safe by idempotency). A request that
  returned 5xx mid-body is safe to retry because application only happens on response
  commit.
- Intermittent connectivity is expected: the sync loop is **chunked and interruptible**.
  It makes progress per inspection and per attachment, persists that progress, and
  resumes. A cycle that dies at 30% leaves 30% durably synced.
- Battery/storage-aware: defer photo upload while on battery below a threshold unless
  the user forces it; surface that as a user-visible choice (D6).

### 5.6 Concurrency guards
- Exactly one sync coordinator process at a time, enforced by a SQLite lease row with an
  expiry — prevents the UI, the background worker, and a foreground retry from
  double-uploading.
- All sync writes occur in explicit transactions with `WAL` mode; no long-held
  transactions across network calls.

---

## 6. Conflict policy

Supervisors edit the same inspection from the web. The brief rules out a collaborative
editor, so we need a deterministic, explainable policy — not a merge UI for everything.

### 6.1 Principle
**Never silently drop either side's work.** Where automatic resolution is defensible we
apply it and record it; where it is not, we preserve both values and require a human
decision. Every automatic resolution is written to the audit log.

### 6.2 Field classes and precedence

| Class | Examples | Rule |
|---|---|---|
| **Inspector-authored answers** | measurements, notes, pass/fail | Inspector wins **while** `status ∈ {assigned, in_progress}`. If the supervisor changed the same field since our `base_version`, both values are preserved in `conflicts` for review — we do not pick a winner. |
| **Supervisor/structural fields** | assignee, scheduled date, status transitions, cancellation | Server authoritative. The tablet never originates these; it only renders them. |
| **Post-acceptance edits** | any field, after `accepted` | Supervisor wins. The tablet shows the record read-only; local divergent values go to `conflicts` as evidence, not as an edit. |
| **Attachments** | photos, signature | Append-only, content-addressed, immutable → **cannot conflict**, only fail to upload. |
| **Deletion** | inspection or photo deleted | Hard delete / erasure requests always win; sync of pending edits to a deleted record is abandoned with a blocking notice. |

### 6.3 Automatic resolution within a class
Where both sides changed a **single-value** field and the class says the inspector wins,
we use the later of the corrected timestamps (§5.2), with the losing value preserved in
`conflicts` for 30 days. Text/notes fields are **never** auto-merged by string diffing;
divergence is always a human decision.

### 6.4 Blocking vs non-blocking
- **Blocking:** supervisor cancelled/reassigned/closed the inspection; template version
  changed incompatibly (D2); a required field was removed. The inspection cannot sync
  until resolved. Other inspections sync normally.
- **Non-blocking:** field-level divergences. The inspection syncs everything else; the
  divergence sits in a **Conflicts** tray with both values side by side and a one-tap
  "keep mine / keep theirs / keep both as note".

### 6.5 Ordering and time
Integer versions give ordering **per record** without telling us the changed fields, so
field-level merge requires either `GET /changes` (§5.1) or a full-record comparison on
conflict. Recommendation: add the `changes` endpoint (D1). Time-based tie-breaks use
**server-corrected client timestamps**: the client stamps with its own clock plus the
last known server offset, never raw device time (A13).

### 6.6 What we deliberately do not do
No three-way text merge, no operational transformation, no per-keystroke history, no
live presence. If the pilot shows field conflicts are frequent, the next investment is
**field-level locking/check-out** (see D3 in §16), not a merge algorithm.

---

## 7. Attachments (up to 40 photos + signature)

Attachments are the heaviest part of the offline problem: A5 puts worst-case raw capture
at hundreds of MB per inspection, and A6 says the return path is slow.

1. **Capture.** Photo written to app-private storage immediately, EXIF/GPS stripped at
   capture time (§8.6), `sha256` computed, `attachments` row created in the **same
   transaction** as the `outbox` metadata op. Capture never waits for the network.
2. **Optimisation.** A transcode/thumbnail pass runs when the device is idle and charging
   (or immediately if the user is in a hurry), producing a "sync-quality" derivative.
   Recommendation: **upload the sync-quality derivative by default and retain the
   original locally** until the record is accepted and purged, so no resolution is lost
   permanently by accident; make "original or optimised" a policy setting (D8).
3. **Upload ordering.** Metadata op first (creates `server_id`), then bytes. The
   `attachment_ref` on the outbox op links them, so an orphaned upload can be retried
   without re-sending metadata.
4. **Resumable chunked upload.** Chunks sized to the measured site throughput (A6,
   recommendation: start at 1 MB and tune from telemetry). The upload is resumable by
   `sha256` + offset, so a mid-upload disconnect resumes rather than restarts. This is
   the single highest-value feature for the "40 photos over bad cellular" case.
5. **Idempotency.** `POST /attachments` is idempotent on `sha256` per inspection; a
   replayed request returns the existing `attachment_id`.
6. **Progress and fairness.** Per-photo progress, sequential upload to avoid saturating
   a weak link with 40 parallel streams, with a bounded parallelism of 2–3 configurable
   by flag so we can tune it from production data.
7. **Failure handling.** Per-attachment retry with backoff; after the retry budget is
   exhausted the attachment is `failed` and the inspection is marked
   `pending_sync:photos`. The form data is **never** blocked behind a photo upload — this
   is the difference between "notes reached the server" and "everything was lost".
8. **Signature.** Treated as an attachment with `kind=signature`, uploaded with high
   priority (it gates completion) and immutable once captured.
9. **Storage.** Before going offline the app computes projected storage for the planned
   inspections and refuses with a clear message if it does not fit. During capture, a
   low-storage threshold blocks new captures and offers deletion of the oldest uploaded
   photos.

---

## 8. Security and privacy

### 8.1 Authentication while offline
The tablet must remain usable without network, but must not become an unauthenticated
data store. Recommendation (D5): app-level session unlock backed by the device
credential, a session token valid for the offline window plus grace, **and** a hard
re-auth requirement at least every N days. N is a compliance decision; the plan assumes
the value comes from D5 rather than inventing one.

### 8.2 Data at rest
- **Encrypt the local database.** The SQLite key is held in the platform keystore
  (Keychain/Android Keystore), not in preferences or code. Recommendation: SQLCipher or
  an equivalent page-level encryption layer (D9).
  *Honest note:* an encrypted database on a device whose credential is already unlocked
  raises the bar for a forensic or lost-device extraction; it does not protect against a
  compromised OS or an attacker with an unlocked device. We should not oversell it.
- Photos and signatures live in app-private, encrypted-at-rest storage with the same
  threat model.
- No customer PII in crash reports, analytics payloads, or logs — only pseudonymous
  `site_ref` / `inspection_id`.

### 8.3 The 24-hour purge (A9, A10)
Requirement: remove local customer data within 24 hours after an inspection is accepted.

1. **Clock source.** `purge_after = accepted_at + 24h`, where `accepted_at` is the
   **server** timestamp received at sync — not device time (A13). This is the whole
   reason the pull response carries `server_time`.
2. **Purge scope.** Delete `inspections.site_json`, `signatures.signer_name`,
   `attachments.local_path` files (photos + signature), and locally cached templates,
   while **retaining** `audit_log` entries that reference only `site_ref`, `inspection_id`
   and hashes. If compliance requires the audit history to retain the signer's identity,
   that identity must live **server-side only**, and the local audit log must record a
   hash rather than a name (A10). **This specific interaction between purge and audit
   retention is the highest-risk unresolved item in the plan and must be closed in
   writing before M2.**
3. **Execution.** A purge job runs on every app foreground, on every successful sync
   cycle, and via a periodic background worker. It is idempotent, records a completion
   event, and emits `purge_overdue_age_hours` if any record is past due.
4. **Verification, not just implementation.** A test asserts that after purge no PII
   remains in the database file, the file system, and any WAL/-shm/journal sidecar
   files. Deleting rows without `VACUUM`/secure-delete can leave recoverable data in
   free pages — this is a known failure mode and must be covered explicitly.
5. **Backstop.** MDM remote wipe (A15) for lost/stolen devices, plus wiping the keystore
   key on too-many-failed-unlock attempts.

### 8.4 Transport and server
TLS everywhere, certificate pinning only if the ops team owns the pin-rotation
runbook (it is a self-inflicted outage waiting to happen otherwise). Server-side
authorisation re-validated **at sync time**, not just at capture time: an inspector who
was unassigned while offline cannot push ops to that inspection (§6.2, supervisor fields
are authoritative).

### 8.5 Tamper-evidence
Audit log rows are append-only locally; the local log mirrors the server and is not the
system of record. Each op carries `op_id` and `actor`, and value hashes chain
(`prev_hash` → `new_hash`) so the server can detect an out-of-order or missing op.

### 8.6 Other
- EXIF/GPS stripped at capture (privacy + it also shrinks files).
- Background work rate-limited and battery-aware, because a sync loop that drains the
  battery is a sync loop inspectors will disable.

---

## 9. Migration and backfill

### 9.1 Client
- Versioned, forward-only SQLite migrations (`user_version`), each with a down-guard:
  the app refuses to open a database newer than itself and falls back to
  **wipe-and-rehydrate**, which is acceptable today because the store is only a
  cache — and will **stop** being acceptable once it is authoritative. From M1 onward,
  migrations must be non-destructive and must never drop the `outbox`.
- Migration order: create new tables → backfill from cache tables → dual-write period →
  switch reads → drop legacy cache tables behind a flag.
- **Critical constraint:** any release that can go out with pending outbox ops must
  **drain the outbox before applying a destructive migration**, or pending notes are
  destroyed. This is enforced by a blocking pre-migration check, not by convention.
- Roll-forward is the default posture for schema changes; the flag (§12) controls
  behaviour, not schema.

### 9.2 Server
- Backfill `version`, `updated_at`, `deleted_at` for existing records; confirm the
  version column is bumped for every existing write path including supervisor edits
  (A8) — a missed increment is invisible until it silently overwrites data.
- Backfill retroactive audit entries for in-flight inspections, marking them
  `source=backfill` so the audit history is honest about provenance.
- Add idempotency and change-log tables; backfill is not required for the sync
  endpoints because clients start from a known cursor at first sync.
- Pin template versions and start recording them on inspections (D2), so an offline
  tablet always renders the schema it captured against.

---

## 10. Observability

**Metrics** (all sliced by app version, rollout stage, and inspection):
- `sync_cycle_success_rate`, `sync_cycle_duration_p50/p95/p99`
- `outbox_depth` (gauge) and `outbox_oldest_op_age_hours` — **the** data-loss early
  warning; alert on backlog age crossing a threshold, not just on error rate
- `op_result_total{status}` (applied/conflict/rejected/duplicate)
- `conflict_rate` overall and **per field id** — the latter tells you which form field
  is badly designed
- `attachment_upload_success_rate`, `upload_duration_p95`, `upload_retry_total`,
  `orphaned_attachments`
- `purge_success_total`, `purge_failure_total`, `purge_overdue_age_hours` (alert: any
  record past 24h), `pii_rows_after_purge` (must be 0)
- `time_since_last_successful_sync` (validates A2), offline session duration
- `local_db_size_bytes`, `free_storage_bytes`, `sync_battery_drain_pct`
- Crash-free sessions, sync-worker ANR/watchdog terminations

**Logging:** structured events with `device_id`, `inspection_id`, `op_id`, `attempt`,
`base_version`, `server_version`, and error code. **No PII, ever** (§8.2). Ops are logged
by `op_id` so a support ticket from a basement can be traced end to end.

**Tracing:** a sync-cycle trace per attempt spanning pull → conflict → push → upload,
with attachment upload as child spans, so "why did this take 9 minutes" is answerable.

**Dashboards:** pilot health (per-inspector backlog age, sync success, purge
compliance), conflict analysis (which fields, which supervisors), attachment
performance.

**Alerting:** backlog age, purge overdue/failed, conflict rate spike, upload success
rate drop, sync cycle stuck. Each alert names its owner and its first diagnostic step.

---

## 11. Testing strategy

1. **Unit.** Outbox reducer, op application/rollback, idempotency replay, conflict
   resolver per field class (table in §6.2 as executable cases), purge scope and
   completeness, clock-offset correction, storage projection.
2. **Integration against a fake server harness.** Deterministic fault injection is the
   core of this plan's confidence: latency, 5xx, truncated responses, **response-lost-
   after-commit** (the classic duplicate-write bug), partial batch results, out-of-order
   ops, duplicate `op_id`, tombstone racing a pending edit.
3. **Property/permutation tests.** Random op orderings and interleavings with concurrent
   supervisor edits; invariant: no acknowledged write is lost, and the client and server
   converge to the same final state for any permutation.
4. **On-device / system tests (the ones that actually find offline bugs).**
   Airplane mode for a full inspection; connectivity flapping every few seconds; kill
   the app mid-upload and mid-sync; background the app during sync; run out of storage
   mid-capture; device clock skewed hours; low battery; app upgrade with a **non-empty
   outbox**; token expiry mid-sync.
5. **Scale/perf.** 40 photos per inspection, largest realistic inspection, oldest device
   in the fleet; measure sync wall time, battery drain, DB growth and query latency over
   a simulated multi-week history.
6. **Security/privacy.** Static analysis of storage paths; a purge verification test that
   greps the database file, WAL files, and the file system for known PII canaries;
   review of log/analytics payloads for PII leakage.
7. **Manual field test.** Real inspectors in a real basement with no signal, on the
   oldest supported tablet, before the pilot. Non-negotiable — no lab test reproduces
   the actual environment described in the brief.
8. **Regression guard.** A permanent "offline golden path" suite that runs on every
   release candidate: go offline → complete inspection → reconnect → verify server
   state.

---

## 12. Staged rollout

Feature-flagged end to end. Every stage has an explicit exit gate; no stage advances on
elapsed time alone.

- **Stage 0 — Shadow mode (internal).** The sync engine writes to the outbox and reads
  locally, but **all reads still come from the network** and writes go through the
  existing endpoints. Purpose: validate the outbox and the new endpoints under real load
  with zero user-visible behavior change. *Exit:* outbox write path has no crashes,
  new endpoints are within latency budget, and shadow writes reconcile cleanly
    against the primary path.
- **Stage 1 — Internal dogfood.** Engineering/QA use offline mode on real inspections
  that are later discarded or carefully reviewed. Kill switch verified. *Exit:* all
  stage-1 acceptance criteria in M3 met; purge verified manually on a real device.
- **Stage 2 — Limited pilot.** A small, volunteer group of inspectors in **one region**
  with a supervising contact on standby. Daily triage of sync failures and a named
  rollback owner. *Exit:* pilot exit criteria (below) met for a sustained period, and
  zero data-loss or purge-breach incidents.
- **Stage 3 — Expanded pilot.** More inspectors and a second region, specifically to
  exercise the **supervisor-edit conflict path** at realistic volume. *Exit:* conflict
  rate and resolution time within target; no blocking conflicts unresolved.
- **Stage 4 — Broad rollout.** Flag on by default, staged by region with a canary
  percentage. The kill switch stays in place.

**Pilot exit criteria** (definition of "the pilot worked"):
1. Zero confirmed incidents of acknowledged inspector input lost.
2. 100% of accepted inspections purged within 24 hours (measured, from telemetry — not
   asserted).
3. Sync success rate and p95 sync duration at or better than the agreed target.
4. Field-conflict rate low enough that the conflict tray is not a daily burden;
   blocking conflicts explained and handled.
5. Inspectors complete inspections offline at least as fast as online.

---

## 13. Rollback

The rollback risk is asymmetric: **turning the feature off eagerly can destroy pending
work.** Therefore rollback is two-phased.

1. **Phase A — Drain mode (always run first).** Flag flips to `drain`: the app stops
   *accepting new* offline edits, pushes everything in the outbox, confirms, and only
   then reverts to online-only. No pending data is ever discarded by a rollback.
2. **Phase B — Hard disable.** Online-only read-through-cache behavior, identical to
   today's app. Used only after the outbox is empty, or in an emergency where retaining
   data is judged less important than stopping harm.

**Rollback triggers** (examples; final list agreed before Stage 1):
- Any confirmed loss of acknowledged input.
- Any purge breach past 24 hours.
- Sync success rate below threshold for a sustained period.
- Crash-free-session regression attributable to the offline stack.
- Data-integrity errors (version mismatches, audit-log gaps) above rate zero.

**Notes:**
- Server-side additions are **additive and independently deployable**, so server
  rollback does not require client rollback; old clients simply never call the new
  endpoints.
- Client rollback is complicated by §9.1: once the store is authoritative, force-killing
  the app to an older build must not wipe a non-empty outbox. Blocks are enforced in the
  migration path.
- **Rollback does not un-retire data.** If a purge already ran, it cannot be undone;
  this is why the purge job is gated behind stage-2 verification rather than enabled at
  stage 0.

---

## 14. Milestones

Sequenced with dependencies. **No calendar dates and no staffing estimates** — these
are commitments the team should size; the plan's job is to make the order and the
blocking relationships explicit. Each milestone lists the acceptance criteria that gate
moving on.

### M0 — Assumptions closed and decisions made
**Depends on:** nothing.
**Work:** validate A1–A15 (§2); get written answers to D1–D10 (§16); measure photo
sizes, storage headroom, and site throughput; confirm compliance interpretation of
A9/A10.
**Acceptance:** all **[load-bearing]** assumptions have measured evidence or a named
owner; every decision in §16 has a recorded answer; scope boundaries in §1 signed off.
**Blocks:** M1 (cannot pick the sync contract while D1 is open).

### M1 — Local authoritative store and outbox (no sync yet)
**Depends on:** M0.
**Work:** schema migrations (§4, §9.1); transactional write path where every mutation
produces an outbox op; offline-capable UI states; storage projection and low-storage
handling; encryption at rest (D9).
**Acceptance:** airplane-mode golden path — open inspection, fill 50 fields, capture 40
photos, capture signature, kill the app, reopen, **all data present**; automated test
proves no code path mutates state without an accompanying outbox op; PII encrypted at
rest verified.
**Blocks:** M2, M3.

### M2 — Server sync endpoints
**Depends on:** M1 (and M0's D1 answer).
**Work:** `GET /sync/inspections` with opaque cursor; `POST /sync/inspections/{id}/ops`
with per-op results and idempotency; `GET /changes`; attachment endpoints; server
backfill (§9.2); auth/authorisation re-validation at sync time (§8.4).
**Acceptance:** idempotency replay returns the original result; concurrent supervisor
edit + client push yields a deterministic, audited outcome; load test at projected
fleet volume; backfill reconciles 100% of existing records.
**Blocks:** M3.

### M3 — Client sync engine, conflict resolution, and attachment upload
**Depends on:** M2.
**Work:** sync coordinator with lease (§5.6); pull/push order (§5.3); retry/backoff
(§5.5); chunked resumable upload (§7); conflict detection, the `conflicts` table and the
resolution tray (§6); telemetry (§10).
**Acceptance:** every fault in the integration harness is survived with no data loss;
kill-the-app-mid-upload resumes; 40-photo inspection uploads over a throttled link and
completes; the permutation suite converges for all tested interleavings; dashboards live.
**Blocks:** M4.

### M4 — Purge, security hardening, and compliance evidence
**Depends on:** M3.
**Work:** purge job + verification + overdue alerting (§8.3); PII-in-logs audit; secure
deletion of DB free pages; MDM/remote-wipe integration; security review and penetration
test; session/re-auth policy (D5).
**Acceptance:** canary-PII test proves zero PII remains in DB, WAL, and file system
after purge; `purge_overdue_age_hours` alerting verified end to end; security findings
triaged with no open high-severity items.
**Blocks:** M5.

### M5 — Pilot (Stage 2), measurement, and exit decision
**Depends on:** M4, plus the manual field test and the M1/M3 regression guards.
**Work:** Stage 0/1 exits; limited pilot with daily triage; conflict-rate tracking;
collect pilot exit criteria evidence (§12).
**Acceptance:** all five pilot exit criteria met; go/no-go recorded with the data behind
it; rollback rehearsed once, not just documented.
**Blocks:** broad rollout (Stage 3/4).

---

## 15. Risk register (top items)

| Risk | Why it matters | Mitigation |
|---|---|---|
| Purge deletes audit data (or audit retention defeats purge) | Direct regulatory breach either way | Resolve A10 in writing at M0; retain hashes + pseudonymous refs locally; purge verification test |
| Outbox destroyed by an app upgrade | Silent data loss — exactly the bug the feature exists to fix | Destructive migrations blocked while outbox is non-empty (§9.1); upgrade-with-pending-ops system test |
| Photo volume overwhelms slow links | Inspection never finishes syncing; inspectors lose trust | Optimised derivatives, resumable chunks, bounded parallelism, per-item status, tune from telemetry |
| Version increments missed on some server write path | Client overwrites supervisor edits silently | Audit counters on every write path; canary job comparing version to `updated_at` |
| Conflict rate higher than assumed | Tray becomes daily overhead; product asks for a merge editor | Per-field conflict metrics from day one; fallback is field check-out/locking, not a merge algorithm (D3) |
| Clock skew corrupts purge/tie-breaks | Wrong purge timing, wrong conflict winner | Server-time offset persisted on every pull; never trust raw device time |

---

## 16. Decisions required before implementation (with recommendations)

These must be answered in **M0**; each one changes code, not just wording.

**D1 — Can we add sync-specific endpoints to the server API?**
Recommendation: **yes, add three additive endpoints** (§5.1). Integer per-record
versions alone cannot support field-level merge or an efficient delta pull; without new
endpoints we are forced into last-write-wins on whole records, which *will* discard
supervisor or inspector work. Keeping them additive means zero migration risk for
existing clients.
*If refused:* fall back to whole-record LWW with `If-Match: version`, and accept that
concurrent edits lose data — this should be a written, signed-off product decision.

**D2 — How do we handle form template changes while a tablet is offline?**
Recommendation: **pin `template_version` on the inspection at sync time**; the tablet
renders the pinned schema. On reconnect, if the template changed, treat it as a
**non-blocking** review item for additive/compatible changes and a **blocking** item when
a field the inspector answered was removed or retyped. Never silently re-map answers to
a schema they were not captured against.

**D3 — What happens when supervisor and inspector edit the same field?**
Recommendation: **preserve both, auto-resolve only where precedence is unambiguous**
(§6.2). Specifically: inspector wins pre-acceptance, supervisor wins post-acceptance,
and ambiguous divergences go to a human. If the conflict rate turns out to be high, the
next investment should be **whole-inspection check-out** (a soft lock while an inspector
is offline), not a merge algorithm — this matches "no full collaborative editor".

**D4 — How long should the server retain idempotency keys?**
Recommendation: **30 days**, with the practical requirement that it exceeds the maximum
credible offline window plus retry tail (A2). Enforce it as a monitored invariant: alert
if any incoming `op_id` is older than the retention window.

**D5 — How long may a tablet stay offline before re-authentication is required?**
Recommendation: **device-credential-backed app unlock plus a server-defined maximum
offline period**, after which syncing requires online re-auth; the exact value comes from
compliance, not from this plan. Do not ship with an unbounded offline window on a device
holding customer PII.

**D6 — When should photo upload run?**
Recommendation: **automatic on any connectivity, deferred while on low battery**, with an
explicit user override ("upload now"). Also offer "upload on Wi-Fi only" for inspectors
on metered cellular — with the honest caveat that it delays the purge clock only if
acceptance happens before upload, which is why upload should be gated on connectivity,
not on network type, by default.

**D7 — Cross-device continuation: in or out?**
Recommendation: **out for the pilot**. Supporting it means distributing the authoritative
local state across devices, which is a materially harder problem. Handle the practical
case operationally for the pilot: an inspection started on the wrong tablet gets
reassigned by a supervisor.

**D8 — Do we upload originals or optimised derivatives?**
Recommendation: **optimised derivative by default, original retained locally until
purge, configurable per policy.** Evidence first: measure actual file sizes (A5) and the
evidentiary requirement for photos before locking this in — if originals are legally
required, the storage plan (§7, item 9) and the upload budget change substantially.

**D9 — What encryption do we use for the local database?**
Recommendation: **SQLCipher (or equivalent page-level encryption) with the key in the
platform keystore.** Accept the stated limit (§8.2) and do not market it as stronger
than it is. Verify it against the fleet's oldest hardware for performance impact before
committing.

**D10 — Who owns the "accepted" timestamp, and what exactly counts as customer data?**
Recommendation: **the server owns `accepted_at`**, and the purge scope is fixed as an
explicit, enumerated field list in code (§4 tables) rather than a vague table-wide
delete. Get the enumerated list reviewed by compliance at M0 and turn it into a test
fixture. This is the cheapest place to prevent a regulatory breach.

---

## 17. Summary of what is deliberately not being built

Automatic text merging; real-time co-editing; peer-to-peer sync; offline reassignment;
cross-device continuation; full-record rewrite of the REST API. Each is a plausible
follow-on once the pilot produces conflict-rate and volume data — none is needed to
solve the problem in `BRIEF.md`.
