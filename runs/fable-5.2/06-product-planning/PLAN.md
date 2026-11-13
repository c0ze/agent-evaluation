# Plan: offline inspection sync

Source: `BRIEF.md` only. Anything the brief does not state is listed as an assumption in section 1 or as a decision in section 16.

## Summary

Inspectors must be able to open assigned inspections, fill forms, take up to 40 photos and collect a signature with no signal, and never lose that work. Supervisors keep editing the same inspections on the web. Every change must be auditable, and customer data must leave the tablet within 24 hours of an inspection being accepted.

The plan has four parts:

1. **The tablet becomes the first place work is saved.** Every edit is written to an encrypted local store and to an ordered queue of pending changes (the *outbox*) before anything is sent. The server remains the system of record.
2. **Sync is a replay of the outbox over the existing REST API**, extended with idempotency keys and field-level merging on top of the existing integer record versions. No real-time collaboration, no CRDTs.
3. **A *checkout* ties each local copy to a time limit.** When a tablet downloads an inspection, the server records a checkout with a time-to-live. The server will not accept an inspection while a checkout is active, and the tablet deletes its copy when the checkout ends. This is what makes the 24-hour rule hold when the tablet cannot be reached (section 8.2).
4. **Rollout is gated by evidence, in stages.** The data-loss fix ships first and separately from full offline work.

Two tensions cannot be designed away and need an owner's decision before build:

- **Removal against data loss.** A tablet that stays offline past its checkout must delete work that never reached the server (D2).
- **Offline tolerance against acceptance delay.** A longer checkout lets inspectors stay offline longer but makes supervisors wait longer when a tablet goes missing (D3).

## 1. Assumptions

Each assumption is something the brief does not say. The three marked **(riskiest)** are expanded in `RESPONSE.md`.

| ID | Assumption | If it is wrong |
|---|---|---|
| A1 **(riskiest)** | "Accepted" means a supervisor accepting the inspection on the server, after the inspector submits it. Deleting the encryption key plus the files counts as "removal". The business tolerates acceptance waiting on a checkout. | If "accepted" means the customer signing on the tablet, the clock starts on-device and unsynced work may have to be deleted within 24 hours. Section 8.2 and D2 change. |
| A2 **(riskiest)** | A tablet normally regains usable connectivity at least once per working day, for long enough to upload one inspection's photos. Tablet clocks cannot be changed by inspectors (managed devices). | Checkouts expire with unsynced work, forcing either data loss or a compliance breach. Photo upload may never complete on brief signal windows. |
| A3 **(riskiest)** | The server team can add endpoints, tables and an acceptance rule. Record versions are per inspection and increase by one on every write. Existing audit data records changes per field. | Fall back to whole-record writes with tablet-side merging: coarser conflicts, weaker audit, no acceptance gate (D4). |
| A4 | Inspectors only work on inspections already assigned to them. They do not create inspections offline. | Offline creation needs client-generated IDs and a server reconciliation step; out of scope here. |
| A5 | One inspector uses a tablet at a time, and signs in online at least once before going offline. | Shared tablets need per-user key separation and a rule for another user's unsynced work (D8). |
| A6 | Form templates and reference lists are small enough to store on the tablet and contain no customer data. | Template download needs its own size budget and purge rule. |
| A7 | The existing read-through cache holds nothing that exists only on the tablet, so it can be dropped and rebuilt. | The cache migration in section 9 must preserve data instead of discarding it. |
| A8 | Tablets are enrolled in device management that can remote-wipe, pin app versions and exclude app data from backups. | Lost-device handling and binary rollback need another mechanism. |
| A9 | Photo size is whatever the tablet camera produces; no evidence-quality rule is stated. | Storage and upload budgets in section 7 depend on D7. |
| A10 | Supervisors edit only on the web, online. They do not need offline work. | Out of scope. |
| A11 | The tablet platform and OS versions are not stated. The plan avoids platform-specific design and treats background execution as best effort. | Background upload limits differ by platform; see D9. |

## 2. User flow

### 2.1 Inspector

1. **Prepare, online.** After sign-in the app downloads assigned inspections, their form templates and reference lists. Each inspection shows "Available offline" once its download and checkout are complete. A readiness screen lists what is downloaded, free storage and when the tablet last reached the server.
2. **Work, offline.** The inspector opens an inspection and fills the form. Every committed field change is saved locally before the screen acknowledges it. Photos are taken with the in-app camera, with a "12 of 40" counter. The signature is captured on screen with the signer's printed name.
3. **Status is always visible.** Each inspection shows one of: *Saved on this tablet*, *Uploading (form sent, 12 of 40 photos)*, *Submitted*, *Needs attention*. A banner shows the age of the oldest change not yet uploaded.
4. **Complete.** "Mark complete" runs the template's validation locally (required fields, photo minimums, signature present) and queues the submission. It does not require signal.
5. **Sync.** Upload starts automatically when a request to the server succeeds, and resumes after each interruption. "Sync now" is available. The inspector does not have to keep the inspection open, but the app tells them to keep the app open if background upload stalls.
6. **Conflicts.** If a supervisor changed the same field, the inspection shows *Needs attention* with both values, who changed it and when. The inspector picks one or types a new value. Everything else in the inspection uploads regardless.
7. **After submission.** Once the server confirms the form, all photos and the signature, the local copy is removed. The list keeps a stub (inspection ID, status, timestamps) with no customer data. Viewing a submitted inspection requires signal.

### 2.2 Supervisor (web)

1. An inspection checked out to a tablet shows a badge: tablet, inspector, last contact, checkout end time.
2. Editing is allowed as today. A notice says offline changes may arrive later and will be merged by field.
3. **Accept is disabled while a checkout is active**, with the reason and the time it clears. Normally it clears seconds after the tablet submits.
4. The history view shows offline changes with the tablet's recorded time and the server's receipt time, plus conflicts and how they were resolved.
5. Reassigning, cancelling or returning an inspection for rework is allowed. The tablet learns of it at next contact (section 5).

### 2.3 Edge flows the UI must cover

| Situation | Behaviour |
|---|---|
| Checkout near its end with unsynced work | Escalating warnings from half the remaining time: "Connect within N hours or this work will be removed from the tablet." |
| Storage low | Download is refused before it starts; photo capture warns before the last safe photo. Unsynced data is never evicted to make room. |
| Sign-in expires offline | Work continues behind the tablet's local unlock until the checkout ends. Upload waits for a fresh sign-in. |
| Inspection reassigned or cancelled while checked out | At next contact, pending work is uploaded as a *late draft* for the supervisor to review, then the local copy is removed. |
| App killed or tablet dies mid-edit | On restart the inspection reopens with every committed field intact. |

## 3. Scope boundaries

**In scope**

- Offline open, form entry, photo capture (up to 40), signature capture, local validation and queued submission for assigned inspections.
- Durable local storage, automatic resumable sync, field-level conflict handling.
- Audit history covering offline changes, conflicts, checkouts and data removal.
- Removal of local customer data, with a server-side report proving it.
- Web changes: checkout badge, accept gate, conflict and late-draft review, audit view.
- Feature flags, pilot cohort controls, monitoring and support tooling.

**Out of scope**

- Real-time co-editing, presence indicators, character-level text merging.
- Creating, assigning or scheduling inspections offline.
- Offline work on the supervisor web app.
- Video, audio, or more than 40 photos per inspection.
- Tablet-to-tablet sync, personal (unmanaged) devices, first-ever sign-in offline.
- Editing form templates offline; changing a template for an inspection already checked out.

**Deferred until after the pilot**

- Read-only offline access to past inspections for the same address.
- Supervisor-side resolution of conflicts as the default path (kept only as a fallback; D5).
- Selective pre-download rules beyond "everything assigned to me".

## 4. Local data model

SQLite stops being a cache and becomes the durable store for pending work. Customer-bearing content is encrypted with a per-inspection key so that deleting the key removes the data (section 8).

| Table | Purpose | Key columns |
|---|---|---|
| `inspection` | One row per checked-out inspection | `id`, `server_version`, `template_id`, `template_version`, `local_state`, `checkout_id`, `checkout_anchor`, `checkout_ttl`, `wrapped_key`, `downloaded_at` |
| `field_value` | Current and base value of each form field | `inspection_id`, `field_key`, `value_enc`, `base_value_enc`, `base_version`, `dirty` |
| `outbox` | Ordered pending changes, the tablet-side audit record | `mutation_id` (UUID), `device_seq`, `inspection_id`, `kind`, `payload_enc`, `base_version`, `actor_id`, `device_time`, `state`, `attempts`, `last_error` |
| `attachment` | Photos and the signature | `client_id` (UUID), `inspection_id`, `kind`, `file_path`, `sha256`, `size`, `captured_at`, `field_key`, `upload_state`, `bytes_confirmed`, `server_id` |
| `conflict` | Collisions returned by the server | `id`, `inspection_id`, `field_key`, `local_value_enc`, `server_value_enc`, `server_actor`, `server_version`, `state` |
| `form_template` | Templates and validation rules | `id`, `version`, `schema` |
| `device_state` | Sync cursor and clock anchors | `last_contact_wall`, `last_contact_elapsed`, `boot_marker`, `change_cursor` |
| `purge_log` | Proof of removal, no customer data | `inspection_id`, `reason`, `purged_at`, `reported` |

Rules:

- **One transaction per edit.** A field change updates `field_value` and appends to `outbox` in a single transaction. The UI confirms the save only after commit.
- **Granularity.** One outbox entry per committed field edit (on leaving the field), not per keystroke.
- **Base values.** `base_value` and `base_version` record what the server held when the tablet last saw the field. They let the tablet show "what changed" and let the server detect collisions.
- **Indexes hold no customer data.** Only IDs, states and timestamps are stored in clear columns.
- **Local state machine.**

```
available -> in_progress -> complete_queued -> uploading -> submitted -> purged
                  |                               |
                  +----> needs_attention <--------+     (conflict; returns to uploading once resolved)
any state -> revoked -> purged                          (reassigned or cancelled)
any state -> expired -> purged                          (checkout ended)
```

## 5. Sync protocol

Endpoint names are illustrative and should follow the existing API's conventions. All additions are new endpoints or optional fields, so old app versions keep working.

### 5.1 Checkout

- `POST /inspections/{id}/checkouts` with the device ID returns `checkout_id` and `ttl_seconds`.
- The server returns a duration, not a timestamp, because the tablet clock is not trusted. The tablet anchors the duration to the moment it *sent* the request, so its view of the end time is never later than the server's.
- Every successful sync renews all of that tablet's checkouts.
- A checkout ends by **release** (the tablet reports it has removed its copy), **expiry**, or **forced release** (an administrator, after a confirmed remote wipe; audited).
- The server refuses `accept` while any checkout for the inspection is active.

### 5.2 Pull

- `GET /inspections?assigned_to=me&since={cursor}` returns changed inspections with their versions. If the API has no change feed, the tablet lists IDs with versions and fetches the ones that differ.
- Pulled values overwrite local values only for fields with no pending local change. Fields with pending changes keep the local value and the old base, so the server sees the collision on push.
- Pull also delivers reassignment, cancellation and return-for-rework.

### 5.3 Push

- `POST /inspections/{id}/mutations` carries an ordered batch. Each entry has `mutation_id`, `device_seq`, `base_version`, the field changes and the tablet's recorded time.
- The server keeps, for each field, the record version at which it last changed. For each field change:

| Server state | Result |
|---|---|
| Field unchanged since `base_version` | Applied; record version increments |
| Field changed, same value | No-op, recorded |
| Field changed, different value | `conflict`, with the server value, author and version |
| `mutation_id` seen before | The original result is returned; nothing is applied twice |
| Inspection accepted, cancelled or reassigned | `rejected`; the payload is stored as a late draft |

- A gap in `device_seq` is rejected so the tablet resends in order. This also lets the server detect dropped entries.
- Retries use exponential backoff with jitter. Connectivity is judged by a successful request, not by the OS network indicator, so captive portals do not count.

### 5.4 Submit, release

1. `POST /inspections/{id}/submit` sends a manifest: every attachment's `client_id` and hash, the signature reference and a hash of the form content.
2. The server checks that every listed attachment is stored with a matching hash and that no conflict is open, then sets the inspection to submitted and returns the verified manifest.
3. The tablet removes the local copy, writes `purge_log`, then calls `POST /checkouts/{id}/release` with the removal time.
4. If the release is lost, the tablet resends it at next contact. Until then acceptance stays blocked, which is the safe failure.

### 5.5 Ordering

Form mutations go first because they are small. Attachments upload in parallel in any order, signature first. Submit goes last and only when everything before it is confirmed.

## 6. Conflict policy

The goal is that no value is silently lost and nobody needs a collaborative editor.

| Case | Policy |
|---|---|
| Inspector and supervisor changed different fields | Both applied automatically; both audited. |
| Same field, same value | No-op. |
| Same field, different values | No automatic winner. The inspector chooses on the tablet: keep mine, take the supervisor's, or enter a new value. Both original values and the choice are audited. |
| Free-text notes changed by both | Treated as one field. Both versions are shown; no text merging. |
| Assignment, schedule, status | Server-owned. The tablet never edits them, so they cannot collide. |
| Photos | Additive; adding never conflicts. If a supervisor deleted a photo the inspector re-captioned, the delete stands and the caption change is audited as dropped. |
| Photo count exceeds 40 after merging | Accepted and flagged for the supervisor. Evidence is not discarded to satisfy a limit. |
| Inspection reassigned or cancelled during checkout | Pending tablet work is stored as a late draft for supervisor review; nothing is applied automatically. |
| Template changed during checkout | The inspection stays on the template version it was downloaded with. |
| Signature captured, then the inspector edits a signed field | Signature is marked stale; a new signature is required before submit. |
| Signature captured, then a supervisor edit merges in | Signature stays valid for the content hash it covered. The edit is recorded as a post-signature amendment (D6). |

An open conflict blocks submission of that inspection only. Its other fields and attachments still upload, so the unprotected window on the tablet stays short. If a checkout ends with a conflict still open, the unresolved pair goes to the supervisor on the web.

## 7. Attachments

- **Capture.** In-app camera writes directly to app-private storage, encrypted with the inspection's key. Nothing goes to the shared photo gallery. A thumbnail is generated locally and encrypted the same way.
- **Limit.** The 40-photo cap is enforced on the tablet at capture and checked on the server.
- **Storage budget.** Before download and before each capture, the app checks free space against the worst case for the inspections on the tablet. The per-photo size used in that check comes from D7.
- **Upload.** `POST /inspections/{id}/attachments` registers `client_id`, hash and size and returns an upload session. Chunks are sent with an offset; after an interruption the tablet asks the server for the confirmed offset and continues. The server verifies the hash on completion. Re-registering the same `client_id` returns the existing session.
- **Signature.** Stored as an attachment of kind `signature` with the signer's printed name, capture time and the hash of the form content shown at signing. It uploads before photos.
- **Deletion.** Removing a photo before it uploads cancels its outbox entry and deletes the file. Removing it after upload queues a delete mutation.
- **Background execution.** Uploads continue in the background where the OS allows. The guarantee is foreground sync; the status screen says so when the background queue stalls.

## 8. Security and data removal

### 8.1 Protection on the tablet

- **Encryption.** Each inspection gets its own data key, generated at download. Field values, outbox payloads and attachment files are encrypted with it. The data key is wrapped by a key held in the tablet's hardware-backed keystore.
- **Offline access.** The app opens offline only behind the tablet's local unlock (biometric or PIN) and only for the signed-in user, for as long as a checkout is active.
- **Upload identity.** Every outbox entry carries the user who made it. Upload requires a valid session for that user.
- **Leak paths closed.** App data is excluded from device and cloud backups. Logs, crash reports and metrics carry IDs and counts only. Screenshots of inspection screens are disabled if device policy allows.
- **Transport.** Existing TLS. Certificate pinning is optional and decided with the security owner.
- **Lost tablet.** Remote wipe through device management, then forced release of its checkouts.

### 8.2 Removal within 24 hours of acceptance

The rule must hold when the tablet cannot be reached, so it cannot depend on the server telling the tablet anything.

1. The server will not accept an inspection while a checkout is active.
2. The tablet's view of a checkout's end is never later than the server's (section 5.1).
3. The tablet removes the local copy no later than a *grace period* after its checkout ends. The grace period is shorter than 24 hours.

So acceptance cannot happen before the checkout ends, and removal happens less than 24 hours after that. In the normal case removal happens right after confirmed submission, before acceptance is even possible.

**How removal works.** Delete the wrapped data key, delete attachment files and thumbnails, delete the inspection's rows, truncate the write-ahead log, and write `purge_log`. Deleting the key makes any leftover bytes unreadable. The removal time is reported to the server, which records it against the inspection.

**Triggers.** Confirmed submission; revocation learned at sync; checkout end plus grace period. The check runs at app start before any screen, on a scheduled background task, and after every sync.

**Unsynced work at checkout end.** The inspection locks for editing and the tablet keeps trying to upload during the grace period. Whatever arrives after the server has moved on is stored as a late draft. At the end of the grace period the copy is removed even if it never uploaded (D2).

**Clock handling.** Elapsed time is measured with the monotonic clock and cross-checked against wall time and a persisted last-seen time. After a reboot, or if wall time has moved backwards, the tablet uses the larger elapsed estimate, which errs toward earlier removal.

**Residual gaps to put in front of compliance (D1).**

- A tablet that is powered off at the deadline removes the data at next start, not at the deadline. Until then the data is encrypted at rest.
- The legacy cache already holds customer data. Whether it meets the rule today is unknown; the new removal job must cover it.

### 8.3 Audit history

The server writes one audit event per field change with: actor, origin (tablet or web), device ID, `mutation_id`, tablet-recorded time, server receipt time, old value, new value, base version and outcome. It also records conflicts with both values and the resolution, checkout issue, renewal, release, expiry and forced release, late drafts, and each removal report. Tablet times are stored as reported and never used for ordering; server receipt order is authoritative.

## 9. Migration and backfill

**Tablet**

- The new schema is created alongside the cache. If A7 holds, the old cache tables are dropped on upgrade and rebuilt on next sign-in. If the old cache was unencrypted, its file is deleted, not converted.
- Schema migrations are forward-only and tested from every app version still in the field.
- Inspections open at upgrade time are re-downloaded and checked out on first online launch. No offline work can exist on an old version, so nothing needs carrying over.

**Server**

- Additive changes only, in expand-then-contract order: `checkout` table, mutation idempotency table, per-field last-changed version, attachment `client_id` and hash, extra audit columns, late-draft storage.
- **Backfill: per-field last-changed version.** Derive it from existing audit history if A3 holds. Otherwise initialise every field to the inspection's current version, which is safe because no tablet holds a base older than that at launch.
- **Backfill: audit origin.** Existing audit rows default to origin `web/online`.
- **No backfill for attachment hashes.** Hashes are needed only for uploads made through the new path.
- **Old clients.** They take no checkouts, so the accept gate never applies to them and their behaviour is unchanged. Old and new endpoints run side by side until the old app version is retired.

## 10. Observability

Metrics carry no customer data and are queued offline like everything else.

| Area | Signals |
|---|---|
| Durability | Outbox depth, age of oldest unsynced change per tablet, app restarts with pending work, local write failures |
| Sync | Attempts, successes and failures by cause; duplicate deliveries absorbed; sequence gaps; time from "Mark complete" to confirmed submission |
| Attachments | Bytes uploaded, resumes per file, hash mismatches, uploads abandoned |
| Conflicts | Count by field, resolution chosen, time to resolve, conflicts passed to supervisors |
| Compliance | Checkouts active and their age; acceptances blocked by checkout and for how long; removals by trigger; **removals with unsynced work**; time from acceptance to reported removal |
| Device health | Free storage at download and capture, clock anomalies, schema migration failures, crash-free sessions |

- **Compliance report.** For every accepted inspection, the server lists each checkout and how it ended, with the removal time. Any accepted inspection without a release, expiry or forced release on record is an alert.
- **Alerts.** Any removal with unsynced work; any tablet whose oldest unsynced change passes half its checkout; hash mismatches; sequence gaps; rising rejected mutations after a release.
- **Support view.** Per tablet: last contact, pending counts, checkouts, last errors. On the tablet, a sync status screen with an exportable log containing IDs only.

## 11. Staged rollout

Controlled by a server-side flag per user and tablet, plus a global switch. Stages advance on exit criteria, not on a calendar.

| Stage | Who | Exit criteria |
|---|---|---|
| 0. Internal | Team tablets, synthetic inspections on a test tenant | All milestone acceptance criteria pass; removal verified by inspecting device storage |
| 1. Durable drafts | Pilot cohort first, then wider; no offline download yet | No reports of lost notes; no rise in write errors or crashes against the current baseline |
| 2. Offline pilot | A small cohort chosen for real no-signal sites and a supervisor who agrees to the accept gate | No acknowledged work lost; no removal deadline missed; every accepted inspection has a complete audit chain and removal record; conflict and blocked-acceptance rates judged acceptable by the pilot supervisors; thresholds for sync time and support contacts set in M0 are met |
| 3. Expansion | Progressively larger cohorts | Stage 2 criteria hold at each step; server load from reconnect bursts within capacity |
| 4. General availability | Everyone; old path retired after the last old app version is gone | Old endpoints unused for one full checkout period plus grace |

Durable drafts (stage 1) can move ahead of offline work because they add no checkout, no accept gate and no new conflict path.

## 12. Rollback

The constraint is that switching the feature off must never strand work on a tablet.

- **Flag off means drain, not stop.** New downloads and checkouts stop. Existing outboxes keep uploading, existing checkouts run to release or expiry, and removal rules keep running.
- **Server sync endpoints outlive the flag.** They stay up for at least one full checkout period plus grace after the flag is turned off.
- **Server changes are additive**, so a server rollback does not break tablets. Idempotency keys make replays after a rollback safe.
- **No binary downgrade across a schema change.** Rollback is by flag. If a release must be withdrawn, the fix ships as a newer version that reads the current schema, and device management pins it.
- **Recovery of last resort.** A support action exports a tablet's pending work as an encrypted bundle that only the server can open, for manual replay.
- **Data repair.** Because every applied change has an audit event with old and new values, a bad merge rule can be identified and reversed per field.
- **Rollback triggers.** Any confirmed loss of acknowledged work; any missed removal deadline; audit gaps; hash mismatches beyond isolated cases.

## 13. Testing

| Layer | What it proves |
|---|---|
| Unit | Field merge rules; local state machine; removal scheduler under a fake clock; validation offline equals validation online |
| Model-based sync tests | Random interleavings of tablet edits, supervisor edits, dropped requests, duplicates and reordering always converge, never lose an acknowledged change and always produce a complete audit trail |
| Crash and power-loss | Killing the app mid-write, mid-upload and mid-removal leaves a consistent store; an interrupted removal completes on restart |
| Network | Flapping links, captive portals, very slow uplinks, connections that die mid-chunk; 40-photo upload completes across many short windows |
| Clock | Skew, backward jumps, reboot, time zone and daylight-saving changes never delay removal |
| Storage | Full disk during capture, download and migration; unsynced data is never evicted |
| Migration | Upgrade from every fielded app version with a populated cache; server expand and contract steps with old and new clients live |
| Security | After removal, a forensic read of app storage yields no readable customer data; backups contain no app data; logs and metrics contain no customer data |
| Auth | Session expiry offline; re-sign-in then drain; second user on the same tablet |
| Contract | Old app against new server; new app against flag-off server |
| Load | Many tablets reconnecting at once with full outboxes |
| Field | Real basements with pilot hardware; full-shift soak with intermittent signal |
| Usability | Inspectors understand the status labels and resolve a conflict unaided; supervisors understand why Accept is disabled |

## 14. Milestones

No dates or staffing are given because the brief contains nothing to derive them from. Sequence and dependencies are what matter.

```
M0 --+--> M1 --+
     |         +--> M3, M4, M5 (in parallel) --> M6 --> M7 --> M8 --> M9
     +--> M2 --+
```

| # | Milestone | Depends on | Acceptance criteria |
|---|---|---|---|
| M0 | Decisions and discovery | none | D1 to D10 decided and recorded. Spikes answer: version granularity and audit granularity of the current API; contents and encryption of the current cache; real photo sizes; background upload behaviour on pilot hardware; how long pilot inspectors actually stay offline. Baselines captured for lost-note reports, crash rate and time to submit. |
| M1 | Durable local drafts | M0 | With the app online-first as today, every committed field survives app kill, tablet restart and connection loss, and uploads when the connection returns. Store is encrypted per inspection. Local copy is removed on confirmed submission. Old cache migrated per section 9. |
| M2 | Server sync foundations | M0 | Mutation endpoint applies, de-duplicates and reports conflicts per the table in 5.3. Checkouts issue, renew, release and expire. Accept is refused during an active checkout. Audit events carry all fields in 8.3. Old app versions pass the existing API test suite unchanged. |
| M3 | Offline forms end to end | M1, M2 | With no signal: download beforehand, open, fill, validate, mark complete. On reconnect: sync, merge different-field edits, surface and resolve same-field conflicts. Web shows checkout badge, accept gate and conflict history. Model-based sync tests pass. |
| M4 | Offline photos and signature | M1, M2 | 40 photos and a signature captured offline and uploaded across repeated interruptions with every hash verified. Storage checks refuse unsafe downloads and warn before capture. Signature rules in section 6 enforced. |
| M5 | Removal and offline access | M1, M2 | Removal fires on every trigger in 8.2 under a fake clock, including reboot and backward clock jumps. Storage inspection after removal finds nothing readable. Compliance report lists every checkout outcome. Offline unlock works without a server session and stops when the checkout ends. Late drafts reach the supervisor. |
| M6 | Observability, support tools, drain mode | M3, M4, M5 | All signals in section 10 visible on a dashboard. Alerts fire in a staged test. Turning the flag off mid-upload drains every outbox with no loss. Encrypted export bundle replays successfully. |
| M7 | Hardening | M6 | Every row in section 13 passes. Security review and compliance sign-off on 8.2 recorded. Field test completed in at least one real no-signal site on pilot hardware. |
| M8 | Offline pilot | M7 | Stage 2 exit criteria met. Written go or no-go from product, compliance and the pilot supervisors. |
| M9 | Expansion and general availability | M8 | Stage 3 and 4 exit criteria met. Old code path and endpoints removed. |

M3, M4 and M5 can proceed in parallel once M1 and M2 are done. M1 can be released to users through stage 1 before M3 to M5 finish.

## 15. Risks to watch

- **Removal destroys real work.** Mitigated by checkout length, early warnings and the alert on any removal with unsynced work. Not eliminated.
- **A dead tablet blocks acceptance.** Bounded by checkout length; forced release after remote wipe is the escape.
- **Photo volume exceeds signal windows.** Mitigated by resumable upload and D7. Field testing in M7 is the real check.
- **Background upload is unreliable.** The plan guarantees foreground sync only.
- **Conflict fatigue.** If supervisors routinely edit while inspectors are on site, same-field conflicts will be common. The pilot measures this; D5 is the lever.
- **Old app versions linger.** Device management can force updates; until then both paths are maintained.

## 16. Decisions needed before implementation

| ID | Decision | Owner | Recommendation |
|---|---|---|---|
| D1 | What event starts the 24-hour clock, and what counts as removal? | Compliance | Supervisor acceptance on the server starts the clock. Key deletion plus file and row deletion counts as removal. Get this in writing, including the powered-off-tablet gap in 8.2. |
| D2 | When a checkout ends with unsynced work, delete it or keep it? | Compliance and product | Delete at the end of the grace period. The regulation is not negotiable and the loss is bounded, visible and alerted. Size the checkout so it is rare. |
| D3 | Checkout length and grace period | Product, with pilot supervisors | Set from the M0 measurement of real offline stretches: long enough to cover the longest normal gap between connections, with a grace period comfortably under 24 hours. Make both server-configurable so the pilot can tune them. |
| D4 | Sync API shape | Server and mobile leads | New mutation endpoint with server-side field merge. Merge rules then live in one place, can change without an app release, and produce authoritative audit events. Reusing whole-record writes with tablet-side merging is the fallback if A3 fails. |
| D5 | Who resolves same-field conflicts? | Product | The inspector, on the tablet, because they have the facts. The supervisor resolves only what is still open when a checkout ends. |
| D6 | Does a supervisor edit after signing invalidate the signature? | Compliance | No. Bind the signature to a hash of what was signed and record later edits as amendments. The customer is usually gone, so re-signing is impractical. Inspector edits to signed fields do require a new signature. |
| D7 | Photo resolution, compression and metadata | Product and compliance | Downscale to the smallest size that still meets evidence needs, decided from sample photos in M0. Keep capture time and location as audit data on the server. This sets the storage and upload budgets. |
| D8 | Offline sign-in and shared tablets | Security | Local unlock for the last signed-in user, valid only while a checkout is active. For the pilot, one inspector per tablet; switching users is blocked while unsynced work exists, with a supervisor-assisted override. |
| D9 | Pilot platform and background expectations | Mobile lead | Pilot on the single tablet model and OS version most inspectors have. Promise foreground sync; treat background sync as a bonus. |
| D10 | Pilot cohort and numeric exit thresholds | Product | A cohort that actually works in no-signal sites, with one supervisor group that accepts the accept gate. Fix thresholds for sync time, conflict rate and support contacts against the M0 baselines before the pilot starts. |
