# PLAN — Offline inspection sync for tablet app

## 1. Context and product input

The only product input is `BRIEF.md`. Key facts from it:

- Inspectors use company-managed tablets in basements with no signal.
- Today, a lost connection after opening an inspection can discard notes.
- Required offline capabilities: open assigned inspections, fill forms, take up
  to 40 photos per inspection, collect a signature.
- Connectivity may return intermittently.
- Supervisors can edit the same inspection from the web.
- Regulations require: (a) an audit history, (b) removal of local customer data
  within 24 hours after an inspection is accepted.
- Existing server APIs are REST with integer record versions.
- The mobile app has SQLite, currently used only as a read-through cache.
- Product wants a pilot before broad rollout.
- Product does not want a full collaborative editor.

## 2. Assumptions (explicit)

These are working assumptions; each is either validated in the pilot or listed
as a pre-implementation decision in §14.

1. **A1 — Single-inspector ownership.** An inspection is assigned to exactly one
   inspector at a time. Concurrent edits by two *inspectors* are out of scope;
   the realistic concurrency case is inspector (tablet) vs. supervisor (web).
2. **A2 — Assignment metadata is available online.** The inspector can sync the
   list of assigned inspections (and the inspections themselves) while online,
   before going offline.
3. **A3 — SQLite on the tablet is reliable and has enough storage** for a
   reasonable workload: brief implies ≤ 40 photos/inspection; we assume photo
   size ≤ ~5 MB each after compression, so ~200 MB per inspection worst case,
   and that devices have several GB free. To be verified during the pilot.
4. **A4 — REST/integer versions can be extended, not replaced.** We can add
   endpoints/fields (e.g., a photo upload endpoint, a sync status endpoint, a
   tombstone/purge-ack endpoint) without breaking existing web clients. The
   server remains the system of record.
5. **A5 — "Accepted" is a server-side state transition** with a timestamp the
   client can read, which starts the 24-hour local-purge clock.
6. **A6 — The signature is a captured image/stroke artifact plus metadata**
   (signer name, timestamp, GPS optional), stored like a photo attachment, not
   a cryptographic e-signature product.
7. **A7 — Audit history is primarily server-side.** The client must not destroy
   information needed for audit; every mutation is attributable to a user and a
   device. The client keeps a local audit log only until it is uploaded.
8. **A8 — Devices are company-managed**, so MDM features (device encryption
   enforcement, remote wipe, app pinning) are available.
9. **A9 — Intermittent connectivity is short-burst and low-bandwidth** (e.g.,
   briefly surfacing from a basement). Sync must be incremental and resumable,
   not all-or-nothing.
10. **A10 — Existing read-through cache schema is disposable.** There is no
    production data in the local SQLite that must be preserved; migration is
    schema migration, not data rescue. (To be confirmed.)

## 3. Goals and success criteria

**Goal:** an inspector can complete an entire inspection — open, fill forms, up
to 40 photos, signature — with zero connectivity, and lose nothing when
connectivity drops or the app is killed.

Success criteria (measured in the pilot):

- Zero reported data loss of notes/photos/signature across app restarts and
  network loss (target: 0 incidents).
- 100% of completed offline inspections eventually reach the server without
  manual intervention once connectivity returns.
- Local customer data purged within 24 h of acceptance on 100% of devices that
  check in; purge failures are detected and alerted, not silent.
- Conflict rate (inspector edit vs. supervisor edit on same record) is measured
  and the conflict UX resolves 100% of them without data loss.

## 4. User flow

### 4.1 Inspector

1. **Prepare (online):** inspector opens the app on Wi‑Fi/cellular. App syncs
   the assigned-inspection list and pre-downloads the full inspection payloads
   (form definitions, current record versions, existing photos) for the next
   N days (N configurable, default: today's and tomorrow's assignments).
2. **Work (offline-capable):** inspector opens an assigned inspection, fills
   the form section by section, takes photos (autosaved immediately to local
   storage, attached to the inspection), captures the signature. Every change
   is written to the local database synchronously before the UI acknowledges
   it (write-ahead, no "save" button required; an explicit "Save" affordance
   may remain for UX familiarity but is a no-op confirmation).
3. **Submit:** when the inspection is complete, the inspector marks it
   "Complete". This is a local state change queued for sync. If online, it
   submits immediately; if offline, it waits in the outbox.
4. **Sync (intermittent):** whenever connectivity appears, a background sync
   worker pushes the outbox (form edits in order, then photos, then signature,
   then the "complete" transition), with resumable uploads. The UI shows
   per-inspection sync status: `Local only / Syncing / Synced / Conflict /
   Error`.
5. **Post-acceptance purge:** once the server marks the inspection accepted,
   the next successful sync returns the accepted state; the client schedules
   local purge of customer data for that inspection within 24 h and reports
   purge completion back to the server (purge acknowledgment).

### 4.2 Supervisor (web)

- Supervisors continue to use the existing web app. They see sync state of
  inspections (e.g., "inspector has unsubmitted offline changes" is *not*
  visible — see scope boundaries; but "submitted, awaiting review" is).
- If a supervisor edits an inspection that the inspector has also edited
  offline, the conflict policy in §8 applies at the inspector's next sync.

### 4.3 Conflict UX

- On a version conflict, the inspector sees the affected inspection flagged
  `Conflict`, with a field-level comparison: "your value" vs. "server value
  (edited by <name>, <timestamp>)". The inspector picks per field (or accepts
  all server / keeps all mine), and the result is re-submitted. Nothing is
  silently overwritten either way. Supervisors are notified (web banner /
  email) when a conflict is resolved so they can re-review.

## 5. Scope boundaries

**In scope:**

- Offline read of pre-synced assigned inspections.
- Offline form editing, photo capture (≤ 40/inspection), signature capture.
- Queue-based, resumable, background sync with conflict detection using the
  existing integer record versions.
- Server-side audit history of all mutations (who/when/what/which device).
- Local purge of customer data ≤ 24 h after acceptance, with acknowledgment
  and server-side tracking of purge status.
- Pilot-first rollout with feature flag.

**Out of scope (explicitly):**

- Real-time collaboration or a collaborative editor (CRDT/OT) — excluded by
  the brief.
- Two inspectors editing the same inspection concurrently (A1).
- Offline creation of *new* inspections on the tablet (creation stays a
  server/scheduler action; inspectors work only on assigned inspections).
- Offline access to inspections not assigned to the signed-in inspector.
- Re-assignment workflows while offline.
- Editing photos after capture (crop/annotate) — defer unless pilot demands it.
- Full offline web app for supervisors.
- Background photo backup to any third-party/cloud photo service.

## 6. Local data model (SQLite)

Promote SQLite from read-through cache to a **local system of truth for
offline work**, with the server as the *global* system of record. Draft
schema (names illustrative):

- `inspection` — `id` (server id), `server_version` (integer, last synced),
  `state` (`assigned|in_progress|completed_local|submitted|accepted`),
  `assigned_to`, `payload_json` (last synced server snapshot),
  `accepted_at` (server timestamp, nullable), `purge_due_at`, `purged_at`.
- `form_draft` — `inspection_id`, `field_path`, `value_json`,
  `base_server_version` (the version the edit was made against),
  `updated_at`, `updated_by_device`. One row per dirty field = the outbox for
  form edits; preserves edit intent for conflict resolution.
- `photo` — `local_id` (UUID), `inspection_id`, `server_photo_id` (nullable
  until uploaded), `file_path`, `byte_size`, `sha256`, `capture_timestamp`,
  `upload_state` (`pending|uploading|uploaded|failed`), `upload_attempts`.
- `signature` — same shape as `photo` plus `signer_name`.
- `outbox_op` — ordered operation log: `op_id` (UUID), `inspection_id`,
  `op_type` (`upsert_fields|upload_photo|upload_signature|complete`),
  `payload_ref`, `created_at`, `state`, `attempts`, `last_error`. This is the
  single source for "what needs to be pushed".
- `local_audit_event` — append-only: `event_id`, `timestamp`, `actor`,
  `device_id`, `inspection_id`, `action`, `detail_json`, `uploaded` flag.
  Uploaded to the server audit log at sync, then eligible for local deletion
  at purge time.
- `sync_state` — key/value: last successful pull timestamp, per-endpoint
  cursors, purge-ack backlog.

Notes:

- Photos live as files in app-private storage; SQLite holds metadata and the
  upload queue state. SHA-256 enables dedupe and integrity checks on resume.
- The 40-photo cap is enforced in the capture UI and matches the brief.
- All writes that the UI confirms are committed to SQLite first (crash-safe
  by construction).

## 7. Sync protocol

Design within the constraint "REST + integer record versions".

### 7.1 Pull (server → client)

- `GET /inspections/assigned?since=<cursor>` — returns changed assignments
  and current versions; client downloads full payloads for new/changed
  inspections (`GET /inspections/{id}`) including existing photo URLs.
- Pull is incremental (cursor = server timestamp or monotonically increasing
  change id; recommend a server change sequence — see §14, D4).
- Pull also returns `state=accepted` + `accepted_at` transitions, which arm
  the purge timer.

### 7.2 Push (client → server), per inspection, in outbox order

1. `PUT /inspections/{id}` with header `If-Version: <base_server_version>`
   carrying the merged form fields.
   - `200` → server bumps integer version; returns new version. Client updates
     `server_version`, clears applied `form_draft` rows.
   - `409 Version Conflict` → server returns current version + current field
     values (+ last editor/timestamp if available; add if missing — §14, D4).
     Client marks inspection `Conflict`, stops pushing that inspection until
     resolved (photos may still upload — see §8).
2. Photo upload: `POST /inspections/{id}/photos` (multipart) with client UUID
   for **idempotency** (re-POST of same UUID returns the existing
   `server_photo_id` instead of duplicating). Resumable: either
   content-range/chunked upload or simply retry whole-file; recommend
   whole-file retry with server-side idempotency first, chunked upload only if
   pilot shows failures on large files (§14, D5).
3. Signature upload: same as photo, typed `signature`.
4. `POST /inspections/{id}/complete` with `If-Version` — transitions server
   state to submitted/awaiting review.
5. Local audit events: `POST /audit-events` (batch, idempotent by event_id).

### 7.3 Sync engine behavior

- Triggered by connectivity callbacks, app foreground, and a periodic worker
  (OS-permitted). Never requires user action.
- Ordering guarantees: per-inspection FIFO; across inspections, any order.
- Exponential backoff with jitter on 5xx/network errors; immediate surface of
  4xx (auth → re-login prompt; 409 → conflict flow).
- Partial progress is durable: every successful sub-request updates SQLite,
  so a dead connection mid-sync loses at most one in-flight request, which is
  retried idempotently.

## 8. Conflict policy

Given "no collaborative editor", use **server-wins-by-default with explicit
field-level resolution and no silent loss**:

1. Detection: integer version mismatch on push (server version >
   `base_server_version`).
2. Automatic handling: if the supervisor's changed fields do **not** intersect
   the inspector's dirty fields, auto-merge (client rebases its edits onto the
   new server version and re-PUTs). This is safe because form fields are
   independent values.
3. Manual handling: if fields intersect, the inspection enters `Conflict`
   state. Local edits are **preserved** (never discarded). Inspector resolves
   per field via the comparison UI (§4.3). Resolution produces a new edit set
   based on the latest server version and is pushed normally.
4. Photos/signatures are additive (append-only) and never conflict.
5. `complete` vs. concurrent supervisor edit: completing is allowed against
   the latest version after auto-merge; if the supervisor's edit materially
   changes the form (intersecting fields), completion is blocked until
   conflict resolution — so a supervisor's correction is never silently
   overridden by a completion.
6. Every conflict (detected, auto-merged, manually resolved) emits audit
   events on both sides.

## 9. Attachments (photos, signature)

- Capture: save to app-private storage immediately upon shutter/signature,
  before any UI confirmation; generate UUID, hash, thumbnail.
- Limits: enforce 40 photos per inspection (brief); configurable server-side
  ceiling to allow future change. Signature: exactly one active per
  inspection; re-capture replaces the *pending* signature locally, but once
  uploaded, replacement is a new versioned artifact (audit requires history,
  so server keeps superseded signatures).
- Compression: on-device resize/recompress to a configurable target
  (recommend default max dimension ~2000 px, JPEG ~quality 80) to bound
  upload size; original retained locally until purge, in case re-upload is
  needed (§14, D6 — confirm acceptable quality for regulatory use).
- Integrity: SHA-256 recorded locally and sent with upload; server verifies.
- Metadata: capture timestamp, device id; GPS optional and off by default
  pending privacy review (§14, D6).

## 10. Security

- Data at rest: rely on managed-device full-disk encryption (A8/MDM) **plus**
  app-level encryption of the SQLite database and attachment files (e.g.,
  SQLCipher or platform keystore-backed file encryption), because customer
  data lingers up to 24 h post-acceptance.
- Data in transit: TLS only; certificate pinning optional via MDM policy.
- Auth: existing app auth; sync endpoints require the same auth; photo URLs
  are signed/short-lived, not public.
- Least data: client only ever holds *assigned* inspections; purge (§11)
  bounds retention. Failed-auth devices can be remotely wiped via MDM.
- Audit: every mutation (create/update/complete/conflict-resolution/purge)
  is attributable: user id, device id, timestamp, before/after for form
  fields. Server audit log is append-only and outside the sync conflict
  domain.
- Deletion guarantee: purge deletes local customer data: payload JSON,
  drafts, photos, signature, thumbnails, cached responses. Local audit rows
  are uploaded first, then deleted. A purge *receipt* is sent to the server;
  server tracks "devices with overdue purge" and alerts.

## 11. Migration and backfill

- **Client schema migration:** versioned SQLite migrations from the current
  cache schema to the new schema. Per A10 we assume the old cache is
  disposable; even so, migration path: on upgrade, drop/re-create cache
  tables, create new tables, force a full re-pull. Verify upgrade and
  downgrade behavior (downgrade = old app sees unknown schema → treat as
  empty cache; document that downgrades lose offline drafts, and block
  downgrade via MDM during pilot if needed).
- **Server changes:** additive only — new endpoints (photos, complete,
  audit-events, purge-ack), new fields (version-conflict payload, change
  cursor), new states. No changes to existing endpoint contracts, so web app
  and old app versions keep working.
- **Backfill:** none required for inspections (they are created server-side
  already). Server-side audit log: new events start flowing at launch; no
  historical backfill needed. Purge tracking starts empty; only inspections
  accepted after launch are tracked (documented compliance boundary; if
  regulation requires retroactive purge verification, that is a separate
  workstream — flagged as D7).

## 12. Observability

**Client (uploaded at sync, sampled for verbose logs):**

- Metrics: outbox depth, sync success/failure counts by endpoint, conflict
  counts (auto vs. manual), photo upload failure rate and retry counts, time
  from local-complete to server-submitted, purge executions and purge
  overdue count.
- Structured logs with device id, app version, inspection id (hashed where
  privacy requires), network state transitions.

**Server:**

- Metrics: version-conflict rate per inspection, 4xx/5xx on new endpoints,
  upload sizes/durations, audit-event ingest lag, purge-ack overdue list
  (device, inspection, hours overdue).
- Alerts: purge overdue > 24 h (compliance-critical), conflict rate spike,
  upload failure rate spike, audit ingest failure.
- Dashboards: pilot cohort funnel (assigned → downloaded → completed locally
  → submitted → accepted → purged).

## 13. Staged rollout and rollback

**Stages (progression gated by acceptance criteria, not dates):**

1. **Internal dogfood:** feature-flagged build to engineering/QA devices
   with scripted offline scenarios.
2. **Pilot:** small group of real inspectors (size chosen by product; brief
   requires a pilot) on managed devices, flag on, in a bounded region/team.
   Duration: enough to cover multiple inspection cycles; exit criteria in
   §15, M5.
3. **Broad rollout:** ramp flag by percentage of inspectors, watching the
   §12 dashboards and alert thresholds at each step.

**Rollback:**

- Client: the feature is behind a remote flag. Flag off = app behaves as
  today (online-only). Offline drafts on flagged-off devices are **not**
  deleted; they are retained and the app offers "reconnect and sync" once
  re-flagged, or a manual export path if the rollback is permanent.
- Server: all changes additive, so rollback = stop routing traffic to new
  endpoints (flag). Existing endpoints untouched.
- Data safety invariant: rollback must never discard an unsubmitted offline
  inspection. Any rollback plan that would strand drafts requires a client
  release that forces a final sync before disabling — gate on this.
- Kill-switch drill: rehearse flag-off during dogfood, including the
  stranded-draft case.

## 14. Decisions required before implementation (with recommendations)

- **D1 — Definition of "accepted" and purge clock start.** Which server
  state counts as accepted, and is the 24 h measured from `accepted_at`
  server time? *Recommend:* the existing "review approved" transition;
  clock from server `accepted_at`; client purges on next check-in and
  reports; server alerts if no purge-ack within 24 h of the device's next
  sync.
- **D2 — Field-level vs. record-level conflict granularity.**
  *Recommend:* field-level auto-merge for non-intersecting changes, manual
  resolution for intersecting (§8). Record-level "server wins" is simpler
  but risks losing inspector work, violating the core brief.
- **D3 — Who may resolve conflicts.** Inspector-only, or supervisor too?
  *Recommend:* inspector resolves (they hold the offline context);
  supervisor is notified and can edit again afterward.
- **D4 — Server API extensions.** Confirm we may add: idempotency keys on
  photo POST, `If-Version` precondition, 409 payload with current values,
  change cursor for incremental pull, audit-events and purge-ack endpoints.
  *Recommend:* implement all as additive changes; they are prerequisites for
  M3.
- **D5 — Resumable upload strategy.** *Recommend:* start with whole-file
  retry + idempotency; add chunked/resumable uploads only if pilot metrics
  show failures. Keeps M3 small.
- **D6 — Photo quality and metadata policy.** Regulatory minimum image
  quality? GPS in EXIF allowed? *Recommend:* compressed capture at the §9
  defaults pending compliance sign-off; GPS off by default.
- **D7 — Retroactive purge verification.** Does the 24 h rule require
  evidence for inspections accepted *before* this feature? *Recommend:*
  treat as out of scope/compliance question to raise with legal now, not
  during rollout.
- **D8 — Pre-download window N.** How many days of assignments to prefetch?
  *Recommend:* today + tomorrow, adjustable remotely based on pilot storage
  data.
- **D9 — Storage floor.** Minimum free-space policy before download/capture.
  *Recommend:* block new inspection downloads below a configurable threshold
  and warn the inspector; verify actual device capacity in pilot (A3).

## 15. Milestones, dependencies, and acceptance criteria

Sequenced by dependency, not dates. No staffing estimates; effort is
expressed only as order and blocking relationships.

- **M0 — Decisions and API contract.** Close D1–D9; publish versioned API
  contract for new endpoints; compliance sign-off on D6/D7.
  - *Depends on:* nothing. *Blocks:* M1, M2, M3.
  - *Acceptance:* signed-off contract doc; compliance answers recorded.
- **M1 — Local offline core (client).** New SQLite schema + migrations;
  offline open/edit/photos/signature; durable outbox; local states; no sync
  yet (fake transport in tests).
  - *Depends on:* M0. *Blocks:* M3.
  - *Acceptance:* with airplane mode on, a scripted full inspection (40
    photos + signature) survives app kill and device reboot with zero loss;
    upgrade from current app version preserves nothing needed and never
    crashes (A10 verified).
- **M2 — Server sync endpoints.** Additive endpoints per D4: versioned PUT,
  idempotent photo/signature upload, complete, audit-events, accepted-state
  surface, purge-ack.
  - *Depends on:* M0. *Blocks:* M3.
  - *Acceptance:* contract tests pass; concurrent web edit produces a 409
    with usable payload; duplicate photo POST returns one record.
- **M3 — Sync engine + conflict UI (client).** Pull/push engine (§7),
  auto-merge, conflict state + resolution UI, sync status surfaces.
  - *Depends on:* M1, M2. *Blocks:* M4.
  - *Acceptance:* end-to-end: offline completion syncs after reconnection;
    supervisor mid-edit produces auto-merge when disjoint and a resolvable
    conflict when intersecting; no data loss in either path; intermittent
    connectivity (chaos toggle every N seconds) still converges.
- **M4 — Audit, purge, observability.** Server audit history for all
  mutations; client purge scheduler + receipts; metrics/alerts/dashboards
  (§12).
  - *Depends on:* M3. *Blocks:* M5.
  - *Acceptance:* audit trail reconstructs who/what/when/device for a full
    inspection lifecycle; a device with a mock-accepted inspection purges
    local customer data within 24 h and the server shows the receipt; an
    artificially blocked purge raises the overdue alert.
- **M5 — Pilot.** Flag on for pilot cohort; run real inspections; collect
  §3 metrics.
  - *Depends on:* M4.
  - *Acceptance (exit):* zero data-loss incidents; 100% eventual sync;
    zero unalerted purge misses; conflict UX resolves all conflicts;
    inspector feedback collected; go/no-go review.
- **M6 — Broad rollout.** Percentage ramp with dashboard gates; rollback
  drill completed beforehand.
  - *Depends on:* M5 exit + rollback drill (§13).
  - *Acceptance:* each ramp step holds §3 metrics steady for an agreed
    observation window before proceeding.

## 16. Testing strategy

- **Unit:** schema migrations, outbox ordering, merge logic (disjoint vs.
  intersecting edits), purge scheduler time math, idempotency key handling.
- **Contract:** client↔server for every new endpoint, including 409 payloads
  and duplicate-upload behavior.
- **Integration (device farm / emulators + real tablets):**
  - airplane-mode full lifecycle; app kill mid-capture, mid-sync, mid-purge;
  - intermittent connectivity harness (toggling network on a timer) verifying
    convergence and no duplicate photos;
  - 40-photo stress at low storage and low battery; OS background-execution
    limits (verify sync completes or resumes);
  - concurrent web edit during every sync phase.
- **Compliance tests:** purge timer correctness across timezone/clock skew
  (purge keyed to server `accepted_at`, not device clock); post-purge
  forensic check that no customer data remains in app storage; audit-log
  completeness.
- **Migration tests:** upgrade paths from the current store; downgrade
  behavior documented/tested.
- **Pilot rehearsal:** full dogfood of M1–M4 flows plus the rollback drill.
