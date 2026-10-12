# PLAN — Offline inspection sync

Status: draft for review. Scope source: `BRIEF.md` only. No dates or staffing
estimates are given; sequence is expressed as milestones and gates.

## 0. Premise and change in kind

Today SQLite is a read-through cache: the server is the system of record and a
dropped connection discards local writes. This plan makes the **device a
temporary system of record** for inspections assigned to it, with the server
remaining the authoritative system of record after sync. Everything below
follows from that one change: we now guarantee *local durability of inspector
input* (notes, photos, signature) as the primary requirement, and we pay for it
with a local mutation queue, conflict handling, and a hard 24-hour data-removal
obligation.

## 1. Explicit assumptions

| # | Assumption | Basis | Confidence |
|---|-----------|-------|------------|
| A1 | Tablets are company-managed, app-updatable, single signed-in user per device, MDM-enrolled | Brief | High |
| A2 | Inspections are assigned to a specific inspector ahead of time, so the device can pre-fetch them | Brief ("open assigned inspections") | High |
| A3 | Server is REST with integer record versions and can accept writes carrying a version (optimistic concurrency) | Brief; **unverified** | Medium |
| A4 | Inspector and supervisor edits are largely disjoint (different form sections); heavy same-field overlap is the exception | Brief implies supervisor review vs. inspector data collection; **unverified** | Low |
| A5 | "Accepted" is a discrete server-side state change that can be recorded and propagated | Regulations clause; **unverified** | Medium |
| A6 | A stable analytics/error pipeline exists on mobile that we can extend rather than build | Not in brief | Medium |
| A7 | Push notification is unavailable/unreliable in basements; sync triggers must work on connectivity regain | Brief | High |

A4 and A5 directly shape the conflict and purge designs; both are testable in
the pilot before broad rollout.

## 2. User flow

Primary flow (steady state):

1. Inspector signs in online (same session model as today), opens **My
   inspections**; assigned inspections sync down with their schema, prior
   field data, and attachments metadata.
2. Inspector opens an inspection. The form renders from the local store; a
   persistent **Offline** chip is shown while there is no signal.
3. Inspector works: taps fields, takes up to 40 photos, collects a signature.
   Every keystroke and capture commits to the local store within ~1s; there is
   no "lose notes" window.
4. Inspector submits for review. This is a **local** submit: the record moves to
   a local `submitted` state immediately; the device queues the change.
5. Device gains any connectivity (Wi-Fi tether, return to office, cellar edge):
   the sync engine drains the outbox: mutations, then photo binaries, then
   state callbacks to `submitted`.
6. Supervisor on the web reviews. If a conflict with a web edit is detected, the
   change does not silently vanish; it enters the conflict queue (§5) and the
   inspector's tablet surfaces a **Needs review** badge.
7. On server acceptance, the device receives an accept event (§5 step 6),
   schedules the 24-hour purge, and the inspection moves to read-only history
   locally.

Secondary flows: connection lost mid-photo-capture (photo completes, resumes);
two inspections open back-to-back with no connectivity (queue drains both);
device replaced while inspections are in flight (outbox reconstructed from
server state; unsynced local-only work is server-authoritative loss, surfaced
to supervisor); supervisor edits while inspector is offline (surfaced on next
sync as a conflict or a non-overlapping merge).

## 3. Scope boundaries

In scope: offline read of assignments; offline form entry incl. photos and
signature; local submit/submit-for-review; deferred upload with resume; sync of
field values; automated non-overlapping merge with detection + manual
reconciliation for overlapping edits; conflict surfacing to the inspector;
append-only audit history readable by supervisors; purge of local customer data
within 24h of acceptance; pilot instrumentation.

Non-goals (explicit, per brief): full collaborative/real-time co-editing (no
OT/CRDT layer); offline creation of new inspections; offline assignment or
schedule changes; multi-user shared device login; offline deletion; web app
changes beyond a conflict listing UI and version-field preconditions; server
rewrite; PDF report generation on device.

Boundary: the tablet must never be the only copy of customer data for longer
than the sync SLA (24h offline grace). If an unsynced local-only inspection
would exceed that window, the app blocks further local input on it and warns.

## 4. Local data model (device)

SQLite + a content directory; transactional and binary concerns stay separate.

Tables (additive; existing cache tables are migrated, not dropped):

- `inspections` — `id` (server int), `local_id` (UUIDv4, device-generated for
  any new record), `schema_version`, `status`, `accepted_at_remote`,
  `purge_due_at_remote`, `base_version`, `sync_state` (`clean` | `pending` |
  `in_flight` | `conflict` | `purge_scheduled`), `updated_at_local`.
- `form_responses` — one row per response (`inspection_local_id`, `field_id`,
  `value_type`, `value`, `value_version` bumped on every local edit).
- `attachments` — `id`, `inspection_local_id`, `kind` (`photo`|`signature`),
  `file_uri`, `bytes`, `sha256`, `captured_at`, `remote_id`, `upload_state`
  (`pending`|`in_flight`|`uploaded`|`failed`), `retry_count`.
- `outbox` — ordered, durable mutation queue: `id`, `inspection_local_id`,
  `op` (`field_update` | `signature` | `status_change`), `payload`, `field_ids`
  affected, `base_version` at creation, `idempotency_key`, `state`
  (`queued`|`in_flight`|`acked`|`rejected_version`|`conflict`|`permanent_fail`).
- `sync_state` — per-inspection cursor, last successful pull, token, backoff.
- `audit_log` — local append-only mirror of server history for accepted
  inspections (read-only).

Rules: single writer process per device (serialize outbox drain); WAL mode;
binary content opt-out of crash reporting (otherwise photos leak to vendor
logs); `purge_scheduled` is sticky — once set, no new writes are accepted for
that inspection except purge.

## 5. Sync protocol

Transport: existing REST, called opportunistically. Offline-tolerant control
plane over unchanged REST verbs; no long-lived websocket dependency in basements.

1. **Precondition on connect**: verify session token and server time skew.
2. **Pull (assignments + remote changes)** before push, so pushes see fresh
   `base_version`: `GET` assignments delta since cursor; detect inspector's
   stale local `base_version`.
3. **Push field mutations** — batched by inspection (bounded, e.g. ≤50 field
   updates/batch). Each mutation carries: `inspection_id`, `base_version`,
   `Idempotency-Key`, per-field payload, and the client's HLC
   (hybrid logical clock) timestamp.
4. **Server applies** optimistically: if mutation `base_version` != current,
   server **detects divergence**:
   - If affected field sets are disjoint from the intervening remote writes →
     both apply; single version bump; no conflict flag (this is the expected
     common case per A4).
   - If the same field was touched remotely → divergence recorded: server does
     **not** overwrite with the older incoming value blindly. It stores the
     remote value as current and retains the inspector's incoming change as a
     `pending_change` versioned candidate, returns `409` with both versions.
5. **Attachments** — independent phase per inspection: upload photos
   (chunked, resumable, `sha256` verified), then signature. Keyed to the
   inspection by `local_id` → server id resolved in step 4. Form data and
   photos reconcile separately so a stalled photo upload never blocks notes.
6. **State callback**: `status_change` op last; server response includes new
   version and, if accepted, `accepted_at`.
7. **Post-sync reconcile**: device recomputes local status from server
   response; conflicts enter local `conflict` state and are surfaced by the M5
   conflict UX.

Conflict policy summary: **detect globally, auto-merge structurally (disjoint
fields), never silently overwrite overlapping fields, surface to inspector with
both values and let them choose.** Deterministic order: field-level LWW only as
the *default* within the non-overlapping case; overlapping edits always end in
manual reconciliation. There is no server-side merge logic beyond field-set
disjointness — this keeps the server change small and complies with "no
collaborative editor".

## 6. Attachments

- Capture targets: JPEG at device-appropriate compression (cap ~2 MB/photo,
  downscale beyond), PNG signature. Validation at capture (not at upload) so a
  full card is discovered early.
- Storage: content-addressed file store off-DB. DB holds metadata only.
- 40 photos ≈ 80 MB worst case per inspection; cap device cache at ~500 MB of
  unsynced binaries with LRU eviction of already-uploaded files only.
- Upload: chunked (e.g. 4 MB), resumable via server range support, retry with
  exponential backoff + jitter, `sha256` integrity check server-side.
- Signature captured as strokes+timestamp, exported to PNG for the PDF/record;
  signer name typed or chosen from roster (assumption: no e-signature standard
  is mandated; see decisions D3).
- Videos/audio: out of scope.

## 7. Security

- At rest: full-device encryption (managed devices, A1) + app DB via
  SQLCipher, key in hardware-backed keystore. Photos stored in app-private
  storage; no exports to shared galleries; screenshots blocked on form screens
  (`FLAG_SECURE` / equivalent).
- In transit: TLS 1.2+, cert pinning optional; no customer PII in URLs or
  analytics events (inspection IDs and counts only).
- Session: short-lived token, refresh on connectivity; biometric/PIN gate to
  open a cached inspection.
- Audit history: append-only, server-authoritative; the device mirrors it, and
  local mirror is included in purge.
- Data removal: on accept event (§5 step 6) the device (a) deletes photos, form
  data rows, audit rows; (b) writes a purge receipt (inspection id, deleted-at,
  device id) which is uploaded on next connect; (c) `sqlite_vacuum`/secure
  delete of freed pages. Compliance is demonstrated by purge receipts, not by
  device enforcement alone.
- MDM: remote wipe hook remains available as the backstop for a lost device.

## 8. Migration and backfill

Additive migration, no destructive step:

1. Schema version bump + WAL + encryption-at-rest enable; new tables created;
  existing read-only cache tables kept during transition (dual-read fallback).
2. Tablets, on next online session, backfill: assignments for the inspector
  (last 90 days, plus any open), attachments metadata, base versions.
3. Feature flag `offline_writes` per device/user flips `inspections.open` and
   form editing from "read-through cache" to "local store write + queue". Roll
   back = flag off; device reverts to cache behavior with no server change
   needed for reads. *Caveat: if the flag is flipped off with a non-empty
   outbox, unsynced mutations are held locally and re-queued on re-enable —
   never silently dropped.*
4. Dual-write window not needed; the flag cutover is per inspection open, so an
   in-flight inspection opened pre-flag completes as a cache write. New opens
   use local store.
5. Data repair/backfill jobs: none required server-side beyond one new column
   (`local_id`/idempotency map + `pending_changes` table for conflicts).
6. Pilot cohort is chosen by flag, not by app version, so a newer app can be
   installed fleet-wide with writes off.

## 9. Observability

- Device metrics (batch uploaded on connect): outbox depth, oldest unsynced
  mutation age, mutation latency (local commit), sync success/failure counts,
  conflict counts by cause, photo upload success/retry, storage pressure,
  purge executed/overdue.
- Server metrics: 409 divergence rate by overlap class, auto-merge rate,
  `pending_changes` backlog, accept-event delivery lag, purge receipt arrivals.
- Tracing: `idempotency_key` propagated end to end; a sync funnel per
  inspection from open → submit → acked → accepted → purged.
- Alerts: oldest-unsynced-mutation age > 12h (approaching the 24h obligation),
  conflict backlog > N for > 1h, purge receipts missing for accepted
  inspections past deadline, storage pressure at > 90%.
- Dashboards exist per role: field ops (devices stuck), engineering (protocol
  health), compliance (purge coverage %).

## 10. Staged rollout

| Stage | Gate to enter | Exit criteria |
|---|---|---|
| S0 Build + internal | Merge + flag framework | Unit/contract/integration green; dogfood 5 devices |
| S1 Pilot (5–10 inspectors, 1 region, 2 sites incl. known dead zones) | S0 exit + server `pending_changes` deployed | ≥ 98% of submitted inspections acked within 24h; 0 lost-note reports; conflict rate < 10% of inspections; manual reconcile completes < 24h in worst case |
| S2 Extended pilot (2 regions, ~30%) | S1 exit + no P1 protocol bugs for 2 weeks | Same SLSs with mixed supervisor behavior; purge receipts 100% for accepted |
| S3 Broad rollout | S2 exit + capacity review | Error rates at parity with pre-change baseline; helpdesk tagging shows no new top driver |

Each gate is a decision, not a date; slippage at a gate stops or narrows the
next stage.

## 11. Rollback

- Per-stage rollback = flag off for the affected cohort; app keeps working as
  today's read-through cache (with the outbox caveat in §8.3).
- Server-side: `pending_changes` and divergence detection are additive and
  inert if the app doesn't send preconditions; they can stay deployed after
  app rollback.
- Purge receipts and accept-event delivery run independent of the write path —
  do not roll those back with the flag; compliance depends on them.
- Trigger thresholds: any lost-data incident (immediate full stop); sync
  success < 95% for 1h; conflict manual-resolution lag > 48h; any PII leakage
  event in logs. On full stop: freeze sync for cohort, preserve local stores
  forensically, export unsynced outboxes, restore cache mode.

## 12. Testing

- Unit: outbox ordering/idempotency, version comparison, disjointness merge,
  purge scheduling deadline math, storage accounting, backoff/jitter.
- Contract: server REST preconditions (`base_version` 409 discriminant),
  idempotency-key replay, `pending_changes` payload, accept event schema;
  versioned schemas so app/server skew is a test.
- Integration: device-sim harness — kill network mid-mutation, kill process
  mid-upload (resume), clock skew, duplicate mutation replay, two devices same
  user, supervisor web edit during offline session, storage full during 40th
  photo.
- Regulatory: automated test that an accepted inspection's local rows/photos
  are gone by deadline + 1h, and that a purge receipt exists server-side; run
  in pilot continuously.
- Fuzz/soak: randomized edit interleavings against a server emulator asserting
  no silent overwrite of overlapping edits and no orphaned dependencies.
- Manual pilot scripts: dead-zone walkthrough at the actual sites; light-/
  dark-/gloved-hand form entry; battery drain profile; 40-photo single session.

## 13. Milestones, dependencies, acceptance criteria

Order is by dependency. A milestone is "done" only when its acceptance criteria
are met on the pilot cohort where specified.

| M | Milestone | Depends on | Acceptance criteria |
|---|---|---|---|
| M1 | Offline read foundation: schema, encryption, assignments backfill, cache cutover flag | — | Assigned inspection fully readable offline incl. attachment metadata; storage-encrypted; flag off = today's behavior unchanged (verified by regression suite) |
| M2 | Local write path: form store, photo capture/signature to local store, outbox | M1 | Create/edit/signature/40 photos survive process kill and 7-day offline soak; no server calls required; ~1s local commit latency p95 |
| M3 | Sync engine: pull, conditional push, idempotency, resumable photo upload | M2, D1 | Repeated/duplicate pushes produce no duplicate rows or double-applied ops; photo upload resumes after kill mid-chunk; unsynced mutation age metric emitted |
| M4 | Server conflict support: field-set disjointness auto-merge, `pending_changes`, 409 contract | M3, D1 | Contract tests pass; server never silently drops an overlapping edit; auto-merge rate and conflict counts measurable per inspection |
| M5 | Conflict UX + reconciliation queue on web + inspector manual merge screen | M4 | Inspector can resolve every generated conflict with both values shown; resolution writes audit entries; no dead-ended states in simulator |
| M6 | Accept events + 24h purge + purge receipts + MDM/wipe backstop | M3 | Automated compliance test passes continuously (purge executed and receipted within deadline) in pilot; alerts armed |
| M7 | Observability dashboards, funnels, alerts | M1 (metrics start early), M3/S4 for full funnel | All §9 metrics/dashboards live; alerts tested by injection |
| M8 | Pilot (S1) with instrumentation and pilot exit report | M1–M7 | Pilot exit criteria in §10 met; conflict/merge rates characterized; go/no-go recorded with numbers |

Parallelizable after M3: M6 and M5 can proceed concurrently (different teams of
work); D2 (P2P) is a stretch option, only after pilot shows conflict rates
exceeding the S1 threshold of 10%.

## 14. Decisions required before implementation

| ID | Decision | Options | Recommendation |
|---|---|---|---|
| D1 | How preconditions are expressed server-side given integer record versions | (a) whole-record optimistic concurrency `version` check; (b) per-field version map; (c) add a `client_change_log` table | **(b) per-field version map**, exposed as an additive field (`field_versions`) on inspections. Keeps the integer `version` field backward compatible; enables true disjointness auto-merge instead of flagging every concurrent edit. Cost: one server-side schema/API change, contained to inspection resources |
| D2 | Overlap resolution mechanism | (a) manual reconciliation for overlapping fields only; (b) automated field LWW; (c) P2P ephemeral shared session | **(a)**. (b) is out: silently overwriting inspector notes recreates the reported bug. (c) contradicts "no collaborative editor" — revisit only if pilot conflicts exceed ~10% of inspections |
| D3 | Signature capture and legal validity | (a) typed/chosen signer name + timestamp + raster strokes; (b) vendor e-sign SDK | **(a)**, unless legal/compliance states a required standard. (b) adds vendor dependency, licensing, and a third sync system; the audit trail from (a) meets the brief's stated requirement |
| D4 | Photo upload chunking/range support | (a) add range-upload endpoint now; (b) whole-file multipart with retry | **(a)**. Basement-adjacent links are the norm in this product; a failed 2 MB upload restart is the difference between "eventually synced" and "stuck". Endpoint cost is small and needed for 40 photos |
| D5 | Accept-event delivery mechanism | (a) sync response + pull polling on connectivity regain; (b) push notification | **(a)**, with polling on reconnect and opportunistic background refresh. Push is unreliable in dead zones (A7); the 24h clock must not depend on it. Poll cadence on reconnect: immediate, then 15 min backoff |
| D6 | Pilot instrumentation ownership and metrics contract | (a) reuse existing mobile analytics; (b) new offline-sync metric namespace | **(b)**, namespaced `sync.*`, owned by the inspecting team, but shipped through the existing pipeline (A6). Avoids entangling pilot data with product analytics retention policies |
| D7 | Device-key handling for SQLCipher on the pilot cohort | (a) hardware keystore per device with MDM re-enrollment path; (b) passphrase-derived key synced at login | **(a)**. (b) exposes the key at rest in a restorable form; the devices are managed, so keystore-based keys are available without new MDM licensing |

## 15. Open questions to answer during pilot (not blockers)

- Overlap rate between supervisor and inspector edits in real data (validates
  or refutes A4 before S3).
- Whether "accepted" is ever triggered while an inspection still has unsynced
  device work (in which case the purge flow must reconcile, not assume).
- Realistic photo sizes on target devices; 40 photos may exceed the 80 MB
  estimate with high-resolution sensors.
- Whether inspectors share tablets within a shift; A1 says no, and M1's design
  assumes it.
