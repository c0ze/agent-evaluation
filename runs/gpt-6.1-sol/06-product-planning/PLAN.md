# Offline inspection implementation plan

## Basis and intended outcome

BRIEF.md is the only product input. This is a proposed implementation plan; recommendations and assumptions below require the named decisions, and are not claims about existing capabilities. No code, external sources, delivery dates, or staffing estimates are used.

The brief establishes these requirements:

- Inspectors use company-managed tablets in places without signal; losing connectivity currently risks discarding notes.
- Assigned inspections must support offline forms, up to 40 photos, and a signature.
- Connectivity returns intermittently, and supervisors can edit the same inspection on the web.
- Audit history is required, and local customer data must be removed within 24 hours after acceptance.
- The server uses REST and integer record versions. Mobile SQLite is currently a read-through cache.
- Product wants a pilot before broad rollout and excludes a full collaborative editor.

The outcome is durable local work with visible synchronization status, explicit conflict resolution, auditable server commits, and a verified cleanup path. A local save, a server synchronization, a submission, and acceptance are separate events.

## Assumptions and scope

| ID | Proposed assumption | Consequence and validation |
| --- | --- | --- |
| A1 | Inspectors can prepare assigned inspections while connected before entering a basement. | New assignments, first login, missing forms, and uncached inspections cannot be opened offline. Validate this workflow with the pilot; show readiness per inspection. |
| A2 | Acceptance can wait until all registered tablet copies are reconciled and purged. | This makes the deletion deadline enforceable without assuming connectivity. Product must approve the acceptance delay; security/compliance must approve what constitutes deletion. This is a launch blocker. |
| A3 | Server changes can provide atomic conditional writes, durable idempotency, audit records, change discovery, and a tablet-copy registry. | REST and integer versions alone do not provide these guarantees. Prove them in a server contract spike before depending on them. |
| A4 | A signature attests to a defined inspection snapshot, and edits to that snapshot require a new signature. | Define the signed fields and evidence with product/compliance. Concurrent supervisor edits may require review and re-signing. |
| A5 | A managed tablet profile belongs to one signed-in inspector at a time, with an approved offline authorization window. | Verify enrollment, lock behavior, credential expiry, account changes, supported OS versions, and key-storage capabilities. |
| A6 | There is a bounded supported workload: 40 photos per inspection plus a signature, with capped photo size and a bounded number of prepared inspections. | Measure on pilot tablets. Decide caps before implementation; do not invent fleet size, traffic, or storage capacity. |
| A7 | Accepted inspections become immutable for tablet editing. | Corrections create a separately audited revision and a new signing/acceptance cycle. Confirm existing web workflows can honor this. |

In scope: preparation/download, durable forms and notes, camera capture, signature capture, offline reopen, background and foreground synchronization, conflict review, submission, acceptance cleanup, migration, support diagnostics, and a controlled pilot. Web changes needed for version checks, conflict visibility, signature invalidation, and acceptance are included.

Out of scope: live cursors or collaborative text editing, offline creation of unassigned inspections, offline supervisor acceptance, arbitrary customer-data exports, and automatic legal interpretations. Device recovery through an authorized support workflow is included; a general offline sharing feature is not.

Reliability target: once the UI says “Saved on tablet,” a crash, restart, or connectivity change must preserve the saved edit. Storage failure must stop the saved indicator. Performance targets for local save latency, opening a prepared inspection, text sync, and draining a 40-photo inspection will be agreed from representative-device measurements in M0. Ownership is by role: mobile owns durable storage/workers; backend owns commit/audit/acceptance contracts; product owns workflow; security/compliance owns retention and signatures; operations owns alerts and recovery procedures. Roles are responsibilities, not staffing estimates.

## Decisions required before implementation

All choices are provisional recommendations. M0 records the accepted choice, decision owner, evidence, and unresolved constraints.

| ID / owner | Decision and recommendation | Alternative and tradeoff |
| --- | --- | --- |
| D1 / product + compliance | Define “accepted” as a server transition after validation and confirmed cleanup of every registered tablet copy. Keep submission distinct; label the intermediate state “Awaiting tablet cleanup.” | Acceptance before cleanup requires a proven deletion mechanism independent of reconnecting; a reconnect-triggered 24-hour timer cannot meet the brief. |
| D2 / security + compliance + mobile | Approve the deletion standard, all locations containing customer data, and platform capabilities. Prefer encrypted per-inspection payloads/files and verified deletion of their keys, files, database rows, and transient copies, with managed backups excluded. | Literal physical erasure of flash remnants or timed deletion on an offline, powered-off device cannot be promised by an app. If cryptographic erasure is unacceptable, obtain an implementable approved method before proceeding. |
| D3 / backend | Add a REST sync contract with compare-and-swap versions, transactional audit and idempotency, attachment staging, paged changes, copy registration, and acceptance coordination. | Existing CRUD without these guarantees risks duplicate writes and missing audit events. A complete event-sourced backend would add unnecessary scope. |
| D4 / product + backend | Use record-level optimistic concurrency and explicit three-way field review for conflicts; never silently overwrite either author's work. | Automatic disjoint-field merging reduces reviews but adds semantic ambiguity. Defer it until pilot evidence justifies it; do not build a collaborative editor. |
| D5 / product + compliance | Define the signed projection, signature provenance, and evidence retention. Recommend signing forms, notes, template version, and the complete photo manifest using an immutable snapshot hash. A changed signed field invalidates the signature. | Excluding some content is possible only with explicit approval; silently carrying signatures across changed evidence is unacceptable. |
| D6 / product + mobile + security | Set maximum photo bytes/resolution, prepared-inspection count, offline authorization duration, and disk reserve from field needs and tablet measurements. Count 40 photos across the inspection; the signature is a separate artifact. | An unlimited offline window or unlimited prefetch increases authorization and storage risks. Shorter windows must still cover the agreed basement workflow. |
| D7 / product + backend | Freeze editing during final acceptance coordination, reconcile every tablet, then purge and accept. Cancellation/revision requires explicit server action and preparation again. | Offline tablets can delay acceptance. If that is unacceptable, redesign D1/D2 before building; merely removing devices from the registry is not proof of deletion. |
| D8 / product + security | On expired authorization, lock local data and pause upload until reauthentication; on reassignment/revocation, require supervised recovery or approved disposal. | Automatic upload with stale permissions exposes data; automatic destruction may lose unsynced work. Define the authorized recovery and disposal policy before pilot. |
| D9 / compliance + backend | Store authoritative audit history on the server with policy-controlled access and retention. Preserve actor, before/after values, versions, signature evidence, and resolution provenance. | The brief provides no audit retention duration or signature format; do not invent either. Define whether offline per-edit provenance is required and its evidentiary limits. |
| D10 / product + operations | Specify pilot workload, success thresholds, stop conditions, and support ownership before exposure. Require zero known saved-edit losses, duplicate committed effects, unsigned acceptance, or cleanup-policy violations. | Expansion based only on enrollment count or connectivity averages misses correctness failures. Quantitative performance/support thresholds need M0 measurements. |
| D11 / product + mobile + backend | Pin the prepared template for the draft and continue accepting it while that template remains approved. If it is retired, require an explicit field-mapping review and re-signing before submission. | Silently swapping forms can discard answers or change signed meaning. Define compatibility and retirement rules before implementation. |

## Inspector and supervisor flow

1. **Prepare while connected.** Authenticate and validate assignment. Register the device copy before downloading any customer data; pin the form/template version, reference data, and current server version. Check capacity and download atomically. “Ready offline” appears only after the complete inspection and form dependencies are locally durable. Incomplete downloads remain unavailable offline. Show last synchronization and offline-access expiry.
2. **Work offline.** Open a prepared inspection, fill forms/notes, and capture photos. Save each meaningful edit locally without waiting for HTTP. Photos become saved only after encrypted bytes and a durable manifest entry exist. Show “Saved on tablet” separately from “Synced.” At the photo/storage limit, explain the limit and preserve existing work. Reopen the same draft after an app or tablet restart.
3. **Sign and submit.** Validate the local form, freeze a signed snapshot, and capture its signature offline. Submission offline is an intent marked “Waiting to submit.” It is not server submission or acceptance. Editing signed content explicitly invalidates the signature and requires re-signing. The UI must never show an incomplete signature/blob dependency as submitted.
4. **Reconnect intermittently.** The worker resumes automatically on foreground/network opportunities. Notes need not wait for large photo transfers. Display pending items, progress, retryable failure, sign-in required, and conflict separately. Interruptions do not discard the draft, reset completed chunks, or duplicate mutations.
5. **Resolve concurrent edits.** A supervisor's web edits increment versions and enter the audit log. A version mismatch leaves both versions available for review. Compare the last common base, the tablet changes, and the current server values; choose values or rewrite deliberately. Conflict resolution creates a new mutation against the current version. Review any changed signed content and collect a new signature as necessary.
6. **Accept and clean up.** A supervisor requests acceptance of a submitted candidate. The server freezes new editing/preparation and requests reconciliation and cleanup from every registered tablet copy. An offline tablet keeps the request pending. Reconnect brings its saved work into review, including any work made before it learned of the freeze. Resolve that work before a tablet discards it. Once all copies have been purged and acknowledged and the complete candidate is valid, the server atomically accepts. The tablet shows a data-free receipt only if its fields are approved as noncustomer data; accepted content cannot be downloaded again to tablets.

## Local data model and durability

Use SQLite as the durable draft store, not an evictable cache. Encrypt customer-bearing payloads using an approved per-inspection key scheme; encrypt attachment files too. Verify database/WAL/journal/temp and backup handling in D2. Never include inspection data in logs or crash reports.

| Local entity | Important fields and behavior |
| --- | --- |
| Inspection baseline | Stable server inspection ID, tenant/user scope, confirmed integer version, assignment and lifecycle state, pinned template, confirmed server payload. Payload is encrypted. |
| Draft/revision | Client-generated revision ID, baseline reference, local sequence, dirty fields and encrypted values, local validation, immutable signed/submitted snapshot hash when applicable. Maintain pending local edits separately from confirmed server data. |
| Outbox operation | Globally unique operation ID, actor and installation ID, local sequence, baseline version/snapshot, immutable patch, dependencies, persisted request fingerprint once sent, retry state, and acknowledgement. Encrypt customer-bearing request bodies. |
| Attachment | Client-generated ID, kind (photo/signature), encrypted file reference, byte length, content hash, upload/session/chunk state, owning revision, and server verification state. A signature also references its signed snapshot and declared signer. |
| Sync checkpoint | Scoped feed cursor, last confirmed server contact, schema/contract version, and worker state. It must advance in the same transaction as applying a change page. |
| Copy/cleanup state | Registered copy token/generation, freeze/cleanup request state, purge progress. Retain only approved noncustomer recovery metadata after purge. The authoritative copy registry is on the server. |

Persist a form edit, its draft revision, and its outbox/provenance entry in one transaction before acknowledging local save. Use durable transaction settings and measure their latency. For files, write encrypted temporary bytes, flush/close, atomically move to the private destination, then commit the manifest/outbox. Recovery sweeps orphan temporary/files and identifies missing manifests without deleting referenced unsynced evidence. A captured photo cannot be declared saved before both pieces are durable.

Serialize workers per inspection. Client UUIDs identify revisions, operations, and attachments without offline ID collisions; preserve existing server inspection IDs without assuming their format. Persist signed snapshots separately from the mutable draft. Compaction may batch unsent operations only if the required per-edit provenance and signing boundaries survive; never rewrite a request already sent. Database/schema upgrades are transactional and preserve queued work. Insufficient disk space must produce an actionable save failure, with the previous durable version intact.

## Server and synchronization contract

Extend existing REST APIs additively. The following describes required semantics, not existing routes.

1. **Preparation and changes.** An authorized preparation request transactionally registers a device copy and returns a consistent snapshot/version, template requirements, and scoped synchronization cursor. Do not release content before registration. A paged changes API uses an opaque ordered cursor, not per-record integer versions as a global sequence. Include edits, assignment/permission changes, acceptance/freeze state, and deletion tombstones. Every tablet read path, including feeds, refreshes, and legacy endpoints, must enforce registration/freeze rules and avoid returning accepted customer payloads; acceptance notifications carry only approved control metadata. Define cursor expiry: an expired cursor triggers a scoped snapshot refresh while preserving the outbox and its original bases.
2. **Mutation.** Send operation ID, immutable request fingerprint, expected integer version, actor/device context, schema/template version, and a patch. The server checks authorization and lifecycle, then atomically commits the patch, incremented version, audit event, and idempotency result. Every writer, including the web app, uses the same version discipline. Return the committed operation/result/version. A version mismatch returns the current version and conflict information without changing inspection data.
3. **Replay.** Repeating an authenticated operation ID with the identical request returns the original result, even if the inspection has since advanced. Reusing it for a different body is an error. Enforce uniqueness transactionally across worker restarts and concurrent requests. Keep deduplication records for the supported retry/recovery lifetime; if records must expire, reject old operations and provide a result/status reconciliation path instead of blindly applying them again.
4. **Client scheduling.** Upload independent binaries and pull changes as connectivity permits, then serialize inspection commits respecting dependencies. For multiple offline edits, compute each expected server version from the acknowledged predecessor; persist the exact request before first transmission. Do not guess successive versions when other writers exist. On timeout, retry the same request. Acknowledgement updates the confirmed baseline and outbox atomically while retaining newer unsent overlays. If a replay response is older than an already-pulled version, mark the operation acknowledged without regressing the baseline; refresh current state and review remaining operations against their retained bases. A crash after server commit but before local acknowledgement is safe.
5. **Error handling.** Back off transient/network/server errors with jitter and a bounded retry interval; honor server throttling. Unauthorized requests pause for sign-in, forbidden access locks work for recovery, conflicts require review, and validation/schema errors require correction. Cancellation of an HTTP attempt does not mean the server rolled it back. Do not classify permanent errors as successful or discard their payloads.
6. **Audit.** The server commit time is authoritative. Retain claimed offline edit time separately, with actor, device, operation ID, before/after or an equivalent reconstructable revision, versions, conflicts/resolutions, photo/signature hashes, submission, acceptance, and cleanup acknowledgements. Offline timestamps/claimed authorship are not trusted proof of actual time. Audit writes failing means the corresponding mutation fails. Restrict audit alteration/access and define retention under D9.

Recommended lifecycle: working draft → signed snapshot → submitted candidate → acceptance pending cleanup → accepted. Validation failure, conflict, or changed signed content returns the candidate to review and re-signing as necessary; it never becomes accepted automatically.

## Conflict and signature policy

Reject a stale record write even if the apparent changes are disjoint. Keep the encrypted local base and draft while retrieving the current authorized server version; show field-level differences and the author of server changes. Present long notes as whole-field alternatives rather than attempting a text editor merge. Resolving disjoint changes is a deliberate review in v1. If the common base is unavailable, require full comparison instead of inferring an ancestor.

Resolve or supersede the blocked operation using a new operation ID and current expected version; never change the body under an existing idempotency key. Archive the reviewed base/local/server alternatives and the chosen disposition as authorized server audit evidence before considering reconciliation complete. Every saved operation must be accounted for as committed or explicitly resolved; no unresolved branch may be purged just because another branch was submitted. A new server edit during review conflicts again.

Deletion, reassignment, freeze, template changes, and accepted state are lifecycle conflicts, not ordinary field conflicts. Stop the normal queue and invoke the relevant recovery/cleanup workflow. A freeze may be unknown to an offline tablet; retain its later saved edits for review when it reconnects. Reconciliation during acceptance uses explicitly authorized/versioned requests, never the ordinary edit path to bypass the freeze.

Photos have stable IDs; a retry is not another photo. Concurrent additions/removals still change the inspection manifest and require version review. Enforce the total 40-photo limit server-side across all writers and client-side for the local draft; excess concurrent additions remain pending for explicit selection, not silent dropping. Removing evidence retains its audit/hash and any server retention required by policy.

The signature records the signed projection's hash, template version, declared signer, capturing inspector/device, and capture-time provenance. Canonicalization must be specified and identical on tablet/server. Changes to any included form field, note, or attachment manifest invalidate the signature, including supervisor edits. The server recomputes and verifies the projection before submission/acceptance. Keeping an old signature image does not make it valid for a new revision. Signature capture is evidence collection; its legal adequacy is a D5 decision.

## Attachments

Capture into application-private encrypted storage; prevent gallery copies, thumbnail leakage, and backup copies. Include the signature in this protection. Decide evidentiary image format/metadata before capture; any approved resizing or metadata removal occurs before the immutable content hash and signature, and must not silently alter signed evidence.

Use resumable, authenticated uploads with a client attachment ID, declared length/hash, and acknowledged chunk offsets. Refresh expired upload credentials after reauthentication; never log upload URLs. Verify complete bytes/hash server-side before returning a verified blob reference. Uploading/finalizing binary staging does not by itself attach evidence to an inspection; the versioned manifest mutation does. Identical retries return the same object state. Reconcile expired sessions rather than counting a replacement upload as another photo.

Dependencies require verified photo/signature objects before their manifest/signature operations, and all signed content before submission. Text commits can proceed independently before a slow photo upload; the candidate remains incomplete until all dependencies match its frozen snapshot. Edits during upload produce a new revision and invalidate any affected signing intent. Staged unreferenced uploads receive a bounded server cleanup policy; uploaded evidence referenced by an accepted candidate is never treated as an orphan. Local files are retained until verified/reconciled and the approved purge workflow authorizes removal.

Capacity admission includes 40 photos at the chosen maximum size, signature, encryption overhead, temporary capture space, migration space, and all other prepared inspections. Enforce the configured reserve during capture, not only at preparation. Measure battery, resume behavior, and upload costs on real pilot hardware; tune chunk sizes/concurrency from those results.

## Security, acceptance, and the 24-hour requirement

Use authenticated transport, current server authorization on every operation, managed-device enrollment, approved at-rest encryption and key storage, and an expiring offline authorization grant. Bind stored data and outbox work to tenant, account, and installation. Lock on credential expiry/background timeout according to policy. Account switching must not expose another inspector's draft; pending work needs authorized drain/recovery before destructive logout. Device loss triggers managed response and registry reconciliation, but issuing a wipe command is not proof it executed.

**An ordinary app cannot react to acceptance it has not learned of or execute a wipe while powered off.** Starting a 24-hour timer when acceptance is next observed violates the stated deadline if acceptance happened earlier. Cryptographic erasure and physical deletion are also different standards. These are D1/D2 launch decisions, not details to defer to QA.

The recommended v1 protocol is an acceptance barrier:

1. Every delivery of tablet customer data registers the copy before content/key release; registration and acceptance-freeze acquisition serialize to prevent a download race. No accepted inspection is available for tablet preparation, and a frozen inspection cannot acquire a new copy.
2. A supervisor requests acceptance at a specific version. The server validates it and freezes ordinary edits. Track all existing copies, including managed copies left by migrations/reinstalls; never remove one merely because it is unreachable.
3. Each tablet reconnects, stops new edits, clears decrypted in-memory views, and reconciles all saved operations and attachment dependencies. Late offline work is reviewed explicitly. If the candidate changes, its signature is invalidated and the acceptance request is revised or canceled for re-signing; already purged tablets prepare again if further work is needed.
4. After review is complete, the tablet performs an idempotent, recoverable purge: inspection rows and payloads, outbox bodies, attachment/signature/thumbnail/temp files, keys, in-memory objects, and classified customer-bearing sync metadata. The approved method must address SQLite WAL/journal/free pages and OS caches/backups, not just DELETE statements. Persist only approved noncustomer cleanup progress. A crash resumes purge before displaying customer data.
5. Acknowledge completed purge to the server for the specific copy generation and cleanup job. Repreparation creates a new generation, so an old acknowledgement cannot clear a new copy. Lost acknowledgements are recoverable by repeating the server's cleanup job and confirming already-absent material; acknowledgements need not retain customer data on the tablet. The server atomically verifies every copy's acknowledgement, complete evidence, current version, and valid signature, then records acceptance and its audit event. Thus approved deletion precedes acceptance, satisfying the 24-hour upper bound with margin.

Keep the acceptance freeze until completion or explicit cancellation; deletion errors leave acceptance pending and alert operations. Unreachable tablets visibly block acceptance. New data access after purge requires fresh authorized preparation, and accepted records remain blocked. A lost tablet requires verifiable approved erasure or acceptance remains blocked. The server retains the authoritative inspection/evidence/audit according to the approved server retention policy.

If product requires immediate acceptance despite disconnected copies, the recommendation must change before implementation: evaluate a platform-enforced per-inspection access/key lease expiring within 24 hours of a server assertion that the record is still unaccepted, with clock-rollback resistance and compliance-approved cryptographic erasure. A lease would bound offline usability and still cannot promise physical deletion while powered off. An app timer, wall-clock comparison at next launch, or an unverified hardware capability is insufficient. No pilot acceptance path may bypass D1/D2.

## Migration and backfill

Deploy additive server contracts first, with compatibility for the existing client. Inventory only the legacy mobile cache/data behaviors needed for this feature during implementation; this plan assumes no repository investigation. Add the draft/outbox/attachment/checkpoint schema using a transactional, restartable migration. Version the schema and contract separately; reject an unsupported downgrade before it touches queued work.

Treat clean legacy cached records as baselines needing online authorization, fresh version/template validation, and copy registration before “Ready offline.” They are not proof of user intent. Preserve detectable unsynced legacy edits in encrypted recovery storage and require reconciliation; if their base version is unknown, do not fabricate it or upload as a fresh overwrite. Explicitly report any legacy work that cannot be recovered; this change cannot reconstruct notes already discarded before upgrade.

Backfill stable attachment identities/manifests and an audit baseline from actual existing server records/version metadata. Mark the baseline as a migration event; do not invent past edit history. Capture new authoritative audit events from the cutover onward for web and mobile. If historical retention obligations need more, D9 must supply a real source or resolve the gap before pilot.

Register existing tablet customer copies during enrollment, or purge and reprepare them before acceptance-enabled pilot use. Include old cache databases/files and existing backup policy in cleanup verification. Keep schemas additive through rollout, and verify old/new clients cannot bypass freeze, version, or acceptance rules. A successful upgrade preserves pending work and hashes; an interrupted upgrade restarts safely with enough reserved disk space.

## Observability and operational recovery

Track local durable-save failures, oldest pending operation age, pending bytes/count, last successful synchronization, retries/error classes, idempotency replay counts, conflict incidence/age, attachment checksum/resume failures, signature invalidations, submission latency, freeze duration, registered outstanding copies, purge failures, and acceptance-to-cleanup invariant violations. Distinguish expected offline queue age from failed synchronization after connectivity returns.

Use scoped opaque operation/correlation IDs and aggregated metrics. Do not log notes, customer names, signature images, photo contents, credentials, or raw payloads; review even IDs for customer association. Export diagnostics only through the authorized support path. Delayed telemetry from offline tablets means absence of an alert is not evidence of successful deletion; the acceptance registry is the enforcement mechanism.

Alert on accepted records without all cleanup acknowledgements, missing audit transactions, checksum mismatches, unrecoverable saved data, and stuck acceptance/purge jobs. Agree queue-age, retry, conflict, and performance thresholds in M0. Provide runbooks for reauthentication, version conflicts, failed uploads, low disk, expired cursors, interrupted migrations/purge, lost tablets, and pending acceptance. Operators can inspect server status and authorized provenance; they cannot silently overwrite or mark a wipe complete.

## Testing and verification

Run contract, migration, security, and device fault tests before field exposure. Validate invariants at each crash boundary, not just end-to-end success.

| Scenario | Required result |
| --- | --- |
| Lose signal during editing; kill/restart after local transaction acknowledgement | Every acknowledged edit returns; UI never reported unsaved work as saved. |
| Crash before/after photo file move or manifest commit; disk fills | Saved photos remain hash-identical; incomplete capture is reported; orphan recovery does not delete referenced evidence. |
| Server commits, response disappears; client/server restart; duplicate workers | Retry applies one effect and one commit audit event; original response can be reconciled; newer local edits survive acknowledgement. |
| An old replay acknowledgement arrives after a newer feed version | The operation is acknowledged once, the baseline never regresses, and remaining drafts keep their bases for review. |
| Supervisor and tablet edit same or different fields from one version | Stale write fails; base/local/server comparison is preserved; reviewed resolution is versioned/audited; a second race conflicts again. |
| Notes/photos/template change after signing; client/server canonicalization differs | Invalid signature cannot submit/accept; valid identical snapshots match; re-signing binds the new evidence. |
| Upload 40 photos and signature; repeated chunks, corrupt bytes, expired session, concurrent 41st photo | Resume preserves verified bytes, corrupt blobs never attach, retries do not inflate count, excess photo awaits selection, submission waits for complete dependencies. |
| Feed pages overlap, cursor expires, tombstone arrives, app crashes during page apply | No skipped committed change; checkpoint/application are atomic; refresh preserves local drafts; lifecycle/permission changes are enforced. |
| Token expires, account/tenant changes, tablet is revoked | Data is locked/scoped; no stale-authority upload or cross-account exposure; approved recovery is usable. |
| Acceptance requested while a tablet is offline or powered off for longer than 24 hours | Server stays pending; it cannot accept without confirmed approved purge. Reconnect preserves late work for review before cleanup. |
| One tablet purges, another reports late edits; acceptance is revised/canceled | Reviewed alternatives are archived, changed evidence requires re-signing, purged tablets must reprepare for new work, and no stale candidate is accepted. |
| Preparation races acceptance freeze; stale web client submits edits | Copy registration/freeze ordering is consistent; neither new copy delivery nor old-client writes bypass the barrier. |
| Crash during purge, acknowledgement lost, tablet storage/key deletion fails | Purge resumes before exposure, acknowledgements are idempotent, failure blocks acceptance, all storage locations meet D2. |
| Device clock rolls backward/forward; telemetry never arrives | Server time drives acceptance/audit; no client timer creates a false compliance claim. Test clock resistance if the lease alternative is selected. |
| Upgrade mixed/partial legacy caches with unsynced work; interrupt migration | Work is preserved or explicitly quarantined; no invented base/history; stale clean data is not called offline-ready. |
| Disable pilot flags with queued notes/photos/conflicts and pending cleanup | Workers, conflict recovery, server contracts, and purge continue; no downgrade or cache eviction destroys work. |
| Representative tablets under full permitted load and poor/flapping connectivity | Local latency, memory/disk, battery, resume behavior, and recovery meet the M0 workload and performance criteria. |

Use two-client/web concurrency fixtures and fault injection at every local/server transaction and attachment phase. Security verification inspects files, database sidecars, OS capture paths, backups, memory/session clearing, and redacted diagnostics against the approved deletion standard. Pilot UAT walks preparation → basement work → restart → intermittent sync → supervisor conflict → re-sign → submission → cleanup → acceptance, including a blocked-acceptance case.

## Milestones, dependencies, and acceptance criteria

No dates or headcounts are assumed. Completion is evidence-based; implementation starts only after M0's blocking decisions.

| Milestone | Dependencies | Reviewable output and acceptance criteria |
| --- | --- | --- |
| M0 — Decide and prove feasibility | None | Decision log for D1–D11; sample user flows, sync/audit contract, supported workload/performance thresholds, pilot/stop criteria. Discovery prototypes prove durable storage, signature canonicalization, and approved deletion on supported tablets. Product accepts offline preparation and acceptance delay. Unproven D1/D2/A3 blocks feature implementation. |
| M1 — Server foundations | M0 | Additive version/idempotency/audit, feed/tombstones, blob staging, registry/freeze/acceptance contracts. Duplicate/timeout/concurrent-writer tests pass; audit failure aborts commit; old web/mobile paths cannot bypass safety checks. No acceptance without all purge acknowledgements and valid evidence. |
| M2 — Durable tablet work | M0; stable M1 contract | Encrypted baseline/draft/outbox/file store, restartable migration, authorization lock, preparation readiness and local-save UI. Crash/disk/upgrade tests preserve acknowledged notes and evidence; uncached records stay unavailable offline. M1/M2 work may overlap only after contracts are agreed. |
| M3 — Synchronization and conflicts | M1 + M2 | Resumable worker, paged pull, retry/idempotent acknowledgement, three-way conflict UI and web compatibility. Intermittent connectivity and response-loss tests pass with no duplicate effects or overwritten drafts. Review/re-sign behavior is understandable in UAT. |
| M4 — Evidence, submission, cleanup | M3; verified blob foundation from M1 | 40-photo/signature flow, snapshot verification, upload dependencies, frozen acceptance reconciliation, full purge and acknowledgements. A complete offline inspection can become accepted; disconnected or failed-cleanup copies keep it pending. Security/compliance verifies D2 against actual storage. |
| M5 — Operational readiness | M4 | Fault suite, mixed-version migration/rollback rehearsal, privacy-reviewed metrics/alerts, runbooks, and support recovery pass. No unresolved safety invariant failure; agreed performance tests pass on pilot tablets. Rehearse a disablement while queues and acceptance jobs are active. |
| M6 — Controlled pilot | M5 | Enroll an explicitly allowlisted cohort and bounded assignments/devices. All are prepared and registered; exercise real basement and supervisor-conflict flows. Review each acceptance and audit/cleanup evidence. Meet D10 thresholds over the agreed observation/workload window, with no known safety failures. |
| M7 — Expand and maintain | M6 passes | Expand cohort in stages with health review at each stage; pause on regressions. Keep migration/compatibility and retention operations supported until old queues/copies are resolved. Broad rollout requires product, engineering, and compliance signoff on measured pilot results. |

## Staged rollout and rollback

Roll out server additions and protections first, then instrumented internal tablets, then the allowlisted pilot, then increasing cohorts. Gate preparation/offline capture separately from sync/cleanup support. For every enabled inspector, validate assignment, enrollment, free space, registered copies, and offline readiness before entering the field. Do not classify acceptance-pending cleanup as accepted in dashboards or user-facing messages.

Pause expansion and stop new offline enrollment/preparation if saved data is lost, audit or idempotency invariants fail, signatures bind incorrectly, authorization leaks occur, deletion cannot be verified, or agreed performance/support thresholds are exceeded. Investigate queued/conflicted work with the runbooks; retain it encrypted until resolved under approved policy.

Rollback stops new exposure while keeping installed-client upload, conflict resolution, blob resumption, audit, registry, freeze, and purge paths alive. Do not disable cleanup or acceptance protections. Keep additive server schema/contract support; drain or explicitly recover every queue before any database downgrade/removal. Do not revert tablets to a cache-only app while drafts exist. For a severe security incident, lock affected data and use the approved managed response, recording any authorized disposal rather than silently discarding work.

Resume rollout only after the root cause is fixed, the relevant fault tests pass, affected drafts/copies are accounted for, and M6's review gates pass again. Completion means a supported offline-to-acceptance flow with audit and cleanup evidence, not merely a successful upload on a connected tablet.
