# PLAN — Offline inspections for the tablet app

Source of truth for product intent: `BRIEF.md`. Everything not stated there is an
assumption and is labelled `A#` in §2, with what breaks if it is wrong. Decisions
that must be made before implementation are labelled `D#` (§16). Milestones are
labelled `M#` (§15) and are ordered by dependency, not by calendar. This plan
deliberately contains no dates and no headcount figures; sequencing and exit
criteria are the commitments, elapsed time is not.

---

## 1. Goals and non-goals

**Goals**

| ID | Goal | Derived from |
|----|------|--------------|
| G1 | An inspector's work is never lost: not on signal loss, app kill, power loss, crash, reassignment, cancellation, or conflict. | "a lost connection ... can discard notes" |
| G2 | An inspection can be completed end-to-end with no connectivity: open an assigned inspection, fill the form, take up to 40 photos, collect a signature, mark it complete. | brief, second sentence |
| G3 | Sync happens opportunistically whenever connectivity appears, without the inspector doing anything; a manual "Sync now" exists but is never required. | "Connectivity may return intermittently" |
| G4 | Supervisors keep editing from the web; concurrent edits are resolved by a fixed policy with a full record, not by a collaborative editor. | "Supervisors can edit the same inspection from the web", "does not want a full collaborative editor" |
| G5 | Every change is auditable (who, what, when, from where, against which version), and local customer data is removed within 24 hours of the inspection being accepted. | "Regulations require ..." |
| G6 | The feature can be piloted with a small group, observed, and switched off without losing queued work. | "Product wants a pilot before broad rollout" |

**Non-goals** (see §4 for the full scope table): real-time co-editing, offline
creation of new inspections, offline reassignment, making the web app work
offline, video attachments.

---

## 2. Assumptions

Each assumption states why it matters and what changes if it is wrong. Items
marked **verify in M0** are cheap to check and expensive to get wrong.

| ID | Assumption | Why it matters | If wrong |
|----|-----------|----------------|----------|
| A1 | Inspectors have connectivity at some point between being assigned an inspection and arriving on site (office, vehicle, street level). **Verify in M0.** | The whole design is prefetch-then-work. "Open assigned inspections offline" is only possible if the assignment reached the device first. | Need an out-of-band delivery path (e.g. dispatcher phone call plus manual entry) or a paper fallback; that is a different product. |
| A2 | An inspection has exactly one assigned inspector at a time; two tablets never edit the same inspection. | Conflict policy only has to handle inspector-vs-supervisor, not inspector-vs-inspector. | Same policy can be extended (device-level ownership), but the pilot must exclude multi-inspector jobs. |
| A3 | The integer record version increments on every committed write to that record, is returned on every read, and the server rejects (409) a write that carries a stale version, or can be changed to do so. **Verify in M0.** | The version is the base for all merging. If it is advisory, or bumped by batch jobs, or shared across records, merge decisions will be wrong and silent data loss becomes possible. | Version enforcement becomes the first server task in M1 and nothing downstream can start until it is in place. |
| A4 | Form templates are versioned and an inspection's template version is, or can be, pinned when the inspection is assigned. | The device must render the form it downloaded, and the server must interpret answers against the same template. | Pin at download time on the device and refuse to submit on mismatch; supervisor must re-issue the inspection. |
| A5 | "Accepted" is a server-side status transition (by a supervisor or automation) that has a server timestamp and can only occur after the server holds the complete submission, including all attachments and the signature. **Verify in M0.** | Defines when the 24-hour purge clock starts and guarantees that purging never removes data the server does not yet have. | If acceptance can precede full receipt, purge timing must be tied to server receipt instead; see D3. |
| A6 | "Customer data" means customer identity and contact details, premises address, premises photos, signature, and free-text fields that may contain personal data. A non-personal stub (inspection id, status, scheduled slot, template id) may remain on the device. **Verify with legal in M0.** | Determines what the purge removes and what the inspector still sees in the list afterwards. | If stricter: the stub holds only the id and status. |
| A7 | Supervisor web edits to an in-progress inspection are mostly workflow (reassign, reschedule, cancel, comment) and rarely touch form answers. **Verify in M0 from server logs.** | The conflict policy (§7) favours the inspector for form content and flags the rest. If supervisors routinely correct form content, flags will be frequent and annoying. | Add a supervisor-side "review overridden edits" tool on the web (still no tablet merge UI); consider locking form content on the web while an inspector is in progress. |
| A8 | Tablets are MDM-managed: device encryption, passcode, remote wipe, app-private storage, and background execution can be enforced by policy, and devices have free storage well above one day of inspections. | Security controls can lean on the platform; prefetch sizing can be generous. | Storage quotas become a hard cap on prefetch; every security control must be app-level. |
| A9 | Photos are captured in-app; a size-limited, recompressed JPEG is acceptable evidence and originals need not be kept. **Verify with legal in M0.** | Sets storage and upload volume: 40 photos at roughly 1 MB each is a different problem from 40 photos at 5–8 MB each. | Keep originals; raise storage thresholds; expect longer drain times on intermittent links (D4). |
| A10 | The server has, or can add, object storage with resumable multipart upload; failing that, the API tier can host a chunked upload endpoint. | Resumable upload is the only workable attachment path on intermittent links. | Build the chunked endpoint in M1; same client abstraction. |
| A11 | Authentication is token-based with a refresh token whose lifetime can be set to cover the longest realistic offline period. **Verify with security in M0.** | Inspectors must open the app in a basement without contacting the identity provider. | Need a local unlock model with deferred re-authentication; must still never block draining queued work. |
| A12 | The current app stores no user-authored drafts in SQLite (it is a read-through cache), so there is nothing to carry forward from old builds; the cache can simply be discarded. **Verify in M0.** | Migration is a drop-and-rebuild rather than a data migration. | Add a one-shot draft migration step to M2. |
| A13 | The web app can be changed in the same programme (conflict flags, audit view, orphaned-work view). | Supervisors need somewhere to see and act on flagged merges. | Degrade to surfacing flags through existing comment fields and email notifications. |
| A14 | Device clocks are not trustworthy. Server time is authoritative; device time and device-side sequence numbers are recorded for ordering. | Ordering of offline edits in the audit history. | Not an assumption that can be wrong, it is a stance; listed so nobody relies on device time. |
| A15 | Regulators accept an audit history in which offline edits carry a device timestamp, a device-side monotonic sequence, and a server receipt timestamp. **Verify with compliance in M0.** | Defines what the change log must store. | Ask the regulator what ordering semantics they require before M1 finalises the event schema. |
| A16 | Web edits go through the same server APIs and will therefore produce the same change events and version increments as tablet edits once M1 lands. | Merge and audit rely on a single change history. | Web write paths must be routed through the new change-event layer in M1; otherwise supervisor edits are invisible to the merge. |

---

## 3. User flow

### 3.1 Prepare (needs connectivity)

1. Inspector opens the app on the network (office, vehicle). The app fetches the
   assignment list and, for each assigned inspection within the prefetch window
   (D14), downloads: the inspection record and its version, customer data, the
   pinned form template, reference data the form needs (lookup lists), and
   thumbnails of any existing attachments.
2. Each inspection in the list shows a readiness state: **Ready offline** /
   **Downloading** / **Not available offline** (with a reason: storage, auth,
   never fetched).
3. The inspector can mark additional inspections "Make available offline". The
   app refuses only when storage is below the safety threshold and says so.

### 3.2 Work (no connectivity)

4. Inspector opens a **Ready offline** inspection. Every field edit is written
   to the local store and the outbox in one transaction (autosave; text fields
   debounced, flushed on blur, on navigation and on app background).
5. Photos are captured in-app, compressed, hashed, stored in app-private
   encrypted storage, and linked to the form field they document. Counter shows
   `n / 40`.
6. Inspector reviews the form, then **Sign**. Signature capture snapshots a hash
   of the form content it attests. After signing, inspector-owned fields are
   locked on the device; **Edit again** unlocks them and invalidates the
   signature (must re-sign).
7. **Mark complete** transitions the local status to *Complete, pending upload*.
   The inspector can move on to the next inspection.

### 3.3 Sync (whenever connectivity appears)

8. The sync engine wakes on connectivity change, app foreground, a periodic
   background task, or "Sync now". It probes the API (not just the OS network
   flag), then for each inspection with pending work: pushes change batches in
   sequence order, applies the server's response (new version, server-side
   changes, flags), then uploads attachments (resumable), then submits.
9. The list shows per-inspection sync state: *n changes pending*, *uploading
   photos 12 / 40*, *Submitted*, *Needs attention*. Nothing about sync is
   modal; the inspector keeps working.

### 3.4 After submission

10. Once the server confirms the complete submission (all attachments verified),
    the device purges the inspection's customer data according to D3, leaving
    a non-personal stub with status. When the supervisor accepts, the stub
    shows **Accepted**. If the supervisor rejects or reopens, the inspection
    reappears as an assignment and is re-downloaded on the next sync.

### 3.5 Failure paths

| Situation | What the inspector sees | What the system does |
|----------|--------------------------|----------------------|
| App killed or tablet dies mid-edit | Reopens where they were, last debounce window at most lost | Transactional autosave; orphan-file sweep on start |
| Storage nearly full | Warning before capture; capture refused at hard floor | Prefetch paused; telemetry event |
| Supervisor edited a field the inspector also edited | Nothing on the tablet beyond a passive "Reviewed by supervisor" note | Inspector value applied, supervisor value kept in audit, inspection flagged on web (§7) |
| Supervisor cancelled or reassigned while offline | "This inspection is no longer assigned to you. Your work has been saved for review." | Changes stored server-side as orphaned work, not applied; local copy purged after confirmation |
| Upload keeps failing for one photo | "1 photo could not be uploaded" with retry | Retries with backoff; after threshold, surfaces to inspector and to observability; submission blocked until resolved or the photo is removed with an audited reason |
| Token expired while offline for longer than the policy window | "Sign in again when you have signal to open inspections." Already-open work remains viewable | Outbox drains automatically after re-auth; nothing is discarded |
| Template on server changed for a downloaded inspection | "Needs attention: this inspection was updated by the office" | Submission blocked; supervisor re-issues; work retained as orphaned if incompatible |

---

## 4. Scope boundaries

| In scope (this programme) | Explicitly out of scope | Possible later |
|--------------------------|--------------------------|----------------|
| Prefetch of assigned inspections; readiness indicator | Offline creation of new inspections | Offline creation with server-issued id blocks |
| Offline form editing with autosave | Editing inspections after acceptance (tablet or web) | — |
| Up to 40 photos per inspection, compressed, resumable upload | Video, audio, documents as attachments | Additional attachment kinds through the same pipeline |
| Signature capture bound to form content hash | Multiple signatures / countersign | Countersign as a second signature attachment |
| Queued, idempotent sync with field-level policy merge | Real-time co-editing, presence, CRDT/OT | Web-side "lock while in progress" |
| Supervisor web: conflict flags, audit history, orphaned work | Web app offline | — |
| Purge of local customer data; purge confirmation to server | Server-side data retention changes | — |
| Feature flags, kill switch, observability, pilot | Inspector-to-inspector handover offline | Device-level ownership in the same merge model |
| Force-upgrade floor after pilot | Support for non-managed (BYOD) devices | — |

---

## 5. Local data model

**Principles**

- The local store is authoritative for inspector-authored data until the server
  acknowledges it. Server-derived data is a versioned mirror.
- Every user write goes through the outbox in the same transaction as the data
  write. There is no code path that writes user data without an outbox row.
- Field-level answer rows rather than one JSON blob per inspection: this is what
  makes field-level merge, cheap autosave, and per-field audit possible.
- Client-generated UUIDs for anything created offline (change events,
  attachments, batches, submissions). Server ids for inspections, which always
  originate on the server.
- No personal data outside the encrypted store (§9).

**Schema (SQLite, encrypted per D5)**

```
device_meta         device_id, user_id, schema_version, last_purge_sweep_at

inspection          id (server), server_version, template_id, template_version,
                    status_server, status_local        -- see state list below
                    customer_json (PII), address_json (PII),
                    server_snapshot_json,              -- last fully applied server state
                    downloaded_at, last_pull_at, last_push_at,
                    purge_after, purge_reason, review_flag_summary,
                    signature_attachment_id, signed_form_hash

form_answer         inspection_id, field_id, value_json,
                    updated_seq, updated_at_device,    -- last local change
                    server_value_json, server_version   -- for display of "changed by office"
                    PK (inspection_id, field_id)

outbox              seq (monotonic, device-wide), id (uuid), inspection_id,
                    entity ('answer'|'attachment_link'|'status'|'signature'),
                    op, field_id, old_value_json, new_value_json,
                    device_ts, actor_user_id, base_server_version,
                    batch_id (null until batched),
                    state ('pending'|'inflight'|'acked'|'orphaned'|'rejected'),
                    attempts, last_error, acked_at

attachment          id (uuid, client), inspection_id, kind ('photo'|'signature'),
                    field_id, caption, local_path, sha256, bytes, mime,
                    captured_at_device, width, height,
                    upload_state ('pending'|'session_open'|'uploading'|
                                  'uploaded'|'verified'|'failed'),
                    upload_session_json,               -- session id, part size, done parts
                    server_attachment_id, attempts, last_error

submission          id (uuid), inspection_id, form_hash, signature_attachment_id,
                    attachment_ids_json, created_at_device,
                    state ('pending'|'inflight'|'accepted_by_server'|'rejected'),
                    server_response_json

template            id, version, json, fetched_at
reference_data      key, version, json, fetched_at
sync_cursor         scope ('assignments'), cursor, updated_at
audit_local         mirror of acked outbox rows + server-originated events,
                    retained only until purge (for "history" view on device)
```

**Inspection local states**

`not_downloaded` → `ready` → `in_progress` → `signed` → `complete_pending_upload`
→ `submitted` → `purged_stub` (then `accepted` / `rejected` reflected on the
stub). Side states: `needs_attention` (with reason), `orphaned` (work saved on
server, no longer assigned).

**Retention on device**

- `outbox` rows in state `acked` are kept until the inspection is purged, then
  removed; they double as the local audit mirror.
- Attachments in `verified` state are kept until purge (so the inspector can
  review them) unless storage pressure forces earlier eviction of verified files
  only (never unverified ones).

---

## 6. Sync protocol

### 6.1 Principles

1. **Ship intent, not state.** The device sends change events (field, old, new,
   base version), never a whole record. The server merges.
2. **Everything is idempotent.** Batches, upload sessions, submissions and purge
   confirmations carry client-generated ids; the server stores results and
   replays them on retry.
3. **Small before large.** Form changes (kilobytes) are pushed before
   attachments (megabytes) so that a ten-second window of signal still gets the
   inspector's notes to the server.
4. **Never block editing on the network.** Sync is a background concern; the UI
   only reflects its state.
5. **One ordering per inspection.** Per inspection: push, then apply the
   response, then pull if needed, then upload, then submit. Different
   inspections may proceed in parallel; the same inspection never has two
   in-flight operations.
6. **Server time is authoritative.** Device timestamps are recorded, not trusted.

### 6.2 API surface (all additive; existing endpoints unchanged)

| Endpoint | Purpose | Idempotency |
|----------|---------|-------------|
| `GET /me/assignments` | Assignment list with `inspection_id`, `server_version`, `status`, `template_version`. Cheap; polled. | — |
| `GET /inspections/{id}?include=customer,template,attachments` | Full download for offline use; returns `version`. | — |
| `POST /inspections/{id}/change-batches` | Push a batch of change events with `base_version`. Server merges per §7, records events, bumps version once per applied batch, returns outcome per event plus server-side changes since `base_version`. | `batch_id`; server stores responses for replay |
| `POST /inspections/{id}/attachments` | Open an upload session for a client-generated `attachment_id` (`sha256`, `bytes`, `mime`, `kind`). Returns the upload mechanism (presigned multipart parts, or chunked endpoint) and part size. | `attachment_id` |
| `GET /inspections/{id}/attachments/{aid}/upload-status` | Which parts the server has. Used on resume; server is truth, not the device's own record. | — |
| `POST /inspections/{id}/attachments/{aid}/complete` | Server assembles, verifies `sha256`, marks `verified`. | `attachment_id` |
| `POST /inspections/{id}/submissions` | Submit with `submission_id`, `version`, `form_hash`, `signature_attachment_id`, `attachment_ids`. Server checks all attachments verified, template match, status submittable. | `submission_id` |
| `POST /devices/{device_id}/events` | Device telemetry and compliance events, including `purge_confirmed`. | event ids |
| `GET /inspections/{id}/audit` | Audit history for web and support. | — |
| `GET /config/mobile` | Remote config: feature flags, kill switch, thresholds. | — |

Existing `PUT /inspections/{id}` with a version check remains for the web and
old app builds; in M1 it is rerouted internally through the same change-event
layer so that web edits produce events (A16).

### 6.3 Change batch — request and response

```json
POST /inspections/8812/change-batches
{
  "batch_id": "7f0c...-uuid",
  "device_id": "tab-0142",
  "base_version": 17,
  "events": [
    {"id": "e1-uuid", "seq": 4021, "entity": "answer", "field_id": "boiler.flue_condition",
     "op": "set", "old": "ok", "new": "corroded", "device_ts": "…"},
    {"id": "e2-uuid", "seq": 4022, "entity": "attachment_link", "op": "add",
     "field_id": "boiler.flue_condition", "attachment_id": "a9-uuid", "caption": "flue joint", "device_ts": "…"},
    {"id": "e3-uuid", "seq": 4023, "entity": "status", "op": "set", "new": "signed",
     "form_hash": "sha256:…", "signature_attachment_id": "s1-uuid", "device_ts": "…"}
  ]
}

200
{
  "outcome": "applied_with_flags",
  "new_version": 19,
  "results": [
    {"id": "e1-uuid", "outcome": "applied"},
    {"id": "e2-uuid", "outcome": "applied"},
    {"id": "e3-uuid", "outcome": "applied"}
  ],
  "server_changes_since_base": [
    {"field_id": "schedule.slot", "new": "…", "actor": "supervisor:44", "version": 18},
    {"field_id": "boiler.flue_condition", "new": "ok", "actor": "supervisor:44", "version": 18,
     "superseded_by": "e1-uuid"}
  ],
  "flags": [{"type": "review_required", "field_id": "boiler.flue_condition",
             "reason": "offline_edit_overrode_web_edit"}],
  "status_server": "in_progress"
}
```

Outcomes: `applied`, `applied_with_flags`, `not_applied` (with `reason`:
`not_assigned`, `cancelled`, `template_mismatch`, `status_locked`; the batch is
stored as orphaned work), `rejected` (malformed; never for concurrency).

### 6.4 Push algorithm (per inspection)

1. Select `pending` outbox rows for the inspection in `seq` order up to a batch
   size cap; assign `batch_id`; mark `inflight` (transaction).
2. `base_version` = `inspection.server_version`.
3. POST. On network failure: revert rows to `pending`, back off. On 5xx: same.
   On 200: mark rows `acked` (or `orphaned`), set `inspection.server_version =
   new_version`, apply `server_changes_since_base` to `server_snapshot_json`
   and to `form_answer` for fields with **no** pending local rows, store flags.
4. On app restart with rows in `inflight`: re-send the same `batch_id`; the
   server replays the stored response. This is why the batch id is persisted
   before the first attempt.
5. If more `pending` rows exist (the inspector kept editing), loop.

### 6.5 Pull algorithm

1. `GET /me/assignments` on every sync wake. For each assignment:
   - not local → download (prefetch window and storage permitting);
   - local and `server_version` newer and no pending outbox rows → `GET` and
     apply;
   - local with pending rows → do nothing; the push response will carry server
     changes.
2. Local inspections absent from the list → `orphaned` or `unassigned`; push any
   pending rows once (server will store as orphaned work), then schedule purge.
3. Full-record apply overwrites `server_snapshot_json`, `form_answer` for fields
   without pending local rows, status, template version, and the customer data.

### 6.6 Submission

After all outbox rows are `acked` and all attachments `verified`, POST the
submission. `409` with `missing_attachments` → re-verify attachments (the
device's record may lag the server); `409 version` cannot happen if push ran
first, but is handled by pushing again; `409 not_submittable` → `needs_attention`.

### 6.7 Triggers, backoff, connectivity

- Wake on: OS connectivity change, app foreground, periodic background task,
  capture or edit while online, manual "Sync now".
- Reachability = a `HEAD /health` with a short timeout, not the OS "connected"
  flag (captive portals, one-bar signal). Failed probe = treat as offline,
  retry on next trigger.
- Backoff: exponential with jitter per inspection, reset on any success.
  Attempts and last error are stored so support can see them.
- Attachments: one at a time per device, parts sequential, progress persisted
  per part; on resume ask the server which parts it has.

### 6.8 Versions with an integer record version

- The server increments `version` by exactly one per applied batch (not per
  event) and records every event with the `resulting_version`.
- The audit log is the same store the merge reads: "server changes since base
  version N" is a query over events with `version > N`. This is deliberate: the
  compliance requirement and the merge requirement are satisfied by one table.
- Records first touched after M1 get a `baseline` event at their current
  version so history is reconstructible from that point (see §10).

---

## 7. Conflict policy

Design constraint from the brief: no collaborative editor. Therefore: a fixed,
documented, field-class ownership policy, applied by the server, with every
losing value retained in the audit history and surfaced to the supervisor on
the web. The tablet never shows a merge dialog.

### 7.1 Field classes

| Class | Examples | Who edits on device | Rule when both sides changed since base |
|-------|----------|---------------------|-------------------------------------------|
| Inspector-owned | form answers, photos and captions, inspector notes, signature | inspector | **Inspector value applied**; supervisor value recorded as overridden; `review_required` flag on the inspection |
| Supervisor-owned | assignee, scheduled slot, cancel/accept/reject, supervisor comments, customer record corrections | nobody (read-only on tablet) | **Server value applied**; device overwrites local copy on next sync |
| System | version, status derived from transitions, timestamps | nobody | Server |

Every field in every template is mapped to a class in a table owned by product
(D2). A field without a mapping is inspector-owned if it is on the form and
supervisor-owned otherwise; the mapping test in CI fails if a template field is
unmapped.

### 7.2 Merge procedure (server, per event)

Given an event with `base_version = B` for field `F`:

1. If no server-side event for `F` with version `> B` exists → apply.
2. Else if `F` is inspector-owned → apply the inspector's value; record the
   supervisor's value as `overridden`; add `review_required`.
3. Else (supervisor-owned) → do not apply; record the event as `superseded`;
   the response tells the device the server value.

Structural transitions are checked before field events:

| Server state when batch arrives | Result |
|--------------------------------|--------|
| Assigned to this inspector, not locked | Merge as above |
| Cancelled, or reassigned to someone else | `not_applied`; batch stored as **orphaned work** attached to the inspection's audit; supervisor sees it and can reattach it when re-issuing |
| Template version differs from the device's | `not_applied`, `template_mismatch`; supervisor re-issues |
| Already accepted (should be impossible per A5) | `not_applied`, `status_locked`, alert raised in observability |

### 7.3 Signature interplay

- The signature attaches to a `form_hash` of inspector-owned content at signing
  time. The server stores that hash.
- If a supervisor edits an inspector-owned field after signature (web), the
  server records the edit as a **supervisor amendment** with its own audit
  entry and marks `signature_covers = false` for that field. Supervisor
  amendments do not rewrite signed content silently. Whether amendments require
  re-signing by the inspector is D7.
- If the inspector unlocks and edits after signing, the device invalidates the
  local signature and requires a new one; the old signature remains in the
  audit history.

### 7.4 What each party sees

- Inspector: a passive note when supervisor-owned fields changed (e.g. the slot
  moved) and when their work was orphaned. No decisions to make offline.
- Supervisor (web): `review_required` badge with a list of overridden values,
  the audit history, and orphaned work sets with a "reattach to re-issued
  inspection" action.

---

## 8. Attachments

**Capture pipeline** (single transaction where it touches the database):
capture to a temp file → recompress to the configured maximum long edge and
quality (D4) → compute `sha256` → move to the app-private attachment directory
(excluded from OS backup) → insert `attachment` row + `outbox`
`attachment_link` event. On startup, sweep the directory for files with no row
(crash between move and insert) and delete them.

**Size envelope**: 40 photos per inspection. At the recommended compression
target this is on the order of tens of megabytes per inspection; without
compression it can be several hundred. Prefetch and storage thresholds (D14)
are set from the chosen target.

**Upload**: open a session, then upload parts; persist each completed part;
on resume ask the server for its part list; `complete` → server verifies the
hash → `verified`. Only `verified` attachments count toward submission. Upload
order is capture order; the signature is last because it is captured last.

**Storage management**: a pre-capture free-space check with a warning threshold
and a hard floor; prefetch pauses at the warning threshold; verified attachment
files may be evicted under pressure (re-downloadable), unverified ones never.

**Signature**: stored as an attachment of kind `signature` (image plus stroke
data) with the `form_hash` it attests; same upload path.

**Removal**: an inspector may delete a not-yet-submitted photo; this is an
audited `attachment_link remove` event and the file is deleted locally; if the
attachment already reached the server, the server keeps it in the audit store
and marks it removed from the inspection.

---

## 9. Security and compliance

**At rest on device**

- SQLite encrypted (SQLCipher or equivalent) with a key held in the OS keystore
  (D5). Attachment files under OS file-based encryption with the strongest
  data-protection class compatible with background upload; app-level per-file
  encryption if security requires (D5).
- Database and attachment directories excluded from OS cloud backups and from
  device-to-device transfer. This is a test in M5, not a checklist item.
- No customer data in logs, crash reports, telemetry, notifications, or the
  recent-apps screenshot (secure-flag / snapshot masking).
- Camera writes to app-private storage only; never to the shared gallery.

**Authentication offline**

- Refresh token in the keystore with a lifetime covering the offline window
  policy (D6). App open offline is gated by device unlock plus an app-level
  biometric/PIN check bound to the keystore.
- After the policy window with no successful refresh, the app requires online
  re-authentication to open inspections but keeps the outbox and drains it
  after re-auth. Nothing is discarded on auth expiry.

**Authorisation on server**

- Every batch, upload session and submission is re-checked against assignment
  at application time, not at download time. Work on inspections no longer
  assigned is stored as orphaned, never applied, never dropped.
- Batch replay by id is tenant- and user-scoped.

**Purge of local customer data** (D3 sets the trigger; this is the mechanism)

- `purge_after` is set per inspection when the server confirms it holds the
  complete submission (or the orphaned work, or an unassignment). It is set from
  server time in the response, never from the device clock.
- Purge runs: immediately on receiving the confirming response (device is
  online at that instant), on every app foreground, on the periodic background
  task, and before rendering anything on cold start. It deletes customer and
  address JSON, form answers, attachment files, acked outbox rows and local
  audit mirror; it leaves the stub. Files are deleted, then the SQLite
  `secure_delete` pragma is relied on for row overwrite.
- The device posts `purge_confirmed {inspection_id, purged_at_device,
  purge_after}` to the server. The server tracks, per device, inspections past
  `purge_after` without confirmation and raises an alert; the backstop is an
  MDM action on that device. A powered-off device is a documented residual
  risk, minimised by choosing the earliest purge trigger (D3).

**Audit history**

- Every change event stores: actor, device id, device timestamp, device
  sequence, server receipt timestamp, base version, resulting version, old and
  new values, merge outcome, and for overridden values the competing value and
  actor. Server-side event store is append-only. Web edits produce the same
  events (A16).
- Purge events, orphaned-work events, signature events and submission events
  are part of the same history.

**Transport**: TLS; certificate pinning is D5's second half (recommended for a
managed fleet, low cost).

---

## 10. Migration and backfill

**Client**

- Schema version bump. On first launch after upgrade: verify A12 (no drafts in
  the old cache), drop the cache tables, create the new schema, force a full
  prefetch on next connectivity. A device that upgrades while offline shows
  "Connect to download your inspections" — this is the only moment the new app
  needs signal that the old one did not; the rollout instructs inspectors to
  upgrade on the network (MDM can enforce Wi-Fi-only install).
- Downgrade protection: the app refuses to run against a newer schema; MDM
  must not push an older build to a device with pending outbox rows (§13).

**Server**

- New tables: `change_event` (append-only), `change_batch` (id → stored
  response), `attachment_upload_session`, `submission`, `orphaned_work`,
  `device`, `device_event`, `inspection_flag`. All additive; no column drops in
  this programme.
- Reroute the existing `PUT /inspections/{id}` and web write paths through the
  change-event layer so every write produces events and a version increment.
- **Backfill**: no historical events are synthesised. Each inspection receives
  a `baseline` event (current version, current snapshot) the first time the
  new layer touches it. Audit history is complete from that point; earlier
  history remains wherever it lives today. Compliance sign-off on this boundary
  is part of M0.
- Version enforcement: if A3 turns out to be advisory today, add the check and
  run a report of how many current write paths would now receive 409s before
  enabling it.

**Web**

- Show `review_required` flags, overridden values, orphaned work, audit
  history; no other behaviour change.

**Coexistence**

- Old app builds keep working against the unchanged endpoints throughout the
  pilot. A minimum-version floor is enforced by remote config only after the
  expand stage (§12) has met its exit criteria.

---

## 11. Observability

**Client events** (no personal data; ids and counts only), buffered locally and
shipped with sync:

- Sync: attempts, outcomes by error class, batch size, round-trip time,
  outbox depth and **age of oldest pending row** per device.
- Attachments: bytes uploaded, parts resumed, sessions abandoned, verify
  failures, time from capture to verified.
- Merge: flags by field class, orphaned batches, template mismatches.
- Purge: time from `purge_after` to `purge_confirmed`; purge failures.
- Readiness: time to "Ready offline", prefetch failures by reason, storage
  headroom, captures refused for storage.
- Platform: background task execution rate, app kills during capture,
  crash-free sessions, schema migration outcomes.
- A ring-buffer diagnostic log (no personal data) that support can request from
  a device through remote config.

**Server metrics**: batch apply latency, outcomes distribution, replayed batch
ids (a proxy for flaky links), upload session completion rate, submissions
rejected by reason, devices past `purge_after` without confirmation, orphaned
work volume, 409 rate on the legacy PUT after version enforcement.

**Dashboards and alerts for the pilot**

- Per-device "oldest pending change" above a threshold.
- Any inspection past `purge_after` + margin without `purge_confirmed`.
- Upload failure rate or verify-failure rate above baseline.
- Any `status_locked` outcome (should never happen).
- Daily pilot digest: inspections completed offline, flags raised, orphaned
  sets, purge SLA compliance, storage headroom distribution.

---

## 12. Staged rollout

Stages are gated by exit criteria, not by elapsed time. Controls: server-side
per-user `offline_enabled` flag, client remote-config kill switch, minimum app
version.

| Stage | Who | Entry | Exit criteria |
|-------|-----|-------|---------------|
| S0 Dogfood | Engineering and product on a test tenant with network shaping | M7 complete | Fault-injection suite green on real devices; purge SLA met in every scripted scenario; no unsynced-work loss in a full day of shaped-network use |
| S1 Pilot | One team of inspectors and their supervisors, real inspections | S0 exit; supervisors briefed on flags; support runbook in place | Over the pilot window: zero loss-of-work incidents; every completed inspection eventually submitted and accepted through the offline path; purge confirmed within SLA for every accepted inspection; flag volume and supervisor feedback judged acceptable by product (A7 check); no open severity-1 defects |
| S2 Expand | Additional teams, including at least one with a different connectivity profile | S1 exit | Same criteria at larger scale; support load sustainable without engineering on call for the feature |
| S3 General availability | All inspectors | S2 exit | Minimum-version floor enforced; legacy cache code path removed in a subsequent release |

The kill switch behaviour is fixed: turning offline mode off stops prefetch
and new offline edits but **always** keeps draining the outbox and uploading
attachments. There is no configuration that discards queued work.

---

## 13. Rollback

**Invariants that hold under every rollback**: no queued work is discarded; no
purge is skipped; server-side data stays consistent with the audit log.

| Layer | Rollback action | Constraint |
|-------|-----------------|------------|
| Feature flag / kill switch | Disable per user or globally | Outbox continues to drain; the app reverts to online-only for new work |
| Client build | MDM rolls back to the previous build | Only permitted for a device whose outbox is empty and attachments are all verified; the app exposes this via a device event so the MDM operator can check. Otherwise the previous build cannot read the new schema and would strand work |
| Server endpoints | Flag off the new endpoints | Devices see 404/410 and back off; nothing is lost; must not be combined with a client rollback that leaves work stranded |
| Server schema | Not rolled back; all changes are additive and unused tables are harmless | Column or table drops are deferred until after S3 |
| Merged data | Supervisor reverts an overridden value from the audit view | Every merge stored the losing value, so revert is a normal edit with its own event |

---

## 14. Testing

**Unit** — merge engine (property-based: single-side change always applies;
both-side change resolves by class; replaying a batch is a no-op; event order
within a batch is respected), outbox state machine, purge scheduler with an
injected clock, storage threshold logic, form-hash stability across
serialisation.

**Contract** — client and server against a shared API contract for every
endpoint in §6.2, including the replay behaviour of every idempotent call.

**Integration with fault injection** — a harness that cuts the network at
every state transition: mid-batch, between batch and response, mid-part, after
`complete` but before the response, during submit; plus 5xx bursts, slow links,
token expiry mid-sync, server clock ahead/behind device. Pass condition: every
run ends with server state equal to device intent and no duplicated or lost
events.

**Device** — app kill during capture; power loss (pull the battery on a test
unit) during autosave; airplane mode toggled every few seconds; background
execution restricted by the OS; storage filled to the floor; OS upgrade with
pending work; restore-from-backup must produce no customer data.

**Concurrency scenarios** — scripted supervisor edits against each field class
while a device is offline with competing edits: verify applied value, audit
entries, flags, and what each party sees. Include cancel, reassign, template
change, and accept-before-push (must be impossible; test that it is).

**Attachment soak** — 40 photos across multiple inspections on a shaped
intermittent link; verify resumption counts, integrity, and total drain time.

**Security and compliance** — at-rest encryption verified on a jailbroken/rooted
test unit; purge verified by forensic file-system inspection; log and telemetry
scan for personal data; audit reconstruction test: rebuild any inspection's
state at any version from events alone.

**Pilot acceptance script** — a checklist inspectors and supervisors run in the
first days of S1 covering the full flow and the failure paths in §3.5.

---

## 15. Milestones

Dependencies are hard unless marked (soft). Acceptance criteria are the
definition of done; nothing else is.

| ID | Milestone | Depends on | Deliverables | Acceptance criteria |
|----|-----------|------------|--------------|---------------------|
| M0 | Discovery and decisions | — | Verified answers for A1, A3, A5, A6, A7, A9, A11, A12, A15; decisions D1–D15 recorded; field-class mapping for every current template; compliance sign-off on the audit baseline boundary (§10) | Every D# has a recorded owner and choice; no "verify" assumption remains unverified; server version semantics documented from code, not from memory |
| M1 | Server foundations | M0 | Version enforcement; `change_event` layer with web/legacy writes rerouted; change-batch endpoint with merge and replay; flags; attachment sessions; submissions; device events incl. purge confirmation; remote config; audit endpoint | Contract tests pass; audit reconstruction test passes; legacy PUT 409 report reviewed; merge property tests pass for every field class |
| M2 | Client local store and outbox | M0 (soft on M1: contract stubs suffice) | Encrypted schema; transactional autosave; outbox; cache migration; backup exclusion; orphan-file sweep | Kill/power-loss tests lose at most one debounce window; migration from the current build verified on real devices; backup contains no customer data |
| M3 | Client sync engine | M1, M2 | Reachability probe; push/pull/apply; replay on restart; backoff; conflict notes; orphaned handling; "Sync now" | Fault-injection suite green; server state equals device intent in every run; no duplicate events under replay |
| M4 | Attachments and signature | M2, M1 (sessions) | Capture pipeline; compression; resumable upload; verify; storage management; signature with form hash; removal | 40-photo soak passes on a shaped link with resumption; integrity verified server-side for every file; storage floor respected |
| M5 | Purge and compliance | M3, M4 | Purge scheduler and triggers; purge confirmation; server-side purge tracking and alert; audit completeness on device and server | Purge SLA met in every scripted offline scenario; forensic check finds no residual customer data; alert fires for an unconfirmed purge in test |
| M6 | Supervisor web | M1 | Flags and overridden values; audit history view; orphaned work with reattach | Supervisors in dogfood can find, understand and act on every flag type without engineering help |
| M7 | Pilot readiness | M3, M4, M5, M6 | Dashboards and alerts (§11); kill switch verified; support runbook; inspector and supervisor briefing; pilot acceptance script | S0 exit criteria met |
| M8 | Rollout S1 → S3 | M7 | Pilot operation, expand, GA, version floor, legacy path removal | Stage exit criteria in §12 |

M1 and M2 can proceed in parallel against the agreed contract. M4 and M3 can
proceed in parallel once M2's schema is stable. M6 is independent of the
client track. The longest chain is M0 → M1 → M3 → M5 → M7 → M8.

---

## 16. Decisions required before implementation

Each has a recommendation; the recommendation is what this plan assumes.

| ID | Decision | Options | Recommendation and rationale |
|----|----------|---------|------------------------------|
| D1 | Where merging happens | (a) server-side field-level merge via a change-batch endpoint; (b) client-side three-way merge over the existing whole-record PUT | **(a).** Whole-record PUT with a version check turns every supervisor touch into a 409 for the whole inspection; the server already needs the event log for audit, and the merge is a query over it. (b) is a fallback only if the server cannot change in this programme. |
| D2 | Conflict ownership policy | (a) inspector wins on form content, supervisor wins on workflow, losers audited and flagged; (b) supervisor always wins; (c) last write wins by server time | **(a).** The inspector was on site; (b) discards field evidence silently; (c) is arbitrary under intermittent connectivity. Product owns the field-class table. |
| D3 | When local customer data is purged | (a) immediately when the server confirms the complete submission (or orphaned work / unassignment), keeping a non-personal stub; (b) on the acceptance signal with a fallback timer from submission confirmation; (c) only on the acceptance signal | **(a).** Compliance holds by construction: purge happens while the device is online and before acceptance can occur, so the 24-hour window is never at risk from a device that stays offline. The cost is that inspectors cannot review a submitted inspection offline; a rejected inspection is re-downloaded. Choose (b) only if the pilot shows inspectors need post-submission access, and set the fallback timer well inside 24 hours. |
| D4 | Photo handling | (a) recompress on capture to a fixed maximum edge and quality, keep only the compressed file; (b) keep originals and upload them | **(a)**, subject to legal confirming compressed images are acceptable evidence (A9). Storage and drain time on intermittent links scale directly with this choice. |
| D5 | At-rest protection and transport | (a) SQLCipher for the database plus OS file encryption for attachments, backup exclusion, certificate pinning; (b) add app-level per-file encryption for attachments | **(a)** for the pilot on a managed fleet; escalate to (b) if security review requires it. Backup exclusion is non-negotiable in either case. |
| D6 | Offline authentication window | Refresh-token lifetime and local unlock policy | Set the window to exceed the longest realistic offline period found in M0, gate app open on device unlock plus app biometric/PIN, and require online re-auth after the window. Draining the outbox never depends on the window. |
| D7 | Post-signature edits by supervisors | (a) amendments recorded separately with `signature_covers=false`, no re-sign required; (b) any amendment to signed fields invalidates the signature and returns the inspection to the inspector | **(a)** for the pilot; it never rewrites signed content and keeps the flow simple. (b) is a compliance question for legal; if required it is a status transition on the server, not a client change. |
| D8 | Offline creation of inspections | in / out | **Out** for this programme. It needs server-issued id ranges and a different assignment model. |
| D9 | Upload mechanism | (a) presigned multipart to object storage; (b) chunked upload through the API | **(a)** if object storage exists, otherwise (b); the client sees one session abstraction either way (A10). |
| D10 | Pull mechanism | (a) poll the assignment list with versions; (b) server change feed | **(a).** Assignment lists are small; polling on each sync wake is cheap and simple. Revisit if the list or the fleet grows. |
| D11 | Work on cancelled or reassigned inspections | (a) store as orphaned work, never apply, supervisor can reattach; (b) apply anyway; (c) discard | **(a).** (b) corrupts a record the inspector no longer owns; (c) violates G1. |
| D12 | Version floor and legacy removal | when to enforce a minimum app version | After S2 exit; never during the pilot, so that a rollback to the old build remains possible for devices with an empty outbox. |
| D13 | Template pinning | (a) pin template version at assignment, server never changes it for a downloaded inspection; (b) allow template changes and migrate answers | **(a).** Template changes on an in-progress inspection are re-issues, not edits. |
| D14 | Prefetch window and storage thresholds | how many days of assignments; warning and hard-floor free-space values | Prefetch today's and the next working day's assignments automatically, allow manual "Make available offline" beyond that, and derive the thresholds from the D4 compression target and the device fleet's free storage measured in M0. |
| D15 | Ordering semantics for the audit history | device sequence + device time + server receipt time (A15) | Record all three; present server receipt order by default with device order available. Confirm with compliance in M0. |

---

## 17. Open questions (owner to be assigned in M0)

- Does acceptance ever happen automatically, and can it happen on a partial
  submission? (A5)
- What exactly counts as customer data for the purge, and may the stub retain
  the scheduled slot and a non-identifying title? (A6)
- How often do supervisors edit form answers on in-progress inspections today?
  (A7; answerable from server logs)
- Is a recompressed image acceptable evidence? (A9)
- What is the longest period a tablet realistically stays offline? (D6, D14)
- Is the audit baseline boundary (history complete from M1 onward) acceptable
  to the regulator? (§10)
- Are there inspection types that legitimately have more than one inspector?
  (A2; excluded from the pilot if so)

---

## 18. Risk summary

The three assumptions whose failure would most change this plan are A3 (version
semantics), A7 with D2 (conflict policy acceptability), and A5 with D3 (purge
timing under offline conditions). They are discussed in `RESPONSE.md`. Each is
scheduled for verification in M0 before any dependent work starts.
