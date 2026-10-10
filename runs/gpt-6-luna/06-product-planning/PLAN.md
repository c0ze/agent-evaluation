# Offline inspection sync plan

**Status:** Proposed plan for implementation planning  
**Product input:** `BRIEF.md` only. Details not stated there are marked as assumptions or decisions.  
**Goal:** Let an inspector complete an assigned building inspection when disconnected, retain the work through intermittent connectivity, and sync it without silently overwriting a supervisor's changes.

## Understanding summary

- Inspectors use company-managed tablets in basements with unreliable or absent signal.
- They need to open assigned inspections, complete forms, take up to 40 photos, and capture a signature offline.
- Work must survive connection loss and app restarts; connectivity may return intermittently.
- Supervisors may edit the same inspection through the web app.
- Existing server APIs are REST-based and use integer record versions; the mobile app already has SQLite but currently uses it as a read-through cache.
- An inspection's local customer data must be removed within 24 hours after it is accepted, and the server must retain an audit history.
- The pilot should add dependable offline work without turning the product into a full collaborative editor.

## Recommended design

Promote SQLite from a read-through cache to the durable local workspace for the inspector's assigned draft. Save each form change and an ordered outbox event in one local transaction before showing it as saved. Keep the server's integer version as the optimistic concurrency token. Sync queued draft changes and attachments idempotently when connectivity permits. If the server version has advanced, preserve both versions and stop automatic writes; send a conflict package for supervisor review rather than merging or overwriting data silently.

Treat server acceptance as a final server-side state transition. The tablet must first upload and receive durable acknowledgments for the inspection, audit events, signature, and attachments, then delete its customer data and per-inspection key and send a purge receipt. Only then should the server finalize acceptance. For a tablet that is offline when a supervisor attempts acceptance, acceptance must wait for a purge receipt or an enforceable offline-data lease to expire. This is the recommended way to make the 24-hour rule meaningful; confirm the platform and MDM can support it before pilot.

## Assumptions and constraints

These are planning assumptions, not additional facts from the brief:

1. Offline creation is limited to assigned inspections already downloaded to that tablet while online. New assignments and unassigned customer records are not available offline.
2. One inspector owns a local working copy at a time. A user switch, sign-out, or reassignment must first sync or safely retain the current draft and must not expose it to another user.
3. A server-side accepted state is the compliance clock's start. A local “ready to submit” action while offline is not yet acceptance.
4. The server can add endpoints and tables compatibly, enforce the existing integer version in a transaction, and retain append-only audit events.
5. The managed tablet platform can encrypt local database/files, exclude them from consumer/cloud backups, and support a reliable local purge or a managed-device recovery path. This needs verification; an app-only background job cannot guarantee execution while a tablet is powered off.
6. “40 photos” is a maximum per inspection, with the signature stored as a separate artifact. File size, supported image formats, and compression quality remain to be decided.
7. Audit retention duration, audit contents, signature evidentiary requirements, and conflict-resolution ownership need approval from the relevant product/compliance owners before implementation.

## User flow and states

1. **Prepare:** While connected, the inspector opens an assigned inspection. The app downloads its current form, assignment, integer `server_version`, and required reference data. It writes an encrypted local baseline and working copy before making the inspection available offline.
2. **Work offline:** Form edits autosave to SQLite transactionally. Each edit is also placed in a durable, ordered outbox. The UI shows local save status separately from server sync status. Photos and the signature are saved in encrypted app storage and referenced by local metadata. The app enforces the 40-photo limit.
3. **Reconnect:** Connectivity is only a hint to try sync. The app resumes queued changes and interrupted attachment uploads with exponential backoff and jitter. A successful network request is acknowledged by its idempotency key; retries do not create duplicate edits, audit events, or attachments.
4. **Version conflict:** If the server version differs from the draft's base version, the app pauses automatic writes and acceptance. It preserves the local draft and attachments, fetches the current server version, and creates an isolated conflict package. A supervisor reviews the local candidate and canonical server record in a minimal web conflict workflow, then records a resolution. This is exception handling, not live co-editing.
5. **Submit and accept:** After required fields, photos, and signature are present, the inspector submits. The server validates assignment and version, persists the final data and audit history, and confirms all artifact uploads. It returns a `ready_to_accept` receipt. The client removes the inspection's local data and key, then sends an idempotent purge receipt. The server marks the inspection `accepted` only after that receipt, or after an approved, enforceable device-lease expiry path. The app retains only a non-customer-data tombstone/receipt.
6. **Cleanup:** If acceptance is initiated from the web while a tablet still holds an offline copy, the server does not finalize acceptance until that tablet reports purge or its enforceable lease expires. The client also runs cleanup on launch and scheduled background opportunities. Cleanup removes database rows, journal/outbox payloads, photos, thumbnails, signatures, upload staging files, SQLite WAL/journal files, and encryption keys.

Suggested states are `assigned_cached → in_progress_local → queued → syncing → conflict_review` (when stale) or `ready_to_accept → purged_pending_receipt → accepted`. The state shown to the user must distinguish “saved on this tablet,” “synced,” and “accepted.”

## Scope boundaries

**In scope:** assigned inspections; offline form entry; up to 40 photos; offline signature capture; local durable autosave; queued/idempotent sync; optimistic version checks; a bounded supervisor conflict-review/resolution path; server audit events; secure local storage and purge; rollout and operational telemetry.

**Out of scope for this pilot:** offline access to every customer or inspection; creation of assignments offline; simultaneous live editing, chat, presence, comments, or general-purpose field-level merge; unlimited media; synchronization across multiple inspector devices; a broad redesign of the supervisor web experience. The minimal web conflict workflow exists only to resolve a stale-version submission safely.

## Local data model

Use additive, transactional SQLite schema migrations. Store customer data only for active assigned inspections.

| Entity | Key fields and purpose |
|---|---|
| `inspection_workspace` | `inspection_id`, `assignment_id`, `inspector_id`, `base_server_version`, encrypted `base_snapshot`, encrypted `working_snapshot`, `state`, `local_updated_at`, `accepted_at`/`purge_due_at` when known. The baseline enables stale-version review; the working snapshot is the durable offline draft. |
| `outbox_event` | Stable `event_id`/idempotency key, inspection ID, monotonic per-inspection sequence, base version, event type, encrypted change payload, actor/device identity, client timestamp, retry state. Keep events ordered per inspection. |
| `attachment` | Opaque attachment ID, inspection ID, kind (`photo` or `signature`), encrypted local file reference, byte count, content hash, capture time, ordering, upload session/state. Derivatives and temporary chunks are also customer data. |
| `cleanup_tombstone` | Opaque inspection identifier, purge receipt ID, server acceptance time, and cleanup outcome only. It must not contain form values, customer identity, photos, signature data, or queued payloads. |

The server remains authoritative for canonical accepted inspections and audit history. SQLite is authoritative for the not-yet-accepted local draft on that device. Never treat a stale cache row as a valid offline assignment without server-issued assignment/version metadata.

## Sync protocol and conflict policy

1. **Bootstrap:** Fetch an assigned inspection snapshot plus integer version and assignment authorization. Store baseline and working copy atomically. The server must reject changes from revoked or unauthorized assignments.
2. **Persist before acknowledging locally:** On each edit, update the working snapshot and append its outbox event in one SQLite transaction. A local “saved” indicator appears only after commit. A crash or force-quit must leave either both records or neither.
3. **Send in order:** Submit events per inspection with a stable idempotency key and `base_version`/`If-Match` integer version. Server validation, canonical update, version increment, and audit append happen atomically. Return the new version and event acknowledgment. Retry of an acknowledged key returns the original result.
4. **Upload artifacts:** Create an upload session, send resumable chunks (or a resumable equivalent supported by the chosen REST service), validate final byte count and SHA-256 digest, then attach the server artifact ID to the inspection. Do not report final submission complete while any artifact is incomplete.
5. **Stale version:** Return a typed conflict response with current version. Do not apply any part of a stale write. The app pauses later events for that inspection and preserves its local state. A separate conflict endpoint stores the local candidate against its base and observed server versions without changing the canonical inspection. The minimal supervisor workflow compares the two versions and commits a deliberate resolution as a new version with its own audit event. The inspector can then continue from that resolved version if work remains.
6. **No automatic merge in the pilot:** Whole-inspection version mismatch requires review, even if the changes may be to different fields. This makes behavior predictable for regulated forms and avoids assuming field-level merge rules that the brief does not define. No signature is silently replaced or merged.
7. **Acceptance:** Server verifies required form state, the signature, all artifact hashes, authorization, and audit persistence. It issues `ready_to_accept`; the client purges local customer data and keys and posts an idempotent purge receipt. Server transitions to `accepted` and records the acceptance time only under the agreed purge/lease policy.

## Attachments and signature

- Enforce no more than 40 photo artifacts per inspection; count pending, uploaded, and retried photos consistently so retries cannot bypass the limit.
- Persist each capture to encrypted local storage before showing it as attached. Keep stable attachment IDs across retries. Show upload state per item and allow a failed transfer to resume without taking the photo again.
- Use resumable uploads with checksum verification. The API must define allowed formats, maximum bytes per file and inspection, image-processing rules, chunk/session expiry, and server retention of abandoned uploads before implementation.
- Treat signatures as separate protected evidence. Preserve the captured artifact and capture metadata; do not edit or merge it during conflict handling. Confirm signer attribution, consent wording, timestamp requirements, and whether the server needs the original stroke data, a rendered image, or both.
- Delete originals, previews, transformed copies, chunks, and server-side abandoned conflict artifacts according to the approved retention policy. Never put image or signature content in logs.

## Security, audit, and deletion

- Encrypt SQLite and all inspection files at rest with per-inspection data keys protected by the managed OS keystore. Require the tablet's normal device authentication to access app data. Exclude the database, files, and keys from unmanaged backups. Use TLS and server-side authorization for every sync, upload, conflict, and acceptance request.
- Bind queued work to the signed-in inspector, device, assignment, and stable event IDs. Revalidate authorization on receipt; do not trust client timestamps or client-provided identity by themselves.
- The server audit is append-only and records actor/device, event ID, affected inspection/version, action, server receipt time, client event time, artifact hashes/references, and the approved before/after detail. Audit entries must be committed atomically with canonical updates and be deduplicated on retry. The exact values to retain and retention period are compliance decisions; keep audit data out of general telemetry.
- Keep logs and metrics free of customer names, field values, photos, signatures, access tokens, and raw payloads. Use opaque IDs or pseudonyms with restricted access.
- Prefer a purge receipt before server acceptance. If the existing business meaning requires acceptance to occur earlier, acceptance may precede deletion by at most 24 hours only if a verified platform/MDM mechanism can ensure deletion on tablets that remain offline or powered off. Do not claim compliance based solely on a best-effort app background task. Track acceptance-to-purge age and alert before the limit; escalate any breach.

## Migration and backfill

- Add server capabilities additively: idempotency, conditional version writes, audit persistence, attachment sessions, conflict packages/resolution, and acceptance/purge state. Keep existing REST callers functional during the pilot; do not reinterpret the integer version.
- Add a forward-only, transactional SQLite migration that creates workspace, outbox, attachment, key, and tombstone structures. Test upgrade from the current read-through-cache schema and recovery from interruption.
- On first use after upgrade, refetch active assigned inspections and their server versions; do not promote arbitrary old cache entries to offline drafts. Since the current app does not support offline work, no local offline draft history needs backfill. Remove/refetch stale cache data and immediately purge already-accepted cached customer records during upgrade.
- No historical server inspection backfill is proposed. Existing records continue at their current versions; new audit events begin with the new audited API path. Confirm how web/API writes enter the same audit stream before enabling the pilot.
- Deploy the additive API before the mobile feature flag. Keep old-client behavior supported until the pilot cohort is upgraded. Do not ship a downgrade path that can discard an outbox or expose a new local schema to an old app.

## Observability and operations

Capture operational metadata only: sync attempts/success/failure, queue age and depth, oldest pending event, retry count, attachment bytes/progress/failure, conflict count and age, server-version rejection, duplicate idempotency hits, audit-write failures, acceptance state transitions, and acceptance-to-purge duration. Use pseudonymous device/inspection IDs and redact payloads.

Provide dashboards split by app version and pilot cohort. Alert on growing queue age, repeated upload failures, unresolved conflicts beyond the agreed service window, missing audit writes, orphaned attachment sessions, acceptance purge approaching the 24-hour limit, and any cleanup breach. Support diagnostics should expose a sync state and opaque correlation ID, not customer content. Establish retention and access controls for telemetry separately from the regulated audit store.

## Staged rollout and rollback

1. **Contract and readiness:** Resolve the decisions below, validate the platform/MDM purge mechanism, establish measurable pilot gates, and document a support/runbook path. No feature flag is enabled.
2. **Server dark launch:** Deploy additive endpoints/schema, idempotency, audit, attachment lifecycle, and metrics without changing existing web behavior. Verify web and mobile writes are audited and version checks are atomic.
3. **Internal device cohort:** Enable the new app path for managed internal tablets and test disconnected work, reconnect, conflict review, acceptance, and purge. Use synthetic or approved test records.
4. **Limited pilot:** Enable an explicitly enrolled, limited cohort of inspectors/assignments. Review sync reliability, photo completion, conflict burden, audit completeness, cleanup receipts, and support feedback before expanding.
5. **Cohort expansion:** Expand only after product/compliance gates are met at each step. Define numeric success thresholds from baseline and pilot data before the pilot begins; do not infer them here.
6. **Broad availability:** Enable by controlled feature flag, retaining cohort and version-level monitoring and an owner/runbook for unresolved queued work.

**Rollback:** Turn off enrollment and new offline-workspace creation first. Keep sync, conflict resolution, and purge paths live for every device with queued work. Do not revert server audit/version data or delete queued drafts. If submission is unsafe, pause final acceptance while preserving encrypted local work and clearly surface “not accepted”; continue purge processing for already accepted inspections. Keep API changes additive and block managed app downgrade until outboxes are drained or migrated. Resume with a corrected client/server release and reconcile all pending queues before re-enabling enrollment.

## Milestones, dependencies, and acceptance criteria

| Milestone | Depends on | Acceptance criteria |
|---|---|---|
| M0 — Product/compliance/API decisions | None | Acceptance and purge semantics, audit content/retention, conflict owner/flow, artifact limits, security/MDM capability, and pilot gates are documented and approved. |
| M1 — Server contract and persistence | M0 | Version-conditional writes are atomic; idempotency retries deduplicate; audit entries are durable with each update; resumable attachments are hash-checked; stale writes return a typed conflict without changing canonical data; acceptance/purge states are queryable. |
| M2 — Local workspace and migration | M0; API contract from M1 | Upgrade from the existing cache schema is transactional; active assignments can be opened offline; every local edit survives app termination; accepted cache rows are purged; unassigned/stale cache rows cannot be opened as valid drafts. |
| M3 — Form sync and conflict path | M1, M2 | Offline edits sync in order; retries do not duplicate updates/audit entries; server version advances only on accepted writes; stale writes preserve the draft and create a supervisor-reviewable conflict without overwriting the canonical record. |
| M4 — Photos and signature | M2, M3, attachment API in M1 | The app supports 40 photos plus the separate signature artifact; interrupted upload resumes; digest mismatch or missing artifact prevents final submission; signature is preserved across retry and conflict. |
| M5 — Audit, purge, and telemetry | M1–M4 | Server audit is complete for mobile/web changes and conflict resolution; local purge removes database/WAL/outbox/media/key copies; acceptance is gated by the agreed purge policy; purge receipts and deadline breaches are observable without logging customer content. |
| M6 — Pilot readiness | M3–M5 | Migration, security, failure-mode, regression, and end-to-end scenarios pass; support runbook and rollback are rehearsed; numeric go/no-go thresholds and escalation owner are set. |
| M7 — Pilot and expansion | M6 | Pilot gate review shows no lost acknowledged edits, no silent stale overwrite, complete audit for accepted work, all accepted records within the deletion requirement, and sync/conflict/support metrics within preapproved thresholds. Expansion is explicitly approved at each cohort gate. |

## Test plan

- **Local persistence:** Offline edits followed by process kill, device restart, low storage, and migration interruption; verify transaction boundaries, ordering, and recovery.
- **Sync/idempotency:** Retry the same edit before/after a lost response; verify one canonical update and one audit event. Exercise intermittent network transitions, expired auth, server retry, and out-of-order responses.
- **Conflict:** Inspector and supervisor edit concurrently; verify stale write is rejected, both candidates remain reviewable, resolution creates a new audited version, and final acceptance cannot bypass unresolved conflict.
- **Attachments:** Capture 40 photos and a signature; test duplicate retries, partial/chunk interruption, hash mismatch, low storage, count boundary, cancellation, and finalization with missing media.
- **Deletion:** Accept from mobile and web; exercise online, offline, powered-off, app-not-running, expired-lease, interrupted purge, duplicate receipt, and delayed server response. Verify all copies and keys are removed and the deadline is enforced by the approved platform mechanism.
- **Migration/compatibility:** Upgrade from the current app cache, test old and new clients against additive APIs, confirm accepted cached rows are cleaned, and verify no existing server record is silently re-versioned or omitted from audit.
- **Security/privacy:** Inspect local DB/files/backups, app logs, telemetry, and crash diagnostics for customer content; verify authorization revocation, user/device association, encrypted storage, and key destruction.
- **Operational:** Dashboard/alert tests for queue backlog, conflict aging, missing audit writes, orphan uploads, and purge deadline risk. Do not use production customer content in test fixtures.

## Decisions required before implementation

| Decision | Recommendation | Why / trade-off |
|---|---|---|
| What starts the 24-hour deletion clock? | Define acceptance as the server's final accepted transition after the client purge receipt; gate web acceptance while an offline device lease remains active. | Gives the system an observable deletion point. It can delay supervisor acceptance when a tablet is unreachable, so verify lease/MDM behavior and business tolerance. |
| Audit detail and retention | Append-only server events with actor/device, server and client times, versions, event IDs, artifact references/hashes, and approved before/after details; compliance owner sets retention before M0 closes. | Supports history and deduplication; retaining field values can increase privacy and storage obligations. Do not invent a legal retention period. |
| Conflict handling | Strict record-level version check; no automatic merge in the pilot; preserve a conflict candidate and add a minimal supervisor compare/resolve action. | Prevents silent loss and avoids broad collaboration complexity; creates manual review work and requires a named resolver. |
| Offline availability | Cache only assigned active inspections; no new assignment or broad customer search offline. | Limits data exposure and keeps the offline data set bounded. Confirm assignment expiry and revocation behavior. |
| Photo/signature contract | Cap at 40 photos, signature separate; choose maximum bytes, allowed formats, compression, and signature representation before API freeze. | The brief gives a photo count but no payload/evidentiary limits. Resumable transfer is recommended for intermittent connectivity. |
| Device/security contract | Confirm tablet OS, keystore/encryption, backup exclusion, shared-device behavior, app authentication, MDM wipe, and offline lease enforcement before pilot. | A hard 24-hour physical deletion requirement cannot rest on a best-effort client task when a device may be off. |
| Pilot success thresholds | Set numeric thresholds for sync time/reliability, conflict volume/age, storage, support burden, and purge margin from baseline before enrollment. | Avoids arbitrary targets and makes expansion a reviewable decision. |
| API compatibility and audit coverage | Add new sync APIs and ensure web writes use the same version/audit guarantees before rollout; keep existing callers compatible. | Prevents a split audit history or clients bypassing version protection. |

## Decision log

| Decision | Alternatives considered | Recommendation and rationale |
|---|---|---|
| Local draft authority | Keep SQLite as cache; use memory until submit; durable local workspace | Durable local workspace: it directly addresses lost notes and app/network interruption. |
| Concurrency | Last-write-wins; automatic field merge; strict version conflict | Strict version conflict for the pilot: safest with regulated forms and unknown field merge semantics. |
| Conflict resolution | Drop local copy; overwrite server; preserve isolated candidate for supervisor review | Preserve both and resolve explicitly: no silent loss or overwrite, bounded to exceptional conflicts. |
| Upload | Single all-or-nothing payload; independent non-resumable files; resumable artifact sessions | Resumable sessions with hashes: matches intermittent connectivity and up to 40 photos. |
| Acceptance cleanup | Best-effort delete after acceptance; delay final acceptance until purge evidence | Delay final acceptance until purge evidence, with a verified lease/MDM path for offline devices: gives an auditable relation between acceptance and deletion. |
| Rollout | Big-bang update; additive dark launch and cohort flag | Additive API first, then controlled cohorts: supports compatibility and a pause path without losing queued drafts. |
