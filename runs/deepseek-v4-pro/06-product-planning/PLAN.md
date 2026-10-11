# PLAN.md — Offline Building Inspection Sync

## 1. Purpose

Enable inspectors on company-managed tablets to work offline (basements with no
coverage), then sync reliably when connectivity returns, without discarding
notes and without conflicting destructively with supervisor edits made from the
web. Fix the current data-loss defect ("lost connection discards notes") and lay
the groundwork for a pilot program.

This plan is driven solely by `BRIEF.md`. Anything not stated there is called out
as an explicit assumption in §2 and is expected to be confirmed in the decisions
gate (§12) before implementation starts.

---

## 2. Explicit assumptions

Confirmed-or-conjectured assumptions that the plan is built on. Each is a
candidate for the decisions gate.

1. **Single-operator tablet.** A tablet is used by one inspector at a time;
   there is no multi-user sharing of a single offline session. (If multiple
   inspectors share a tablet, an explicit sign-in + per-user data partition is
   required.)
2. **Pre-assignment.** Inspections are assigned to the inspector's tablet before
   the inspector goes offline. There is no requirement to discover/pull
   *unassigned* inspections while offline.
3. **Intermittent, not permanently-offline.** Offline is a temporary state
   (hours, at most a working day). True indefinite offline storage is out of
   scope for this phase.
4. **Server timestamp is authoritative.** Tablet clocks may drift; ordering and
   audit times ultimately come from the server at sync time, while the device
   records local (best-effort) capture timestamps for UX.
5. **Inspection = one form + ≤40 photos + one signature.** No video, no audio,
   no arbitrary file attachments in this phase.
6. **"Accepted" is a server-side terminal state.** An inspection becomes
   *accepted* only on the server (by supervisor action or workflow), and the
   24-hour local purge clock starts from the moment the tablet learns of that
   acceptance via a successful sync.
7. **SQLite is device-local only.** There is no cross-device SQLite replication;
   the server remains the system of record, and SQLite is upgraded from a
   read-through cache to a staging store (write-through/queue).
8. **Existing API can be extended, not replaced.** We add new endpoints / headers
   for sync rather than re-architecting REST + integer versioning into a new
   protocol (e.g., no CRDT layer, no WebSocket sync) for this phase.
9. **Audit history is a server property.** Regulatory audit history is kept on
   the server (append-only). The local device keeps a transient copy for upload
   until acknowledged, then purges customer data per the 24-hour rule.
10. **Not a collaborative editor.** Field-level merge for scalar fields is the
    ceiling of sophistication; we explicitly do not build real-time co-editing,
    presence, or per-keystroke sync.

---

## 3. Scope boundaries

### In scope
- Open an *assigned* inspection offline and enter form data.
- Attach up to 40 photos, captured offline.
- Collect a single signature offline.
- Queue all changes locally and replay them when connectivity returns.
- Detect and resolve conflicts with supervisor edits made during the offline
  window (field-level last-write-wins; see §7).
- Download required inspection data (form template, prior photos, supervisor
  notes) before going offline.
- Remove local customer data within 24h of server-side acceptance.
- Append-only audit trail per inspection.

### Out of scope (explicitly)
- A full collaborative/co-authoring editor with presence or text CRDTs.
- Creating *new* inspections on the tablet offline.
- Reassigning inspections between inspectors on the tablet.
- Offline browsing/pulling of inspections not already assigned to the device.
- Video, audio, or arbitrary file attachments (beyond photos + signature).
- Deleting/editing an already-accepted inspection from the tablet.
- Indefinite offline retention beyond the working-day window.

---

## 4. User flow

1. **At base (online):** inspector signs in; the tablet downloads today's
   assigned inspections (template + existing photos + signatures + base
   versions). The app shows a "ready for offline" confirmation with counts and
   available storage.
2. **Enter offline:** connection drops. The app shows a visible **offline
   banner** and the subset of work that is fully local. The user keeps working.
3. **Offline work:** open inspection → fill form → take/attach photos (≤40) →
   collect signature. Each edit is written to local SQLite and marked `dirty`;
   the "unsynced changes" badge increments.
4. **Connection returns (auto or manual retry):** app detects connectivity and
   begins background sync (see §6). User can continue working; sync is
   non-blocking. Progress and any errors/conflicts surface in a sync tray.
5. **Sync result:** the app shows "synced X of Y", any conflicts resolved
   automatically (§7), and any items requiring manual attention.
6. **Acceptance & purge:** when the server accepts an inspection, the tablet
   learns of it at the next sync, and schedules local deletion of customer data
   after 24h (§9).
7. **Back at base (online) / end of shift:** tablet is verified as fully synced
   before being returned; remaining local data purged per policy.

---

## 5. Local data model (SQLite)

Upgrade SQLite from a read-through cache to a two-stage store. Key tables
(conceptual; exact schema is a decisions-gate output):

- `inspection`
  - `id`, `server_version` (base integer version the device last saw),
    `form_payload` (current local form state), `state`
    (`assigned | open | submitted_pending | accepted | archived`),
    `dirty_fields` (set of field names changed locally), `local_status`
    (`clean | dirty | syncing`), `last_synced_at`, `purge_due_at`.
- `attachment`
  - `id`, `inspection_id`, `kind` (`photo | signature`), `uri` (encrypted blob
    path), `captured_at`, `upload_state` (`pending | uploading | uploaded`),
    `content_hash`.
- `change_log`
  - Append-only per-inspection log of local mutations (what/whom/when) used both
    for the sync queue and for building the server audit entries. Reuses the
    same shape as the server's audit schema so uploads are a direct copy.
- `sync_queue`
  - Ordered outbox of pending sync operations (upsert-inspection, upload-attachment,
    upload-change-log, mark-accepted). FIFO with retry counts and last error.
- `assignment_manifest`
  - What was downloaded for offline use, and whether it is complete.

Principles:
- Every local write is: (1) written to the domain table, (2) appended to
  `change_log`, (3) enqueued in `sync_queue` — as a single SQLite transaction.
- `server_version` is never mutated by the client except by the sync loop.
- Attachments are stored as encrypted files referenced by `attachment`, not as
  blobs in the DB, to bound DB size and support partial uploads.

---

## 6. Sync protocol

Extends the existing REST + integer-version API. Two-phase per inspection:

**Phase A — Pull (download baseline).** GET inspection by id → template, prior
photos/signatures, `server_version`, current supervisor edits. Populates the
local store with `server_version = N`.

**Phase B — Push (flush outbox).** Ordered operations:
1. Upload attachments chunked/resumable (photos and signature first, since later
   form writes may reference them).
2. `POST /inspections/{id}/sync` with body:
   - `base_version = N` (version the device last observed)
   - `dirty_fields` + field values (only changed fields)
   - `change_log` entries for audit
   - `attachment` hashes/ids for reconciliation
3. Server responds with:
   - `new_version`, `accepted` flag, `purge_due_at` (if accepted), and any
     server-side field wins (for conflict display).

Concurrency model: optimistic concurrency keyed on `base_version`. The server
applies the push only for fields in `dirty_fields`, incrementing `server_version`
exactly once per accepted sync. Idempotency: the push carries a client-generated
`sync_operation_id` so retries after a network drop are deduplicated (server
dedupes on that id, not on version alone).

Resumability: attachment upload uses ranged uploads keyed on `content_hash`,
so an interrupted 40-photo upload resumes rather than restarts.

---

## 7. Conflict policy

Objective: never silently discard either the inspector's work or the
supervisor's work, while keeping the implementation much simpler than a
collaborative editor.

1. **Attachments and audit log — append-only, never conflict.** Photos,
   signatures, and change-log entries are additive across writers. Both fates'
   additions coexist (a photo uploaded by the inspector is added to the set; a
   supervisor edit is a new audit entry). No merge logic needed.
2. **Scalar form fields — field-level last-write-wins.**
   - The client sends only `dirty_fields` with a local `modified_at` per field.
   - Server compares per-field: the write with the later `modified_at` wins that
     field; the loser's value is retained in the audit log (not silently lost).
   - Because field-level merge is confined to scalar fields touched by the
     client, a supervisor editing *different* fields during the offline window
     is never overwritten.
3. **Same field edited by both — deterministic tiebreak.** If both parties edit
   the same field, last `modified_at` wins; if timestamps are equal, the server
   revision wins. The losing value is surfaced in the UI and retained in audit
   history.
4. **Accepted/terminal-state guard.** A push targeting an inspection the server
   has already marked `accepted` is rejected with a terminal response and the
   device transitions to purge rather than attempting to overwrite.
5. **No manual merge UI in v1.** Conflicts resolve automatically per the rules
   above; the result is shown as "field X was updated by supervisor to Y" in the
   sync tray. Manual conflict review is deferred and only added if field-level
   LWW proves insufficient.

---

## 8. Attachments

- **Photos:** up to 40 per inspection, captured offline; stored encrypted on
  device (see §9); uploaded resumable, chunked, with `content_hash`
  deduplication. Thumbnails generated on-device to keep UI responsive.
- **Signature:** a single vector/stroke capture (and/or PNG) per inspection;
  treated as an attachment, not a form field, so it is append-only. Signature
  image + a verifiable signature (timestamps captured + upload hashes) are
  preserved for audit.
- **Ordering:** uploads happen before the inspection upsert so the server can
  validate the form (e.g., "all required photos present") atomically.
- **Storage budget:** device enforces a local quota; UI warns when approaching
  it. A full 40-photo inspection plus signature should never exceed the pilot
  device memory budget (size constant is a decisions-gate input, not a guess).

---

## 9. Security

- **Device:** company-managed via MDM; enforce screen-lock PIN/biometric; app
  unlock optional but recommended pre-pilot.
- **At-rest encryption:** SQLite encrypted with SQLCipher (passphrase via
  device Keystore/Keychain); photos/signatures encrypted with per-inspection
  keys; keys never leave the secure enclave.
- **Transport:** TLS for all REST sync; certificate pinning on the tablet.
- **Auth:** short-lived access tokens + long-lived refresh handled offline;
  tokens stored in secure storage; never in SQLite or logs.
- **Data minimization / purge:** see §10. After purge, key material for that
  inspection is destroyed so decryption is impossible even if storage is
  recovered.
- **Logs:** no customer PII in local logs or crash reports (redaction by
  default); screenshots disabled if possible.
- **Audit integrity:** server audit entries are append-only and hash-chained
  where required; client change_log provides the who/when for the offline window.

---

## 10. Regulatory compliance, migration & backfill

### 24-hour data removal
- Server sets `accepted_at` and `purge_due_at = accepted_at + 24h` and returns
  them on the next sync.
- Device schedules a `purge` for `purge_due_at - safety_margin` and deletes all
  local customer data for that inspection (form, photos, signature, change_log),
  then wipes its keys. A purge receipt is sent to the server for audit.
- Device checks purge obligations on every app foreground AND at every sync,
  so it cannot be bypassed by the user keeping the app backgrounded.

### Migration & backfill
- **Schema migration:** existing SQLite read-through cache → new schema (§5) via
  a versioned migration (add `server_version`, `dirty_fields`, `sync_queue`,
  `change_log`, `attachment`). Read-through cached data is retained as the
  initial baseline where compatible; anything already incomplete is re-pulled.
- **Backfill on server:** for inspections currently mid-flight, backfill
  `server_version`, `accepted_at`/`purge_due_at`, and audit history so the
  device has a coherent base version on first sync.
- **Template backfill:** ensure form schemas are published to a versioned
  endpoint so the tablet can fetch the correct template before going offline.
- **Existing-photos backfill:** prior photos/signatures are available for
  download so the tablet is a complete working copy, not a partial one.

---

## 11. Observability

Instrument and alert on (client + server):
- Sync success rate, sync duration, and queue depth per tablet.
- Attachment upload failures and retries; bytes uploaded.
- Conflict counts broken down by field (to verify LWW assumptions).
- Manual-attention items (should be zero in v1; any nonzero is an alert).
- Purge compliance: % of accepted inspections purged within 24h; any breach is
  a P0 alert.
- Client crash/failure rates, SQLite corruption events.
- Offline duration distribution (to validate the "working day" assumption).

Dashboards: pilot health (per-tablet and per-region) plus a compliance board.

---

## 12. Decisions required before implementation (with recommendations)

| # | Decision | Recommendation | Why |
|---|----------|----------------|-----|
| D1 | Conflict resolution granularity | Field-level LWW (scalar fields); append-only for attachments/audit | Matches "no collaborative editor" while protecting supervisor edits; record-level LWW would stomp unrelated supervisor changes |
| D2 | Same-field tiebreak | Server revision wins on equal timestamps | Deterministic, no client clock trust |
| D3 | Client clock authority | Server timestamp authoritative; device time advisory only | Devices drift; audit must be trustworthy |
| D4 | Sync unit | Per-inspection upsert (not whole device blob) | Bounds failure radius, permits partial progress |
| D5 | Idempotency mechanism | Client `sync_operation_id` + server dedupe | Prevents duplicate writes from retries after drops |
| D6 | At-rest encryption | SQLCipher + per-inspection attachment keys | Regulatory + theft risk on field tablets |
| D7 | Purge trigger | Server-selected `purge_due_at`, device self-checks foreground+sync | Compliance can't be bypassed on the device |
| D8 | Offline retention ceiling | Working-day horizon, device quota hard stop | Avoids indefinite offline scope creep |
| D9 | Form-template versioning | Versioned template endpoint downloaded pre-offline | Tablet must have the right schema to validate offline |
| D10 | Pilot tenancy model | Per-region feature flag; siloed audit | Enables staged rollout + clean rollback |

---

## 13. Staged rollout

1. **Dark / shadow mode (no users).** All sync writes run against staging with
   production-shaped data; verify no data loss vs. online path.
2. **Pilot (single region, ~n inspectors).** Feature-flagged tenants only.
   Inspectors work offline with a fallback to online; supervisor workflows
   unchanged. Daily compliance review of §11 metrics.
3. **Pilot expansion.** 2–3 more regions after the pilot meets §14 acceptance
   criteria for N consecutive working days (no date committed here).
4. **Broad rollout.** Only after compliance metrics hold and rollback has
   been rehearsed (see §15).

Gating rule: each stage advances only on meeting the acceptance criteria in the
prior stage, not on a calendar.

---

## 14. Milestone sequence, dependencies & acceptance criteria

Ordered; each milestone depends on the previous unless noted.

**M0 — Decision gate & spike**
- Deps: none.
- AC: D1–D10 resolved and recorded; a sync-protocol spike (merge + idempotency)
  validated against a test double of the REST API.

**M1 — Local store & migration**
- Deps: M0.
- AC: SQLite schema migration is atomic and reversible; read-through cache
  converts with no data loss; every local write enqueues atomically
  (unit-proven).

**M2 — Offline capture (form, photos ≤40, signature)**
- Deps: M1.
- AC: full inspection can be captured with zero connectivity; 40-photo + visa
  signature stress passes on pilot hardware with quota warnings.

**M3 — Sync engine (push/pull, resumable uploads, dedupe)**
- Deps: M1 (indep. of M2 for TDD purposes).
- AC: drop-connection at every phase resumes correctly; duplicate retries produce
  exactly one server write; pull/push round-trips cleanly.

**M4 — Conflict policy + supervisor concurrency**
- Deps: M3.
- AC: matrix of supervisor-edit-vs-offline-edit scenarios converges to §7 rules;
  no unrelated field is ever overwritten; losing values appear in audit.

**M5 — Acceptance, purge & compliance**
- Deps: M3, M4.
- AC: tablet learns acceptance at sync and purges within 24h; purge verified
  even when app backgrounded; purge receipts reach the server audit.

**M6 — Security hardening**
- Deps: M2, M3.
- AC: SQLCipher + key management verified; security review pass of storage,
  logs, and transport completes cleanly.

**M7 — Observability & pilot instrumentation**
- Deps: M3.
- AC: §11 dashboards and P0 alerts live for staging + pilot.

**M8 — Pilot & staged rollout**
- Deps: M4, M5, M6, M7.
- AC: pilot passes shadow + single-region criteria; rollback rehearsed.

---

## 15. Rollback

- **Feature-flag kill switch.** Offline mode is behind a per-tenant flag; kill
  forces online-only operation immediately.
- **Data safety on rollback.** Before disabling, device flushes pending queue;
  any unflushable data is retained (not purged) and warned about. Rollback must
  never delete un-synced user data.
- **Schema reversibility.** DB migration supports downgrade so a rolled-back
  binary can still open the store read-only.
- **API compatibility.** New sync endpoints are additive; existing online path
  remains the fallback so the web/supervisor flow is never blocked.
- **Rehearsal.** Rollback is exercised in staging and in the pilot working group
  before broad rollout (ties to M8 AC).

---

## 16. Testing

- **Unit:** merge/LWW rules, tiebreak, queue ordering, idempotency, schema
  migration, purge scheduling.
- **Integration:** server-API contract tests for the sync protocol; dedupe and
  version-increment correctness; supervisor-vs-inspector concurrency tests.
- **Network:** Chaotic monkey (drop/toggle/DNS-delay) at every sync phase;
  resumable-upload interruption matrices; intermittent-connectivity replay.
- **Device:** pilot hardware; 40-photo + signature stress; storage quota; battery
  and low-memory; SQLite corruption recovery.
- **Security:** at-rest encryption verification; no-PII-in-logs; key-wipe after
  purge; cert-pinning tests.
- **Compliance:** 24-hour purge clock verification (foreground/background/sync
  triggers); audit-history completeness across the offline window.