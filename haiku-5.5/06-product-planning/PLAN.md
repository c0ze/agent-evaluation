# Offline inspection sync: implementation plan

**Input:** `BRIEF.md` only. Nothing here was checked against the existing codebase or server.

**Conventions:** **A#** = assumption (§2). **D#** = decision to make before implementation (§17). Numbers marked *proposed* are starting points to calibrate in the M0 spike or the pilot. The brief gives no basis for them, so they must be measured before they are relied on.

**No dates or staffing.** Milestones are ordered by dependency and gated by acceptance criteria.

---

## 1. Summary

Inspectors lose notes today because the mobile app treats SQLite as a read-through cache. The change makes the tablet the place where in-progress work lives until the server confirms it.

- **Local-first store.** Assigned inspections live in encrypted SQLite. Each edit commits together with an outbox entry, so nothing the inspector enters is discarded on disconnect.
- **Server as system of record.** The server keeps a field-level change log. That log is the audit trail and the merge base, and it uses the existing integer record versions.
- **Merge, not lock, not last-writer-wins.** Edits to different fields merge automatically. Same-field disagreements become visible held proposals. No value is silently overwritten.
- **Attachments as immutable, hashed blobs.** Photos and signatures upload resumably and are verified by the server before the device relies on them.
- **Purge at confirmed submission.** The device removes customer data once the server confirms submission, which closes the device's exposure window before acceptance can occur. This depends on compliance confirming the reading (A2, D1).
- **Pilot first.** One cohort behind a server-controlled flag. Rollback drains outboxes rather than discarding them.

---

## 2. Assumptions

| ID | Assumption | If false | Verify in |
|---|---|---|---|
| A1 | Every existing write path (web, REST API, batch imports, admin scripts) increments the record version in the same transaction, and stale writes are rejected. | Conflict detection and the audit trail are wrong. Write paths must be fixed before any sync work. | M0 spike, M1 |
| A2 | The 24-hour removal duty runs from server acceptance, and removing the local copy after submission is confirmed satisfies it. | Device retention must follow acceptance, which a basement device may not learn of in time. The design changes (§9). | M0 (compliance opinion) |
| A3 | Inspectors download assigned inspections and templates while online, before going underground. New inspections are not created offline. | Offline creation or on-site assignment is needed. Conflict surface and scope grow. | M0 (product, ops) |
| A4 | Compressed photos average about 1 MB (long edge 2048 px). 40 photos is about 40 MB per inspection. Tablets have room for several pending inspections. | Stronger compression or eviction rules are needed. Uploads take longer. | M0 device measurement |
| A5 | Same-field conflicts are infrequent: a supervisor on the web and an inspector offline edit the same field of the same inspection. | Locks, section ownership, or a richer merge UI are needed. Merge logic alone is not enough. | M0 supervisor interviews, M9 telemetry |
| A6 | Form fields have stable keys and are independently meaningful, so field-level merge is valid. | Merges can produce invalid combinations. Section-level granularity is needed. | M0 template review |
| A7 | "Customer data" means form content, photos, and signatures held on the device. Audit records (who, what, when) are not purged from the device but are kept on the server for the regulated period. | Purge scope changes, or audit records need minimizing. | Compliance (M0) |
| A8 | Company-managed tablets support MDM remote wipe, excluding app data from OS backup, and hardware-backed key storage. | Compensating controls are needed. Lost-device risk rises. | IT, device model and OS (M0) |
| A9 | Sync runs on reconnect, on app foreground, and on manual retry. Push notifications are not needed for the pilot. | A push channel is needed. | Accepted for pilot |
| A10 | Device clocks can be wrong. Server time governs acceptance timing and audit ordering. | Purge timing and audit ordering are wrong. | Clock-skew tests (M3, M6) |
| A11 | The current read-through cache holds no unsynced writes, so it can be discarded at upgrade. | Writes are lost at upgrade. | Read the old app's write paths (M8) |
| A12 | Offline sessions can last hours to days, and drafts can stay unsynced for days. | Sync and storage limits must be revisited. | M0 (product) |

The three riskiest assumptions are A1, A2, and A5. `RESPONSE.md` covers them.

---

## 3. Scope

**In scope for the pilot** (the scope items marked *assumed* go beyond the brief):

- Sign-in, pre-download of assigned inspections and their pinned templates, and per-inspection offline status.
- Offline editing of form fields, with local autosave on every change.
- Up to 40 photos per inspection captured offline, and soft delete of a photo.
- A signature captured offline and bound to the form state it signs.
- Ready check, with submission queued until connectivity returns.
- Automatic sync on reconnect, with visible sync status and visible held conflicts.
- Supervisor web: a conflict queue for held proposals, and a per-inspection audit view (*assumed*; D16).
- Local purge after confirmed submission, with purge receipts and overdue monitoring.
- A pilot cohort behind a server flag.

**Out of scope:**

- Real-time or simultaneous co-editing, presence indicators, field locks, and CRDT or OT text merging.
- Offline creation of inspections, and offline reassignment.
- Offline editing on the supervisor web. The web stays online-only.
- Offline access to submitted or accepted inspections (D2).
- Offline search, reporting, or PDF generation across inspections.
- More than one signed-in user per tablet at a time.
- Attachment types beyond photos and signatures, such as video or audio.
- Replacing existing REST endpoints. They are extended, not replaced.
- Broad rollout, which is gated on the pilot (§13).

---

## 4. User flow

### 4.1 States

**Device-side state:** `not downloaded` → `available offline` → `editing (unsynced)` → `ready` → `submit queued` → `submitted` → `purged`.

**Blocking or changing side states:**

- `held conflict`: blocks submission.
- `signature invalid`: content changed after signing, so the inspector must re-sign.
- `returned`: the supervisor requested rework, so the inspector must re-download.
- `orphaned`: the inspection was unassigned while unsynced work existed (D23).

**Server-side state:** `draft` → `submitted` → `accepted` or `returned`.

### 4.2 Flows

1. **Before going underground (office, Wi-Fi).** The inspector signs in and sees the assignment list. They tap "Make available offline". The default is all assigned inspections. The app downloads the snapshot, the template version, and the attachment manifest. Each row shows *Available offline*, *Updated on server*, or *Not downloaded*.
2. **In the basement.** Opening an available inspection never needs the network. Each edit commits locally at once. A banner reads "Offline. N changes waiting to sync." Photos are captured, compressed, encrypted, and queued. After the inspector signs, the form locks. Unlocking to edit invalidates the signature and requires re-signing.
3. **Ready.** Local validation runs. If it passes, the inspector taps "Submit when connected". The submission is queued, not blocked.
4. **Back in coverage.** Sync runs in the background in this order: field operations (serial per inspection), photo uploads (resumable, up to 2 in parallel), the signature, submit, and then a pull of other changes. Progress and failures are visible. Retries are automatic and never block the UI.
5. **Conflict.** After sync, the inspection shows "1 conflict". The conflict shows the inspector's value, the current server value, and who changed it last. The inspector picks one, or types a new value. That creates a resolution operation. Submission stays disabled until no conflicts remain.
6. **Submission confirmed.** The device shows "Submitted" with the inspection ID and submit time, then removes the customer data (§9). The "submitted" list keeps only the opaque ID and timestamps, with no names or addresses.
7. **Returned by supervisor.** The inspection shows "Returned. Connect to download." It can be edited only after a fresh download.
8. **Accepted.** Nothing is left on the device. Any remaining local copy is purged by the backstop trigger (§9).

### 4.3 Rules that apply everywhere

- Sync errors never block editing, and failed work is never dropped.
- Once a submit is sent, the form is locked on the device until the server confirms or rejects it.
- Signing out with unsynced work is blocked, with a clear message.
- An expired token while offline does not delete local data. The inspector re-authenticates when online (D12).

---

## 5. Local data model

SQLite in WAL mode with `synchronous=FULL`, encrypted per §10.

- **`inspection`**: id, server_version, template_id, template_version, server_status, local_state, signed_content_hash, submitted_at, purge_state.
- **`field_value`**: keyed by (inspection_id, field_key); holds value, server_version_seen, and a dirty flag. `server_version_seen` is the version at which this device last saw that field's server value, either from a pull or from its own acknowledged operation. It is the per-field base for conflict detection.
- **`outbox_op`**: op_id (UUID, primary key), inspection_id, seq, kind (`set_field`, `add_photo`, `delete_photo`, `sign`, `unlock`, `submit`, `resolve`), field_key, payload, base_version, state (`pending`, `in_flight`, `acked`, `held`, `rejected`), attempts, next_attempt_at, error_code.
- **`attachment`**: id (UUID), inspection_id, kind (`photo` or `signature`), sha256, byte_size, file_ref, upload_state, upload_offset, server_attachment_id, capture_index.
- **`held_conflict`**: inspection_id, field_key, device_op_id, device_value, server_value, server_version.
- **`sync_state`**: device_id, protocol_version, last_success_at, feed cursor.

**Invariants:**

1. An edit and its outbox row commit in one transaction. No UI change happens without a durable operation.
2. An operation is deleted only after the server acknowledges it (applied, duplicate, or held). A held operation is deleted only after it is resolved.
3. At most one pending `set_field` per field. A later edit replaces the value but keeps the earliest pending `base_version` for that field. This keeps conflict detection conservative: a conflict is never missed.
4. One batch in flight per inspection. Operations for an inspection are sent in seq order.
5. A pulled snapshot updates non-dirty fields and their `server_version_seen`. Dirty fields keep their pending value and base. The display is the server snapshot with pending operations overlaid.

---

## 6. Server changes and sync protocol

### 6.1 Server additions

- **`change_log`** (append-only): inspection_id, version, field_key, old_value, new_value, actor_type (`inspector_device`, `supervisor_web`, or `system`), actor_id, device_op_id, device_time, server_received_at. Rows are written in the same transaction as the version increment (A1). The application role has no UPDATE or DELETE on this table.
- **`op_receipt`**: unique on (inspection_id, op_id), storing the result. Retries return the stored result.
- **`held_proposal`**: op_id, inspection_id, field_key, proposed_value, base_version, state (`open` or `resolved`), resolution, resolved_by, resolved_at.
- **`attachment`**: id, inspection_id, kind, sha256, byte_size, state, storage_ref, uploaded_offset.
- **`device`**: device_id, user_id, status (`active`, `revoked`, or `lost`), protocol_version, last_seen_at.
- **`purge_receipt`**: device_id, inspection_id, device_purged_at, method, self_check_passed, received_at.
- **Assignment change feed** per user, with a monotonic cursor (D6).
- **Cutover baseline marker** (§11).

### 6.2 Endpoints (v1; final shapes in OpenAPI at M2)

- `GET /v1/sync/feed?cursor=`: assignment and inspection changes, including version bumps, status changes (submitted, accepted, returned), and unassignments.
- `GET /v1/inspections/{id}`: snapshot, with version, field values and per-field versions, template reference, and attachment manifest. The ETag is the version.
- `POST /v1/inspections/{id}/ops`: a batch of up to N operations, each `{op_id, field_key, value, base_version}`. Response 200: `{version, applied[], duplicate[], held[{op_id, field_key, server_value, server_version}]}`. Partial application is intentional (§7).
- `PUT /v1/attachments/{id}`: metadata (inspection_id, kind, sha256, byte_size) returns an upload session. Chunks are sent with an offset. `GET` on the session returns the current offset after an interruption. `POST .../complete` verifies the sha256. All of these are idempotent by attachment ID.
- `POST /v1/inspections/{id}/submit`: body `{submit_op_id, base_version, signature_attachment_id, content_hash}`. The server rejects unless there are no open held proposals, all attachments are verified, and the signature's content hash matches the current server state. A mismatch returns 409 `content_changed_after_signature`. The inspection must still be editable.
- `GET /v1/inspections/{id}/status?op_id=`: recovery after a lost response.
- `POST /v1/devices/{id}/purge-receipts`: batch.
- Every request carries `X-Protocol-Version`. Unsupported versions get 426. The app keeps all local data and prompts for an update.

### 6.3 Retries and idempotency

- The client generates IDs (op_id, attachment ID, submit op_id) and reuses them on every retry. A response lost after the server committed is therefore safe: the retry gets the stored result.
- Retries use exponential backoff with jitter. Operations wait indefinitely. Their age is surfaced to the user.
- The server serializes writes per inspection with a row lock on the inspection row.
- Batch size limits (maximum ops and body bytes) are set by M2 tests.

### 6.4 Server merge algorithm (per operation, in order)

1. If no `change_log` row exists for (inspection, field) with version greater than `op.base_version`, apply it: increment the version, write the change_log row, and update the value.
2. Otherwise, if the server's current value already equals `op.value`, treat it as applied (a no-op).
3. Otherwise, insert a `held_proposal` and do not apply the value. Return it in `held[]`.

After the batch, run template validation on the resulting state. Validation errors do not reject operations. They block submission.

The check is per field, not per record. A whole-record `If-Match` on the integer version would turn every concurrent edit into a conflict. The record version still matters, because it is the base the field-level check is measured against.

### 6.5 Pull

Every sync pulls the feed first, then fetches the snapshots of changed inspections. Snapshots are applied under §5 invariant 5.

---

## 7. Conflict policy

**Principles:**

- Never silently overwrite a value.
- Never drop an offline operation.
- Every value that is replaced or held appears in the audit log, attributed to its actor.

| Situation | Outcome |
|---|---|
| Different fields changed on the device and on the server | Merged automatically |
| Same field, same value | No conflict |
| Same field, different values | Held proposal. The server keeps its value. The device keeps its value as unresolved. Both are shown. |
| Field with an open held proposal | Locked for new device edits until resolved |
| Photo added offline | Never conflicts (add-only, unique IDs) |
| Photo deleted on both sides | Idempotent |
| Merge produces an invalid form | Applied. Submission is blocked until fixed. |
| Content changed after signing | Signature invalidated on the server. Inspector must re-sign. |
| Operation after submission | Rejected `not_editable`. If returned, the device re-downloads. |
| Operation after acceptance | Rejected |
| Inspection unassigned while unsynced work exists | Operations stay in the outbox as `orphaned`. They are shown to the inspector and to the supervisor on the web. Nothing is dropped silently (D23). |

**Resolution (D3, recommended).** The inspector resolves on the device the next time they open the inspection. They can choose the server value, keep their own, or type a new value. A supervisor on the web can resolve at any time and can override. Each resolution is a new operation with the current base. The audit records both values and the resolver.

**Why not the alternatives:**

- **Server wins** discards the inspector's offline notes, which is the problem the brief describes.
- **Last-writer-wins** loses data silently, which an audit trail cannot accept.
- **Pessimistic locks** block supervisors. Lease expiry is undefined when a device is offline for days. The brief does not ask for locks.
- **CRDT or OT** is built for real-time co-editing, which is out of scope.

**Signals to track:** held proposals per 100 applied edits, time to resolve, and hotspot fields (field keys only, never values).

---

## 8. Attachments

### 8.1 Photos

- Capture only through the in-app camera. Files are stored in the app sandbox, encrypted (§10), and never written to the camera roll.
- Compress on capture: long edge at most 2048 px, JPEG quality 75 to 85 (A4, to calibrate). Strip GPS by default (D10).
- Cap of 40 per inspection, enforced on the device and on the server.
- Each photo has a client UUID, the sha256 of the stored bytes, the byte size, a capture index, and the device capture time.
- States: `captured` → `queued` → `uploading` → `uploaded` → `verified`. A local copy is evicted only after `verified`, and only under storage pressure (least recently used). Photos stay local until submission so the inspector can review them offline.
- Uploads are chunked and resumable. After an interruption the client asks the server for the offset and continues. A hash mismatch causes a re-upload. Retries back off with jitter. Stalled uploads are visible to the user.
- Storage guard: capture and download are refused below a free-space threshold (*proposed*: calibrate in M0), with a clear message. Nothing is dropped silently.
- A photo captured and then deleted before upload sends both the add and the delete operations, and does not upload the blob. Both events are audited.
- Deleting an uploaded photo creates a tombstone operation. The local file is removed after the server acknowledges it. The server keeps the blob under the retention rule (D16).

### 8.2 Signature

- Captured as a rendered PNG plus stroke data (JSON), bundled as one attachment with its sha256, signer name, signer role, and device time.
- Bound to the form state: the signature stores a canonical hash of all field values plus the ordered photo ID list, as of signing.
- Immutable once verified. Any later applied content change invalidates it on the server. The device locks the form after signing. Unlocking is an explicit action, and it is audited.
- Submission checks the hash against current server state (§6.2). If the supervisor changed content in the meantime, submit returns 409, and the inspector merges and re-signs.
- Whether a device-captured signature with later server receipt is legally sufficient is a compliance question (D9, D20).

### 8.3 Upload network policy

Uploads over cellular are allowed by default in the pilot, with per-inspection visibility. A Wi-Fi-only setting is available if data cost requires it (D11).

---

## 9. Retention and purge (the 24-hour rule)

**Requirement:** remove local customer data within 24 hours after acceptance.

**Problem:** acceptance is a server event. A basement device can be offline longer than 24 hours and cannot learn of acceptance in time. A purge that depends on sync cannot be guaranteed.

**Recommended design (D1):**

1. **Primary trigger: server-confirmed submission.** Once the server confirms the submission and verifies the attachments, the device purges the inspection. Acceptance can only happen after submission, so the device's exposure window closes before the regulatory window would. This depends on A2.
2. **Backstop trigger: acceptance.** If the device learns of acceptance first (for example, because a submit acknowledgment was lost), it purges within 24 hours of the server's `accepted_at`. The deadline is computed from server time plus a monotonic device-clock offset, not the device wall clock (A10).
3. **Other triggers:** sign-out (only when no unsynced work exists), unassignment, MDM wipe, and device revocation.

**Purge mechanics:**

- Each inspection has a data key, wrapped by the database key. Purge destroys the key, deletes the rows, and deletes the files, thumbnails, temporary files, and upload sessions for the inspection. The outbox entries for that inspection are removed only after they are acknowledged.
- Self-check: after purge, scan the app's storage paths for the inspection ID and wrapped key material, and record the result.
- A purge receipt goes to the server (device time, method, self-check result). The server tracks overdue purges.

**Residual risk:** the server confirmed the submission but the acknowledgment was lost, and the device stays offline past acceptance. The device keeps only the submitted payload until it can confirm. Alert on devices holding submitted-but-unconfirmed inspections past a threshold (*proposed*: calibrate). Compliance must accept or reject this residual risk.

**Option B, rejected unless compliance requires it:** keep local copies until acceptance. This works only if the device can always reach the server before the deadline, which a basement cannot promise. The fallback is a remote wipe at the deadline, which destroys unsynced drafts. Option B would need a different product design, so the decision should close before M0 ends.

**Lost or wiped devices:** MDM wipe plus server revocation. Unsynced drafts on that device are lost. The product owner must accept this (D22).

**Server audit records are not purged by this process** (D16).

---

## 10. Security and privacy

| Threat | Control | Residual risk and test |
|---|---|---|
| Lost or stolen tablet | Device passcode. Encrypted database and files (SQLCipher or equivalent), with keys in hardware-backed storage. MDM remote wipe. Server revokes device tokens. | Unsynced drafts are lost on wipe (D22). Test wipe and revocation. |
| Offline credential misuse | Refresh token in secure storage. App lock. Limited offline grace window (D12). Server authorizes every request. | Test expired-token behavior with local data present. |
| Cross-inspector access | Server checks assignment on every read, operation, attachment, and submit. The client is never trusted. | IDOR tests on every endpoint. |
| Data in backups, snapshots, or logs | App data excluded from OS backup. App-switcher snapshot blurred. Logs carry IDs only, never form content, photo bytes, or GPS. | Backup-output test. Log-redaction test. |
| Audit tampering | Server-only audit writes. Append-only role. Devices cannot write `change_log` directly. | Permission test. Optional hash chain (D20). |
| Replay of old operations | Op IDs scoped to inspection and user. Receipts return the stored result. Tokens required. | Replay tests. |
| Transport | TLS only, no cleartext. Certificate pinning only if security policy requires it (D20). | Standard TLS checks. |
| Oversized or abusive uploads | Per-attachment and per-inspection size caps. Rate limits. Hash verification. | Load and abuse tests. |
| Supervisor overwrites inspector answers | Every resolution is audited with both values and the resolver's identity. | Audit completeness test. |

**Privacy:** data is minimized. GPS is stripped by default, and nothing goes to the camera roll. Inspectors get notice that drafts stay on the tablet until submission. The retention statement is documented.

**Security gate:** threat-model review and a penetration test of the sync and attachment endpoints before the pilot (M7).

---

## 11. Migration and backfill

**Client**

- The old read-through cache is purged once, at first launch of the new version. This happens only after confirming there are no pending writes (A11). Assigned inspections are then re-downloaded. Record counts are checked before and after.
- Local migrations are forward-only and versioned. A failed migration leaves data untouched, opens the app in a safe read-only state, and reports the error.
- The new client enforces a minimum protocol version. Old clients keep the read-through path until the flag and the contract phase.

**Server**

- Expand-only changes during the pilot: the new tables in §6.1. Nothing is dropped. The contract phase happens only after general availability.
- Write-path inventory at M0. Every writer routes through the change-logging layer or a database trigger. A writer that cannot be routed blocks M1 (A1).
- **Cutover baseline.** For every non-accepted inspection, record a baseline at cutover version C, with a full snapshot in `change_log`. Operations with `base_version` below C are rejected `stale_base`, and the app refreshes. This is safe because devices that downloaded before cutover hold no drafts (A11).
- Pre-cutover audit history is kept as it is. The new audit starts at C. The gap is documented and shown to compliance (D16).
- Attachment backfill, if existing server photos need hashes: a batch job with checkpoints, idempotent, verified per inspection by checksum before and after. Mismatches are re-run.

**Pilot devices:** enrolled devices receive the flag. The first sync downloads all assigned inspections.

---

## 12. Observability

**Device** (aggregated, sent on sync, with no customer content):

- Outbox depth, oldest pending operation age, bytes pending upload.
- Sync attempts, successes, and error codes. Time from reconnect to fully synced.
- Held conflicts by field key (not values).
- Photo upload failures by reason. Storage free-space bands.
- Crashes, including those during offline sessions.
- Purge timing: time from confirmed submission to purge. Self-check failures. Overdue count.
- Migration outcome, protocol version, and flag state.

**Server:**

- Per endpoint: request rate, error rate, p95 latency. Counts of 409 and 426.
- Merge outcomes: applied, duplicate, held, no-op.
- `change_log` write failures. These must fail the operation, never skip the audit write.
- Attachment ingest throughput, hash mismatches, and incomplete sessions older than a threshold.
- Submit-to-accept latency.
- Overdue purges by device and by age. Devices holding submitted-but-unconfirmed inspections.

**Integrity reconciliation** (daily, for the pilot and after): compare the operations each device reports creating per inspection with the operations the server acknowledged, and do the same for photo counts. Any gap is a P1 incident.

**Initial alerts** (*proposed*):

- Any operation or photo unacknowledged past a threshold on a device that has synced recently.
- Any overdue purge.
- Any audit write failure.
- A jump in the held-proposal rate.
- Any 426 in the pilot cohort after rollout.
- Any hash mismatch.

**Logging:** structured, redacted, with a trace ID per sync session. No form values or photo bytes.

**Dashboards:** pilot cohort versus non-pilot cohort, broken down by site.

---

## 13. Staged rollout

Gates are defined by conditions, not dates.

| Stage | Population | Entry gate | Exit gate |
|---|---|---|---|
| S0 Lab | Engineering test tablets, staging backend | M0 closed. D1 to D4 and D9 recorded. | M3 to M6 acceptance met. Fault-injection suite passes. |
| S1 Dry run | Internal staff on test inspections in the production tenant | Security review of M7 scope. Compliance sign-off on the purge trigger (D1). Rollback drill passed in staging. | Full end-to-end scenario on physical tablets in airplane mode. Monitoring verified. No open P1. |
| S2 Pilot | One cohort of inspectors and their supervisors at one site, flagged per user | Pilot cohort and thresholds agreed (D18). Runbook written. Support on call. Inspectors notified. | Pilot exit criteria (below) met over the pilot period. |
| S3 Expansion | Additional sites, in waves | Previous wave met its exit gate. No rollback trigger open. | Gates per wave |
| S4 General availability | All inspectors | Go decision recorded | Stable for a defined period. The read-through path is removed in a later release, in the contract phase. |

**Pilot exit criteria** (*proposed*; thresholds confirmed in D18):

- Zero confirmed losses of an offline operation, photo, or signature, per reconciliation.
- Zero purge deadline breaches, or every breach explained and fixed.
- Zero audit gaps for pilot inspections.
- Zero open P1 security findings.
- Conflict rate and time to resolve measured, and within bounds agreed in D18. No bound is set here because there is no baseline yet.
- Inspector-reported task time and support volume no worse than the current app.
- A typical 40-photo inspection fully syncs within a target agreed in D18. *Proposed starting point:* 5 minutes on Wi-Fi. Measure before committing.

---

## 14. Rollback

**Kill switches** (server-side flags, per cohort or device):

1. **Pause uploads.** Operations and photos queue locally.
2. **Pause submit.** Submissions queue locally.
3. **Drain mode.** The app stops downloading new drafts and creating new offline drafts. It keeps syncing what already exists.
4. **Disable the offline path.** Revert to read-through only after the outbox is empty.

**Rules:**

- Never disable the offline path while the outbox has items. Rollback waits for the drain.
- During the pilot, the server never removes endpoints, tables, or audit data. New endpoints are protocol-versioned. Clients below the minimum get 426 and keep their data.
- Local migrations are forward-only. Earlier app versions cannot read new outbox rows, so downgrading is allowed only after the drain. Schema additions are backward-compatible so that old clients can still read.
- Incorrect merges are corrected with compensating operations recorded in `change_log`. History is never rewritten.
- A device that cannot drain (lost or wiped) follows §9 and D22.

**Triggers:** confirmed data loss or an unexplained reconciliation gap; merge corruption; purge breach at scale; security incident; crash or sync error rates above the D18 thresholds.

**Drill:** in S1, on a test device with pending operations and photos. Enable drain, reconnect, confirm zero loss, and confirm a clean downgrade. Repeat before each expansion wave.

---

## 15. Testing

| Layer | What is tested | Key cases |
|---|---|---|
| Unit | Outbox state machine, coalescing, base-version tracking, purge state machine | Coalescing keeps the earliest base. Purge only after acknowledgment. |
| Model and property | Random interleavings of device operations, server operations, retries, reorders, and lost responses | No acknowledged operation lost. No silent overwrite. Every replaced value appears in `change_log`. Outcome deterministic for a given server order. |
| Contract | App against the v1 OpenAPI, and 426 behavior | Old and new client versions. Breaking schema changes fail CI. |
| Server integration | Idempotency, row-level serialization, authorization, `change_log` in-transaction | Duplicate operation, attachment, or submit returns the stored result. Concurrent writers. Cross-user access denied. |
| Device fault injection | Kill at each write boundary. Power-loss simulation where possible. Storage full. Clock skew forward and back. Token expiry while offline. | Zero losses across repeated kills. Purge timers correct. |
| Network chaos | Packet loss, timeouts, responses lost after commit, flapping connectivity | Retries converge. No duplicate `change_log` rows. Uploads resume at the server offset. |
| Device lab | Physical target tablets, airplane mode, real camera and signature capture | 40-photo inspection end to end. Repeated basement-like on and off cycles. |
| Security | Penetration test of sync endpoints. Inspection of encrypted files on storage. Backup-output check. Log redaction. | No high findings open before S2. |
| Purge verification | Submit acknowledged. Accept first. Lost acknowledgment. Device offline past accepted_at plus 24 hours. Wipe. | Deadline logic. Self-check. Receipts. Overdue alerts. |
| Migration | Real-shaped old cache database. Upgrade with and without assigned data. Downgrade after drain. Backfill rerun. | Counts and checksums match. Backfill rerun is idempotent. |
| Performance | Upload throughput for 40 photos. Sync endpoint load at pilot size, and at reconnect bursts when many devices return together | Targets set from the M0 spike. p95 measured. |
| Usability | Walkthroughs with inspectors: offline indicators, conflict resolution, re-sign prompt, storage messages | Inspectors complete the conflict flow unaided. |

---

## 16. Milestones

**Dependency edges:**

- M0 → M1, M0 → M3
- M1 → M2
- M2 + M3 → M4
- M2 + M3 → M5
- M4 + M5 → M6
- M3 + M6 → M8
- M2 + M3 → M7 (runs continuously; must complete before S1)
- M7 + M8 + S1 exit → M9
- M9 → M10

The critical path is M0 → M1 → M2 → M4 → M6 → M8 → M9 → M10. No durations are estimated.

### M0: Decisions and spikes
**Depends on:** nothing.

**Work:** close the decision register (§17). Inventory write paths (A1). Get a compliance opinion (A2, A7). Confirm the platform and MDM capabilities (A8). Measure photo sizes, upload times on a representative uplink profile, and encrypted database write latency on the target tablet (A4). Interview supervisors (A5). Review templates (A6).

**Acceptance criteria:**

1. Every decision marked "Blocks M0" has a recorded decision and an owner.
2. The write-path inventory lists every writer, and each has a plan to route through change logging.
3. A concurrent-update test against the current API shows a 409 on a stale version. Or a fix is planned and scoped.
4. A written compliance opinion on D1 is on file.
5. A measurement report from target tablets covers photo sizes, upload times, and database write latency with encryption on.

### M1: Server change log and write-path routing
**Depends on:** M0.

**Work:** `change_log`, `op_receipt`, and `held_proposal` tables. Route all writers through change logging. Cutover baseline tooling. Audit export.

**Acceptance criteria:**

1. Every write path produces `change_log` rows in the same transaction as the version increment. A concurrent-write run shows no missing versions.
2. `change_log` is append-only for the application role (permission test).
3. A baseline run on a copy of production data gives every non-accepted inspection a baseline at cutover version C, with matching checksums.
4. An audit export for an inspection shows field, old and new value, actor, device time, and server receipt time.
5. A failed `change_log` write fails the operation.

### M2: Sync API v1
**Depends on:** M1.

**Work:** feed, snapshot, ops, resumable attachments, submit, status, and purge receipts. OpenAPI spec. 426 handling. Batch limits.

**Acceptance criteria:**

1. The merge algorithm passes the model and property tests in §15.
2. Duplicate operation, attachment, and submit requests return the stored result with no new `change_log` rows.
3. Authorization tests show no cross-user access on any endpoint.
4. Submit is rejected when held proposals are open, when attachments are unverified, or when the signature hash mismatches (409 `content_changed_after_signature`).
5. Old-protocol clients receive 426 with no state change.

### M3: Device store and outbox
**Depends on:** M0. Developed against a mock of the M2 contract. Integrated at M4.

**Work:** encrypted schema. Transactional edit-plus-outbox. Snapshot application. Purge primitives (key destruction, file deletion). Backup exclusion. App lock.

**Acceptance criteria:**

1. Kill and restart at every write boundary, repeated at least 1,000 times (*proposed*). Zero operations lost and zero duplicated.
2. A downloaded inspection can be fully read and edited with the network off.
3. Backup output contains no app database and no app files.
4. Database and files are unreadable without the keys.
5. A device clock off by a day does not change the purge deadline result.

### M4: Sync engine and conflict handling
**Depends on:** M2, M3.

**Work:** push and pull engine, retry and backoff. Held-conflict UI on the device. Conflict queue and resolution UI on the web. Submit gating.

**Acceptance criteria:**

1. Property tests pass against the real engine and server.
2. A same-field conflict created on the web and on the device is shown on both sides. Resolving it creates a new operation, and the audit records both values.
3. Submit is disabled while conflicts are open, on both the device and the server.
4. Disjoint-field edits from both sides merge without any prompt.
5. Sync recovers from a simulated two-hour disconnect with 100 pending operations.

### M5: Photos and signatures
**Depends on:** M3 (local storage), M2 (upload API).

**Work:** camera capture and compression. Encrypted attachment storage. Resumable uploads. Signature capture with hash binding. Storage guard. Delete tombstones.

**Acceptance criteria:**

1. A 40-photo inspection uploads completely across repeated network drops, with no duplicates and all hashes verified.
2. The 41st capture is refused on the device, and the server also rejects it.
3. A later applied change invalidates the signature, and re-signing is required. Submit rejects a mismatched hash.
4. The storage guard blocks capture and download with a message. Nothing is dropped silently.
5. A photo captured and deleted before upload leaves no blob on the server, and the audit shows both events.

### M6: Retention and purge
**Depends on:** M4 (submit and accept states), M5 (attachment purge).

**Work:** purge triggers per §9. Self-check. Receipts. Overdue monitoring. Sign-out rule.

**Acceptance criteria:**

1. Each trigger in §9 is tested end to end on a device. After purge, the self-check finds no inspection data and the key is gone.
2. The lost-acknowledgment path reconciles through the status endpoint and then purges.
3. The accept-first path purges within 24 hours of server `accepted_at`, verified with clock offsets.
4. The overdue alert fires in a drill.
5. Sign-out with unsynced work is blocked.

### M7: Observability and security hardening
**Depends on:** M2 and M3 for instrumentation. Runs continuously. Must complete before S1.

**Acceptance criteria:**

1. Dashboards and alerts from §12 are live for the pilot cohort. Each alert is tested by fault injection.
2. The log-redaction test passes.
3. A penetration test of the sync and attachment endpoints shows no open high-severity findings.
4. The threat model has been reviewed.

### M8: Migration and rollback tooling
**Depends on:** M3, M6.

**Acceptance criteria:**

1. An upgrade from a real-shaped old cache purges the cache, verifies counts, and re-downloads assigned inspections.
2. A forced migration failure leaves data untouched and the app in a safe state.
3. The rollback drill (§14) drains with pending operations, reconnects, and downgrades with zero losses.
4. Each kill switch in §14 is tested in staging.
5. Backfill rerun is idempotent.

### M9: Pilot
**Depends on:** M7, M8, and S1 exit.

**Acceptance criteria:** pilot exit criteria (§13) are met. The go or no-go decision is recorded.

### M10: Broad rollout
**Depends on:** M9 go decision.

**Acceptance criteria:** the S3 and S4 gates are met for each wave. The read-through path is removed only in a later release.

---

## 17. Decisions before implementation

| ID | Decision | Options | Recommendation | Blocks |
|---|---|---|---|---|
| D1 | What triggers local purge | (a) server-confirmed submission; (b) acceptance plus 24 hours; (c) keep until acceptance | (a) as primary, (b) as backstop. Compliance signs off on (a) in writing. | M0 |
| D2 | Can inspectors open submitted or accepted inspections offline? | Yes (keep copies); no | No. Online re-fetch only. | M0 |
| D3 | Who resolves held conflicts? | Inspector on device; supervisor on web; either | Either. The inspector resolves on the device by default. The supervisor can always resolve or override. Submit is blocked while conflicts are open. | M0 |
| D4 | Locking or optimistic concurrency? | Pessimistic lease; optimistic with merge | Optimistic. No leases. Supervisors can edit checked-out inspections. | M0 |
| D5 | Conflict granularity | Whole record; section; field | Field, with per-field `server_version_seen` | M1 |
| D6 | Pull mechanism | Per-user change feed (new); per-inspection polling | Per-user feed with a cursor. Polling is acceptable only if assignment counts are small. | M2 |
| D7 | Batch semantics | Atomic batch; per-operation apply with held proposals | Per-operation. Conflicts are held, not rejected. | M2 |
| D8 | Signature and later edits | Lock web edits on signed inspections; invalidate the signature; allow edits without re-signing | Invalidate on any applied change. The device locks the form after signing. | M5 |
| D9 | Signature time authority | Device time; server time; both | Store both. Device time is the signer's time, and server receipt is the record time. Compliance confirms. | M0 |
| D10 | Photo privacy and quality | GPS kept or stripped; original or compressed | Strip GPS by default. Keep only compressed photos on the device. Do not store originals. | M5 |
| D11 | Upload network policy | Any network; Wi-Fi only | Any network in the pilot, with visibility. Add a Wi-Fi-only setting if data cost requires it. | M5 |
| D12 | Offline authentication window | No limit; time-limited grace | Drafts have no time limit. Token grace is limited (*proposed*: calibrate, for example several days), with a warning before expiry. | M3 |
| D13 | Encryption approach | Platform file protection only; encrypted database with per-inspection keys | Encrypted database with per-inspection keys. Keys in hardware-backed storage. | M3 |
| D14 | Template versioning | Live template changes; version pinned per inspection | Pinned per inspection. New versions apply on the next download. | M2 |
| D15 | Platform and MDM | iPadOS; Android; mixed | Confirm the company standard. The design is platform-neutral, but backup exclusion and key storage must be verified on the chosen platform. | M0 |
| D16 | Audit scope and retention | Field-level changes only; or also photo, signature, submit, resolution, and sync events | All of the latter. Retention period comes from compliance (not in the brief). | M1 |
| D17 | Legacy cache at upgrade | Migrate it; discard it | Discard, after confirming there are no pending writes. | M8 |
| D18 | Pilot cohort, success thresholds, and kill-switch thresholds | Set by product, ops, and engineering | Set before S2, using §13 as the template. Calibrate from M0 measurements. | M9 (before S2) |
| D19 | Offline creation of inspections | In scope; out of scope | Out of scope for the pilot. | M0 |
| D20 | Device-bound signing and certificate pinning | Required; optional | Only if compliance or security policy requires them. Otherwise add a server-side hash chain for audit tamper evidence. | M0 |
| D21 | Rollback semantics | Disable immediately; drain first | Drain first (§14). | M8 |
| D22 | Loss of unsynced drafts on wipe or lost device | Accept with disclosure; shorten the offline window | Accept with disclosure and monitoring. The product owner signs off. | M0 |
| D23 | Reassignment with unsynced work | Discard; keep for supervisor recovery | Keep the work visible as `orphaned` for the supervisor to reassign or discard. Purge only after that decision. | M4 |

---

## 18. Limits of this plan

- The brief does not specify the tablet OS, the regulator, the server retention period, the form model, or the existing server's write paths. Each appears as an assumption or decision above.
- Numbers marked *proposed* or "calibrate" have no data behind them yet.
- No calendar dates or staffing estimates are given.
