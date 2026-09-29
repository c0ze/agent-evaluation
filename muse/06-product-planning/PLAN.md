# Offline inspection sync — Plan

## 1. Goal and context

Enable inspectors on company-managed tablets to complete assigned building
inspections fully offline — open assignment, fill forms, capture up to 40
photos, collect a signature — and sync reliably when connectivity returns
(intermittent or delayed), without losing notes.

Current state (per `BRIEF.md`): losing connection after opening an inspection
can discard notes. The mobile app has SQLite but uses it only as a
read-through cache. Server APIs are REST with integer record versions.
Supervisors can edit the same inspection from the web. Regulations require an
audit history and removal of local customer data within 24 hours after an
inspection is accepted. Product wants a pilot before broad rollout and
explicitly does not want a full collaborative editor.

This plan is the implementation blueprint. It makes no staffing or calendar
commitments.

## 2. Explicit assumptions

Assumptions are numbered so milestones, tests, and decisions can reference
them. Items marked **must-confirm** are in Section 13 as pre-implementation
decisions.

- **A1. Assignment model.** Inspections are assigned to one inspector at a
  time; reassignment is rare. Offline work is single-writer per inspection on
  the tablet side. Concurrent offline edits from two tablets on the same
  inspection are out of scope.
- **A2. Overlap with supervisor edits.** Supervisors edit from the web mainly
  status/metadata (assign, accept, reject, priority, due date, notes to
  inspector), and only occasionally inspection form answers. Field-level
  overlap during an active offline session is uncommon. **Must-confirm.**
- **A3. No real-time collaboration.** Product accepts that offline inspectors
  see a snapshot from last sync; they do not need live supervisor edits while
  offline, and supervisors do not need live inspector keystrokes. Sync
  converges on reconnect.
- **A4. Connectivity profile.** Offline periods last minutes to a full shift
  (basements, intermittent return). The protocol must assume sync can be
  interrupted mid-batch and resumed later; it must not assume a long stable
  window. **Must-confirm** (affects attachment strategy).
- **A5. Photo volume and size.** "Up to 40 photos" per inspection; tablet
  cameras produce multi-MB images. Originals must be preserved or a defined
  compressed equivalent accepted as the record. **Must-confirm.**
- **A6. Signature.** One signature per inspection, captured on-device,
  treated as a small binary attachment bound to a form version, not as
  editable text.
- **A7. Server versioning.** REST integer record versions are per-inspection
  (or per-record) optimistic-concurrency counters: a write with a stale
  version is rejected (e.g., 409) and the client must re-read and retry. The
  server can add idempotency keys and per-field audit metadata without a
  full rewrite. **Must-confirm.**
- **A8. Audit history.** "Audit history" means a server-side append-only log
  of who changed what field, when, from which device/client, sufficient for
  regulators; the tablet does not need to render full history offline, only
  to contribute accurate entries. **Must-confirm.**
- **A9. 24-hour local deletion.** "Removal of local customer data within 24
  hours after an inspection is accepted" applies to form content, photos,
  signature, and derived caches/thumbnails on the tablet, measured from the
  tablet learning of acceptance (or from acceptance server-side plus a bounded
  propagation window — decision required). MDM remote wipe exists as a
  backstop but is not the primary mechanism. **Must-confirm.**
- **A10. Device trust.** Company-managed tablets provide OS-level storage
  encryption, screen lock, and MDM inventory/wipe. The app adds its own
  encrypted store and does not rely on OS encryption alone for PII.
- **A11. Auth offline.** Inspectors authenticate while online; short offline
  grace (cached credentials / tokens) is acceptable to regulators and
  security, with re-authentication required for sensitive actions per policy.
  **Must-confirm.**
- **A12. SQLite stays.** The existing SQLite database can be migrated to a
  durable offline store (schema + outbox tables); no change of local database
  engine is needed.
- **A13. Pilot scope.** Pilot is a small set of inspectors/building types with
  cooperative supervisors, on the same server version as production (behind
  feature flags), not a fork.

## 3. User flow

### 3.1 Inspector (tablet)

1. **Before going offline (online).** Inspector sees assigned inspections.
   Opening (or explicitly downloading) an assignment pins it for offline:
   form schema, current answers, reference data, and record version are
   persisted. UI shows "Available offline" with last-synced time.
2. **Going offline.** Banner changes to "Offline — changes saved on this
   tablet." All input autosaves locally on every change (no save button as
   the only path; today's data-loss bug is fixed by making local persistence
   the source of truth for drafts).
3. **Offline work.** Fill forms (including required-field validation run
   locally), take up to 40 photos (queued with thumbnails), collect
   signature. Draft state, photo queue, and completion checklist are visible
   without connectivity. App restart, OS kill, or reboot loses nothing.
4. **Reconnect (intermittent or full).** Sync starts automatically and in the
   background; UI shows per-inspection status: `Not synced / Syncing (n/m
   photos) / Synced / Conflict needs review / Failed — will retry`. Inspector
   can keep editing during sync; new edits queue behind the in-flight batch.
5. **Conflict.** If a supervisor changed the same record while the inspector
   was offline, the inspector is shown a conflict screen: which fields
   differ, supervisor value vs. tablet value, and a guided choice (keep mine /
   take supervisor / merge per field where safe — see Section 6). No silent
   overwrite in either direction. Unresolved conflicts block "submit" but
   never block continued local editing.
6. **Submit / accept.** Inspector submits when complete (works offline; the
   submission is queued). Supervisor accepts on the web. Once the tablet
   learns of acceptance, a deletion countdown starts and local customer data
   for that inspection is purged within the 24-hour obligation (Section 8),
   leaving only a non-customer receipt (inspection ID, timestamps, sync
   status) if permitted.

### 3.2 Supervisor (web)

- Web shows sync/liveness per inspection: `tablet draft pending`,
  `last tablet sync`, `photos pending (n/m)`, `conflict`, so supervisors do
  not mistake a stale view for final.
- Supervisors can keep editing; if they edit a record with a pending tablet
  draft, the UI warns "inspector has unsynced changes; your edit may
  conflict" (best-effort, based on last known tablet state).
- Accept/reject remains a server-side transition; rejection returns the
  inspection to the inspector's queue with a reason, deliverable on next sync.

## 4. Scope boundaries

**In scope:**

- Offline open, edit, autosave, and resume for assigned inspections.
- Photo capture queue (40 per inspection), signature capture, background
  sync with resume.
- Conflict detection and guided resolution for the tablet-vs-web case.
- Audit events for offline-originated changes; 24-hour local purge after
  acceptance.
- Pilot instrumentation, feature flags, staged rollout, and rollback.

**Out of scope / non-goals:**

- Full collaborative/real-time co-editing (explicitly excluded by product).
- Multi-tablet concurrent offline editing of the same inspection.
- Offline supervisor workflows on tablet; offline reassignment; offline
  creation of new unscheduled inspections (unless D-decision says otherwise —
  default: not in pilot).
- General offline browsing of unassigned/history inspections beyond pinned
  assignments.
- New server framework or protocol replacement (e.g., WebSockets, CRDT
  service); the design extends REST + integer versions.

**Pilot exclusions (add after pilot only if validated):** bulk pre-download
of a week of assignments, offline reference-data search across all buildings,
background photo upload on metered connections beyond a cap.

## 5. Local data model (SQLite + file store)

Keep SQLite; promote it from read-through cache to durable store. All writes
go to SQLite first, then to an outbox.

Proposed tables (names illustrative; final schema in implementation design):

- `inspections` (one row per pinned assignment): `id` (server ID),
  `assigned_to`, `status` (local lifecycle: `pinned/draft/submitted/
  conflict/accepted-purge-pending/purged`), `form_schema_version`,
  `server_version` (last synced integer version), `local_revision`
  (monotonic local counter), `updated_at_local`, `last_synced_at`,
  `last_server_state_json` (snapshot for diff/conflict display),
  `acceptance_observed_at`.
- `form_answers`: `(inspection_id, field_key)` with `value_json`,
  `updated_at_local`, `updated_by`, `base_server_version`.
- `outbox_ops` (append-only queue): `op_id` (client UUID),
  `inspection_id`, `type` (upsert-field / submit / resolve-conflict),
  `payload_json`, `base_server_version`, `created_at`, `attempt_count`,
  `state` (pending/in-flight/acked/failed), `idempotency_key`.
  In-flight ops carry a lease so a crash returns them to pending.
- `attachments`: `attachment_id` (client UUID), `inspection_id`, `kind`
  (photo/signature), `local_path`, `byte_size`, `hash_sha256`,
  `capture_at`, `upload_state` (queued/uploading/parts-acked/complete/
  failed), `server_blob_id`, `form_version_binding` (for signature).
  Binaries live in an app-private encrypted file store; SQLite holds only
  metadata.
- `sync_state`: per-inspection cursor (`last_pull_version`,
  `last_push_ack`), backoff state, and conflict snapshot pointers.
- `audit_staging`: locally recorded change events not yet acked by the
  server (flushed as part of push; never the system of record alone).
- `purge_log` (non-customer): `inspection_id`, `accepted_at`,
  `purged_at`, `scope` — retained to prove 24-hour compliance.

Key rules:

- Every user edit is a synchronous local transaction (answer + outbox op +
  audit staging) before UI confirms. Crash-safe by construction.
- Photos are written to the file store and referenced by the outbox; a photo
  is never "saved" in UI until bytes + metadata are durable.
- Local data is keyed to survive app kill, reboot, and user switching
  inspections mid-draft.

## 6. Sync protocol

Constraints: REST + integer versions, intermittent connectivity, resumable
everything, idempotent everything.

- **Direction split.** Pull-then-push per inspection, per cycle:
  1. Pull: `GET /inspections/{id}?since={last_pull_version}` returns current
     server version, changed fields, supervisor transitions, and upload
     session state for attachments.
  2. Push: POST outbox ops in creation order, each with `base_server_version`
     and `idempotency_key` (client op UUID). Server applies if versions
     chain, else rejects with 409 + current server state.
- **Idempotency.** Server stores idempotency keys per inspection; retried
  POSTs return the original result without duplicating effects or audit
  entries. Required for at-least-once mobile retry.
- **Batching and resume.** Push in small batches (e.g., one field-batch +
  one attachment chunk-set per request; exact sizes tuned in pilot). Each
  batch is independently acked; on interruption the client resumes from the
  first unacked op. No "all or nothing" multi-photo transaction.
- **Ordering.** Field ops apply in client creation order per inspection.
  Attachment uploads are independent of field ops and can interleave, but
  `submit` is a barrier op: it applies only after all preceding field ops
  and required attachments for that inspection are acked.
- **Submit semantics.** `submit` carries the local revision and required
  checklist hash; server validates completeness against the authoritative
  schema version and either accepts (status transition + version bump) or
  rejects with machine-readable errors the tablet can render offline later.
- **Backoff and triggers.** Exponential backoff with jitter on failure;
  sync triggers on connectivity regain, app foreground, edit, periodic
  while online, and manual "Sync now." Never busy-loop on metered or
  flaky links; respect OS background limits.
- **Schema versioning.** Form schema is versioned; pinned inspections record
  the schema version they were opened with. If the server schema advanced
  during offline work, push includes the base schema version and the server
  either migrates forward (additive changes) or returns a
  migration-required response with instructions (breaking changes).

## 7. Conflict policy (no collaborative editor)

- **Detection.** Any push whose `base_server_version` no longer matches the
  server version is a conflict candidate. The server responds 409 with the
  current field values and their versions/authors; the client diffs against
  `last_server_state_json` to classify per-field: clean (only one side
  changed), true conflict (both changed to different values), or
  metadata-only.
- **Default resolution rules (proposed; confirm in D-decisions):**
  - Non-overlapping fields auto-merge (both sides' changes kept).
  - Same-value writes to the same field auto-resolve (no user action).
  - True field conflicts require explicit choice on the tablet (inspector
    keeps mine or takes supervisor), except a small denylist of
    supervisor-authoritative fields (e.g., accept/reject, assignment) that
    always resolve to the server value and are shown as read-only during
    conflict.
  - Photos and signature are append-only / replace-with-history: concurrent
    additions union; a replaced signature creates a new version rather than
    overwriting, with the old version retained server-side in audit.
- **Never lose data.** Losing side of a conflict is preserved in server audit
  and (until purge) in the tablet conflict snapshot, restorable by
  supervisor action.
- **UX.** One conflict screen per inspection listing each conflicting field
  with both values, author, and timestamp; "accept all supervisor" /
  "keep all mine" bulk actions plus per-field pickers; resolution itself is
  an outbox op (works offline after the conflict snapshot is known, applies
  on next push).
- **Server guardrails.** Supervisor web edits to an inspection with known
  pending tablet changes show a warning; accept/reject while tablet ops are
  unacked is either blocked or recorded as "accepted with pending tablet
  changes" per decision D4.

## 8. Attachments (photos + signature)

- **Capture.** Up to 40 photos per inspection (enforced locally with a clear
  counter). Each photo gets a client UUID, SHA-256, timestamp, and
  inspection binding at capture. Signature is one attachment bound to the
  form revision signed; editing signed fields after signing invalidates the
  signature locally and requires re-sign (configurable per compliance).
- **Storage.** App-private encrypted file store; originals retained until
  server ack (or per compression decision). Thumbnails derived locally for
  list views; thumbnails are part of the purge scope.
- **Upload.** Resumable chunked upload (e.g., client-initiated upload
  session per attachment, fixed-size chunks with per-chunk ack, whole-file
  hash verified server-side before marking complete). Retries resume at
  chunk granularity. Photo order does not matter; signature upload is
  prioritized after field ops.
- **Compression/quality (decision D3).** Either upload originals, or
  upload a defined compressed rendition as the record with originals
  discarded after ack. The choice affects storage, upload success on flaky
  links, and regulatory acceptance — must be decided with compliance before
  implementation.
- **Failure handling.** Failed attachments retry independently; an
  inspection can reach `Submitted` with attachments pending only if policy
  allows partial submit (default recommendation: submit requires all
  required attachments acked; optional photos may follow within a grace
  window — confirm).

## 9. Security

- **Encryption at rest.** SQLite + file store encrypted with keys in the
  platform keystore/keychain, unlocked on device unlock; per-inspection or
  per-file data keys so purge can be cryptographic erasure (destroy key +
  delete bytes).
- **Encryption in transit.** TLS; certificate pinning per company policy.
- **Auth.** Online login via existing IdP; short-lived access tokens with a
  bounded offline grace period (decision D6). Jailbreak/root detection and
  MDM compliance checks gate offline data access where policy requires.
- **24-hour purge.** On observing acceptance (push ack, pull, or push
  notification while online), record `acceptance_observed_at`, schedule
  purge, and delete form answers, photos, signature, thumbnails, outbox
  payloads, and audit staging for that inspection within the remaining
  window — including when the app is backgrounded (OS background task) and
  after reboot (purge check on launch). Retain only `purge_log` receipt.
  If the tablet stays offline past the window, purge on next launch/sync and
  record the delay as a compliance exception with telemetry.
- **Backstops.** MDM selective wipe for lost devices; supervisor-initiated
  remote revoke that queues a purge for next contact.
- **Audit.** Every mutation carries actor, device ID, client timestamp,
  base version, and op ID; server appends to the immutable audit log.
  Client clocks are untrusted for ordering — server timestamps are
  authoritative; client timestamps are informational.

## 10. Migration and backfill

- **Client migration.** Existing read-through-cache SQLite migrates in place:
  add outbox/attachment/sync/purge tables, backfill `server_version` from
  last cache metadata, and treat any unpersisted in-memory drafts as lost
  (one-time, disclosed in release notes — the new autosave prevents
  recurrence). Migration runs in a transaction with rollback to the old
  schema version on failure.
- **Server migration.** Additive changes only for pilot: idempotency-key
  store, per-field audit metadata, resumable upload sessions, conflict
  (409 + state) responses, `pending tablet changes` signals for web UI.
  No change to version semantics; no data rewrite.
- **Backfill.** No historical backfill of audit beyond existing records.
  In-flight inspections at rollout cutover sync normally on next contact;
  inspectors are asked to sync before updating the app (banner + release
  notes), but update without sync must not corrupt data (old cache rows are
  ignored, never pushed).
- **Downgrade.** App downgrade across the migration is unsupported during
  pilot; forward-rollback (Section 12) is the path.

## 11. Observability

- **Device telemetry (privacy-preserving).** Sync success/failure rates,
  conflict rate and resolution outcome, outbox depth and age, photo
  queue depth and chunk-retry counts, time-to-synced after reconnect,
  purge latency vs. 24-hour window, storage pressure, migration success.
  No customer PII in telemetry; IDs are inspection/op UUIDs only.
- **Server telemetry.** 409 rate by endpoint, idempotency replay rate,
  upload session completion rate, submit rejection reasons, audit write
  failures (alert), schema-migration fallback rate.
- **Inspector-facing.** Per-inspection sync status, last-synced time,
  pending counts, conflict entry point, purge countdown after acceptance.
- **Supervisor-facing.** Pending-tablet-changes and conflict badges,
  last-tablet-sync timestamps.
- **Pilot dashboards and alerts.** Daily pilot review of sync success,
  conflict rate, attachment completion, purge compliance, and crash-free
  sessions; alerts on purge-window breaches, audit gaps, and sync stalls
  (outbox age beyond threshold).

## 12. Staged rollout and rollback

- **Stage 0 — Internal validation.** Team devices on lab networks with
  scripted offline/chaos cases; all acceptance criteria in Section 14
  exercised; no customer data beyond fixtures.
- **Stage 1 — Pilot.** Small inspector cohort + paired supervisors, feature
  flags per device/inspection type; server changes behind flags with old
  behavior default. Entry criterion: Stage 0 acceptance green. Exit
  criterion: pilot success thresholds (Section 14) met over a sustained
  window plus supervisor sign-off.
- **Stage 2 — Broad rollout.** Progressive enablement by team/region with
  pause criteria (purge breach, spike in 409s/unresolved conflicts, upload
  completion drop, crash regression). Each step is reversible via flags.
- **Rollback.**
  - Server: flags revert to pre-offline behavior; in-flight upload sessions
    drain or expire; unacked tablet outbox ops remain queued and retry
    against the reverted API only if the API contract is unchanged —
    otherwise they hold with clear UI until re-enabled (never silently
    dropped).
  - Client: forward-fix preferred; if a client build must be pulled, MDM
    holds the rollout and affected tablets keep local drafts intact (no
    wipe on rollback). Downgrade across the SQLite migration is not
    supported; recovery is via fixed build, not data deletion.
  - Data safety invariant: rollback never deletes unacked tablet drafts or
    unacked photos; purge obligations still apply to accepted inspections.

## 13. Testing

- **Unit.** Outbox state machine (pending/in-flight/acked/failed + lease
  expiry), conflict classifier (clean/auto-merge/true-conflict), purge
  scheduler math, chunk resume logic, idempotency-key handling.
- **Integration (client + API contract).** Pull-push cycles against a fake
  server implementing version/integer + 409 semantics; replayed idempotency;
  submit barrier with missing attachments; schema-version migration paths.
- **Persistence/crash.** Kill -9 / reboot at every point (mid-edit,
  mid-photo, mid-chunk, mid-batch, mid-purge); assert zero draft loss and
  correct resume. Downgrade-block and migration-failure rollback cases.
- **Network chaos.** Scripted flaky/intermittent profiles (drop mid-batch,
  reorder, duplicate POSTs, long offline then burst reconnect); duplicate
  delivery must not duplicate effects or audit entries.
- **Conflict matrix.** Supervisor-edits-field × inspector-edits-same-field,
  supervisor-accepts-while-tablet-pending, rejection-with-pending-draft,
  signature-invalidated-by-post-sign-edit, schema-bump-mid-offline — each
  with expected UI and server end-state.
- **Attachment stress.** 40-photo inspections at max camera size on
  low-storage devices; chunk resume after hours offline; hash-mismatch and
  corrupt-chunk recovery.
- **Security/compliance.** Encrypted-store verification, token-grace
  enforcement, purge-scope tests (bytes + thumbnails + caches gone; receipt
  retained), purge-after-long-offline exception path, audit completeness
  (every applied op has exactly one entry).
- **Field/pilot testing.** Real basements with real dead zones; supervised
  pilot with daily telemetry review; supervisor usability of conflict and
  pending-change warnings.
- **Regression.** Existing online-only flows unchanged when flags are off;
  read-through-cache behavior preserved for unpinned inspections.

## 14. Milestone sequence with dependencies and acceptance criteria

No calendar dates. Each milestone lists dependencies and the acceptance bar
that gates the next. Order is intentional; M2–M4 can overlap in design but
land in sequence.

- **M1. Local durability (no sync yet).**
  Dependencies: decisions D1–D3 (draft model, conflict defaults,
  photo policy) to avoid rework; none otherwise.
  Acceptance: edits autosave to SQLite transactionally; kill/reboot loses
  nothing; 40-photo queue + signature persist locally; purge-table schema
  present but inert; unit + crash tests green.

- **M2. Pull + pin for offline.**
  Dependencies: M1; decision D5 (schema migration rule).
  Acceptance: assignments pin with schema + version snapshot; "available
  offline" and last-synced UI; stale-schema and unpinned-access handling;
  integration tests for pin/refresh/evict green.

- **M3. Push with idempotent outbox + conflict v1.**
  Dependencies: M2; server idempotency + 409-with-state (decision D2
  shapes the contract); decision D4 (accept-with-pending rule).
  Acceptance: ordered push with resume; duplicate POSTs produce one effect
  and one audit entry; conflict screen with per-field choice;
  supervisor-authoritative denylist enforced; conflict matrix tests green;
  no silent overwrites in either direction.

- **M4. Resumable attachments + submit barrier.**
  Dependencies: M3; decision D3 (original vs. compressed record).
  Acceptance: chunk-resume upload with hash verification; 40-photo stress
  passes on low-storage devices; submit blocked until required uploads ack
  (per policy); signature binding + post-sign-edit rule enforced.

- **M5. Purge, audit, and security hardening.**
  Dependencies: M3–M4; decisions D6–D7 (offline auth grace, purge clock).
  Acceptance: acceptance triggers purge scheduling; all customer bytes
  (answers, photos, signature, thumbnails, caches) gone within the window
  including after reboot/background; `purge_log` receipts retained;
  long-offline purge-delay exception path tested; audit completeness
  verified; encrypted-store and token-grace tests green.

- **M6. Observability + supervisor surfaces.**
  Dependencies: M3–M5 (events to observe).
  Acceptance: device + server dashboards live; inspector sync states and
  supervisor pending/conflict badges shipped; pilot alerts (purge breach,
  sync stall, audit gap) firing on synthetic faults.

- **M7. Pilot.**
  Dependencies: M1–M6; pilot cohort and flag plan; decision D8 (pilot
  success thresholds).
  Acceptance: pilot entry checklist green (flags, rollback runbook,
  support channel); sustained window meeting D8 thresholds; zero purge
  breaches; supervisor sign-off; go/no-go for broad rollout recorded.

- **M8. Broad rollout + hardening.**
  Dependencies: M7 go decision.
  Acceptance: progressive enablement with pause criteria monitored; rollback
  drill executed at least once in production-like conditions; post-rollout
  review captures conflict-rate, upload-completion, and purge-latency data
  for follow-ups (e.g., widening offline scope).

## 15. Decisions required before implementation (with recommendations)

| ID | Decision | Recommendation | Why |
|----|----------|----------------|-----|
| D1 | Offline draft model: autosave-every-change vs. explicit save? | **Autosave every change locally** as the source of truth for drafts. | The brief's core complaint is discarded notes; explicit-save preserves the failure mode. Autosave + outbox is the standard fix. |
| D2 | Conflict default: who wins true field conflicts, and which fields are supervisor-authoritative? | **Inspector chooses per field; accept/reject + assignment always server-wins** (denylist). Auto-merge non-overlapping and same-value writes. | Avoids silent loss without building a collaborative editor; keeps status transitions authoritative where safety demands it. |
| D3 | Photo record: original bytes or defined compressed rendition? | **Ask compliance; default to compressed rendition as the record** (stated resolution/quality floor) if permitted, else originals. | 40 originals over intermittent links is the main upload risk; a defined rendition sharply improves completion rates. Do not compress silently — record the policy. |
| D4 | Supervisor accept/reject while tablet changes are pending: block, warn, or allow? | **Warn + allow with "accepted with pending changes" state; block only final archival until tablet converges or supervisor overrides explicitly.** | Blocking every accept on tablet sync stalls supervisors; silent allow risks accepting stale state. The middle path preserves velocity with visibility. |
| D5 | Form-schema bump mid-offline: auto-migrate or force re-sync? | **Auto-migrate additive changes; require guided re-sync for breaking changes** (never silently drop answers). | Additive bumps are common and safe to migrate; breaking changes need human eyes. |
| D6 | Offline auth grace: how long can a cached login authorize offline work? | **Bounded grace (illustrative: one shift), then re-auth required; sensitive actions (signature, submit) require recent auth.** Confirm exact bound with security/compliance. | Balances basement usability against lost-device risk; exact bound is a policy call, not an engineering guess. |
| D7 | Purge clock: from server acceptance or from tablet observation? | **Server acceptance starts the obligation; tablet purges within 24h of observation and reports delay as a compliance exception if observation was late.** Confirm with legal/compliance. | Tablets cannot act on what they cannot see; the exception path makes the gap auditable instead of silent. |
| D8 | Pilot success thresholds: what earns broad rollout? | **Pre-commit numeric gates** (e.g., sync success, attachment completion, conflict-resolution rate, purge compliance, crash-free sessions) agreed with product before M7. | Prevents moving goalposts; thresholds must exist before pilot data arrives. Values, not the practice, are the open item. |

## 16. Risks (pointer)

The three riskiest assumptions — supervisor/inspector edit overlap, photo
upload under intermittent connectivity, and the 24-hour purge clock — are
analyzed in `RESPONSE.md`. This plan mitigates each (guided conflicts,
resumable uploads + compression decision, purge scheduler + exception path)
but cannot eliminate them without the D-decisions above.
