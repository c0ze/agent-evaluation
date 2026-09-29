# Offline Inspection Sync: Product and Engineering Plan

Status: proposal for review. Input: `BRIEF.md` only. Nothing in the existing codebase or APIs was inspected, so every statement about current system behavior is an assumption (section 2) that Milestone M0 must confirm or overturn.

This plan deliberately contains no calendar dates, durations, or staffing numbers. Sequencing is expressed as dependencies and acceptance criteria. Durations and capacity can only be estimated after M0 answers the open questions and the team's capacity is known.

## Contents

1. Summary and headline recommendations
2. Assumptions
3. User flow
4. Scope boundaries
5. Design invariants
6. Local data model
7. Sync protocol
8. Conflict policy
9. Attachments (photos and signature)
10. Retention and purge (the 24-hour rule)
11. Security and privacy
12. Audit history
13. Migration and backfill
14. Observability
15. Staged rollout
16. Rollback
17. Testing
18. Milestones
19. Decisions required before implementation
20. Brief-to-plan traceability

---

## 1. Summary and headline recommendations

**Problem.** Inspectors work in basements with no signal. Today, losing connectivity after opening an inspection can discard their notes. They need to open assigned inspections, fill forms, take up to 40 photos, and collect a signature with no connection. Connectivity comes back intermittently. Supervisors can edit the same inspection from the web. Regulation requires an audit history and removal of local customer data within 24 hours after acceptance. Product wants a pilot first and explicitly does not want a full collaborative editor.

**Approach in one paragraph.** Promote the tablet's SQLite database from a read-through cache to the system of record for any inspection the inspector has taken offline. Every edit is committed to SQLite before the UI acknowledges it and is appended to a durable outbox. A single-flight sync engine pushes outbox changes to the server as idempotent changesets guarded by the existing integer record version. Attachments upload separately, resumably, and verified by content hash. Conflicts are resolved per field with a three-way merge; the only conflict that reaches a human is the same field changed on both sides. Server-side audit is append-only. Local data lives in an encrypted store keyed so that purge is a deterministic, verifiable operation.

**Headline recommendations** (each is justified in its section and listed as a decision in section 19):

1. **Fix data loss first.** Ship durable local drafts (M1) before any offline sync. This addresses the brief's stated failure directly and de-risks everything after it.
2. **Additive server changes only.** Add idempotent changeset, submit-with-manifest, resumable attachment upload, and device-hold endpoints. Keep the integer version as the concurrency token. Do not change existing REST endpoints used by the web app.
3. **Field-level three-way merge, not last-writer-wins, and not a collaborative editor.** Supervisor-owned fields are server-authoritative. Same-field conflicts on inspector-owned fields are shown to the inspector, and no losing value is ever silently discarded.
4. **Freeze on signature.** A signature binds to a hash of the exact content signed. After signing, the local record is read-only. Changing signed content invalidates the signature.
5. **Two-layer purge.** Purge immediately when the device learns of acceptance, plus a local retention cap counted from the server's stated submission-receipt time. Acceptance can only happen after the server has the submission, so the cap meets the deadline even for a device that never hears about acceptance, as long as it knows the server received the submission.
6. **Purge is guarded by a safety interlock.** Local data is deleted only after the server has confirmed a matching manifest, except under an explicit compliance-approved override for the regulatory deadline (D1).
7. **Pilot exit is coverage-based, not time-based.** The pilot ends when specified hard scenarios have been observed and metrics pass, not after an arbitrary period.

---

## 2. Assumptions

The brief is short. These are the assumptions the plan rests on. "Risk" is the consequence if the assumption is wrong. "Validate in M0" is the cheapest way to find out. A1 to A16 are referenced throughout.

| ID | Assumption | Risk if wrong | Validate in M0 |
|---|---|---|---|
| A1 | Inspections are created and assigned on the server. The tablet never creates one ("open assigned inspections"). | Offline creation needs client-generated IDs and a create-conflict story; this plan does not cover it. | Product confirms. |
| A2 | Tablets are MDM-enrolled, so we can enforce screen lock and disk encryption, disable OS backup, and remote-wipe. One inspector uses a tablet at a time under a personal login. | Shared or unmanaged devices break the security model (section 11) and per-user data separation. | Ask IT/MDM owner what is enforceable today. |
| A3 | The server lifecycle is at least: in progress, submitted, accepted, with possible "returned for rework". "Accepted" is a discrete event stamped with a server timestamp, performed by a supervisor or system, and acceptance requires a prior submission. | The purge design (section 10) and the manifest interlock depend on it. If supervisors can accept without a submission, unsynced work can exist for an accepted inspection (D1). | Read the state machine and the accept code path. Check whether acceptance is reversible. |
| A4 | The integer record version is one counter per inspection aggregate (form answers plus status), bumped by every writer (web, mobile, API, batch or import jobs), and stale writes are rejected atomically. | If some writer skips the bump, conflicts are silently missed and supervisor edits get overwritten. If versions are per-child or coarser, merge granularity changes. | Inventory every write path. Test with a deliberately stale write from each path. |
| A5 | Some audit history exists today, but not necessarily field-level, device ID, device-reported time, or conflict-resolution provenance. | We may need to build most of the audit model (section 12), and it gates M2. | Sample existing audit records. Compare with what compliance requires. |
| A6 | Form definitions are versioned and can change while a tablet is offline. | Answers captured against an old schema cannot be validated or stored server-side. | Check how the form builder versions and publishes changes. |
| A7 | Supervisor web edits mostly touch a limited set of fields (review comments, corrections, status) and rarely the same fields an inspector is editing at the same moment. | If overlap is common, conflict UX becomes the product, and "no collaborative editor" is at risk. | Mine existing audit or edit history for supervisor edits made during inspector-open windows. |
| A8 | Offline duration is unknown: from minutes (basement) to possibly multiple days (no coverage at site and no Wi-Fi afterward). The design must not depend on it. | Token lifetime, storage, retention, and lease policies all assume a bound. | Ask field ops for the realistic long tail. Instrument in M1. |
| A9 | Tablet camera photos are multi-megabyte and tablet storage suffices for the configured number of simultaneous offline inspections. The 40-photo limit is per inspection. | Storage exhaustion during capture can corrupt work. Sizes drive upload feasibility. | Measure photo sizes and free storage on actual pilot tablets. |
| A10 | The signature is a drawn signature captured on the tablet. Who signs (customer, site representative, or inspector) is not stated. It attests to the content at signing time. Legal requirements for e-signature evidence are unknown. | An unenforceable signature defeats the purpose of collecting it. | Legal/compliance answers D6. |
| A11 | Device clocks can be wrong and users can change them. Audit needs a server-trusted time. | Device-reported times cannot stand alone as audit evidence. | Compliance answers D11. |
| A12 | The app runs on managed iOS or Android tablets (platform not stated) with SQLite, and OS background-execution limits apply to sync and uploads. | Background upload and key-storage design differ by platform. | Confirm platform, framework, and minimum OS versions. |
| A13 | "Local customer data" means everything on the tablet derived from an inspection: forms, photos, signature, thumbnails, caches, logs, exports. Server-side audit history is not "local customer data". The regulation sets a maximum retention, so purging earlier is permitted. | If compliance reads it more broadly or narrowly, the purge scope and the early-purge cap (D1) change. | Compliance confirms scope and that earlier purge is acceptable. |
| A14 | Authentication uses expiring tokens with refresh. Offline token expiry policy is not defined. | Users could be locked out of their own unsynced data, or the reverse: stolen tablets stay usable indefinitely. | Read the auth design. Decide D9. |
| A15 | The server has no resumable upload and no idempotency-key support today. | Retries during sync would duplicate photos or changes. | API inventory. |
| A16 | The current read-through cache may already retain customer data past what regulation allows (it may never be purged). | An existing compliance gap surfaces as we touch the cache. It must be escalated, not silently fixed. | Inspect what the cache holds and for how long. Escalate to compliance if confirmed. |

---

## 3. User flow

### 3.1 Inspector flow

Terminology used in the UI. These states must never be conflated, because "saved" must not be presented as "safe":

- **Saved on this tablet**: committed to local SQLite.
- **Waiting to upload**: local data that the server has not confirmed.
- **Uploaded**: server has acknowledged the data and verified attachment hashes.
- **Submitted**: server has the submission and its manifest matches.
- **Accepted**: supervisor accepted. The tablet copy will be removed by a shown deadline.

**Step 1. Prepare (online).** While the tablet has a connection (office Wi-Fi, for example), the app pre-fetches assigned inspections in the prefetch window (D9). Each inspection shows a readiness badge: **Ready offline** means the record, form definition (pinned version, D10), reference data, and existing attachments needed to work are all stored locally. **Not ready** means something is missing. The inspector should see *before entering the basement* which inspections are ready. Opening a not-ready inspection with no connection shows an explicit reason and what is missing, never a spinner or a generic error.

**Step 2. Work (offline or online, identical experience).** Opening an inspection reads only from local storage. There is no "Save" button: every field change is committed to SQLite before the UI treats it as done. Connectivity changes never interrupt work, never show a blocking dialog, and never discard input. A persistent status chip shows the sync state ("Saved on this tablet", "Waiting to upload: 3 changes, 12 photos", "Uploaded").

**Step 3. Photos.** In-app camera only (never the system gallery, see section 9). The counter shows N of 40. The 41st capture is blocked with an explanation. Free storage is checked before capture starts and the inspector is warned when low.

**Step 4. Signature.** If the form requires one, the signature pad appears. On completion the app computes a hash of the form content plus attachment manifest as of that moment and stores the signature bound to it (D6). The inspection becomes read-only except an explicit "Edit and re-sign" action that discards the signature.

**Step 5. Submit.** Validation (required fields, required signature, photo minimums if configured) runs locally. "Submit" moves the inspection to *submitted on this tablet*. Sync sends it when a connection exists. The UI states plainly: "Submitted on this tablet. Not yet received by the office" until the server confirms, then "Submitted".

**Step 6. Leaving the site.** If anything is waiting to upload, the app tells the inspector how much and what will happen next ("2 inspections, 31 photos waiting. They will upload automatically when this tablet has a connection. Keep the app installed and do not clear its data.").

**Step 7. Server accepts.** When sync sees acceptance, the inspection shows "Accepted. Will be removed from this tablet by <deadline>" and is purged (section 10).

### 3.2 Inspector edge flows

| Situation | Behavior |
|---|---|
| App killed, tablet rebooted, or battery dies mid-edit | On next launch the draft is restored from SQLite. At most the field being typed at that instant can be lost, never earlier fields. |
| Supervisor changed different fields while the inspector was offline | Merged silently at next sync when the inspection is not on screen. A notice reads "Supervisor updated 2 fields." |
| Same field changed on both sides | Conflict card: both values, who changed each and when. Inspector chooses. Nothing is dropped (section 8). |
| Inspection reassigned or cancelled while offline | On contact, the device is told. If there are unsynced changes, they are sent as late offline work for supervisor review (D1). The inspection becomes read-only, then purges. |
| Supervisor returns inspection for rework | It reappears as editable, re-downloaded from the server at the new version, and the retention clock restarts. |
| Storage nearly full | Warning before capture. Below a hard floor, capture is refused with an explanation. The DB is never allowed to fail for lack of space. |
| Auth token expired while offline | Work continues under local unlock. Sync requires re-authentication when online. Local data is never wiped because auth failed. |
| Form definition changed on the server while offline | Inspector completes on the pinned version (D10). |
| Sync repeatedly fails for one inspection | The inspection is flagged "Needs attention" with a diagnostic code and a support action. It is never silently dropped or endlessly retried in a hidden loop. |

### 3.3 Supervisor flow (web)

- On an inspection with an offline copy, the supervisor sees a **device hold** banner: "Offline copy on <inspector>'s tablet since <time>, last synced <time>. Edits made here may conflict with work not yet uploaded." Editing is allowed, not blocked, because a lost tablet must never lock a record.
- After sync, the supervisor sees field-level provenance: who set each value, whether it was device-reported offline, and any conflict resolutions.
- Accepting an inspection while a device hold shows unsynced work needs an explicit confirmation with reason (D1). This is audited.
- Purge status is visible: accepted, device purge confirmed, or overdue.

---

## 4. Scope boundaries

**In scope for the pilot**

- Offline open of assigned inspections, form entry for existing form types, up to 40 photos, signature capture.
- Durable local drafts (fixes the current data-loss failure).
- Background sync with retry, idempotency, and integer-version concurrency.
- Field-level merge and a minimal conflict UI.
- Server-side audit extensions and purge receipts.
- 24-hour local data removal with verification.
- Feature flags, observability, kill switches, and a staged pilot.
- Minimal supervisor web changes: device hold banner, provenance display, purge status.

**Out of scope (non-goals)**

- Real-time or collaborative editing, cursors, presence, CRDTs, operational transforms.
- Offline creation of inspections (A1).
- Offline supervisor or web use.
- Video or audio attachments; more than 40 inspector photos; photo annotation or editing.
- Device-to-device or peer sync.
- Offline browsing of historical or completed inspections beyond the retention window.
- Multiple tablets editing one inspection at once for the same inspector.
- Unmanaged or personal devices.
- Changing the REST style of existing APIs.
- PDF or report generation offline (stays online unless M0 shows it is required).

**Deferred candidates (revisit after pilot)**

- Thumbnail-first upload so supervisors see photos sooner.
- Hard field-level locks.
- Offline creation.
- Bulk conflict tooling.
- Time-boxed decryption keys for submitted data (extra defense for devices that stay offline and unpowered past the deadline).

---

## 5. Design invariants

These are testable rules. Violating any is a release blocker.

- **I1 Durability.** No edit is acknowledged in the UI before its SQLite transaction commits (WAL mode, synchronous FULL for user-data writes).
- **I2 Outbox integrity.** Outbox entries are append-only and are not deleted until the server has acknowledged them and the manifest verified.
- **I3 No silent loss.** Any value that loses a merge, any op that fails validation, and any attachment that fails upload remains stored and visible to the user or support until resolved. Nothing is dropped without a user-visible or audit-visible record.
- **I4 Single deletion path.** Customer data is removed only by the purge engine, which enforces preconditions and produces a receipt.
- **I5 Single root.** All customer data reachable on the device belongs to exactly one inspection ID, so purge is "delete by root".
- **I6 Registered stores.** Every table, directory, cache, and log that can hold customer data is registered with the purge engine. A CI check fails if a new store is added without registration.
- **I7 Idempotency.** Every network mutation carries a client-generated ID. Replays produce the same result.
- **I8 Server authority.** The server validates assignment, version, schema, and manifest on every write. The client is never trusted for authorization or time.
- **I9 Fail safe on flags.** Turning a feature flag off never deletes unsynced data.

---

## 6. Local data model

The SQLite store changes from disposable cache to authoritative store for in-progress work. Legacy cache tables (prefix `cache_`) remain disposable. New tables (prefix `local_`) are never dropped or rebuilt without going through purge.

### 6.1 Tables

| Table | Key columns | Purpose |
|---|---|---|
| `local_inspection` | `id` (server ID), `server_version` (last integer version merged into local state), `lifecycle` (see 6.2), `assigned_to`, `form_schema_id`, `form_schema_version`, `downloaded_at`, `last_synced_at`, `submitted_at_local`, `submitted_at_server` (server-stated receipt time, anchors the Layer 2 cap), `accepted_at_server`, `purge_deadline`, `purge_target`, `readiness` | One row per offline-capable inspection. Root of all customer data (I5). |
| `local_base_snapshot` | `inspection_id`, `server_version`, `snapshot` | Last server state the local state was merged against. Needed for three-way merge. |
| `local_answer` | `inspection_id`, `field_key`, `value`, `dirty`, `updated_seq`, `updated_at_device`, `updated_at_monotonic`, `origin` (inspector or merged) | Current local value per form field. |
| `local_outbox` | `op_id` (UUID), `inspection_id`, `seq` (per-inspection monotonic), `type`, `field_key`, `value`, `base_version`, `changeset_id`, `state` (pending, sent, acked, rejected), `attempts`, `last_error`, `authored_at_device`, `authored_at_monotonic` | Append-only change log; source for changesets and audit provenance. |
| `local_attachment` | `id` (UUID), `inspection_id`, `kind` (photo, signature_image), `path`, `sha256`, `bytes`, `mime`, `captured_at_device`, `state` (captured, queued, uploading, uploaded, verified, failed, removed), `upload_session_id`, `bytes_uploaded`, `server_id`, `thumbnail_path` | Immutable attachments. |
| `local_signature` | `id`, `inspection_id`, `strokes`, `attachment_id`, `signer_name`, `signer_role`, `content_hash`, `signed_at_device`, `state` (valid, invalidated) | Signature bound to content hash (D6). |
| `local_conflict` | `id`, `inspection_id`, `field_key`, `base_value`, `local_value`, `remote_value`, `remote_actor`, `remote_at`, `status` (open, resolved), `resolution`, `resolved_at` | Unresolved same-field conflicts. |
| `local_sync_state` | `cursor`, `last_success_at`, `server_time_at_last_contact`, `monotonic_at_last_contact`, `flags_snapshot`, `min_supported_version` | Global sync and clock-anchor state. |
| `local_purge_ledger` | `inspection_id`, `reason`, `deadline`, `state` (scheduled, running, verified, failed), `purged_at`, `receipt_sent`, `data_classes_removed`, `had_unsynced_data` | Durable record of purge work and receipts. Contains no customer content. |
| `local_diag` | `ts`, `level`, `code`, `context_ids` | Ring-buffer diagnostics, no customer content (allowlisted fields only). |

Attachments are files in an app-private directory. They are never written to a shared gallery or external storage. Each inspection has its own directory and its own data-encryption key (D7).

### 6.2 Local inspection lifecycle

```
not_downloaded -> preparing -> ready_offline -> editing -> signed -> submitted_local
                                   ^              ^  |                  |
                                   |              |  +- (edit & re-sign)|
                                   |              +--------------+      v
                                   |                             |  submitted_synced -> accepted -> purged
                                   +---- returned_for_rework <---+          |
                                                                            |
 any state --(revoked / reassigned / cancelled)--> revoked_local --> flushed_late --> purged
```

Transitions are explicit, persisted, and each is idempotent so a crash mid-transition resumes safely.

### 6.3 Storage budgeting

Worst-case footprint per inspection is `40 x average_photo_bytes` plus thumbnails and DB rows. With an illustrative 3 MB average that is about 120 MB per inspection, so ten simultaneously offline inspections would be about 1.2 GB. These are placeholders. M0 measures actual sizes and free space to set the maximum number of offline inspections per tablet and the free-space floor for capture.

### 6.4 Schema management

- Forward-only, transactional, idempotent migrations with a version table.
- Expand-then-contract: new tables and columns are added first and old ones are removed only in a later release. This is what makes app rollback safe (section 16).
- Every migration is tested against fixture databases captured from each shipped schema version, including large and corrupted-but-openable ones.

---

## 7. Sync protocol

The protocol is illustrative and additive. Names are proposals for backend design review (D5). The existing integer record version is the concurrency token. Existing web-facing endpoints do not change.

### 7.1 Server surface (proposed)

| Endpoint | Purpose |
|---|---|
| `GET /sync/assignments?cursor=` | Delta list: inspection ID, version, status, assignee, `accepted_at`, `purge_deadline`, revoked flag, form schema version. Returns `server_time` for clock anchoring. |
| `GET /inspections/{id}` (existing) | Full record and integer version for download. |
| `POST /inspections/{id}/device-hold` | Register or clear the advisory device hold on download, submit, or purge receipt. |
| `POST /inspections/{id}/changesets` | Idempotency key = `changeset_id`. Body: `device_id`, `base_version`, `form_schema_version`, ops with `op_id`, `field_key`, `value`, `authored_at_device`. Applies atomically against the version. Returns `200 {new_version}` or `409 {current_version, current_record, conflicting_fields}`. |
| `POST /attachments/uploads` and chunk, status, complete calls | Resumable, idempotent by client attachment ID. Server verifies SHA-256 on complete. |
| `POST /inspections/{id}/submit` | Body: final `base_version` plus a manifest (field-values hash, attachment IDs with SHA-256, signature hash). Server verifies everything is present, returns the missing list if not, and only then moves to submitted. |
| `POST /devices/{id}/purge-receipts` | Receipt of local removal (no customer content). |

Server invariants:

- **Atomic version check plus write** within one transaction. Each accepted changeset bumps the version by exactly one.
- **Idempotency store:** a changeset with a previously seen ID returns the original response, not a second write.
- **Authorization on every call:** the server re-checks that the caller is assigned to the inspection and the device is enrolled. Rejected changesets are quarantined and audited, not discarded.
- **Old clients and the web keep working.** New behavior is opt-in per client capability.

### 7.2 Client sync cycle

Single-flight, interruptible, and every step persists its progress:

1. **Preflight.** Is a valid token present? Does a small authenticated request succeed? "Connected" from the OS is not trusted (captive portals, one-bar links). If preflight fails, back off with jitter and stop.
2. **Pull deltas.** Fetch assignment changes since the cursor and reconcile: new, updated, revoked, accepted. For inspections with local edits, store the new server snapshot as pending merge and never overwrite local state.
3. **Push changesets.** For each dirty inspection, oldest first, send changesets in `seq` order, one in flight per inspection. On `200`, advance `server_version` and mark ops acked. On `409`, go to the conflict path (section 8). On network failure, stop and retry later.
4. **Upload attachments** with bounded concurrency, independent of step 3 (section 9).
5. **Submit** any inspection in `submitted_local` once all its changesets are acked and its attachments verified, sending the manifest.
6. **Purge queue** (also runs on its own schedule with no connectivity, section 10).
7. **Report** purge receipts and diagnostics.
8. **Persist** cursor and schedule the next cycle.

Triggers: app foreground, connectivity-change events, a periodic background job, and a manual "Sync now". Sync never blocks editing.

### 7.3 Failure semantics

| Response | Behavior |
|---|---|
| Timeout or network drop | Retry with capped exponential backoff and jitter. The idempotency key makes the retry safe even if the first request landed. |
| `401` / token expired | Pause sync, prompt re-auth when the user is next in the app. Never wipe data. |
| `403` / no longer assigned | Treat as revocation (D1 late-work path). |
| `409` version conflict | Conflict path (section 8). |
| `422` validation (for example schema mismatch) | Quarantine the changeset, mark the inspection "Needs attention", surface a diagnostic code. Do not retry blindly. |
| `413` too large | Attachment path: shrink and retry once, then mark failed and visible. |
| `5xx` | Backoff. If persistent, stop after a bounded number of attempts per cycle and alert (section 14). |

### 7.4 Clock handling

Device wall-clock time is recorded as "device-reported". Alongside it the device stores elapsed monotonic time since the last server contact, so the server can reconstruct approximate authoring time as `last_server_time + elapsed`. Ordering inside a device uses the per-inspection `seq`, never the wall clock. Backward clock jumps are detected and logged. The server stamps every audited event with its own receive time. Audit shows both (section 12).

### 7.5 Pull merges never disturb the open form

The engine will not mutate an inspection that is on screen. Remote non-overlapping changes are applied when the inspection is next opened or when the user accepts a "Supervisor updated this inspection" prompt.

---

## 8. Conflict policy

**Premise.** Product does not want a collaborative editor. The design therefore keeps concurrency rare by construction (field ownership, device hold) and handles the residue with a small, explicit policy. Frequency of overlap is unknown (A7); M0 estimates it.

### 8.1 Field ownership (D3)

- **Inspector-owned:** observations, form answers, photos, signature. Web edits to these by supervisors are allowed but are corrections that can conflict.
- **Supervisor-owned:** review comments, status transitions (return, accept), assignment. The mobile client renders these read-only and never writes them, so no conflicts are possible.
- The server enforces ownership (I8), not just the UI.

### 8.2 Rules

1. **Different fields changed on each side:** automatic three-way merge using `local_base_snapshot`. Both authors recorded in audit.
2. **Same field, same resulting value:** no conflict.
3. **Same field, different values (inspector-owned):** a conflict is created. The server keeps its current value as current truth until the inspector decides. The inspector's device shows both values with actor and time. The inspector picks one (or edits a new value). The decision is sent as an ordinary changeset citing the conflict, and audit records the losing value.
4. **Supervisor-owned fields:** server wins, always.
5. **Photos:** append-only. A local delete is a tombstone (audit retains metadata; the blob is deleted from the device if it was never uploaded). A supervisor cannot silently remove an inspector photo without an audit event.
6. **Status conflicts** (accepted, cancelled, reassigned while the device holds unsynced work): server state wins. Unsynced device work goes down the late-work path (D1) and is never applied to an accepted record.
7. **Submit racing a supervisor edit:** the submit call returns `409`. The inspector resolves and re-submits. A resubmit after resolution re-verifies the signature binding (section 9.4).
8. **Retry bound:** after a bounded number of consecutive `409`s on one inspection, stop and mark it "Needs attention" rather than looping.
9. **Nothing is silently discarded** (I3).

### 8.3 Device hold (D4)

On download the server records an advisory hold: "copy on device X since T". Supervisors see it. It is informational and overridable because a lost or dead tablet must never block a record. It clears on submit, purge receipt, or expiry per policy. It reduces surprise, it does not prevent conflicts, and the merge policy does not rely on it.

### 8.4 Alternatives considered

| Option | Why rejected |
|---|---|
| Last-writer-wins | Silently loses one party's work, and a device's "last" time is untrustworthy (A11). Fails the audit intent. |
| Whole-record hard lock | Blocks supervisors whenever a tablet is offline or lost. Used only as an advisory hold. |
| CRDT or operational transform | Explicitly a collaborative editor. Product declined it. |
| Supervisor always wins | Loses on-site facts only the inspector knows. Rejected for inspector-owned fields. |

---

## 9. Attachments (photos and signature)

### 9.1 Capture pipeline

- **In-app camera only.** Capturing through the system camera app would place photos in a shared gallery, outside the purge engine's reach and possibly in cloud backup. The app writes directly to its private, encrypted per-inspection directory.
- **Crash-safe write order:** write to a temp file, flush, atomically rename, then insert the `local_attachment` row and the outbox op in one transaction. On startup, reconcile directory contents against rows: orphan files are quarantined and surfaced or cleaned up, and rows whose files are missing are flagged.
- **Processing:** resize and compress at capture to a target set in D8 (starting parameters to be validated against inspection-quality requirements, not assumed). Strip or retain EXIF per D8. Store capture metadata in the database rather than depending on EXIF.
- **Limit of 40:** enforced in the UI over non-removed inspector photos. The server enforces a separate, higher hard limit. If the combined total from all sources exceeds the cap at sync, the extra photos are stored and flagged, never dropped (I3).
- **Storage guard:** check free space before entering capture. Refuse capture below a hard floor so the database always has headroom.

### 9.2 Upload

- Metadata (attachment ID, hash, size, capture time) travels early in the changeset, so a supervisor can see "photo pending upload" before the bytes arrive.
- Blobs upload through resumable sessions: create session, send chunks, query offset after any failure, resume, complete. The server verifies SHA-256 on complete, and only then is the local attachment marked `verified`.
- Idempotent by client attachment ID plus content hash. Duplicate uploads collapse.
- Bounded concurrency and chunk size tuned in M5 from measurements on real tablets and links. Network policy (Wi-Fi only versus also cellular on the company plan) is D8. Large uploads pause on low battery or low-quality links.
- Per-attachment failure states are visible to the inspector and support, with retry. A failed attachment blocks submit and says which one.

### 9.3 Signature

- Store vector strokes and a rendered image. Hash both. The image is uploaded as an attachment.
- Record signer name and role (per D6), device-reported time, device ID, and the content hash.

### 9.4 Signature binding (D6)

- At signing, compute a canonical hash over the form values, pinned schema version, and photo manifest. The signature record stores that hash.
- After signing, the local inspection is read-only. "Edit and re-sign" invalidates the signature and returns to `editing`.
- If a supervisor edit merges into signed content (or the server-side content hash no longer matches at submit), the signature is marked **stale**. The inspector must review and re-sign, or a supervisor decides. A stale signature is never presented as valid.
- Whether the device-reported signing time is sufficient evidence is a legal question (A10, A11, D6, D11).

---

## 10. Retention and purge (the 24-hour rule)

This is the section where offline and regulation collide, so it is spelled out.

### 10.1 The problem

The regulation runs from acceptance, and acceptance is a server event. A tablet in a basement, or simply offline, may not learn of acceptance for a long time. A naive "delete on acceptance" therefore cannot meet the rule for offline devices. Conversely, deleting data that the server does not yet hold destroys the inspector's work and possibly evidence.

### 10.2 Design: two layers plus an interlock

**Layer 1: server-driven.** When sync reports `accepted_at`, the device sets `purge_deadline = accepted_at + 24h` and purges as soon as the interlock allows, which in practice is at that sync. Purging earlier than the deadline is permitted (A13). If the device learns of acceptance after the deadline, it purges immediately and records a late-purge event.

**Layer 2: local retention cap (fallback for missed contact).** When the server confirms a submission, its response (or any later pull) includes `submitted_at_server`, the server's own receipt time. The device stores it and schedules the local copy to be purged no later than `submitted_at_server + R`, where `R` is at most 24 hours (final value from compliance, D1). The anchor must be the server-stated receipt time, not the time the device happened to receive the acknowledgement. A lost response could otherwise delay the device's "synced" moment by hours, past acceptance. Acceptance cannot occur before the server received the submission, so `accepted_at >= submitted_at_server`, and purging at `submitted_at_server + R` with R at most 24h can never be later than `accepted_at + 24h`. The server-time deadline is converted to a local deadline using the clock anchor from the last contact (`local_sync_state`) plus elapsed monotonic time, tracked across reboots, and the stricter of wall-clock and monotonic elapsed time is used, with backward clock jumps detected and a safety margin applied. Layer 2 needs no connectivity once the device knows the submission was received. If the device learns of the receipt only after `submitted_at_server + R` has passed, it purges immediately and records a late-purge event. A device that does not know the server holds its submission is in the late-work situation (10.3), not in Layer 2. Returning an inspection for rework cancels the cap and restarts it at the next submission.

**Interlock (safety).** Before any purge, the purge engine verifies: all outbox ops acked, all attachments `verified`, and the server submission manifest matches the local manifest. If not satisfied:

- If the inspection never reached submission, and the server has not accepted it, do not purge (the inspector's work is still needed).
- If the inspection was accepted or revoked by the server while unsynced local work exists, follow the **late-work path** (10.3).

### 10.3 Late-work path (D1)

Cases: supervisor accepted or cancelled the inspection, or it was reassigned, while the device holds unsynced changes. Recommended behavior:

1. On contact, the device uploads the unsynced work as a **late offline submission** attached to the audit trail, not applied to the accepted record. A supervisor can review and, if needed, reopen or amend.
2. After the server confirms receipt, purge.
3. If the deadline passes before the device can make contact, compliance wins: the data is purged anyway. The event is recorded as "purged with unsynced data" (in the purge ledger and reported at next contact), the inspector is warned in advance ("This inspection was accepted. Unsent work will be removed at <time>. Connect to send it."), and an alert fires. This tradeoff must be explicitly signed off by compliance and product (D1). It is the only place the plan permits deliberate data loss.

To make this rare, the server should warn or require a reason when accepting an inspection that has a device hold with unsynced work (section 3.3).

### 10.4 What "removed" covers

Everything registered under I6:

- Database rows: inspection, answers, outbox, conflicts, signature, snapshots, purge-related caches.
- Files: photos, thumbnails, signature images, temp files, any exports.
- Search indexes and derived caches.
- Diagnostics and crash artifacts (which by rule contain no customer content, and are verified to).
- Per-inspection encryption keys (destroyed).
- Database residue: `secure_delete`, WAL checkpoint with truncate, and freed-page cleanup (vacuum) after purge.
- OS-level surfaces controlled by MDM: backups disabled, screenshots and app-switcher previews blanked for customer screens, no customer data in notifications.

### 10.5 Verification and escalation

- After purge, a verification pass confirms no rows, no files, no key.
- Purge receipts (inspection ID, device, time, data classes, verified, had-unsynced-data flag) are queued and sent at next contact.
- Server-side: any accepted inspection with no verified receipt after the deadline plus a grace period raises an alert and appears on a compliance dashboard. Escalation path: contact the inspector, then MDM remote wipe (D13).
- The residue test (section 17) proves deletion at the byte level using planted marker strings.

### 10.6 Residual risks

- A tablet that is powered off or unable to run the app past the deadline cannot purge. Mitigation: encryption at rest, device-bound keys, MDM lock or wipe. Deferred hardening: time-boxed decryption keys for submitted data.
- A user who manipulates the clock. Mitigation: monotonic tracking and server-side detection at next contact.

---

## 11. Security and privacy

| Threat | Controls |
|---|---|
| Lost or stolen tablet | Full-disk encryption (MDM-enforced). Database and attachment encryption with keys held in hardware-backed OS keystore (D7). App lock (PIN or biometric) with a timeout. Remote wipe via MDM. Server-side revocation blocks sync from that device. |
| Data left on device after acceptance | Purge engine (section 10). Registry of stores (I6) enforced by CI. Residue tests. |
| Data leaks via OS features | No gallery or external storage. OS backup disabled. Screenshot and app-switcher preview protection on customer screens. No customer content in notifications, logs, telemetry, or crash reports (schema-enforced allowlists). |
| Compromised or modified client | Server validates assignment, version, schema, ownership, manifests, and hashes. Device identity bound to an enrolled device. Rate limits. |
| Replay of changesets or uploads | Idempotency keys. Device-bound credentials. Content-hash verification. |
| Over-collection | Minimize what is prefetched: only assigned inspections within the prefetch window (D9), only the customer fields the form needs. |
| Offboarded or reassigned inspector | Assignment re-checked on each call. Revocation causes local read-only and purge on next contact. MDM wipe as escalation. |
| Stale offline credentials | Bounded offline session policy (D9). Sync requires fresh auth. Auth failure never deletes data (I9), but access after the bound requires re-auth. |
| Shared tablets | Assumed not to exist (A2). If they do, per-user data separation and logout behavior become a blocking decision. Logout with unsynced data must not destroy it: it locks the app and retains encrypted data. |
| Tampering with evidence | Content hashes over forms, photos, signature. Append-only audit (section 12). |
| Location or personal data in photo metadata | EXIF policy in D8. |

Transport uses TLS. Whether to add certificate pinning is a platform and MDM decision recorded in M0.

---

## 12. Audit history

The regulation requires an audit history. Offline authoring complicates it: the time a change was made and the time the server learned of it differ, and the device clock is untrusted (A11).

**Proposed server audit event** (append-only, immutable):

- `event_id`, `inspection_id`, `actor`, `actor_role`, `device_id`
- `event_type` (field change, attachment added or removed, signature captured or invalidated, submit, accept, return, conflict opened or resolved, hold set or cleared, purge receipt, late offline submission, override)
- `field_key`, old and new values (or hashes where content should not be duplicated)
- `authored_at_device` (labelled untrusted), `elapsed_since_last_server_contact`, `received_at_server` (trusted)
- `version_before`, `version_after`, `changeset_id`, `conflict_id` where relevant

**Rules:**

- Audit is written in the same transaction as the change it describes.
- Server-side audit is not "local customer data" (A13), but compliance must confirm both that it may retain customer content and for how long.
- Deletion is audited: purge receipts and late-purge events go into the audit trail with no customer content.
- Existing history is not fabricated. Records predating this feature are labelled as legacy with the fields they never captured (section 13).
- The device's local outbox is the source of provenance and is purged with the rest.

---

## 13. Migration and backfill

### 13.1 On-device migration

1. Introduce the new schema by expansion only. Existing cache tables are untouched at first.
2. **Cached rows are not converted into offline drafts.** Their freshness is unknown. On first launch under the flag, assigned inspections are re-downloaded with versions.
3. Run the purge engine over legacy cache contents. Accepted or stale inspections in the legacy cache are customer data that may already be past the 24-hour limit (A16). If this is confirmed, escalate to compliance rather than fixing it silently.
4. Drop legacy cache tables only in a later release, after the new store has proven itself (expand-then-contract).
5. Migrations are transactional, idempotent, and reported to telemetry with outcome and duration. A failed migration leaves the old store readable and the app in online-only mode.

### 13.2 Server-side backfill and readiness

| Item | Action |
|---|---|
| Integer versions | Verify every inspection has a non-null version and that every writer path bumps it (A4). Fix or wrap writers that do not, before any offline client is enabled. Backfill nulls with a baseline version. |
| Audit history | Add the new fields going forward. Mark pre-existing records `legacy`. Do not invent field-level history that was never recorded. |
| `accepted_at` | Ensure it exists for accepted inspections. Backfill from state history where available, otherwise leave null and never send a purge deadline for those (they cannot be on an offline device at launch). |
| Form schemas | Ensure schemas are versioned and old versions remain servable and acceptable for the pinned-schema window (D10). |
| Device registry | Create enrolled-device records mapped to MDM identities. |
| Idempotency store and upload sessions | New tables with expiry and cleanup. |
| Attachments | Nothing to backfill. Existing photos keep working. |

### 13.3 Compatibility

- Old app versions keep using existing endpoints. New endpoints are additive.
- The server reports capabilities and minimum supported client version for offline features (D14). Old clients are never offered offline mode.
- A new client against a server with offline features disabled falls back to online-only behavior while still draining any local data (I9).

---

## 14. Observability

Mobile telemetry must survive being offline: a local diagnostics ring buffer uploaded during sync. Telemetry uses allowlisted, schema-enforced fields and never contains customer content.

| Signal | Why | Alert / use |
|---|---|---|
| Sync cycle success rate and failure codes | Health of the engine. | Alert on sustained drop. |
| Time from reconnect to fully synced | The user-visible promise. | Trend by cohort and site. |
| Outbox depth and **age of oldest unsynced item** per device | Detects stuck devices. | Alert when age exceeds a threshold set from pilot data. |
| Attachment upload success, retries, bytes pending, resume counts | Photo path health. | Alert on failure spikes. |
| Version-conflict rate; open-conflict age | Validates A7. Tunes conflict UX. | Review at every pilot checkpoint. |
| Late offline submissions and "purged with unsynced data" events | Direct measure of the D1 tradeoff. | Every occurrence reviewed. |
| **Purge SLA:** accepted-to-purge-verified time, count past deadline, count without receipt | Regulatory compliance. | Any overdue inspection pages the owner. |
| Data-loss canary: manifest mismatches at submit (local counts and hashes versus server) | Detects silent loss or corruption. | Any mismatch is an incident. |
| Local storage headroom, capture refusals | Predicts photo failures. | Trend. |
| Migration outcomes | Blast-radius check. | Halt rollout on failures. |
| Clock anomalies (large skew, backward jumps) | Audit and purge trust. | Review. |
| Crash-free sessions; app restarts with pending data | Stability. | Standard. |
| Server: idempotent replays, `409` rate, quarantined changesets, `401`/`403` rates | Protocol health. | Alert on anomalies. |

Runbooks (M8) cover: stuck device, purge overdue, migration failure, suspected data loss, conflict spike, mass reauth, rollback.

---

## 15. Staged rollout

Stages advance on criteria, not on elapsed time. Every stage runs behind server-controlled feature flags (per org, user, and device). Flags are cached on device so they behave predictably offline, and fail safe (I9).

| Stage | Who | Data | Entry | Exit |
|---|---|---|---|---|
| **R0 Internal** | Employees on test tablets | Synthetic customer data only | M3 to M8 functionality complete enough for internal use. R0 runs inside M9. | Full scenario matrix (section 17) passes on real devices, including real no-signal locations. Purge residue test passes. |
| **R1 Closed pilot** | Small cohort of volunteer inspectors and their supervisors. Cohort chosen so every manual sync can be reviewed. Includes basement-heavy and photo-heavy work and supervisors who edit often. | Real | R0 exit, compliance sign-off on D1, D6, D11, purge verified | Coverage-based (below) plus metrics green. |
| **R2 Wider pilot** | More sites and teams representing the variety in R1, plus known difficult cases | Real | R1 exit, fixes for R1 findings shipped | Same gates, plus support burden acceptable and no unresolved compliance findings. |
| **R3 Staged expansion** | Cohorts by org or site in increasing share | Real | R2 exit | Automated gates hold at each step (below). |
| **R4 General availability** | All eligible | Real | R3 complete | Online-only fallback kept for a defined period. Legacy cache code removed only after criteria are met. |

**Coverage-based pilot exit.** R1 (and R2) are not complete until each of these has actually happened, either organically or as a scripted scenario if it did not occur naturally:

- A real session with no signal for the whole inspection.
- Flapping connectivity during upload.
- A supervisor edit made while the inspector was offline, both non-overlapping and same-field.
- A returned-for-rework cycle.
- A full accept-to-purge cycle verified end to end.
- A device reboot or app kill with unsynced data.
- An app update with local data pending.
- Low-storage handling.
- A stale-signature case.

**Metric gates** (thresholds set in M0 from baseline, stated here as principles):

- Zero confirmed silent data loss.
- Purge compliance: every accepted pilot inspection purged within the deadline, or a documented, compliance-reviewed cause.
- Sync completion after reconnect within the agreed target.
- Conflicts resolved without support intervention above an agreed rate.
- Inspector and supervisor feedback collected against a fixed script.

**Automatic halt criteria.** Pause expansion and page an owner on: any confirmed silent data loss; any purge overdue without explanation; migration failures above threshold; manifest-mismatch incidents; sustained sync-failure spike; audit gaps.

---

## 16. Rollback

Principle: rolling back must never strand or delete unsynced data.

| Layer | Trigger | Action | Data safety | Irreversible |
|---|---|---|---|---|
| Feature flag | Serious defect in offline features | **Drain mode:** stop offering new offline sessions, keep syncing and purging existing local data. A separate hard "online-only" state applies only to inspections with no local data. | Unsynced data is preserved and continues to sync (I9). | Nothing. |
| App release | Defective build | Halt store rollout, ship a forward fix. Schema is expand-only, so an older build ignores new tables. An older build cannot sync local data, so the server enforces the minimum supported version (D14) and users with pending data are steered to update rather than downgrade. | Local data stays encrypted and intact. | Downgrading past the minimum version is unsupported. |
| Server | Sync endpoint defect | Disable the changeset path via flag. Clients queue and retry with backoff. Restore, then replay: idempotency makes replay safe. Additive schema means no data migration to undo. | Changes wait on tablets. | None, provided idempotency store retention outlasts the outage. |
| Purge logic | Purge deleting too much, or not enough | Interlock (section 10.2) is the first defense. Kill switch on the **Layer 2 fallback cap only**, with compliance on the loop. The server-driven purge (Layer 1) continues because it is a regulatory duty and is guarded by the interlock. | Deleted data cannot be recovered by design, which is why the interlock and the residue tests come first. | Deleted data. |
| Migration | Local migration bug | Old store remains readable, app falls back to online-only, forward-fix migration. | Legacy cache untouched. | None. |
| Stranded data | Device cannot sync (bug, lost credentials, app cannot open) | Support-initiated, admin-authorized **rescue export** of the encrypted local store, delivered over a controlled channel, for manual recovery (D13). | Preserves evidence. | Export is itself customer data and is purged per policy. |

Rollback drills are part of M9: flag drain, forced update, sync endpoint outage with replay, and a purge-kill-switch exercise, all with test tablets holding unsynced synthetic data.

---

## 17. Testing

### 17.1 Layers

- **Unit:** three-way merge (every combination of base, local, remote, absent), field ownership enforcement, canonical hashing, manifest construction, state-machine transitions, purge preconditions, clock-anchor arithmetic.
- **Property and model-based:** a simulator with one server and multiple devices, random operations, random drops, duplicates, and reorderings. Property: all replicas converge; no accepted op is lost or applied twice; the version is monotonic; the audit log reconstructs every field's history.
- **Fault injection:** kill the process or drop the network at every step of the sync cycle, the capture pipeline, the migration, and purge. Disk full. Token expiry mid-upload. Clock jumps forward and back. Reboot with unsynced data.
- **Contract tests** between mobile and server: integer version semantics (`409` shape), idempotent replay, manifest verification, upload resume, schema pinning. Run against every writer path (A4).
- **Migration:** fixture databases from every shipped schema version; real-size data; interrupted migration; legacy cache purge.
- **Purge residue test:** plant unique marker strings in fields, photos (in pixel-embedded and metadata forms), signature, logs, and caches; run the purge on a test device; scan the database file, WAL, free pages, and the app's whole data directory for the markers. No marker may be found. Repeat under crash-mid-purge.
- **Time-based purge:** injectable clock to exercise both purge layers, the backward-jump case, and reboot elapsed-time tracking. One real-time soak for confidence.
- **Security:** review of key handling and storage encryption, backup and screenshot behavior, MDM policy verification, authorization tests (wrong assignee, unenrolled device, replayed changesets), and independent penetration testing before R1.
- **End-to-end:** web supervisor and tablet editing the same inspection in every interleaving from the conflict rules.
- **Field tests:** real basements, real signal loss, flapping and captive-portal networks, low-battery and low-storage behavior on the actual pilot tablet models.
- **Performance and soak:** 40-photo inspections over degraded links, several offline inspections queued, battery impact, long offline periods (A8), large local DB.
- **Usability:** inspectors and supervisors run the scripted flows. Verify that the difference between "saved on tablet" and "uploaded" is understood.
- **Audit completeness:** for a sampled set of test inspections, rebuild the full history from the audit trail alone and compare it with the known sequence of actions.

### 17.2 Scenario matrix (minimum set; each has an automated or scripted expected result)

| # | Scenario | Expected |
|---|---|---|
| 1 | Connectivity lost right after opening an inspection, then 40 photos and a signature | All data present after reconnect. Zero loss. |
| 2 | App killed mid-typing | Everything before the current keystroke survives. |
| 3 | Sync request succeeds on server but response lost | Retry is idempotent. One version bump, no duplicates. |
| 4 | Supervisor edits a different field while offline | Auto-merge, both audited. |
| 5 | Supervisor edits the same field | Conflict shown. No value lost. Resolution audited. |
| 6 | Supervisor edits after signature | Signature marked stale. Cannot be submitted as valid. |
| 7 | Upload drops at 90 percent of a photo | Resumes from offset. Hash verified. |
| 8 | 41st photo | Blocked with explanation. |
| 9 | Accepted while device online | Purged. Verified. Receipt received. |
| 10 | Accepted while device offline, later sync | Purged on next contact. Late-purge flagged if past deadline. |
| 11 | Submitted and synced, device never hears of acceptance. Variant: the submit response was lost and the device learned of receipt hours later | Layer 2 cap, anchored on `submitted_at_server`, purges within the deadline in both variants. |
| 12 | Accepted with unsynced device work | Late-work path. Data reaches audit if contact occurs. If the deadline passes first, purge with flagged event. |
| 13 | Reassigned or cancelled while offline | Read-only, late-work path, purge. |
| 14 | Form schema changed while offline | Completes on the pinned version. |
| 15 | Token expires offline | Work continues. Sync after re-auth. No wipe. |
| 16 | Clock set backward | Detected. Purge and audit unaffected. |
| 17 | Low storage during capture | Warned, then refused. DB intact. |
| 18 | Migration interrupted | Old store intact. Retry succeeds. |
| 19 | Feature flag turned off with unsynced data | Drain mode. Data still syncs. |
| 20 | Older app build with pending data | Server steers to update. Data preserved. |

---

## 18. Milestones

Dependencies are hard prerequisites. Milestones that share no dependency may proceed in parallel. There are no dates. Each milestone ships its own metrics and tests; M8 assembles dashboards and runbooks from them.

```
                 M0 Discovery and decisions
                    |                |
                    v                v
          M1 Durable local       M2 Server foundations
           store and purge        (changesets, hold, audit,
           primitives              schema pinning, uploads)
              |     \             /      |
              |      \           /       |
              v       v         v        v
        M3 Offline open   M5 Attachments (needs M1 + M2)
         and pull (M1+M2)        |
              |                  |
              v                  |
        M4 Push sync, merge,     |
         submit (M1+M2+M3)       |
              |     \            |
              |      v           v
              |     M6 Signature (M4 + M5)
              |          |
              v          v
             M7 Retention and purge enforcement (M4 + M5 + M6)
                    |
                    v
      M8 Observability and ops readiness (M4..M7 instrumentation)
                    |
                    v
            M9 Hardening and pre-pilot verification
                    |
                    v
             M10 Pilot (R1 to R2)
                    |
                    v
        M11 Expansion and legacy retirement (R3, R4)
```

### M0. Discovery and decisions

Depends on: nothing.

Work:

- Answer every assumption A1 to A16 with evidence (code paths, API inventory, sampled data, device measurements).
- Decide the blocking decisions in section 19 (see "needed by" column).
- Write spike results: photo size and free-storage measurements on pilot tablets; supervisor-edit overlap estimate from history (A7); write-path and version audit (A4); audit-log capability gap (A5); MDM enforceability (A2); platform and background-execution constraints (A12); encryption library evaluation (D7).
- Set metric thresholds and halt criteria (section 15) from baselines.

Acceptance:

- Each of A1 to A16 is marked validated, invalidated, or unresolved with a named consequence and a plan change where needed.
- D1, D2, D3, D5, D6, D7 are decided in writing by the named owners. The others have a decision or an explicitly agreed safe default with the milestone that needs the final answer.
- A16 result reported to compliance if the legacy cache retains data past limits.
- This plan is revised to reflect the findings.

### M1. Durable local store and purge primitives

Depends on: M0 (D7, D3 for schema).

Work:

- New `local_*` schema, migration framework, encrypted store, per-inspection key handling.
- Every edit committed to SQLite before acknowledgement, and outbox append in the same transaction.
- Draft restore on relaunch. Online behavior otherwise unchanged (this is the "stop losing notes" release).
- Purge engine skeleton: store registry (I6) with CI check, delete-by-root, key destruction, verification, residue tooling.
- Legacy cache purge on first launch (section 13.1).

Acceptance:

- Fault-injection suite: killing the app or dropping the network at any point never loses a committed field (scenarios 1, 2, 18 pass).
- Migration passes on all fixture databases, including interruption.
- Residue test passes for the primitive purge.
- CI fails when an unregistered store is added.
- Shipped only behind a flag. No change in online functionality.

### M2. Server foundations

Depends on: M0 (D2, D3, D5, D10, D11). Can proceed in parallel with M1.

Work:

- Version audit fixes so every writer bumps the version (A4).
- Idempotent changeset endpoint with atomic version check; idempotency store.
- Submit-with-manifest endpoint; device-hold endpoints; purge-receipt endpoint; `accepted_at` and purge deadline exposure; assignment delta feed.
- Resumable attachment upload sessions with hash verification.
- Extended audit events (section 12). Schema pinning support. Capability and minimum-version negotiation.
- Minimal web changes: hold banner, provenance display, purge status, accept-with-unsynced warning.

Acceptance:

- Contract tests pass for all endpoints, including duplicate delivery returning the identical result, stale version returning `409` with the documented body, and wrong assignee or unenrolled device being rejected and audited.
- Every writer path passes the stale-write test.
- Existing web and old-client regression suites pass unchanged.
- Audit reconstruction test passes on sample flows.
- Load test shows the idempotency store and upload sessions do not degrade existing endpoints.

### M3. Offline open and pull

Depends on: M1, M2.

Work:

- Prefetch of assigned inspections, readiness badges, local open with no connection, form definition pinning, revocation handling (read-only, then late-work or purge), status chip.

Acceptance:

- With airplane mode enabled, a prefetched inspection opens and is fully editable; a non-prefetched one shows a specific explanation.
- Reassign, cancel, and schema-change scenarios (13, 14) behave as specified.
- Remote changes never mutate an inspection on screen.
- Storage budget per tablet enforced from M0 measurements.

### M4. Push sync, merge, and submit

Depends on: M1, M2, M3.

Work:

- Sync engine (section 7.2), backoff, failure semantics, clock anchoring.
- Three-way merge, conflict table, conflict UI, ownership enforcement.
- Submit state machine with manifest, "Needs attention" state, sync status UI.

Acceptance:

- Scenarios 3, 4, 5, 15, 16, 19 pass.
- Model-based simulator shows convergence and no lost or duplicated ops over many randomized runs including drops and duplicates.
- Every `409` yields either an automatic merge or a stored conflict. Nothing is dropped.
- The manifest at submit matches for all test inspections. The data-loss canary reports zero mismatches.

### M5. Attachments

Depends on: M1, M2. Final integration with submit needs M4.

Work:

- In-app camera pipeline with crash-safe writes, compression and EXIF policy, 40-photo counter, storage guard, encrypted per-inspection files.
- Resumable upload client, bounded concurrency, network and battery policy, per-attachment failure states.

Acceptance:

- Scenarios 7, 8, 17 pass. A 40-photo inspection completes on a degraded link in the fault-injection rig, including drops mid-chunk.
- Files never appear in the device gallery or backup (verified on the pilot models).
- Orphan-file and missing-file reconciliation tested after crash at each step of the write order.
- Submit is blocked, with a specific message, while any attachment is unverified.

### M6. Signature

Depends on: M4, M5 (D6 decided).

Work:

- Signature capture, content-hash binding, read-only after signing, re-sign flow, stale-signature detection on merge and at submit, audit events.

Acceptance:

- Scenario 6 passes. A signed inspection cannot be modified without invalidating the signature.
- Hash computation is canonical and reproducible across client and server on the same content.
- Legal or compliance reviewers approve the evidence recorded (D6, D11).

### M7. Retention and purge enforcement

Depends on: M4, M5, M6 (D1 decided).

Work:

- Both purge layers, interlock, late-work path, purge ledger, receipts, server alerts, compliance dashboard, user-facing deadline messaging.
- Extend the registry to every data class introduced in M3 to M6.

Acceptance:

- Scenarios 9 to 13 pass.
- Residue test finds no markers across database, WAL, free pages, files, logs, and caches after purge, including a crash mid-purge.
- Layer 2 cap demonstrably purges a submitted-and-synced inspection with no connectivity after acceptance, within the deadline, in time-injected tests and a real-time soak.
- Backward clock jump and reboot tests pass.
- Overdue-purge alert fires in a staged test.
- Compliance signs off on the behavior in the deadline-passes-while-offline case.

### M8. Observability and operational readiness

Depends on: instrumentation from M4 to M7.

Work:

- Dashboards and alerts (section 14), diagnostics upload, support tooling, rescue-export procedure (D13), runbooks, on-call ownership.

Acceptance:

- Each alert has been fired in a staging test and reaches a named owner.
- Each runbook was exercised once by someone who did not write it.
- Diagnostics contain no customer content (automated scan).

### M9. Hardening and pre-pilot verification

Depends on: M3 to M8.

Work:

- Full scenario matrix on real pilot tablet models, including physical basements and degraded networks.
- Independent security review and penetration test, MDM policy verification.
- Rollback drills (section 16).
- Usability sessions with inspectors and supervisors.
- Performance and soak.

Acceptance:

- All 20 scenarios pass on real devices.
- No open critical or high security findings.
- Every rollback drill completes without unsynced-data loss.
- Compliance sign-off recorded for D1, D6, D11 and the audit model.
- R0 (internal, synthetic data) exit criteria met, which is what allows R1 to start.

### M10. Pilot

Depends on: M9.

Work: run R1 then R2 (section 15) with regular review of the section 14 signals, the coverage checklist, and the halt criteria.

Acceptance:

- Coverage-based exit list complete. Metric gates pass. No unresolved compliance findings.
- Written findings: conflict rate versus A7, offline durations versus A8, photo and storage reality versus A9, support burden.
- Decision memo on whether and how to expand, including any plan changes.

### M11. Expansion and legacy retirement

Depends on: M10.

Work: R3 staged expansion with automated gates, R4 general availability, later removal of legacy cache code and the online-only fallback once criteria are met.

Acceptance:

- Each expansion step holds the automated gates before the next.
- Removal of legacy paths happens only after the agreed criteria hold and rollback is no longer required at that layer.

---

## 19. Decisions required before implementation

For each: the decision, options, a recommendation, who decides, and when it is needed. Owners are roles, not named people.

| ID | Decision | Options | Recommendation | Decides | Needed by |
|---|---|---|---|---|---|
| **D1** | Purge rule, early-purge cap, and what happens to unsynced work at the deadline | (a) purge on learning acceptance only; (b) add a local cap counted from the server's submission-receipt time; (c) never purge unsynced data even past the deadline | (b). Layer 1 plus Layer 2 with interlock (section 10). For unsynced work on an accepted, cancelled, or reassigned inspection, use the late-work path; if the deadline passes before contact, purge anyway with a flagged event, because the regulation outranks retention. Compliance sets `R` (at most 24h). Reject (c): it violates the regulation. | Compliance/legal with Product | Before M1 schema is final; final by M7 |
| **D2** | Conflict granularity and same-field policy | Record-level; field-level merge; last-writer-wins | Field-level three-way merge. Same-field inspector-owned conflicts go to the inspector, with both values kept. See section 8. | Product with Engineering | Before M2 |
| **D3** | Field ownership map | Free-for-all; ownership partition enforced server-side | Partition: inspector-owned versus supervisor-owned, enforced on the server. Requires the form owner to classify fields. | Product | Before M1 schema |
| **D4** | Device hold | None; advisory hold; hard lease | Advisory, overridable hold, informational only. Hard locks strand records when tablets are lost. | Product | Before M2 |
| **D5** | Sync API shape | Reuse existing full-record PUT; additive changeset, submit, and upload endpoints | Additive endpoints with idempotency keys and the integer version as concurrency token. Full-record PUT cannot carry provenance or idempotency. | Backend and Mobile leads | Before M2 |
| **D6** | Signature semantics and post-signature edits | Store an image only; bind to content hash and freeze | Bind to a canonical content hash. Read-only after signing. Changes invalidate. Stale on merge. Legal confirms who signs and what evidence is required. | Legal/compliance with Product | Before M6 (before M1 if it changes schema) |
| **D7** | Local encryption and key management | OS file protection only; encrypted SQLite plus per-inspection file keys; per-inspection database files | Single encrypted SQLite (a maintained, platform-validated library) with a keystore-held key; attachments encrypted per inspection so purge can destroy the key; `secure_delete`, WAL truncate, and vacuum after purge. Per-inspection DB files are a viable alternative if M1 spikes show residue problems. | Security with Mobile lead | Before M1 |
| **D8** | Photo policy: resize and compression targets, original retention, EXIF, network policy | Full-size originals; resized; Wi-Fi only versus cellular allowed | Resize and compress at capture to a target validated against inspection-quality needs. Do not retain separate originals unless required. Strip EXIF location unless required as evidence and record capture metadata in the database. Allow cellular on the company plan for small changesets and Wi-Fi-preferred for large uploads. | Product with Compliance | Before M5 |
| **D9** | Offline scope and auth: what to prefetch, how long offline access lasts, when re-auth is needed | Prefetch all assigned; window only; on demand | Prefetch assigned inspections within a configured window. Bounded offline session length set from M0 data on offline duration. Sync always requires fresh auth. Auth failure never wipes data. | Product with Security | Before M3 |
| **D10** | Form schema changes while offline | Force update; pin at download | Pin the schema version at download. The server accepts submissions on a previous version for a defined window. If incompatible, a supervisor migrates. | Product with Backend | Before M2 |
| **D11** | Audit model and device-time trust | Trust device time; server time only; both | Record both with elapsed-since-contact. Server time is authoritative for ordering. Audit is append-only. Compliance confirms that this is acceptable audit evidence. | Compliance with Backend | Before M2 |
| **D12** | Pilot definition: cohort, exit and halt criteria, metric thresholds | Time-boxed; coverage-based | Coverage-based exit (section 15). Cohort small enough for manual review. Thresholds from M0 baselines. | Product with Engineering and Compliance | Before M9 |
| **D13** | Stranded-data recovery and remote wipe | No recovery; support-only rescue export; auto-upload of raw data | Admin-authorized, audited rescue export of the encrypted store. Remote wipe always available for security, but the server first shows "unsynced work at last contact" so recovery can be attempted. | Security with Support | Before M8 |
| **D14** | Minimum supported version and old-client behavior | Allow all; capability negotiation with a version floor | Server-side capability negotiation. Old clients stay online-only and are never offered offline mode. Enforce a floor for users with pending local data. | Mobile and Backend leads | Before M2 |

---

## 20. Brief-to-plan traceability

| Brief statement | Where addressed |
|---|---|
| Company-managed tablets, basements, no signal | A2, 3.1, 11 |
| Lost connection can discard notes today | Section 1 (headline 1), I1, M1 |
| Open assigned inspections, fill forms | 3.1, M3 |
| Up to 40 photos | Section 9, M5 |
| Signature offline | 9.3, 9.4, M6 |
| Intermittent connectivity | 7.2, 7.3, 9.2 |
| Supervisors can edit the same inspection from the web | Section 8, 3.3, A7 |
| Audit history | Section 12, D11 |
| Local data removal within 24 hours after acceptance | Section 10, D1, M7 |
| REST APIs with integer record versions | 7.1, A4, D5 |
| SQLite as read-through cache today | Section 6, section 13 |
| Pilot before broad rollout | Section 15, M10 |
| No full collaborative editor | Section 4 non-goals, 8.4 |
