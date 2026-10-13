# Plan — Offline Work for Tablet-Based Building Inspection App

> **Source:** `BRIEF.md` only. No other product input assumed.
> **Status:** Pre-implementation plan. No dates or staffing estimates are given — sequencing is expressed as dependencies and exit criteria, because the brief provides no team size, velocity, or deadline data to justify them.

---

## 1. Purpose and goals

Inspectors on company-managed tablets work in basements with no signal. Today a lost connection after opening an inspection can discard notes. This plan adds durable offline work:

1. **No lost work:** once an inspector opens an assigned inspection, notes, form entries, photos, and signature survive connectivity loss, app restart, and (within device limits) app crash.
2. **Full offline task:** open assigned inspections, fill forms, take up to 40 photos, and collect a signature entirely offline.
3. **Opportunistic sync:** when connectivity returns — even intermittently — changes upload safely and download supervisor changes, without duplication or silent overwrite.
4. **Regulatory compliance:** full audit history; local customer data removed within 24 hours after an inspection is accepted.
5. **Pilot-first:** ship to a small pilot cohort, measure, then broaden. Explicitly **not** a full collaborative editor.

### Non-goals

- Real-time / multi-user collaborative editing of a single inspection.
- Offline creation of *unassigned* inspections or ad-hoc inspections (unless Decision D-03 says otherwise).
- Offline supervisor workflows — supervisors stay on web, online.
- Replacing REST APIs or the integer record-version scheme.
- Supporting personal/BYOD devices in the pilot.

---

## 2. Explicit assumptions

Every downstream section depends on these. Each is marked **[validate]** with how to confirm it before or during the pilot.

| ID | Assumption | If wrong | Validate by |
|---|---|---|---|
| **A-01** | Inspectors know their assigned inspections before entering a no-signal area, and have a connected moment (depot Wi-Fi, start of shift) to pre-download them. | Inspectors dispatched ad hoc underground can never start work. | Interview dispatch/inspectors; log assignment-to-arrival gaps. **[riskiest — see RESPONSE.md]** |
| **A-02** | Tablet storage and battery can hold a full day's assigned inspections plus up to 40 photos each, and photos can be captured at a resolution the sync window can move. | Devices fill mid-day; uploads never finish; purge deadline missed. | Measure real photo sizes and assigned-inspections-per-day on managed devices. **[riskiest]** |
| **A-03** | Server REST APIs with integer record versions can be extended with conditional writes (version-checked PATCH/PUT) and idempotency keys without a breaking API rewrite. | Offline edits silently overwrite supervisor edits; duplicates on retry. | API spike against the current endpoints in Milestone M0/M1. |
| **A-04** | Supervisor edits to an inspection an inspector is editing offline are the exception, not the norm, and a simple per-field / per-section conflict policy (not OT/CRDT) is acceptable. | Frequent same-field collisions make manual resolution a daily burden. | Audit edit-overlap rate from server history before the pilot. **[riskiest]** |
| **A-05** | Devices are company-managed (MDM), so the app can rely on device encryption, remote wipe, enforced OS/app updates, and a managed app-data purge. | Purge and at-rest security guarantees weaken sharply on unmanaged devices. | Confirm MDM enrolment and wipe APIs for the tablet fleet. |
| **A-06** | Signatures captured offline (image + timestamp + inspector identity bound to the record) are legally acceptable; confirmed before launch. | Offline signature feature blocked or rework required post-build. | Written confirmation from compliance/legal. |
| **A-07** | Inspectors have an authenticated session (token or offline PIN) whose lifetime covers a full offline shift. | Inspectors locked out underground; work cannot be attributed for audit. | Check current token TTL vs. longest expected offline duration. |
| **A-08** | `Accepted` is a server-side state set by a supervisor; the 24-hour purge clock starts at server acceptance time (not local completion time). | Clock ambiguity breaches the 24-hour regulation. | Compliance confirms the clock start (see Decision D-06). |
| **A-09** | Existing SQLite DB on device contains cache data only — no unsynced user work — so migration can rebuild or discard cache rows safely. | Migration destroys the only copy of inspector work. | Inspect current cache write paths; confirm no local-only writes exist. |
| **A-10** | Intermittent connectivity returns at least once within the retention window for most inspections (e.g., end of shift), so the outbox drains before storage pressure or purge risk. | Outboxes grow unbounded; accepted-inspection purge races unsynced uploads. | Pilot telemetry on time-to-first-sync and outbox age. |

---

## 3. User flow

### 3.1 Roles

- **Inspector** (tablet, often offline) — performs inspections.
- **Supervisor** (web, online) — reviews, edits, accepts.
- **System** (server) — source of truth for accepted state and audit history.

### 3.2 Happy path

1. **Start of shift (online):** inspector opens the app, authenticates, and sees assigned inspections. The app pre-downloads each assigned inspection: form definition, current field values, reference data, and server version. UI shows a per-inspection "Ready offline ✓" state only after the download completes. *Mitigates A-01 partially: readiness is visible, not assumed.*
2. **Entering the field (offline):** inspector opens a downloaded inspection from local SQLite. All editing is local-first: every keystroke/selection is persisted transactionally before the UI confirms it. Connection loss is a non-event — there is no "unsaved" state to discard.
3. **Capture attachments:** up to 40 photos per inspection, captured into app-private storage with metadata (hash, timestamp, order). A counter (`n / 40`) is always visible; the signature step collects a drawn signature image plus signer name/role, timestamp, and an attestation checkbox.
4. **Intermittent connectivity:** when a network appears, a background sync pass drains the outbox (see §5) oldest-first, resumable if the connection drops mid-pass. The inspector sees per-inspection sync state: `Saved on device`, `Syncing…`, `Synced`, `Needs review` (conflict), never a spinner blocking editing.
5. **Completion:** inspector marks the inspection *Complete on device*. It remains editable locally until the supervisor accepts it (or until a defined lock point — Decision D-04).
6. **Supervisor review (web):** supervisor sees synced data, may edit, then **Accepts**. Acceptance is the terminal regulatory event: server records it in the audit history and starts the 24-hour local-purge clock (A-08).
7. **Purge:** the tablet, on next sync (and via a local scheduled check), deletes all local customer data for the accepted inspection and confirms deletion back to the server (see §7, §8). Until deletion is confirmed, the server flags the device as purge-overdue after 24 hours (see §10).

### 3.3 Edge flows

- **Not downloaded, no signal:** inspection is listed (if assignment metadata arrived earlier) but clearly marked "Not available offline." The inspector cannot start it; no partial form is created.
- **Conflict on sync:** inspection enters `Needs review` state with a per-field resolution screen (§6). The local work is never discarded automatically.
- **Rejected / changes requested by supervisor:** inspection returns to the inspector at next sync with supervisor comments; it is not purged.
- **Device lost/stolen:** MDM remote wipe; server marks device records un-synced and reassigns inspections (A-05).
- **Storage low:** capture blocks new photos with an explicit warning *before* the limit, and prompts a sync at the next connection (A-02).

---

## 4. Scope boundaries

### In scope (pilot → general)

| Area | Scope |
|---|---|
| Pre-download | Assigned inspections + form definitions + required reference data |
| Offline edit | All form fields on assigned inspections; notes |
| Attachments | ≤ 40 photos/inspection; one signature block (image + metadata) |
| Sync | Push/pull, conflict detection and manual resolution, retry/resume |
| Compliance | Audit history, 24-hour post-acceptance local purge |
| Rollout | Pilot cohort, staged expansion, kill switch (§11) |

### Out of scope (explicitly)

- Collaborative/real-time editing, presence, cursors, OT/CRDT (per brief).
- Offline creation of inspections not assigned to the inspector (pending D-03).
- Offline access to full customer history, billing, or unrelated records — least-data principle; only assigned inspection payloads are downloaded.
- Video, audio notes, document uploads (only photos + signature).
- Changes to the supervisor web editing experience, beyond surfacing sync/conflict state and acceptance-triggered purge status.
- iOS/phone form factors unless the managed fleet includes them (confirm in M0).

---

## 5. Local data model

SQLite evolves from a read-through cache into the **local source of truth for in-progress work**. The server remains the system of record for accepted inspections.

### 5.1 Principles

- Every local edit is a committed transaction before UI acknowledgement; the app never holds the only copy of work only in memory.
- Sync state is data, not UI state: every entity carries enough metadata to sync, detect conflicts, and purge without inference.
- The DB is versioned (`PRAGMA user_version` / migrations table) from the first offline release; the cache-era schema is migrated, not extended ad hoc (see §9).

### 5.2 Core tables (logical)

| Table | Contents | Key fields |
|---|---|---|
| `inspections` | Local copy of each downloaded inspection | `id`, `server_version` (integer, last synced), `local_status` (`downloaded/in_progress/complete_on_device/syncing/needs_review/synced/accepted_pending_purge`), `assignee_id`, `downloaded_at`, `purge_due_at` (nullable) |
| `field_values` | Current local value per form field | `inspection_id`, `field_id`, `value`, `updated_at`, `origin` (`local/server`), `dirty` flag |
| `field_history` (local audit) | Append-only local change log feeding the server audit history | `id`, `inspection_id`, `field_id`, `old_value`, `new_value`, `actor_id`, `device_ts`, `server_ts` (null until synced), `op_id` (idempotency key) |
| `attachments` | Photo and signature metadata; binary files on disk in app-private storage | `id`, `inspection_id`, `kind` (`photo/signature`), `file_path`, `sha256`, `byte_size`, `width/height`, `captured_at`, `upload_status` (`pending/uploading/uploaded/failed`), `server_id` (nullable), `sort_order`, signer metadata for signatures |
| `outbox` | Ordered, durable queue of unsent operations | `op_id` (UUID, idempotency key), `inspection_id`, `op_type` (`field_update/attach/complete/...`), `payload_ref`, `base_server_version`, `created_at`, `attempts`, `last_error`, `next_retry_at` |
| `sync_state` | Per-inspection and global cursors | `inspection_id`, `last_pulled_version`, `last_pushed_at`, `last_error` |
| `reference_data` | Versioned picklists/form definitions needed offline | `kind`, `version`, `payload`, `fetched_at` |
| `purge_log` | Proof of local deletion for compliance | `inspection_id`, `accepted_at`, `purged_at`, `method`, `confirmed_to_server` |

### 5.3 Notes

- **Form definitions are versioned and pinned to the inspection at download time** so a mid-shift server form change cannot corrupt an in-progress offline form; a newer form applies to the next download.
- Attachments are files, not BLOBs (streaming, hashing, resumable upload, cheaper purge); SQLite holds only metadata. A periodic reconciler detects orphan files / missing files.
- All timestamps store UTC; device clock skew is handled by recording device time and server time separately, and ordering sync by `op_id` + per-inspection sequence, not wall clock alone.
- Retention: `field_history` rows are deleted locally only after server acknowledgement; `purge_log` holds no customer data (IDs and timestamps only) so it can outlive the purge.

---

## 6. Sync protocol

Built on existing REST + integer record versions (A-03). No new transport.

### 6.1 Push (tablet → server)

1. Sync triggers: connectivity regained, app foreground, manual "Sync now", and a periodic check while online. Editing never waits for sync.
2. The outbox drains per inspection, in recorded order. Each request carries: `op_id` (idempotency key, server deduplicates retries), `base_server_version` (the integer version the edit was made against), and the field changes / attachment references.
3. **Conditional write:** the server applies the update only if `base_server_version` matches the current server version (or, under the field-level policy in §7, if the *touched fields* are unchanged since that version). On match, the server increments the version and returns the new version; the tablet clears the outbox entries and updates `server_version`.
4. **Retry:** exponential backoff with jitter, durable `next_retry_at`; a dropped connection mid-pass leaves the outbox intact — resume sends the same `op_id`s, so no duplicates.
5. Completion (`Complete on device`) is itself an outbox operation, sent only after all prior ops for that inspection succeed.

### 6.2 Pull (server → tablet)

1. On each sync pass, the tablet requests changes since `last_pulled_version` per inspection (and any reassignments, rejections, or acceptances).
2. Clean local state → apply server values, advance `server_version`.
3. Dirty local state → do **not** apply blindly; hand to the conflict policy (§7).
4. Acceptance notices trigger the purge flow (§8); reassignment/rejection notices update `local_status` and surface comments.

### 6.3 Attachments sync

- Photos upload after field data for the same inspection (a form without photos is reviewable; photos without a form are not). Upload is resumable at the file level: the app checks which `sha256`s the server already has, uploads only missing files, and finalises with a manifest (ordered list of hashes). Chunked/resumable upload if observed photo sizes require it (Decision D-05).
- Download: the tablet does not re-download its own uploaded photos; supervisor-added attachments (if any) download as thumbnails-first.

### 6.4 Safety properties

Idempotent push (safe retry), version-checked writes (no silent overwrite), ordered per-inspection application, and a per-inspection sync state machine that is always recoverable after app kill: on launch, any `syncing` state older than the current process is reset to `pending`.

---

## 7. Conflict policy

Full collaborative editing is out of scope (brief). Conflicts arise only when a supervisor edits an inspection that has unsynced local edits.

### 7.1 Detection

A push or pull where `server_version ≠ base_server_version` for the inspection is a *potential* conflict. It becomes a *real* conflict only if the same field was changed on both sides since the base version — so the server must retain, per version, which fields changed (field-level change metadata), or the client and server exchange changed-field lists for comparison.

### 7.2 Resolution (recommended defaults; confirmed by D-02)

| Case | Policy |
|---|---|
| Server changed different fields than inspector | **Auto-merge.** Apply both; no user involvement. Expected to be the overwhelmingly common case (A-04). |
| Same field, both changed, inspector value is a note/free text | **Both retained for review.** Inspector's value stays as the working value; supervisor's is shown alongside. Neither is silently dropped. |
| Same field, both changed, structured value (picklist, number, pass/fail) | **Manual choice required.** Inspection enters `Needs review`; inspector (or supervisor, per D-02) picks per field. Default highlighted value: the inspector's, since it reflects on-site observation — but never auto-applied for pass/fail safety fields. |
| Supervisor changed form structure / rejected the inspection | **Server wins on structure; local values preserved** and mapped where field IDs still exist; orphaned values shown in the review screen, never discarded. |
| Inspection accepted by supervisor while local edits unsynced | **Server wins terminally.** Local edits are exported into an "unsynced changes" record shown to both parties and appended to the audit history; the purge clock still runs only when any local customer data has been preserved in that server-side record (§8 guardrail). |

### 7.3 Guardrails

- No silent overwrite in either direction, ever. Every conflict outcome (including auto-merges) is written to the audit history with both values and the resolution.
- Resolution happens on the tablet at next connection (or on web, per D-02); work is never blocked offline by a conflict that hasn't been detected yet.
- If pilot data violates A-04 (same-field conflicts are common), revisit scope before broad rollout — that is a pilot exit criterion (§11), not a post-launch fix.

---

## 8. Attachments

| Aspect | Plan |
|---|---|
| Limit | Hard limit of 40 photos per inspection, enforced at capture with a visible counter; the 41st capture is blocked with an explanation, not queued. |
| Capture | Camera via OS intents or in-app capture into app-private internal storage (not the shared gallery). Stamp capture metadata: timestamp, inspection, order, hash at write time. |
| Size | Capture/compress at a resolution set by photo-size measurement in M0 (A-02; Decision D-05). Store original only if legal/quality review requires it (Decision D-07); otherwise store the compressed file only, and record the policy in the audit history. |
| Signature | Signature image + signer printed name/role + timestamp + attestation, bound to the inspection version; stored and synced as a special attachment kind. Cannot be edited after completion on device — only retaken (retake replaces, and the replacement is audited). |
| Upload | Hash-first deduplication, resumable, background-capable, ordered after form data (§6.3). Partial uploads survive app kill and connection loss. |
| Failure | An attachment that fails repeatedly surfaces in the inspection's sync card with a per-file retry; the inspection cannot be marked *Synced* until every attachment is `uploaded` or explicitly removed by the inspector (removal is audited). |
| Purge | Attachment files for an accepted inspection are deleted with the rest of the local customer data (§9); deletion includes temp/export copies, verified by the reconciler scanning for the inspection's file paths and hashes. |

---

## 9. Security, privacy, and compliance

- **Device trust (A-05):** pilot is managed tablets only. MDM provides device encryption, remote wipe, and OS patch level; the app checks management state on launch and refuses offline customer data on unmanaged devices.
- **Encryption at rest:** SQLite database and attachment files encrypted at rest (e.g., SQLCipher or OS file-level encryption keyed via platform keystore — Keychain/Keystore), with the key never in the database or app bundle. Managed-device full-disk encryption is a second layer, not the only layer.
- **Authentication offline (A-07):** cached credential / device PIN unlocks the app offline; server tokens are refreshed on sync, never block offline work mid-shift, and offline unlocks are audit-logged. Token material stays in the platform keystore.
- **Least data:** only assigned inspections are downloaded; no customer-wide search or history offline. Data minimisation also shrinks the purge surface.
- **Audit history (regulatory):** every field change, attachment add/remove, signature, completion, conflict resolution, and purge is an audit event: actor, device timestamp, server timestamp, old/new values, and (for resolutions) both candidates. Events sync to the server, which is the authoritative audit store; local audit rows are retained until server acknowledgement.
- **Purge ≤ 24 hours after acceptance (A-08):** on learning of acceptance (next sync or scheduled check), the app deletes: field values, history payload values, attachment files, signature, and cached customer identifiers for that inspection, then writes a `purge_log` entry (IDs/timestamps only) and confirms to the server. If the device is offline past the deadline, purge executes locally on the acceptance knowledge it already has; any device that has not confirmed purge within 24 hours of acceptance is flagged purge-overdue on the server dashboard and at next contact. Downloaded-but-never-opened inspections purge the same way.
- **Transport:** TLS as today; no customer data in URLs, analytics, or crash reports (§10).
- **Signature integrity:** signature attachment hash is computed at capture and recorded in the audit log so post-capture tampering is detectable.

---

## 10. Migration and backfill

### 10.1 App / schema migration

1. Ship a new SQLite schema version with migrations: create the new tables (§5), mark the cache-era tables as rebuildable cache.
2. On upgrade: back up the existing DB file, run migrations transactionally, verify row counts and integrity, then delete the backup. On migration failure: restore the backup, fall back to online-only mode, and report (never leave a half-migrated DB; never lose data — A-09 says cache-era data is rebuildable from the server, so the worst case is a re-download).
3. Cache-era rows are re-fetched from the server as proper pinned downloads on first post-upgrade sync; nothing cache-era is treated as inspector work.

### 10.2 Backfill

- **Assigned inspections:** on first run of the offline build, already-assigned inspections are pre-downloaded in the background (with progress UI) so inspectors are not surprised on day one.
- **Server side:** the server must backfill per-field change metadata (which fields changed per version) for in-flight inspections where feasible, so conflict detection (§7.1) works for inspections downloaded before launch; where not feasible, conservatively treat any version mismatch on those inspections as field-level-unknown and route to manual review for the first sync only.
- **Audit history:** no historical backfill is fabricated. Audit coverage starts at offline launch; the history records this boundary explicitly ("audit begins at offline-feature enablement") rather than implying earlier coverage.

---

## 11. Observability

### 11.1 Signals (no customer data in any signal)

| Signal | Purpose |
|---|---|
| Sync pass: started/completed/failed, duration, ops pushed/pulled, bytes | Baseline health; detect sync stalls |
| Outbox depth and age of oldest op (per device, aggregated) | Detect stuck inspectors before data ages out (A-10) |
| Conflict rate: per inspection, auto-merged vs. manual vs. same-field | Validate A-04; pilot exit criterion |
| Attachment upload failures, retries, time-to-complete per inspection | Validate A-02 / D-05 sizing |
| Purge: accepted → purged duration distribution, overdue count | Regulatory compliance proof |
| Offline edit sessions, time from download → first sync | Validate A-01 / A-10 behaviour |
| Client errors: migration failures, DB integrity, orphan-file reconciler findings | Migration safety |
| App version / schema version distribution | Staged rollout control |

### 11.2 Tooling

- Structured client telemetry flushed on sync; a server dashboard for the pilot cohort covering the rows above; alerts on: purge-overdue > 0, outbox age above a pilot-calibrated threshold, conflict-rate spike, migration failure rate above zero for two consecutive days.
- Every inspector-visible sync state is backed by the same state machine used in telemetry, so support can map a screenshot to server-side data without asking for customer data.
- Support diagnostics: an opt-in, inspector-triggered "send diagnostics" bundle (versions, sync state, logs with customer data redacted) for pilot issues.

---

## 12. Staged rollout and rollback

### 12.1 Stages (each gated by exit criteria, not dates)

| Stage | Audience | Entry | Exit criteria |
|---|---|---|---|
| **S0 Internal** | Team devices, test inspections | M3 complete (§13) | No data-loss in fault-injection testing; migration suite green |
| **S1 Pilot** | Small named pilot cohort of inspectors (volunteer crews), real inspections | S0 exit; support runbook ready; purge dashboard live | §13 M5 acceptance criteria; zero unresolved purge-overdue; conflict-rate within the A-04 expectation |
| **S2 Expanded pilot** | One full region/team | S1 exit; issues triaged | Same error/purge budgets at larger N; help-desk load acceptable |
| **S3 General** | All managed tablets | S2 exit | — |

Rollout control: a server-side feature flag per cohort (`offline_enabled`), plus a sync kill switch (`offline_readonly`: tablets can view/edit locally but push is paused) and an app-config minimum version. Flags are checked on every sync — the pilot must not depend on forcing app updates underground.

### 12.2 Rollback

- **Flag rollback (preferred):** disable `offline_enabled` for a cohort. Tablets at next sync upload any outstanding outbox items (a "drain and disable" mode), then revert to the online read-through behaviour. Local data already downloaded is retained until synced or purged per acceptance — rollback never bulk-deletes unsynced work.
- **App rollback:** previous app version must be able to open (or safely ignore) the new schema; schema migrations are therefore additive within a release train, and destructive schema changes wait for a full rollout. If the prior app cannot read the new DB, the fallback is drain-and-disable, not an app downgrade onto the new DB.
- **Server rollback:** new sync endpoints are additive (new optional fields, new endpoints); rolling back the server must not break tablets already mid-sync — version-checked writes and idempotency keys make partial rollouts safe.
- **Data rollback:** there is no "un-accept" — an accepted inspection stays accepted and its purge proceeds regardless of feature rollback, because the 24-hour obligation is regulatory, not feature-scoped.

---

## 13. Testing

Clinically, "it worked on Wi-Fi in the office" proves nothing. Testing simulates the basement.

| Layer | Coverage |
|---|---|
| Unit | Outbox state machine, conflict detection/merge rules (full field-matrix), purge selection, schema migrations (upgrade from every shipped version), form version pinning |
| Sync integration (harness) | Scripted fake server: duplicate pushes (idempotency), out-of-order arrival, version mismatch, mid-pass connection drop, server 5xx/timeout, attachment interruption and resume; supervisor-edit races against tablet edit races |
| Offline device testing | Airplane-mode suites on real managed tablets: open → edit → 40 photos → signature → kill app → relaunch → verify nothing lost; storage-full behaviour; battery/low-power mode |
| Migration testing | Upgrade a device holding cache-era data; migration failure injection (disk full mid-migration, killed mid-migration) with DB backup/restore verification |
| Purge & compliance | Accept an inspection; verify local deletion of DB rows, attachment files, and temp copies ≤ 24 h; device-offline-past-deadline case; purge-overdue dashboard firing; audit-history completeness (every change attributable) |
| Conflict UX testing | Pilot-like scenarios for the `Needs review` screen with inspectors, including auto-merge cases being invisible and manual cases being understandable without training |
| Rollout/rollback drills | Flag drain-and-disable with a non-empty outbox; kill switch; server rollback with tablets mid-sync |
| Pilot instrumentation test | Verify every §11 signal fires in staging with correct redaction (no customer data in telemetry/logs) |
| Accessibility/field usability | Gloves, bright light, one-handed use on the actual tablet for capture/signature flows (formative, during pilot design) |

Data-loss bar: any test or pilot incident where persisted local work is lost without inspector action blocks progression to the next rollout stage.

---

## 14. Milestones (sequence, dependencies, acceptance criteria)

No calendar dates: durations depend on team size and parallel work, which the brief does not state. Each milestone lists *entry dependencies* and *observable acceptance criteria* instead.

### M0 — Decisions and validation spikes
- **Depends on:** nothing (starts immediately).
- **Work:** close Decisions D-01…D-08 (§15); measure real photo sizes and inspections/day (A-02); audit supervisor/inspector edit overlap (A-04); confirm MDM capabilities (A-05), token TTL (A-07), compliance clock and signature legality (A-06, A-08); API spike for conditional writes + idempotency keys (A-03).
- **Acceptance:** every D-item recorded with an owner and outcome; photo-size distribution and edit-overlap rate reported with real numbers; spike demonstrates a version-checked write and a deduplicated retry against the real API; go/no-go recorded.

### M1 — Local data foundation
- **Depends on:** M0 (D-01, D-03, D-05 outcomes at minimum).
- **Work:** new SQLite schema + migrations from the cache schema, local-first editing (every edit transactional), pinned form versions, local audit log, DB/file encryption at rest.
- **Acceptance:** kill-the-app-mid-edit test loses nothing; upgrade test from the cache build passes on real devices; no customer-data regression in online mode (feature flag off = today's behaviour).

### M2 — Attachments and signature offline
- **Depends on:** M1; D-05, D-06, D-07.
- **Work:** camera capture to private storage with hashing, 40-photo enforcement, signature capture, local reconciler, storage-pressure behaviour.
- **Acceptance:** offline 40-photo + signature flow completes in airplane mode on the pilot tablet model; orphan/missing-file reconciler passes fault injection; photo-size budget from M0 respected at capture settings.

### M3 — Sync and conflict handling
- **Depends on:** M1, M2; server conditional-write/idempotency work (from M0 spike); D-02.
- **Work:** outbox push/pull, version-checked writes, field-level conflict detection, auto-merge, `Needs review` UI, acceptance/rejection handling, purge flow (§9), purge-overdue flagging.
- **Acceptance:** full §13 sync-harness suite green (duplicates, drops, races, resume); acceptance → local purge verified end-to-end incl. the offline-past-deadline case; zero silent overwrites in the conflict matrix.

### M4 — Observability and rollout machinery
- **Depends on:** M3.
- **Work:** telemetry events, pilot dashboard, purge-overdue and outbox-age alerts, cohort feature flags, drain-and-disable rollback, diagnostics bundle, support runbook.
- **Acceptance:** every §11 signal demonstrably fires in staging with redaction verified; rollback drill with a non-empty outbox completes without data loss; purge-overdue alert demonstrably fires on a simulated overdue device.

### M5 — Pilot (S1) and hardening
- **Depends on:** M4; support coverage arranged; pilot cohort named.
- **Work:** staged pilot per §12; weekly review of conflict rate, outbox age, purge durations, attachment failures against the A-02/A-04/A-10 expectations; fix-forward or roll back by flag if budgets are breached.
- **Acceptance (exit to S2):** zero lost-work incidents; zero unresolved purge-overdue; same-field conflict rate at or below the level the manual flow demonstrably handles (threshold set from M0 overlap data); 100% of accepted pilot inspections purged ≤ 24 h; inspector-reported sync-state comprehension verified in pilot debriefs.

### M6 — General rollout (S2 → S3)
- **Depends on:** M5 exit.
- **Work:** expand cohorts per §12, keep the same gates per stage; remove pilot-only scaffolding only after S3 is stable.
- **Acceptance:** per-stage error/purge budgets held at each expansion; rollback path re-drilled at S2.

---

## 15. Decisions required before implementation

Each decision blocks the milestone shown. Recommendations are this plan's; each needs a named decision owner from the responsible team (product, mobile, server, compliance).

| ID | Decision | Options | **Recommendation** | Rationale | Blocks |
|---|---|---|---|---|---|
| **D-01** | Source of truth while offline | (a) Local-first: tablet authoritative for in-progress work, server on sync. (b) Server-first with local queue replay. | **(a) Local-first** | (b) reintroduces "lost connection discards notes" in every ambiguous case; local-first with a durable outbox gives the no-lost-work guarantee in §1. | M1 |
| **D-02** | Conflict granularity and resolver | (a) Whole-record, supervisor wins. (b) Field-level auto-merge, manual pick for same-field, inspector resolves. (c) Field-level, supervisor resolves on web. | **(b)**, with pass/fail safety fields requiring explicit confirmation | (a) discards on-site observations — the exact failure in the brief; (c) strands the inspector. Field-level matches "no collaborative editor" while avoiding needless conflicts (A-04). | M3 |
| **D-03** | Offline creation of unassigned inspections | (a) Not allowed in pilot. (b) Allow, sync as new records. | **(a) Not allowed in pilot** | Brief scopes work to *assigned* inspections; (b) adds ID allocation, duplicate-creation, and assignment-integrity problems the pilot doesn't need. Revisit with pilot feedback. | M1 |
| **D-04** | Lock point after completion | (a) Inspector can edit until supervisor accepts. (b) Local completion locks the inspection. | **(b) locks, with an audited "reopen" that syncs as a new edit round** | Prevents silent divergence between what the supervisor reviewed and what the inspector later changed; reopen keeps field reality possible without breaking review integrity. | M3 |
| **D-05** | Photo resolution and upload mechanics | (a) Device-original photos, file-level resume. (b) Compressed to an M0-measured budget, chunked/resumable upload. | **(b)**, budget set by M0 measurements and quality review | 40 originals over intermittent links is the most likely sync failure (A-02); chunked resume survives mid-upload drops. Originals only if D-07 requires them. | M2 |
| **D-06** | Purge clock definition | (a) 24 h from server acceptance timestamp. (b) 24 h from device learning of acceptance. | **(a) server acceptance timestamp** — compliance to confirm | Regulation says "within 24 hours after an inspection is accepted"; (b) could extend retention past the regulatory bound whenever sync lags. (a) means an offline device must purge from locally known acceptance info and the server must flag overdue devices (§9). | M2/M3 |
| **D-07** | Are original-resolution photos/signature legal records? | (a) Compressed files are the record. (b) Originals must be retained. | **Ask compliance; default design keeps the option open** (capture pipeline can store original until D-07 lands) | Guessing wrong in either direction is costly: (a)-wrong breaks evidential value; (b)-wrong multiplies the A-02 risk. Cheap to keep open for one milestone. | M2 |
| **D-08** | Offline authentication lifetime | (a) Token TTL ≥ longest offline shift + grace. (b) Offline PIN unlock over a long-lived device credential. | **(b)**, with per-unlock audit events | (a) couples security to shift length and still fails on multi-day dead zones; (b) keeps attribution (who unlocked, when) for the audit history while offline (A-07). | M1 |

---

## 16. Risks

The three riskiest assumptions (A-01, A-02, A-04) are summarised separately in `RESPONSE.md`, with mitigations. Remaining plan-level risks:

- **Server change burden:** conditional writes + per-field change metadata are new server obligations (A-03). If the API can't support them, the fallback — whole-record version checks — pushes far more conflicts to manual review and may invalidate A-04. Detected in M0, before mobile work depends on it.
- **Form-definition drift:** a form edited server-side while an inspector is mid-inspection offline is handled by pinning (§5.3), but supervisor expectations need alignment: supervisors must understand their form change doesn't reach in-flight offline work.
- **Clock skew on tablets:** audit ordering uses op IDs and sequence numbers, not wall clock; device timestamps are still recorded and skew is measured in telemetry.
- **Purge vs. unsynced work race:** accepted-before-sync case is handled in §7.2/§9, but it is the subtlest flow in the system; it gets dedicated tests in M3 and its own pilot alert.
- **Support load:** inspectors will report "not synced" states that are actually healthy offline states. The five named sync states (§3.2) and the runbook exist precisely to keep this from becoming a help-desk flood during the pilot.

---

## 17. Open questions for the brief's owners

1. Does the fleet include more than one tablet model/OS version? (Affects M2 acceptance devices.)
2. Can an inspector's assignment change while they are offline, and what should the tablet show when it next syncs? (Assumed: reassignment applies on sync, never deletes local work — local changes route to review per §7.)
3. Is there a maximum number of assigned inspections per inspector per day? (Sizes M0 storage measurements; no number assumed here.)
4. Who is the named compliance contact for D-06/A-08 and A-06 sign-off?

