# PLAN.md — Offline inspection sync for the tablet inspection app

Product input: `BRIEF.md` (sole source). No dates or staffing numbers are used;
sequencing is expressed as milestones with dependencies.

## 1. Goals and non-goals

Goals:

1. An inspector can open an assigned inspection, fill forms, take up to 40 photos,
   and collect a signature with zero connectivity, with no loss of notes.
2. Local work syncs to the server automatically whenever connectivity returns,
   however intermittent.
3. Concurrent supervisor edits from the web are handled predictably and are
   auditable.
4. Regulatory obligations are met: append-only audit history, and removal of
   local customer data within 24 hours after an inspection is accepted.
5. A pilot runs before broad rollout.

Non-goals (explicit):

- No full collaborative editor / real-time co-editing. Concurrent editing is
  resolved by a defined conflict policy, not by merging cursors.
- No offline supervisor web editing.
- No changes to the server's REST + integer-record-version API contract beyond
  additive endpoints.

## 2. Explicit assumptions

| # | Assumption | If wrong |
|---|------------|----------|
| A1 | Tablets are company-managed (MDM), so we can enforce encryption-at-rest, remote wipe, and app-level data purge. | Security section needs rework; 24h purge may be unverifiable. |
| A2 | Connectivity, though intermittent, returns often enough (hours, not weeks) for photos and records to sync before the 24h purge deadline. | Purge must wait for sync completion, not just acceptance time. |
| A3 | Server APIs are REST with integer record versions and can add endpoints without breaking existing clients. | Sync protocol changes; migration risk. |
| A4 | SQLite on the tablet has capacity for the pilot's local working set (open inspections + up to 40 photos each, with photos stored as files and only metadata in SQLite). | Need local quota management / eviction earlier. |
| A5 | An "accepted" state exists (or will exist) server-side that starts the 24-hour purge clock. | Define acceptance trigger before implementation. |
| A6 | Supervisors edit from the web only while inspections are in editable states; they do not need offline edits. | Scope grows significantly. |
| A7 | A single inspector works on a given inspection offline at a time (assignments are per-inspector), but a supervisor may edit concurrently. | Conflict surface is inspector-vs-supervisor only. |
| A8 | Audit history is a server-side regulatory record; the tablet is not the system of record for audit. | Audit design changes. |

## 3. User flow (offline-first)

1. Inspector opens the app (online or offline). App shows assignments downloaded
   during the last sync.
2. Inspector opens an assigned inspection. App loads the full inspection
   (form schema, existing answers, photo metadata) from local SQLite. No
   network call is required to open or edit.
3. Inspector edits form fields. Every mutation is written immediately to local
   SQLite inside a transaction and appended to a local outbox/change log with a
   client-generated change ID. UI never blocks on the network.
4. Inspector adds photos (up to 40). Photos are written to app-private storage,
   metadata row in SQLite, state = `pending_upload`.
5. Inspector captures a signature offline; stored as an attachment, same
   pipeline as photos.
6. Inspector marks the inspection complete/submits. Record moves to
   `pending_sync`; submission is durable locally even if the app is killed.
7. Whenever connectivity is detected (connectivity listener + background
   sync worker), the app pushes pending changes: metadata first, then
   attachments in the background, with resumable uploads.
8. Server applies changes with optimistic concurrency; responses update local
   state and record versions. On success, local rows move to `synced`.
9. Supervisor edits from the web concurrently are pulled down on next sync;
   conflicts are resolved per the conflict policy and surfaced in the UI.
10. When the server marks the inspection `accepted`, the 24h purge clock
    starts; the app purges local customer data for that inspection within
    24h (see §8).

Failure UX: any sync failure leaves local state intact; the user sees a
"pending sync" indicator with retry. Notes are never discarded on connection
loss (the current pain point).

## 4. Scope boundaries

In scope:

- Offline read of assigned inspections; offline form entry; offline photo
  capture (≤40) and signature; durable local writes; background sync;
  inspector-vs-supervisor conflict handling; local purge after acceptance;
  pilot rollout.

Out of scope:

- Real-time collaborative editing, presence, or operational transforms.
- Offline web app for supervisors.
- Editing inspections not assigned to the inspector.
- Server-side form-schema authoring changes (use existing schemas).
- Replacing the server API style (stays REST + integer versions).

## 5. Local data model (SQLite)

SQLite is promoted from read-through cache to the local store of record for
offline work. Photos/signature blobs live in app-private files; SQLite holds
metadata and content.

Tables (additive; existing cache tables are migrated, §9):

- `inspection_local` — one row per inspection: `id` (server id), `record_version`
  (last synced server integer version), `local_state` (`draft` / `pending_sync` /
  `synced` / `conflicted` / `accepted`), `assigned_to`, `updated_at`,
  `accepted_at` (nullable), `purge_due_at` (nullable).
- `field_change` — the outbox: `change_id` (client UUID, idempotency key),
  `inspection_id`, `field_name`, `value_json`, `base_version` (record version
  the change was made against), `created_at`, `sync_state`
  (`pending` / `sent` / `acked`), `attempts`.
- `attachment` — `attachment_id` (client UUID), `inspection_id`, `kind`
  (`photo` / `signature`), `file_path`, `bytes`, `mime`, `capture_index`
  (enforces ≤40 photos), `upload_state` (`pending` / `uploading` / `uploaded`),
  `checksum`, `created_at`.
- `sync_cursor` — key/value: last successful server pull timestamp, per-entity
  watermarks, device id.
- `audit_outbox` — local mirror of user actions for debugging; not the
  regulatory audit (server is).

Indexes on `field_change(sync_state, created_at)`,
`attachment(upload_state)`, `inspection_local(local_state, purge_due_at)`.

Local-only invariants: at most 40 rows of `kind='photo'` per inspection;
`purge_due_at` set exactly when `accepted_at` is set.

## 6. Sync protocol

Transport: existing REST style, integer record versions, additive endpoints.

Pull:

- `GET /v1/inspections/assigned?since=<cursor>` — incremental pull of
  assignments and changed inspections (supervisor edits included). Cursor is
  server time or high-watermark; stored in `sync_cursor`.
- Response carries each inspection's current integer `record_version`.

Push (metadata):

- `POST /v1/inspections/{id}/changes` — body: list of `field_change` rows
  (change_id, field_name, value, base_version) + client attachment manifest.
  Server validates `base_version` against current version:
  - Match → apply, bump version, append audit entries, return new version.
  - Mismatch → return 409 with the server's current record and version;
    client resolves per conflict policy (§7) and retries.
- Idempotency: `change_id` is the idempotency key; retries after network loss
  are safe. Server dedupes on `change_id`.

Push (attachments):

- `POST /v1/inspections/{id}/attachments` — multipart, resumable (chunked
  upload with offset resume), one request per attachment, checksum verified
  server-side. Attachments are uploaded after metadata is acked so the server
  can reject orphan uploads. Signature is just `kind='signature'`.
- Ordering guarantee: metadata first, attachments second, per inspection;
  acceptance/submission only allowed server-side when required attachments
  are uploaded (server enforces ≤40 photos).

Sync engine:

- Triggered by: app foreground, connectivity regained, periodic background
  work (OS-scheduled), and explicit "Sync now".
- Exponential backoff with jitter per entity; circuit breaker per endpoint.
- Pull-then-push per sync cycle to minimize 409s.

## 7. Conflict policy

Conflict surface (per A7): inspector offline edits vs. supervisor web edits on
the same inspection. No inspector-vs-inspector conflicts (assignment model),
and product explicitly does not want a collaborative editor.

Policy: field-level last-writer-wins (LWW) with server arbitration and full
audit. Concretely:

- Every field change carries a client timestamp and the `base_version` it was
  made against.
- Server compares incoming changes against current record. If
  `base_version` is stale, the server does not blindly reject: it merges at
  field granularity — fields the supervisor changed since `base_version` and
  that the inspector did not touch are kept; fields both touched are resolved
  LWW by timestamp; fields only the inspector touched are applied.
- Every merge decision is written to the server-side audit log (old value,
  new value, actor, source device, reason).
- If any field was overwritten by LWW, the inspection's local state becomes
  `conflicted`; the inspector sees a banner listing which fields were adjusted
  by the supervisor, with the supervisor's values shown. The inspector can
  re-edit; their new edits create new `field_change` rows.
- Photos/signature are additive-only; no merge conflict possible. Replacing a
  photo is a new attachment plus a field change pointing at it; the old file is
  retained server-side for audit.

Why not OT/CRDT: out of scope per brief; LWW + audit + surfacing is proportionate
for two-party, low-frequency edits.

## 8. Security and data retention

- Encryption at rest: rely on platform full-disk encryption plus app-private
  storage containers; verify MDM enforces device encryption and passcode
  (A1). No customer data in backups, logs, or notifications.
- In transit: TLS for all endpoints; certificate pinning optional (decision D6).
- Local purge (regulation): when the server marks an inspection `accepted`,
  the app learns via pull and sets `purge_due_at = accepted_at + 24h`. A
  scheduled local job purges: form answers, field_change rows, attachment
  metadata, and the photo/signature files, for that inspection. Purge runs on
  app foreground, on connectivity, and via background work; it is verified by a
  local check job that scans for orphan files. Purge completion is reported to
  the server (`DELETE /v1/devices/{device}/local-data` acknowledgement) so
  compliance can be evidenced. If the device is offline at the deadline, purge
  still executes locally (it does not depend on the server); the ack is sent
  later.
- Audit: the regulatory audit history is server-side and append-only; the
  client never edits it. Local `audit_outbox` is diagnostic only and is purged
  with the inspection.
- MDM backstop: managed tablets support remote wipe if a device is lost.

## 9. Migration and backfill

- Existing SQLite cache tables are migrated with an additive schema migration
  (new tables above; cache tables kept until first successful sync, then
  dropped). Migration runs on app start, is idempotent, and is versioned.
- Backfill: on first run after upgrade, the app pulls all assigned open
  inspections and their current server versions into the new tables, and
  queues nothing for push (no phantom changes).
- In-flight upgrades: an inspector mid-edit when the app updates must not lose
  notes — the migration preserves existing draft state or, at minimum, exports
  it; test covers kill-during-migration.
- Server backfill: none required for pilot; existing records flow through the
  incremental pull. Audit history remains continuous (no rewrite of past
  audit rows).

## 10. Observability

Client (privacy-safe, no customer data in logs):

- Sync counters: changes pending/sent/acked, attachments pending/uploaded,
  409 conflict count, consecutive failures, last successful pull/push time.
- Purge job: inspections purged on time vs. late, orphan-file scan results.
- Local diagnostics screen (for support): per-inspection sync state.

Server:

- Standard request metrics plus: change-application success/409/merge
  outcomes, attachment upload success/resume counts, purge-ack lag
  (accepted_at → purge ack received) with alerting when lag approaches 24h.
- Audit log queryable by inspection for compliance.

Alerts: purge-ack lag > threshold; sync failure rate spike; attachment upload
failure spike.

## 11. Staged rollout

Stage 0 — Internal dogfood: team devices, synthetic inspections.
Stage 1 — Pilot: one supervisor team, one region, a bounded number of
inspectors, real inspections, feature-flagged. Success criteria below.
Stage 2 — Broad rollout: remaining teams, in waves, still behind the flag.
Stage 3 — Cleanup: remove flag, retire cache-only code path.

The feature flag gates offline write mode; when off, the app behaves exactly
as today (read-through cache).

## 12. Rollback

- Client: flag off restores the old cache-only behavior; new tables are left in
  place but unused (additive migration is safe to keep). Worst case, app
  version rollback via MDM; local unsynced data is preserved across the
  downgrade path because the outbox tables are additive (verify in testing).
- Server: new endpoints are additive; rollback = stop calling them. No schema
  change that old clients depend on. In-flight `pending_sync` inspections are
  re-pullable after rollback (they were never lost server-side; local pending
  changes remain on device and sync if the flag is re-enabled).
- Data: no server data migration to reverse; audit rows written by the new
  endpoints remain valid audit history.

## 13. Testing

- Unit: outbox transactionality, ≤40 photo invariant, LWW merge function,
  purge job, backoff/retry, idempotency-key dedupe.
- Integration (test server): pull/push round trip; 409 path; field-level merge
  matrix (supervisor-only, inspector-only, both-touched, stale base version);
  attachment upload + resume after mid-upload failure; dedupe on retried POST.
- E2E (device): airplane-mode open/edit/photos/signature → kill app → reopen →
  notes intact; restore connectivity → full sync; concurrent supervisor edit
  during offline edit → conflict banner; acceptance → purge within 24h with
  device offline at deadline; migration from old schema mid-edit.
- Failure injection: kill during sync, kill during migration, kill during
  purge, storage-full, slow/intermittent network (shaped), clock skew.
- Compliance test: audit log contains every applied change and merge decision;
  purge verified by local scan and server ack.
- Pilot exit review against acceptance criteria before Stage 2.

## 14. Milestones, dependencies, acceptance criteria

No calendar dates; order and dependencies only.

- **M1 — Server sync API (additive).** Deps: none. AC: change endpoint with
  idempotency keys + integer-version checks returns new versions; 409 with
  current record on stale base; field-merge endpoint or merge logic per §7;
  attachment upload endpoint with checksum + resume; purge-ack endpoint;
  audit entries written for every applied change and merge; integration tests
  green.
- **M2 — Local store of record + outbox.** Deps: none (parallel with M1).
  AC: schema migration from cache tables; offline open/edit/photo/signature
  persists across app kill; ≤40 photo invariant enforced; outbox durable and
  idempotent.
- **M3 — Sync engine + conflict handling.** Deps: M1, M2. AC: pull/push
  round trip; background sync on connectivity; 409 → field-level merge →
  `conflicted` banner; attachments uploaded with resume; E2E offline→online
  test green.
- **M4 — Attachments pipeline.** Deps: M1, M2. AC: 40 photos + signature
  captured offline, uploaded reliably under shaped lossy network, checksums
  verified, server rejects >40 and orphan uploads.
- **M5 — Purge + security hardening.** Deps: M3. AC: acceptance triggers 24h
  local purge executed even while offline; orphan scan clean; purge ack
  reported; MDM encryption/wipe verified; no customer data in logs.
- **M6 — Observability.** Deps: M3, M5. AC: dashboards and alerts in §10 live;
  purge-lag alert fires in a forced test.
- **M7 — Pilot (Stage 1).** Deps: M1–M6. AC: pilot team completes real
  inspections end-to-end offline; zero lost notes; conflicts resolved with
  audit; 100% of accepted inspections purged within 24h; supervisor sign-off.
- **M8 — Broad rollout (Stages 2–3).** Deps: M7 exit criteria met. AC: all
  teams migrated; flag removed; cache-only path retired; rollback drill
  executed once in staging.

## 15. Decisions required before implementation (with recommendations)

- **D1 — Conflict resolution approach.** Options: record-level reject
  (409, inspector retries), field-level LWW with audit, CRDT/OT.
  **Recommendation: field-level LWW with server arbitration, audit, and a
  conflict banner.** Proportionate to two-party edits; no collaborative editor
  per brief.
- **D2 — What starts the 24h purge clock.** "Accepted" server state vs. sync
  completion. **Recommendation: server `accepted` state (regulatory event),
  with purge executed locally even if offline; ack sent when online.**
- **D3 — Purge vs. unsynced data.** If a device is offline at acceptance and
  still holds unsynced changes, purge anyway or wait for sync?
  **Recommendation: sync-first with a hard cap — attempt sync at acceptance;
  purge at 24h regardless, but block acceptance-triggered purge only if the
  record is still `pending_sync` AND the deadline is >X hours away; escalate
  via alert. Simpler alternative: purge at 24h regardless (recommend this —
  compliance wins; pending changes are also on the server once synced, and an
  inspector should not submit without sync unless connectivity is absent, in
  which case the server has nothing to accept yet).** Final call needed with
  compliance.
- **D4 — SQLite as store of record vs. new local DB.** **Recommendation:
  promote existing SQLite (already present, avoids a second DB and a second
  migration path).**
- **D5 — Attachment storage on device.** **Recommendation: app-private files,
  metadata in SQLite, checksums, resumable chunked upload; server is the only
  long-term store.**
- **D6 — Certificate pinning.** **Recommendation: defer to post-pilot; TLS +
  managed devices is adequate for pilot; revisit if threat model requires.**
- **D7 — Pilot scope.** **Recommendation: one region, one supervisor team,
  bounded inspector count, flag-gated, with M7 exit criteria.**
- **D8 — Supervisor visibility of offline drafts.** Can supervisors see
  `pending_sync` drafts? **Recommendation: no — supervisors see only synced
  state; drafts are inspector-local until pushed. Reduces confusion and
  conflict surface.**
- **D9 — Audit of local (pre-sync) actions.** **Recommendation: audit begins
  at server apply time; local actions are mirrored in the diagnostic outbox
  only. Confirm with compliance that regulatory audit starts at submission.**
