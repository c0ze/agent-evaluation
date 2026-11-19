# PLAN — Offline inspection capture and sync

Status: draft for review. Scope: the tablet inspection app plus the server
surface it depends on.

All product input comes from `BRIEF.md`. Anything not in the brief is recorded
as an assumption (§2) rather than silently decided. No calendar dates or
headcount figures appear in this document; milestone ordering and dependencies
carry the schedule, and sizing is deferred to the team that owns the work (§19).

---

## 1. Problem statement

An inspector opens an assigned inspection, loses connectivity, and loses work.
The brief's phrasing — "a lost connection after opening an inspection can
discard notes" — points at the current architecture, not at a missing feature:
the app treats SQLite as a read-through cache, so the only durable copy of an
open inspection lives on the server. Every edit is therefore provisional until
the network agrees to take it.

The fix is a change of ownership, not a retry loop:

> **Local-first.** Once an inspection is opened on the tablet, the tablet holds
> the durable copy of the inspector's own work until the server has
> acknowledged it. Network availability affects *when* work reaches the server,
> never *whether* it survives.

Everything below follows from that rule, plus three constraints from the brief
that pull against it: supervisors edit the same record from the web; regulators
require an audit history; and local customer data must be gone within 24 hours
of acceptance.

---

## 2. Assumptions

Each assumption is tagged with what breaks if it is false. The three that carry
the most risk are developed in `RESPONSE.md`.

| # | Assumption | If false |
|---|---|---|
| A1 | The existing REST API can be extended **additively** (new endpoints, new optional fields, new headers) without breaking current clients. | Sync must be designed against a fixed API, or the server needs a breaking release; M0 outcome changes. |
| A2 | The integer record version is a whole-inspection token covering form content, not attachments or audit events. | If the version is finer-grained (per section) or coarser (per site), the merge base and rebase loop need redesign. |
| A3 | An inspector's offline window is bounded by roughly one working shift, and the device returns to connectivity at least daily. | Leases, package pre-download windows, local retention backstops and conflict volume all shift; see `RESPONSE.md` R2. |
| A4 | Supervisor edits and inspector edits overlap only occasionally and are usually on different fields. | Conflict review becomes the dominant path and needs a dedicated workflow and staffing, not an exception queue. |
| A5 | Each inspection needs at most 40 photos plus one signature, and photos can be compressed to a size that fits comfortably in tablet storage for several concurrent inspections. | Storage planning, upload strategy and purge scheduling change; needs measurement on real devices. |
| A6 | "Accepted" is a server-side state transition performed by a supervisor, and the brief's 24-hour clock starts there. | Retention trigger and the acceptance gate (§10.4) must be redefined with compliance. |
| A7 | The tablet is company-managed and enrolled in MDM, so device revocation and remote wipe are available as a compliance backstop. | The plan cannot guarantee deletion on a device that never reconnects; a different control (e.g. short-lived per-inspection keys escrowed to the server) is required. |
| A8 | Inspectors authenticate before going offline and can work through a shift on a cached, device-bound credential. | Offline capture is limited to the access-token lifetime, which is likely too short for a shift. |
| A9 | The server can store attachments in object storage with presigned, resumable uploads, or an equivalent exists. | Attachments must stream through the API tier; throughput and cost profile change. |
| A10 | Form schema can be pinned per offline package and the server will accept a submission against the pinned schema. | Schema drift mid-offline becomes a data-loss path and needs a migration-on-submit design. |
| A11 | Supervisors do not need to see an inspector's in-progress offline work in real time; near-real-time is acceptable. | Requires streaming draft sync and a presence model, which the brief's "no full collaborative editor" rules out. |
| A12 | Audit history for pre-existing inspections is already held by the current system; this work extends it forward rather than backfilling history. | Backfill and audit reconstruction become a separate compliance project. |
| A13 | The 24-hour deletion obligation can be satisfied by cryptographic erasure (destroying a per-inspection key) plus file deletion, and this is acceptable as "removal". | Physical-media sanitisation requirements would force device re-imaging, which is incompatible with a tablet fleet. |
| A14 | Inspectors work one inspection at a time in the field, so UI can assume a single active record. | Multi-record capture needs a queue UI and more aggressive storage management. |

---

## 3. Goals, non-goals, and scope boundaries

### 3.1 Goals

1. An inspector can complete an entire inspection — open, fill, photograph,
   sign, submit — with the radio off, and lose nothing to a crash or a killed
   process.
2. Work syncs correctly and idempotently over intermittent connectivity,
   including links that drop mid-upload.
3. Concurrent supervisor edits are either merged safely or surfaced as an
   explicit, reviewable conflict. No silent overwrite in either direction.
4. Every change is attributable and auditable end to end, including changes made
   offline.
5. Local customer data is provably removed within 24 hours of acceptance.
6. The change is reversible without destroying unsynced field work.

### 3.2 Non-goals

- **No real-time collaborative editing.** No CRDT, no operational transform, no
  presence/cursors, no live co-editing of the same field. The brief rules this
  out explicitly.
- No offline capability for the supervisor web app.
- No new inspection types, form designer, or reporting changes.
- No changes to how inspections are assigned or scheduled.
- No background sync on personal (BYOD) devices; company-managed only.
- No offline PDF/report generation.
- No migration of historical inspections into the local model.

### 3.3 Scope boundary in one sentence

The boundary is the **record**: everything needed to complete one assigned
inspection offline is in scope; anything involving cross-record consistency,
scheduling, or analytics is out.

### 3.4 Interface boundary

Three surfaces move:

| Surface | Change |
|---|---|
| Tablet app | New local write path, sync engine, offline UX, retention/purge. |
| Server API | Additive sync endpoints, idempotency, attachment tickets, lease, audit ingest. Existing endpoints unchanged. |
| Supervisor web | Conflict review queue, lease/status indicators, acceptance gate. Small but non-zero. |

If the supervisor web cannot take the conflict queue in the same release, the
pilot must fall back to a read-only "conflict report" for supervisors and
manual resolution by operations — degraded but acceptable for a pilot.

---

## 4. User flows

### 4.1 Prepare (online, before leaving signal)

1. Inspector sees assigned inspections with a **offline readiness** badge:
   *not downloaded*, *ready*, *stale*, *conflict*.
2. Tapping *Prepare for offline* downloads an **inspection package** (§6):
   header, pinned form schema, reference data, any existing draft, lease.
3. Package build is atomic: a partially downloaded package is never marked
   ready. Readiness shows the package age and the assignment's due window.
4. A bulk "prepare all for today" action downloads every assigned inspection
   due in the working window, with a storage check up front.

### 4.2 Capture (offline)

1. Inspector opens a ready inspection. App takes a lease if online; if offline,
   it reuses the lease in the package or marks the record *unleased* (§6.3).
2. Every field change is written to SQLite in a transaction before the UI
   confirms it — no in-memory-only state, no debounce that can lose the last
   keystroke on process death. Autosave is the write, not a timer.
3. Photos: capture to app-private storage, hash, record metadata, show count
   against the 40 limit. No writes to the OS media gallery.
4. Signature: capture on a signature pad; store image plus signer name, role,
   captured-at, device id, and a hash. The signature is immutable once captured;
   re-signing creates a new signature version and an audit event.
5. Optional *Mark ready to submit* sets local state to `ready` but does not
   require connectivity. Submission itself can be queued.
6. If connectivity appears at any point, the sync engine works in the
   background without blocking the UI. The inspector never waits on a spinner
   to keep typing.

### 4.3 Sync (any connectivity)

1. Push pending ops for the oldest-pending inspection first.
2. If the server version moved, pull, merge, and either rebase silently
   (disjoint fields) or park the conflicting fields for review.
3. Upload attachments opportunistically, resumable, in parallel with form sync.
4. Finalize a batch only when every attachment in its manifest is verified.
5. On success, show a per-inspection "synced at <relative time>" state; never a
   global "all good" that hides one stuck record.

### 4.4 Supervisor review (online, web)

1. Supervisor sees live draft state, a *last synced* timestamp, and whether the
   inspector is holding an offline lease.
2. Supervisor may edit. Edits are recorded as ordinary revisions with an actor
   and an audit event.
3. If the inspection is in conflict, the supervisor sees a field-level diff:
   *server value*, *inspector value*, *base value*, plus who and when for each,
   and resolves field by field. Resolution is an explicit audited action.
4. Acceptance is gated when the assigned device has an unsynced session
   (§10.4).

### 4.5 Acceptance and purge

1. Supervisor accepts. Server records the acceptance event and emits a retention
   instruction to the device.
2. Device, on next sync, deletes local customer data for that inspection within
   the 24-hour window and returns a signed deletion receipt.
3. If the device never connects, the local max-age backstop (§10.3) deletes the
   data anyway, and MDM revocation remains the last resort.

---

## 5. Architecture overview

```
┌────────────────── tablet ──────────────────┐
│ UI (forms, camera, signature)              │
│      │ write-first, synchronous             │
│ ┌────▼──────────────────────────────────┐  │
│ │ SQLite (encrypted)                    │  │
│ │  draft · pending_op · attachment_local│  │
│ │  audit_event (hash-chained) · package │  │
│ └────┬──────────────────────────────────┘  │
│      │ durable queue                        │
│ ┌────▼─────────────┐   ┌─────────────────┐ │
│ │ Sync engine      │   │ Retention/purge │ │
│ │ pull→merge→push  │   │ key destruction │ │
│ └────┬─────────────┘   └─────────────────┘ │
└──────┼─────────────────────────────────────┘
       │ HTTPS, idempotent, resumable
┌──────▼─────────────────────────────────────┐
│ API: sync batch · changes cursor · lease   │
│      attachment tickets · audit ingest     │
├────────────────────────────────────────────┤
│ Object storage (staged → bound attachments)│
├────────────────────────────────────────────┤
│ Relational store: records, versions,       │
│ audit log, idempotency keys, leases        │
└────────────────────────────────────────────┘
```

Two independent queues — operations and attachments — because they fail
differently and at different speeds. Coupling them would make a 200 MB photo
set block a 2 KB form save.

---

## 6. Local data model

SQLite stops being a cache. It becomes the system of record for
*the inspector's unacknowledged work* and a materialized mirror of
*the server's acknowledged state*. The distinction is carried per row by
`state`, never inferred.

### 6.1 Tables

```sql
-- One row per downloaded inspection. Deleted on purge.
CREATE TABLE inspection_package (
  inspection_id   TEXT PRIMARY KEY,
  site_id         TEXT NOT NULL,
  schema_version  INTEGER NOT NULL,   -- pinned form schema
  base_version    INTEGER NOT NULL,   -- server version at download
  base_doc        TEXT NOT NULL,      -- canonical JSON snapshot (merge base)
  base_doc_hash   TEXT NOT NULL,
  lease_id        TEXT,
  lease_expires_at TEXT,
  status          TEXT NOT NULL,      -- assigned|in_progress|submitted|accepted
  downloaded_at   TEXT NOT NULL,      -- device clock, metadata only
  stale_after     TEXT NOT NULL
);

-- Inspector's working copy. One per inspection (A14).
CREATE TABLE draft (
  inspection_id   TEXT PRIMARY KEY REFERENCES inspection_package,
  doc             TEXT NOT NULL,      -- canonical JSON: field_id -> value
  doc_hash        TEXT NOT NULL,
  local_rev       INTEGER NOT NULL,   -- monotonic, local only
  base_version    INTEGER NOT NULL,   -- last server version merged in
  state           TEXT NOT NULL,      -- draft|ready|submitted|conflict|purging
  updated_at      TEXT NOT NULL,
  updated_by      TEXT NOT NULL
);

-- Append-only queue. Never rewritten, only appended and state-transitioned.
CREATE TABLE pending_op (
  op_id           TEXT PRIMARY KEY,   -- UUIDv7, doubles as idempotency key
  inspection_id   TEXT NOT NULL,
  seq             INTEGER NOT NULL,   -- per-inspection ordering
  kind            TEXT NOT NULL,      -- field_set|group_add|group_remove|
                                      -- status|submit|attachment_bind
  payload         TEXT NOT NULL,
  base_version    INTEGER NOT NULL,
  state           TEXT NOT NULL,      -- queued|inflight|acked|conflict|dead
  attempts        INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT,
  created_at      TEXT NOT NULL,
  UNIQUE (inspection_id, seq)
);

CREATE TABLE attachment_local (
  attachment_id   TEXT PRIMARY KEY,   -- client-generated UUID
  inspection_id   TEXT NOT NULL,
  kind            TEXT NOT NULL,      -- photo|signature
  rel_path        TEXT NOT NULL,      -- app-private dir, never MediaStore
  mime            TEXT NOT NULL,
  bytes           INTEGER NOT NULL,
  sha256          TEXT NOT NULL,
  width           INTEGER,
  height          INTEGER,
  captured_at     TEXT NOT NULL,
  capture_skew_ms INTEGER,            -- device time vs server offset
  state           TEXT NOT NULL,      -- captured|uploading|staged|bound|
                                      -- verified|failed
  remote_key      TEXT,
  upload_offset   INTEGER NOT NULL DEFAULT 0,
  key_ref         TEXT                -- per-inspection DEK reference
);

CREATE TABLE audit_event (
  event_id        TEXT PRIMARY KEY,
  inspection_id   TEXT NOT NULL,
  seq             INTEGER NOT NULL,   -- local chain order
  actor_id        TEXT NOT NULL,
  action          TEXT NOT NULL,
  payload_hash    TEXT NOT NULL,
  prev_hash       TEXT,
  hash            TEXT NOT NULL,      -- H(prev_hash || canonical(event))
  device_time     TEXT NOT NULL,
  server_time     TEXT,              -- filled on ack
  state           TEXT NOT NULL      -- pending|acked|rejected
);

CREATE TABLE sync_cursor (
  inspection_id   TEXT PRIMARY KEY,
  server_version  INTEGER NOT NULL,
  last_pull_at    TEXT,
  last_push_at    TEXT,
  conflict_count  INTEGER NOT NULL DEFAULT 0,
  last_error      TEXT
);

CREATE TABLE retention_job (
  inspection_id   TEXT PRIMARY KEY,
  reason          TEXT NOT NULL,      -- accepted|unassigned|cancelled|
                                      -- max_age|device_revoked
  due_at          TEXT NOT NULL,      -- <= accepted_at + 24h
  state           TEXT NOT NULL,      -- scheduled|running|done|blocked
  receipt         TEXT
);
```

Indices: `pending_op(state, next_attempt_at)`,
`attachment_local(inspection_id, state)`, `retention_job(state, due_at)`.

### 6.2 Invariants

These are enforced in code and asserted in tests. A violation is a bug of the
highest severity, not an edge case.

1. **I1 — write before render.** No field change is shown as saved before the
   SQLite transaction commits.
2. **I2 — append-only queue.** `pending_op` rows are never deleted before
   acknowledgement; state transitions are one-way.
3. **I3 — no purge before sync.** Retention never deletes an inspection that
   has `queued` or `inflight` ops, unless the job's reason is `device_revoked`
   or `max_age` (documented, audited exception).
4. **I4 — attachment durability ordering.** A local photo file is deleted only
   after the server confirms it is bound *and* its hash is verified.
5. **I5 — audit completeness.** Every state-changing local action appends an
   audit event in the same transaction.
6. **I6 — single writer per inspection.** Only one `draft` row per
   inspection; concurrent UI writers are serialized through a single write
   queue.
7. **I7 — base coherence.** `draft.base_version` always equals the server
   version whose document is the merge base. Rebase updates both atomically.

### 6.3 Inspection state machine

```
assigned ──open──▶ in_progress ──submit──▶ submitted ──accept──▶ accepted
    │                   │                      │                   │
    │                   │◀─────reopen──────────┘◀────reopen────────┘
    └────cancel────────▶ cancelled ◀────────────┘
```

Rules:

- `submit` and `accept` are different actors and different transitions.
- `accept` freezes content. Any mobile op based on a version at or before the
  accepted version is rejected and surfaced as a **late change**; the
  supervisor must reopen before it can be applied. This is the only correct
  outcome — silently applying it would rewrite an accepted, audited record.
- `reopen` bumps the version and emits an audit event.
- Local `state` mirrors this, plus `conflict` and `purging`, which are
  device-local only.

### 6.4 Lease

A lease is an advisory record, not a mutex:

```
POST /inspections/{id}/lease      → { lease_id, expires_at, version }
DELETE /inspections/{id}/lease
```

- Acquired online when the package is prepared or the inspection is opened
  online.
- Offline, the package's lease is reused until `lease_expires_at`.
- A lease does not block supervisor edits (that would violate A11 and create a
  deployment deadlock). It is used for: display ("inspector offline since…"),
  and the acceptance gate (§10.4).
- Expired lease + offline editing = allowed, but the record is marked
  *unleased*; this raises conflict risk and is visible to both sides. An
  inspector must never be blocked from working because a lease lapsed in a
  basement.

---

## 7. Sync protocol

### 7.1 Transport shape

Additive REST, consistent with the existing stack (A1, A2):

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/sync/assignments?cursor=` | Assignments changed since cursor; package manifest. |
| `GET` | `/inspections/{id}/package?schema={v}` | Full package: header, pinned schema, reference data, base doc. |
| `POST` | `/inspections/{id}/sync` | Atomic batch of ops + audit events. `If-Match: <version>`, `Idempotency-Key: <batch_id>`. |
| `GET` | `/inspections/{id}/changes?since={v}` | Current doc + version + status, for rebase. |
| `POST` | `/inspections/{id}/attachments` | Request upload ticket(s): returns presigned URL, expiry, storage key. |
| `POST` | `/inspections/{id}/attachments/{aid}/complete` | Confirm upload, return verified hash/url. |
| `POST` | `/inspections/{id}/sync/{batch}/finalize` | Commit revision once manifest is fully verified. |
| `POST` | `/inspections/{id}/retention-receipt` | Deletion receipt from device. |
| `POST` | `/devices/{id}/revoke` | (admin) mark device revoked; all future sync rejected. |

`POST /sync` is atomic per batch: all ops apply or none do. A batch carries at
most one base version; ops that would need a different base must be split.

### 7.2 Idempotency

Intermittent connectivity makes "request succeeded, response lost" the normal
case, not an exception. Every mutating call carries a client-generated
`Idempotency-Key` (UUIDv7). The server stores `(key, request_hash, response)`:

- Same key, same hash → replay the stored response, do not re-apply.
- Same key, different hash → `422`, a client bug; quarantine the op.
- Key retention must exceed the longest expected offline window plus retry tail
  (a configuration value, set from A3; not guessed here).

Attachment uploads are idempotent by `attachment_id` + `sha256`, and resumable
by byte offset. Re-uploading a complete, identical object is a no-op.

### 7.3 Push algorithm

```
for each inspection with pending work, oldest pending first:
  attempt = 0
  loop:
    pull remote doc + version                      # cheap, always
    if remote.version != draft.base_version:
        merged = three_way_merge(base_doc, local_doc, remote_doc)
        if hard_conflicts:
            park conflicting fields; draft.state = conflict
            notify inspector; break
        else:
            rebase: base_doc = remote_doc; base_version = remote.version
                   local_doc = merged; append audit event 'rebase'
    batch = { ops since last ack, audit events, manifest refs }
    r = POST /sync  (If-Match: base_version, Idempotency-Key)
    case 200: ack ops; update cursor; break
    case 409: attempt += 1
              if attempt > 3: park as conflict; break
              continue loop                    # re-pull and rebase
    case 5xx/timeout: backoff with jitter; retry same key
    case 4xx (semantic): mark op dead; quarantine; alert; break
finalize when manifest complete and all hashes verified
```

The rebase loop is bounded on purpose. An unbounded loop under a busy
supervisor turns into a livelock and burns battery; three attempts then a
visible conflict is the honest outcome.

### 7.4 Pull strategy

- Per-inspection fetch on demand is the default — it is cheap and avoids
  cross-record coupling.
- A cursor-based assignment feed (`/sync/assignments?cursor=`) keeps the
  freshness badges accurate without polling every record.
- Background sync runs on OS scheduling with constraints (network available,
  charging optional, battery not critical), never as a foreground blocking
  task.

### 7.5 Failure taxonomy

| Failure | Detection | Handling |
|---|---|---|
| Response lost after commit | Retry returns replayed response | Idempotency; no duplicate |
| 409 version mismatch | `If-Match` | Pull, merge, rebase, retry (≤3) |
| Partial attachment upload | Offset < bytes on resume | Resume from offset |
| Attachment corrupted in transit | SHA-256 mismatch | Discard, re-upload, 3 strikes → failed |
| Server 5xx | Status | Exponential backoff + jitter, capped |
| Auth expired | 401 | Refresh; if offline, queue and mark `reauth_required` |
| Device revoked | 403 `device_revoked` | Stop sync, wipe local data, notify |
| Clock skew | Server `Date` vs device | Record skew on events; never order by device time |
| Schema version unknown | 409 `unsupported_schema` | Block submit, prompt app update; never silently drop fields |
| Storage full mid-capture | Pre-flight + write error | Block new capture, keep existing, warn loudly |

### 7.6 What the server must never do

- Never apply a partial batch.
- Never accept a write without an actor and an audit event.
- Never auto-resolve a conflict by last-write-wins.
- Never return a success for an attachment it has not hashed.

---

## 8. Conflict policy

### 8.1 Model

Three-way merge against the downloaded base snapshot. For each field:

| base B | local L | remote R | Outcome |
|---|---|---|---|
| any | L == R | | converged, take either |
| B | L ≠ B, R == B | | take L |
| B | L == B, R ≠ B | | take R |
| B | L ≠ B, R ≠ B, L ≠ R | | **conflict** — keep both, review |

No CRDT, no vector clocks, no per-character merge. The merge base is a whole
document snapshot held per draft (I7), which is why the package must carry the
full document and not just a version number.

### 8.2 Merge units

- **Scalar fields** — as above.
- **Repeating groups** (defect lists, checklist rows) — items carry
  client-generated stable ids. Adds merge additively. Edits merge per item.
  Deletes are tombstones (`{id, deleted: true}`), so a delete on one side and an
  edit on the other is a detectable conflict rather than a resurrection.
- **Attachments** — additive sets keyed by `attachment_id`. No conflict on add.
  A metadata edit (caption, annotation) is a scalar field on the attachment.
- **Signature** — immutable, single-valued, never merged. If the server side
  has a different signer or a different signature hash, it is a hard conflict
  requiring human resolution. A signature is evidence, not a value.
- **Status** — a separate small state machine (§6.3). Status transitions are
  never merged field-by-field; invalid transitions are rejected with a reason
  and surfaced.

### 8.3 Conflict classes and routing

| Class | Example | Route |
|---|---|---|
| Silent rebase | Inspector edits notes, supervisor edits address | Auto-merge, audit event, no UI |
| Soft conflict | Both edit the same free-text field | Supervisor review queue; inspector sees "changes were merged, review flagged" |
| Hard conflict | Signature differs; submit vs accept | Block; supervisor must reopen or discard the inspector's late change with a stated reason |
| Policy conflict | Inspector edits a field supervisor locked (if locking exists — see D1) | Reject with reason, notify inspector |

### 8.4 Rules that prevent silent data loss

1. The losing value is never discarded. It is stored in the conflict record and
   visible in the review UI.
2. Resolution is an explicit action with an actor and an audit event.
3. The inspector is told, on the device, which fields were resolved against
   them — not just "synced".
4. Conflict rate is a first-class pilot metric (§12), because a high rate means
   the ownership model (D1) is wrong, not that the merge code has bugs.

---

## 9. Attachments and signature

### 9.1 Capture

- Photos go to app-private storage; the camera intent writes to a `FileProvider`
  path, never `MediaStore`. This matters for purge: gallery copies are invisible
  to the app and violate "removal".
- Downscale on capture to a configurable long edge and JPEG quality; store the
  original only if policy requires it. Default target: readable defect detail at
  a size that allows several inspections on a 64 GB device (A5 — must be
  measured, not assumed).
- Compute SHA-256 on the device at capture time and carry it through upload.
- Signature: rendered to PNG, plus structured metadata (signer name, role,
  timestamp, device id, method). The image and metadata are hashed together.

### 9.2 Upload

1. `POST /attachments` with `{attachment_id, kind, bytes, sha256, mime}` →
   presigned URL + storage key + expiry.
2. Upload resumable (offset-based), retried with backoff, resumable across app
   restarts because the offset is persisted in `attachment_local`.
3. `POST /attachments/{aid}/complete` → server fetches or receives, hashes,
   compares, marks `verified`, returns canonical reference.
4. Only `verified` attachments enter a finalize manifest.

Uploads proceed opportunistically before submission — an inspector who walks
past a window with signal should not have to press anything for 40 photos to
start moving.

### 9.3 Ordering and atomicity

Form content and photos are committed together at finalize, not before:

- Photos may be **staged** server-side while the form is still a draft.
- `finalize` binds the verified set to the revision. A missing or failed photo
  blocks finalize and therefore blocks submission.
- Staged-but-never-finalized attachments are garbage-collected after a TTL; the
  GC job is idempotent and reports counts, because orphan growth is a silent
  cost bug.

This gives the good property: partial progress on a 200 MB photo set survives
app kills and dead batteries, but no revision is ever complete-but-missing-a-photo.

### 9.4 Deletion order

Local file → only after server-side hash verification. This inverts the naive
order and is the difference between "we uploaded it" and "we still have it if
the upload lied".

---

## 10. Security, privacy, and retention

### 10.1 Threat model

| Threat | Control |
|---|---|
| Lost or stolen tablet | Encrypted DB and files; key in hardware-backed keystore; device PIN/biometric gate; MDM remote wipe |
| Malicious or curious inspector | Per-inspection leases and audit; no bulk export; screenshot block on signature/PII screens |
| Rooted device / extracted DB | SQLCipher-class encryption; keys non-exportable; integrity attestation optional |
| Backup exfiltration | Disable OS backup for the app sandbox |
| Network interception | TLS 1.2+, certificate pinning (with an MDM-proxy exception — see D8) |
| Stale credential after offboarding | Short access tokens + device-bound refresh; revocation checked on every sync |
| Log/crash leakage | Structured logging with field allowlist; crash reports stripped of document content |
| Clock manipulation to evade retention | Retention uses monotonic elapsed time and server time offset; clock jumps produce audit anomalies |

### 10.2 Encryption and key hierarchy

- SQLite database encrypted at rest (SQLCipher or platform equivalent).
- Each inspection gets its own data encryption key (DEK), wrapped by a
  device-bound key in the hardware keystore. Photos are encrypted with the same
  DEK; the wrapper lives in `attachment_local.key_ref`.
- **Deletion is key destruction first.** Dropping a wrapped DEK is fast,
  atomic, and does not depend on filesystem behaviour on flash. File deletion
  and row deletion follow, then a `VACUUM`.
- Note honestly: overwriting blocks on flash is not reliable; crypto-erase is
  the defensible mechanism (A13). If compliance demands physical sanitisation,
  the answer is device re-imaging, not an app feature.

### 10.3 Retention matrix

Trigger: acceptance (primary), unassignment, cancellation, device revocation,
max age (backstop).

| Data class | Location | Deleted when | Mechanism |
|---|---|---|---|
| Form answers | SQLite `draft` | accepted + ack | row delete + key destroy |
| Photos | app-private files | accepted + ack | file delete + key destroy |
| Signature | app-private file + metadata | accepted + ack | file delete + key destroy |
| Thumbnails/caches | app cache dirs | accepted + ack | directory purge |
| Local audit events | SQLite | after acked by server, plus retention floor | row delete |
| Sync metadata (ids, versions, timestamps) | SQLite | retained (no customer content) | — |
| Crash/log buffers | app logs | on purge | truncate, verified |
| Server records | server | per existing policy | out of scope |

Deadline: `due_at = accepted_at + 24h − safety margin`, scheduled as a
`retention_job`. The margin exists because the device may only reach the network
at the end of a shift; it is a configuration knob, not a guess.

**Backstop.** Any inspection whose local data is older than a configured
maximum age is purged regardless of server state, with a receipt marked
`max_age`. This is the only mechanism that can satisfy the obligation on a
device that never reconnects. It is also the mechanism that can destroy
unsynced work, so it must be loud: warn the inspector at package open, warn
again at 75% of the window, and record the loss in the audit trail.

**Receipts.** Deletion produces a local receipt (inspection id, bytes, key id,
timestamp, app version) and posts it to the server. Receipts contain no
customer data and are retained for compliance reporting.

### 10.4 Acceptance gate

The gate is the hinge that makes the 24-hour obligation satisfiable at all:

> If the assigned device holds an active lease with pending ops, `accept`
> returns `409` with the pending timestamp. A supervisor may override with a
> recorded reason; the override is an audited event and explicitly waives the
> device-confirmed deletion path for that record.

Without this, a supervisor could accept while the inspector is still in the
basement, starting a 24-hour clock the device cannot observe, and the plan would
be promising something it cannot deliver.

### 10.5 Offline authentication

- Access tokens are short-lived; refresh tokens are device-bound, encrypted,
  and revocable.
- Offline grace window: configurable, must cover a shift (A8). During grace,
  local work proceeds; sync waits for a fresh token.
- Server accepts ops produced during the grace window, records the grace
  interval in the audit event, and rejects anything beyond it with
  `reauth_required` — queued, not lost.
- Biometric/PIN unlock gates app open after a configurable idle period; it does
  not gate background sync, which uses the stored credential.

---

## 11. Audit history

- Every state-changing action produces an event with: actor, device id, app
  version, action, payload hash, base version, device time, server time, and
  (for offline events) the lease id in force.
- Events are **hash-chained locally** (`hash = H(prev_hash ‖ canonical(event))`)
  so a batch of offline events can be verified as a contiguous, unmodified
  sequence. The chain head is included in the sync batch.
- The server is the authoritative audit store. It rejects a batch whose chain
  does not verify and records the gap. A rejected batch is quarantined, not
  silently dropped — the device keeps the ops and the inspector is told.
- Offline ordering uses local sequence, not device time. Device time is
  recorded as evidence and flagged when it diverges from server time beyond
  tolerance.
- Audit events are never compacted or deleted on the device before server
  acknowledgement.
- Conflict resolutions are audited as first-class events (who resolved, what
  was discarded, reason).

Open question for compliance: whether the *local* chain is required as evidence
or only the server copy (D10). The design supports either.

---

## 12. Observability

### 12.1 Client events (no customer content)

Per sync attempt: `inspection_id` (hashed/opaque), attempt, outcome, duration,
bytes, ops count, HTTP status class. Per conflict: field count, class, route.
Per attachment: kind, bytes bucket, attempt, outcome, resume count. Per purge:
reason, elapsed, bytes, success. Plus periodic gauge: queue depth, oldest
pending age, DB size, free storage, last successful sync age, clock skew.

### 12.2 Server metrics

Sync request rate, p95/p99 latency, 409 rate, idempotency replay rate,
`422` mismatch rate (client bug signal), attachment verification failure rate,
orphan staging count, lease acquisition failures, audit chain verification
failures, acceptance-gate overrides.

### 12.3 Dashboards and alerts

| Signal | Alert when |
|---|---|
| Oldest unsynced op age | Exceeds the shift-length assumption (A3) — the assumption is being violated in the field |
| Conflict rate | Exceeds the pilot threshold — ownership model problem |
| Purge failures / overdue jobs | Any job past due — compliance breach, page immediately |
| Attachment verification failures | Sustained — corruption or transport bug |
| Auth refresh failures | Spike — credential handling regression |
| Crash-free sessions | Below pilot floor |
| Devices never syncing | Fleet-level check: MDM reachable but no sync |

Per-device support view: last sync, queue depth, oldest pending, storage, app
version, conflict count. This is what support uses when an inspector calls.

Telemetry must be usable to answer "is this device losing work right now?"
without looking at the device.

---

## 13. Migration and backfill

### 13.1 Mobile schema

- Current DB is a read-through cache. Add the §6 tables in a single versioned
  migration; keep cache tables so unrelated screens keep working.
- **Do not convert cached rows into drafts.** Cached records were never the
  inspector's work; a naive migration would resurrect stale server copies as
  editable local documents and create phantom conflicts.
- Clear the cache on upgrade; it is by definition reconstructible.
- Migrations are forward-only and additive. No destructive `ALTER`/table
  rewrites, so a downgrade (§14) does not find a broken schema.
- Test the migration against a captured device database from the current
  release, not a synthetic one. Obtaining that database is a real dependency,
  not a formality.

### 13.2 Server

- New tables: idempotency keys, leases, attachment staging, device registrations
  (if absent), sync batches, retention receipts.
- Audit table extended with `source` (`mobile_offline`, `web`, `system`),
  `device_id`, `chain_head`, `grace_interval`.
- Existing endpoints untouched; new behaviour behind a per-tenant flag.

### 13.3 Backfill

- **Packages:** any inspection assigned and due within the pilot window needs a
  package built before rollout, or the first offline shift starts with an empty
  device. A backfill job generates packages for open assignments and reports
  failures.
- **Form schemas:** snapshot the current schema per inspection type and store
  the version the API accepts. Without a pinned schema a mid-flight form change
  breaks the merge base (A10).
- **Audit:** no historical backfill (A12). Audit coverage begins at the rollout
  boundary and the gap is documented.
- **Reference data** (sites, equipment lists) is versioned and included in the
  package; it is read-only offline.

### 13.4 Compatibility

- Old app versions continue against old endpoints. The server must not require
  the new bundle.
- New app against old server: feature-detect the sync endpoints; if absent,
  fall back to online-only behaviour and say so in the UI. No silent
  degradation.

---

## 14. Staged rollout

Four stages, each with an exit gate. Stage advancement is a decision, not a
calendar event.

### S0 — Internal

Test tenant, synthetic inspections, real devices in a lab with a controllable
network (throttle, drop, blackhole, captive portal).

Exit: full offline flow passes on the device matrix; no data-loss reproducer
open; purge verified with simulated clock; kill switches exercised.

### S1 — Pilot

One region, volunteer inspectors, sites selected because they actually have
basements and dead zones. Product explicitly asked for a pilot; this is it.
Cohort sized so support can look at every device individually — deliberately
not a number chosen for statistical power.

Exit criteria (all must hold over a defined number of completed offline
inspections, agreed at S1 planning — expressed as inspections, not weeks):

- Zero confirmed data-loss incidents.
- Sync success rate above the agreed floor on first or second attempt.
- Conflict rate below the agreed ceiling, and every conflict resolved with no
  silent loss.
- 100% of purge jobs completed within the 24-hour window, verified by receipts.
- No PII in logs or crash reports (audited sample).
- Support can answer "where is this inspection?" from dashboards alone.

### S2 — Wave expansion

Multiple regions, still gated per tenant. Same metrics, plus fleet-scale checks:
storage pressure, orphan attachment growth, sync storm behaviour at shift start
(everyone reconnects at once — this is the load profile that breaks naive
retry loops).

### S3 — General availability

Offline capture becomes the default path; online-only remains available as a
per-tenant fallback.

### Kill switches

Client-visible flags, cached with a maximum staleness and honoured offline:
`offline_capture_enabled`, `sync_write_enabled`, `attachment_upload_enabled`,
`auto_purge_enabled`. Each switch has a documented effect on in-flight data.
A cached switch older than its max staleness fails **safe**: capture continues
locally (never block the inspector), sync writes pause.

---

## 15. Rollback

Rollback must not be "uninstall and reinstall" — that destroys exactly the
data this project exists to protect.

| Level | Trigger | Action | Data effect |
|---|---|---|---|
| R1 — pause sync writes | Sync-induced corruption or server bug | Server flag `sync_write_enabled=false`; clients queue locally | None; queue grows, oldest-age alert fires |
| R2 — pause offline capture | Field data corruption or unacceptable conflict rate | Disable package creation for new inspections | Existing drafts remain editable and syncable |
| R3 — app rollback | Client regression not fixable forward quickly | Ship previous build | **Only safe if the previous build ignores the new tables.** Patch it to preserve draft tables before relying on this |
| R4 — emergency export | Data at risk, fix unclear | Encrypted export of drafts to support channel; then wipe per policy | Preserves work, loses offline UX |

R3 is the sharp edge: a build that treats SQLite as a disposable cache may clear
the database on startup. Before any rollout, verify that the rollback target
build tolerates an unknown-but-present set of tables. If it does not, the
rollback target must be a patched build — decided before rollout, not during an
incident.

Server changes are additive, so R1/R2 need no deploy. Schema changes are
additive and nullable, so a partial rollback does not strand data.

---

## 16. Testing strategy

### 16.1 Layers

| Layer | What | Notes |
|---|---|---|
| Unit | Three-way merge (property-based: generate B/L/R, assert invariants — no value invented, no field lost, idempotent re-merge) | The merge is the part most likely to lose data quietly |
| Unit | State machine, retention scheduler, hash chain | Table-driven, exhaustive over transitions |
| Integration | Sync against a fake server with fault injection: drop response after commit, duplicate delivery, 409 storms, partial uploads, 401 mid-batch | The fake server is a deliverable, not a test fixture |
| Device | Kill process mid-transaction, battery pull, storage full, clock skew, backgrounded during upload | Real devices; emulators hide background/Doze behaviour |
| E2E | Full offline shift → sync → supervisor edit → conflict → resolve → accept → purge | Scripted on device farm |
| Load | Shift-start reconnect storm; N devices syncing the same site | The realistic failure mode for retry loops |
| Compliance | Purge within SLA under clock manipulation; receipt verifies; no PII in logs; revoked device wipes | Witnessed by compliance, not self-certified |
| Security | At-rest encryption checks, key extraction attempts, screenshot policy, backup exclusion | External review recommended |

### 16.2 Specific regression tests that must exist

1. Airplane mode on, edit 30 fields, force-stop, reopen → all 30 present.
2. Upload 40 photos, kill app at 60%, restart → resumes, no duplicates, all
   hashes match.
3. Server accepts batch, response dropped, client retries → exactly one
   revision, no duplicate audit events.
4. Supervisor edits field X while inspector edits field Y → auto-merge, both
   survive, one audit event each.
5. Supervisor edits field X while inspector edits field X → conflict, both
   values retained, supervisor resolves, decision audited.
6. Supervisor accepts while inspector has queued ops → 409 at accept; override
   path audited; late change surfaces as late change, never silently applied.
7. Accept → device syncs → purge completes → receipt present; local files and
   rows gone; thumbnails and log buffers gone.
8. Device offline past max age → backstop purge runs, inspector warned, loss
   recorded.
9. Device revoked → next sync 403 → local wipe → no further writes.
10. App downgrade over a database with drafts → drafts still present and
    readable.

### 16.3 Test data and environments

- A captured production-like device DB and a seeded server tenant.
- A network conditioner available on every test device — not a one-off lab rig.
- Signature and photo fixtures including corrupt, zero-byte, oversized, and
  wrong-MIME files.

---

## 17. Milestones

Ordering is dependency-driven. Sizing and calendar planning are deliberately
absent; see §19.

| Milestone | Depends on | Unblocks |
|---|---|---|
| M0 Decisions & contracts | — | everything |
| M1 Local write model | M0 | M2, M3, M6 |
| M2 Offline capture UX | M1 | M8 |
| M3 Sync core | M0, M1 | M4, M5, M7 |
| M4 Attachment pipeline | M3 | M5, M6, M7 |
| M5 Conflict & review | M3, M4 | M8 |
| M6 Audit, retention, security | M1, M4 | M7, M8 |
| M7 Observability & rollout tooling | M3, M4, M6 | M8 |
| M8 Pilot | M2, M5, M6, M7 | M9 |
| M9 Broad rollout decision | M8 | — |

Critical path: M0 → M1 → M3 → M4 → M5 → M8. M2 runs in parallel with M3 once
M1 lands. M6 can start after M4 and does not wait for M5.

### M0 — Decisions and contracts

Depends on: nothing.

Work: resolve decisions D1–D10 and D12 (D8 before M1, D11–D12 before M2);
agree the API contract (endpoints, headers, error
codes, idempotency semantics); confirm object-storage capability; capture a
device DB sample; agree the retention interpretation with compliance; write the
fake-server contract test harness stub.

Acceptance:
- Every blocking decision in §18 is recorded with an owner and a chosen option.
- API contract reviewed and signed off by mobile, server, and security.
- Object-storage path proven with a spike upload (resumable, hash-verified).
- Compliance confirms, in writing, that crypto-erase plus the acceptance gate
  satisfies the 24-hour obligation, or states what would.

### M1 — Local write model and migrations

Depends on: M0.

Work: §6 tables, write-first path, state machine, hash-chained audit, SQLCipher,
migration from the current cache DB.

Acceptance:
- Every field write is durable before UI acknowledgement (I1) under forced
  process kill.
- No cache row is promoted to a draft during migration.
- Migration succeeds on a real captured device DB, and the rollback build can
  still open the result.
- `pending_op` survives 10k append/state-transition cycles with no unbounded
  growth.

### M2 — Offline capture UX

Depends on: M1.

Work: package download and readiness badges, offline form UX, photo capture with
limits, signature capture, resume-after-death, storage warnings.

Acceptance:
- A full inspection — form, 40 photos, signature — completes with the radio off.
- Force-stop at any point loses at most the keystroke in flight.
- Photos never appear in the OS gallery.
- Storage exhaustion blocks new capture without corrupting existing drafts.

### M3 — Sync core

Depends on: M0, M1.

Work: pull/merge/push, idempotency, rebase loop, conflict parking, backoff,
queue scheduler, feature detection, grace-window auth.

Acceptance:
- Duplicate delivery produces exactly one revision.
- 409 storm converges or parks within three attempts; no livelock.
- A two-hour network partition drains fully on reconnect with no duplicates.
- Every applied op has a matching, chain-verified audit event.

### M4 — Attachment pipeline

Depends on: M3.

Work: tickets, resumable upload, verification, staging, finalize binding, orphan
GC.

Acceptance:
- Kill/resume at arbitrary offsets; no duplicate objects, all hashes verified.
- Finalize refuses an incomplete manifest.
- Orphan GC reclaims staging without touching bound attachments.
- 40-photo inspection uploads within the agreed time budget on a realistic link.

### M5 — Conflict handling and supervisor review

Depends on: M3, M4.

Work: merge for scalars, groups, attachments, signature; conflict records;
supervisor diff and resolution UI; device-side notice.

Acceptance:
- The full conflict matrix (§8.3) produces the specified outcome, verified by
  automated tests, including the signature hard conflict.
- No losing value is ever discarded.
- Resolution requires an explicit action with a reason, and is audited.

### M6 — Audit, retention, purge, security hardening

Depends on: M1, M4.

Work: lease and acceptance gate, retention scheduler, crypto-erase, receipts,
device revocation wipe, log redaction, certificate pinning decision,
screenshot policy.

Acceptance:
- Purge completes within the window in a clock-manipulation test; receipt
  verifies server-side.
- Purge removes files, rows, thumbnails, caches, and log buffers; verified by
  filesystem inspection, not by the app's own report.
- Revoked device wipes and refuses further sync.
- A PII scan of logs and crash reports from a full flow is clean.
- Acceptance is refused (or explicitly overridden and audited) when the device
  has pending ops.

### M7 — Observability and rollout tooling

Depends on: M3, M4, M6.

Work: client events, server metrics, dashboards, alerts, kill switches, support
device view, runbook.

Acceptance:
- Every metric in §12.1–12.2 is queryable.
- Each alert fires in a staging-injected scenario.
- Each kill switch is demonstrated, including its effect on in-flight data.
- Support can locate and diagnose a stuck inspection from the dashboard alone.

### M8 — Pilot

Depends on: M2, M5, M6, M7.

Work: run S1, collect evidence, iterate.

Acceptance: S1 exit criteria (§14) met over the agreed number of completed
offline inspections, with no open data-loss or compliance defect.

### M9 — Broad rollout decision

Depends on: M8.

Acceptance: written go/no-go covering S2 criteria, rollback readiness (including
the patched rollback build), support capacity, and the unresolved risks in
`RESPONSE.md`.

### Parallelisation note

M2 depends only on M1 and can run alongside M3. M6 depends on M1/M4 but not on
M5. The critical path is M0 → M1 → M3 → M4 → M5 → M8; anything that shortens
M0 shortens everything, which is why M0 is a milestone and not a meeting.

---

## 18. Decisions required before implementation

Each decision names the options, a recommendation, and why. "Before
implementation" means before M1 code lands; a decision deferred past that point
gets made by accident.

### D1 — Ownership and concurrency model

**Options:** (a) real-time collaborative editing (CRDT/OT); (b) hard lock —
supervisor cannot edit while a lease is active; (c) advisory lease + field-level
merge + supervisor review queue.

**Recommendation: (c).** (a) is ruled out by the brief and is far more
machinery than the problem needs. (b) is simple but blocks supervisors for an
entire offline shift and creates a deadlock when a device is lost — the lease
never releases. (c) preserves inspector data, keeps supervisors productive, and
bounds complexity to a three-way merge plus a review queue. Cost: conflict
review UI on the web.

### D2 — Concurrency token granularity

**Options:** (a) one integer version per inspection for everything; (b) version
for form content plus separate versioning for attachments and audit; (c) finer
per-section versions.

**Recommendation: (b), with a fallback to (a).** The integer version is the
right token for form content and is what the existing API already provides.
Attachments and audit cannot ride on it — 40 photo uploads cannot all be
serialized behind one version bump, and audit events must never be lost to a
version race. Give them identity (`attachment_id` + hash, `event_id` + chain)
and bind them at finalize. (c) multiplies conflict surfaces for no benefit at
this scale.

### D3 — Sync API shape

**Options:** (a) reuse per-record `PATCH` with `If-Match`; (b) additive batch
`POST /sync` + cursor feed; (c) GraphQL.

**Recommendation: (b).** A batch with one `If-Match` gives atomicity and one
audit boundary per attempt, which is exactly what offline replay needs. (a)
produces N partial writes and N audit events per attempt and makes "all or
nothing" impossible. (c) does not fit the existing REST stack and adds a
protocol rewrite to an already large change.

### D4 — Attachment transport

**Options:** (a) multipart through the API; (b) presigned resumable upload
direct to object storage; (c) third-party upload SDK.

**Recommendation: (b), falling back to (a) if no object storage exists.**
Photos are the bulk of the bytes and the least suited to API-tier buffering.
Direct upload with server-issued tickets keeps the API thin and makes resumption
natural. (c) adds a vendor dependency for something the storage layer already
solves.

### D5 — Lease duration and offline auth grace

**Options:** fixed short lease; lease tied to shift length; no lease at all.

**Recommendation: lease defaulting to one operational shift, renewable only
online, expiring into an "unleased but editable" state; auth grace at least as
long as the lease.** No lease removes the acceptance-gate mechanism (D6). A
short lease would expire in the basement, which is the exact environment being
designed for. Expiry must never block work — it raises risk, visibly, on both
sides.

### D6 — Acceptance gate

**Options:** (a) accept unconditionally; (b) block accept while the device has
pending ops, with audited override.

**Recommendation: (b).** This is what makes the 24-hour obligation satisfiable:
the clock starts at an event the device can observe. (a) creates a class of
records where accepted data and unsynced field data coexist with no lawful
resolution. The override keeps supervisors unblocked in genuine emergencies and
leaves a record of the trade-off.

### D7 — Retention trigger and definition of "customer data"

**Options:** (a) purely server-side deletion of the server copy; (b) device
purge on acceptance with a max-age backstop; (c) device purge only, no backstop.

**Recommendation: (b)**, with the exact data classes in §10.3 confirmed by
compliance. (a) ignores the device, which is where the brief says data lives.
(c) fails silently on a device that never reconnects — the backstop is the only
control that holds in that case. Needs a written definition of customer data:
form answers, photos and signatures are clearly in; audit metadata and sync
identifiers are arguably not, and that distinction decides what survives purge.

### D8 — Encryption and certificate pinning

**Options:** platform full-disk encryption only; app-level DB encryption with a
device-wrapped key; per-inspection envelope keys.

**Recommendation: app-level encryption with per-inspection envelope keys.**
FDE does not protect data on a powered, unlocked, rooted device, and it cannot
give crypto-erase. Envelope keys make deletion atomic and auditable. Pinning:
recommend pinning with a documented MDM-proxy exception, because a hard pin that
breaks behind a corporate proxy takes the whole fleet offline.

### D9 — Form schema evolution

**Options:** always serve the latest schema; pin schema per package.

**Recommendation: pin per package, accept submissions against the pinned
schema.** A schema change mid-offline either invalidates the inspector's work or
forces a lossy migration on a device that cannot ask anyone. Pinning plus
server-side acceptance of older versions is boring and correct. Schema upgrades
apply at the next package build.

### D10 — Audit authority and evidence chain

**Options:** server-only audit; client chain forwarded and verified; client
chain as the authority.

**Recommendation: server is authoritative; client chain is tamper-evidence.**
The client cannot be the authority for its own actions. The hash chain is what
lets the server accept an offline sequence with confidence, and what lets it
detect a gap. Confirm with compliance whether the client chain must be retained
as evidence.

### D11 — Signature validity offline

**Options:** captured signature is final when submitted; requires online
countersignature before acceptance.

**Recommendation: capture offline, bind at submit, countersign server-side at
sync before the record can be accepted.** This keeps the field flow intact
while ensuring no accepted record rests on a signature that never reached the
server. Legal must confirm whether an offline capture with a device-bound key is
admissible; if not, signature capture becomes an online-only step and the flow
must say so up front rather than fail at submit.

### D12 — Photo policy

**Options:** full-resolution originals; compressed on capture; compressed plus
optional original.

**Recommendation: compress on capture by default, configurable per tenant, with
the original retained only if policy demands.** 40 full-resolution photos per
inspection is a storage and upload problem with no inspection benefit. The
compression parameters must be validated against actual defect-detection needs
before being fixed, not chosen from intuition.

### D13 — Pilot cohort and success thresholds

**Options:** broad early rollout; single-region volunteer cohort.

**Recommendation: single region, volunteer inspectors, sites with genuine dead
zones, cohort small enough that support can inspect every device.** Thresholds
expressed in completed offline inspections, not elapsed time. Numbers should be
set at S1 planning from a baseline measured in S0 — inventing them now would be
a guess dressed as a target.

### D14 — Offline scope per assignment

**Options:** download everything assigned; download only a chosen window.

**Recommendation: explicit "prepare for offline" plus a bulk action for the
working window, with visible staleness.** Silent bulk download of a month of
assignments fills tablets and makes purge unpredictable. Explicit preparation
also creates the moment where the app can warn about storage and about the
retention backstop.

---

## 19. Sizing and scheduling note

This plan deliberately contains no calendar dates and no headcount or effort
figures. Neither can be derived from the brief: throughput depends on the
existing codebase (which the brief describes only as "SQLite as a read-through
cache"), on the server team's API capacity, on device-lab availability, and on
the compliance review cycle. Publishing numbers now would be a confident guess,
which is worse than an honest gap.

What is defensible now:

- The dependency graph in §17.
- The critical path: M0 → M1 → M3 → M4 → M5 → M8.
- The capability set required: mobile engineering (offline storage, background
  sync), server engineering (idempotency, attachment staging, audit), QA with
  real devices and network conditioning, security review, compliance/legal
  sign-off, and support tooling.
- The fact that M0 is the highest-leverage milestone: every unresolved decision
  in §18 becomes rework later.

Sizing should be produced by the owning team after M0, against their measured
velocity, and should be expressed as confidence ranges rather than single
figures.

---

## 20. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Conflict rate far higher than assumed (A4) | Medium | High — review queue becomes a bottleneck | Measure from day one of pilot; fall back to field-level locking for specific field groups |
| Pinned schema not accepted by server (A10) | Medium | High — mid-offline schema change loses work | Resolve in M0; otherwise block package creation when schema changes |
| Purge cannot be guaranteed on an unreachable device | Medium | High — compliance breach | Acceptance gate + max-age backstop + MDM revocation; documented residual risk |
| Attachment volumes exceed device storage (A5) | Medium | Medium | Compression policy, storage pre-flight, per-device quotas |
| Shift-start sync storm degrades service | Medium | Medium | Jittered scheduling window, server-side admission control, load test |
| Rollback build clears the new tables | Low | Severe — destroys field work | Patch and test the rollback build before rollout (R3) |
| Idempotency store grows unbounded | Medium | Low–Medium | TTL plus retention ≥ longest offline window; monitor |
| Legal rejects offline signature | Low–Medium | High — flow redesign | Resolve D11 before M2 |
| Cache-to-draft migration creates phantom conflicts | Medium | Medium | Never promote cache rows; clear cache on upgrade; test on real DB |

---

## 21. Appendix — API payload sketch

```http
POST /inspections/{id}/sync
If-Match: 41
Idempotency-Key: 018f2b7e-...

{
  "batch_id": "018f2b7e-...",
  "base_version": 41,
  "chain_head": "sha256:...",
  "ops": [
    {"op_id": "...", "seq": 118, "kind": "field_set",
     "field": "roof.condition", "value": "poor", "at": "<iso8601>"},
    {"op_id": "...", "seq": 119, "kind": "group_add",
     "group": "defects", "item_id": "...", "value": {...}},
    {"op_id": "...", "seq": 120, "kind": "submit"}
  ],
  "audit": [
    {"event_id": "...", "seq": 300, "action": "field_set",
     "payload_hash": "sha256:...", "prev_hash": "sha256:...",
     "hash": "sha256:...", "device_time": "..."}
  ],
  "attachments": [
    {"attachment_id": "...", "sha256": "...", "state": "verified"}
  ]
}
```

```http
200 OK
{"version": 42, "applied": ["..."], "conflicts": [], "rebase_required": false}

409 Conflict
{"version": 44, "reason": "version_mismatch",
 "current": {"doc_hash": "sha256:..."},
 "conflicts": [{"field": "roof.condition",
                "base": "fair", "local": "poor", "remote": "good",
                "remote_actor": "...", "remote_at": "..."}]}

409 Conflict
{"version": 44, "reason": "inspection_accepted",
 "hint": "late_change_requires_reopen"}
```

Error codes are part of the contract and must be stable; the client branches on
them, so changing a code is a breaking change.

---

## 22. Appendix — failure-mode checklist for design review

Run through this before M1 is declared done. Each line is a question someone
must answer with evidence, not an opinion.

- What happens if the process dies between the SQLite commit and the UI update?
- What happens if the same batch is delivered three times concurrently?
- What happens if the device clock jumps forward a year?
- What happens if the device runs out of storage with an unsynced inspection?
- What happens if the supervisor accepts during a 40-photo upload?
- What happens if the form schema changes while an inspector is offline?
- What happens if the inspector uninstalls the app with unsynced work?
- What happens if the device is wiped by MDM mid-shift?
- What is on the device one hour after acceptance? Twenty-four hours after?
- Can support tell, right now, which devices are holding unsynced work older
  than a shift?
