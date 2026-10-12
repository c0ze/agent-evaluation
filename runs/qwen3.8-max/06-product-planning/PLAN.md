# PLAN.md — Offline Inspection Sync

Adding durable offline work to the tablet-based building inspection app, per
`BRIEF.md`. This plan makes its assumptions explicit, defines the design across
user flow, scope, data, sync, conflicts, attachments, security, migration,
observability, rollout, rollback, and testing, and lays out a dependency-ordered
milestone sequence with acceptance criteria. It deliberately contains **no
calendar dates and no staffing numbers**; sequencing is expressed through
dependencies and relative complexity only.

---

## 1. Goal and success criteria

**Goal.** An inspector can open an assigned inspection in a no-signal basement,
fill the full form, capture up to 40 photos and a signature, and have all of it
survive app restarts and lost connectivity, then sync losslessly when signal
returns — while supervisors can edit the same inspection from the web, an audit
history is preserved, and local customer data is removed within 24 hours of
acceptance.

**Success criteria (measured in pilot):**

- Zero lost-notes / lost-attachment incidents across pilot sessions.
- Offline capture survives process kill, app restart, and device reboot.
- On reconnect, queued work drains and reconciles without user action.
- Concurrent inspector (offline) + supervisor (web) edits reconcile with no
  *silent* data loss (overwritten values are recoverable from audit).
- 100% of accepted inspections purge local customer data within the regulatory
  window, including devices that stay offline.
- Rollback to online-only can be triggered without losing captured data.

---

## 2. Explicit assumptions

These are assumptions **not stated in the brief**; each is a candidate for
validation in Milestone M0. The three riskiest are analyzed in `RESPONSE.md`.

- **A1 — Server extensibility.** The REST + integer-version APIs can be extended
  (or wrapped) to support: version-preconditioned writes, a batch sync
  operation, client idempotency keys, client-generated UUIDs for
  offline-created sub-records, and an observable `accepted` status. No full
  server redesign is required.
- **A2 — Assignments are server-created.** "Assigned inspections" already exist
  server-side before the inspector goes offline; the client does not need to
  *create* inspections offline, only open and edit them. Sub-records (answers,
  photos, signature) may be created offline.
- **A3 — Field-level mergeability.** Forms have stable field keys, and inspector
  vs supervisor edits are largely disjoint (different field sets / sections), so
  most concurrency is resolvable by field-level three-way merge rather than a
  collaborative editor.
- **A4 — `accepted` is a distinct, observable state.** Acceptance is a server
  status the client can read during sync, and it carries a server timestamp
  usable as the purge clock origin.
- **A5 — Managed device baseline.** Tablets are company-managed with MDM
  (screen lock, remote wipe), a bounded OS matrix, and platform keystore /
  file-based encryption available.
- **A6 — Attachment storage.** Server-side object storage exists or can be added
  for photo/signature blobs, with resumable/chunked upload support.
- **A7 — Audit is server-authoritative.** The durable, tamper-evident audit
  history lives on the server; the client keeps only a display mirror.
- **A8 — Single offline writer per record.** At most one inspector edits a given
  inspection offline at a time (device is assigned to one inspector); the
  concurrency case is inspector-offline vs supervisor-online, not two offline
  inspectors on the same record.
- **A9 — Bounded attachment size.** ≤40 photos per inspection at a per-photo
  size that fits on-device encrypted storage and typical reconnect windows;
  exact ceilings confirmed in M0.
- **A10 — Auth can be refreshed.** Existing auth issues refreshable tokens; a
  token can be re-obtained on reconnect before draining the queue.

If any assumption fails, the affected milestone(s) must be re-planned; A1, A3,
and A4 are the highest-leverage and are treated as M0 gating decisions.

---

## 3. User flow

**Before descent (online, at the surface / in the vehicle):**

1. Inspector opens the app; assigned inspections are listed (synced from server).
2. Inspector selects one or more inspections and marks them **Available
   offline** (or the app pre-fetches assignments automatically for the shift).
   The inspection record, current form schema, and field values are cached;
   `base_version` is recorded. A banner confirms offline readiness.

**In the basement (offline):**

3. App detects no connectivity and shows a persistent **Offline — changes saved
   locally** indicator with an unsynced-change count.
4. Inspector opens the assigned inspection and fills form fields. Every edit is
   written to SQLite and appended to the outbox immediately (durable on each
   commit, not batched to session end).
5. Inspector captures up to 40 photos; each is stored encrypted on disk with
   metadata queued for upload. A counter shows `n/40`. Capture beyond limits is
   blocked with clear feedback.
6. Inspector collects the signature (image + capture metadata). Stored and
   queued like a photo.
7. Inspector can close/reopen the app, or the device can reboot; all captured
   data is still present and marked unsynced.

**On intermittent / restored connectivity:**

8. When signal returns (even briefly), a background sync worker drains the
   outbox: pushes mutations with version preconditions, uploads attachments
   (resumable), and pulls server changes (including any supervisor edits and the
   `accepted` status). Sync is opportunistic and resumes after drops.
9. Conflicts, if any, are resolved by policy (§7). Overwritten inspector values
   are preserved in audit and surfaced for review — never silently dropped.
10. UI transitions to **Synced** as items complete; partial sync is shown
    honestly (e.g., "12 of 40 photos uploaded").

**After acceptance (post-sync):**

11. When the inspection reaches `accepted`, the client schedules purge of local
    customer data (PII rows + attachment files) for `accepted_at + 24h` and
    enforces it locally even if the device is offline at that moment (§9).

**Supervisor (web, online):** unchanged editing experience, but edits now
participate in version-preconditioned merge with offline inspector changes and
are recorded in the shared audit history.

---

## 4. Scope boundaries

**In scope (pilot):**

- Offline open/read of assigned inspections.
- Offline create/edit of form answers for **one** inspection type with stable
  field keys (the pilot form; see D7).
- Offline capture of up to 40 photos + one signature per inspection.
- Durable local storage, outbox, and resumable sync with version preconditions.
- Field-level conflict merge + same-field resolution with audit preservation.
- Server-authoritative audit history ingestion from offline mutations.
- 24h local purge of customer data with an offline-safe backstop.
- Encryption at rest for DB and attachment files.
- Observability, feature flags, and a rollback path to online-only.

**Out of scope (explicitly excluded):**

- Full collaborative / real-time co-editing, CRDTs, or operational transform
  (brief: "does not want a full collaborative editor").
- Offline **creation** of brand-new inspections/assignments (A2).
- Multi-inspector concurrent offline editing of the same record (A8).
- Offline editing of *all* historical inspection types (pilot covers one).
- Server-side re-architecture beyond the sync/attachment/audit endpoints needed
  here (A1 keeps this additive).
- Cross-device offline merge for the same inspector (one device per inspector
  per assignment in pilot).
- Biometric/liveness or advanced e-signature ceremony beyond captured image +
  metadata unless compliance requires it (D6).

---

## 5. Local data model

SQLite moves from **read-through cache** to **offline system-of-record**. New/
extended tables (names indicative):

- **`inspection`** — `id` (server id), `base_version` (last synced server
  version), `status`, `assigned_to`, `form_schema_version`, `dirty` (bool),
  `purge_deadline` (nullable), `last_synced_at`. Form answers are stored
  normalized (below), not as an opaque blob, to enable field-level merge (D10).
- **`inspection_answer`** — `inspection_id`, `field_key`, `value`,
  `value_type`, `dirty` (bool), `base_version` per field/section (or a
  `dirty_fields` set on the parent). Stable `field_key` is the merge unit.
- **`attachment`** — `attachment_id` (client UUID, idempotency key),
  `inspection_id`, `kind` (`photo` | `signature`), `local_path`, `content_hash`,
  `bytes`, `upload_state` (`pending` | `uploading` | `uploaded` | `failed`),
  `server_id` (assigned after upload), `created_at`, `mime`.
- **`outbox` / `mutation`** — `mutation_id` (client UUID), `entity_type`,
  `entity_id`, `op` (`upsert` | `delete`), `field_changes` (json),
  `base_version`, `state` (`pending` | `inflight` | `conflict` | `done`),
  `attempts`, `created_at`, `last_error`. The write path appends here
  transactionally with the data change.
- **`audit_local`** — display mirror of server audit: `seq`, `entity_id`,
  `field_key`, `old`, `new`, `actor`, `source` (`offline-sync` | `web` |
  `system`), `server_version`, `ts`. Server remains authoritative (A7).
- **`purge_queue`** — `inspection_id`, `purge_deadline`, `origin`
  (`accepted` | `ttl-backstop`), `state` (`pending` | `done`), `receipt`.
- **`sync_meta`** — `key`/`value`: `device_id`, `sync_cursor`, `schema_version`,
  `last_online_at`, `token_state`.

**Invariants:**

- Data change + outbox entry commit in the **same** SQLite transaction (no
  change without a queued mutation; no orphan mutations).
- `base_version` is only advanced on confirmed server apply.
- Every entity carries enough state to be idempotently retried (UUIDs) and to
  detect conflicts (versions).
- `schema_version` gates migrations; downgrade is forward-only with quarantine
  (§13).

---

## 6. Sync protocol

Optimistic concurrency built on the server's integer record versions, with an
outbox and idempotency for flaky links.

**Write path (offline):** each edit writes data + an outbox mutation carrying
`mutation_id`, `field_changes`, and the field/record `base_version` the inspector
started from.

**Push (on connectivity):** the worker sends pending mutations to a **batch**
endpoint `POST /sync` (D1). Each item includes `entity_id`, `field_changes`,
`base_version`, and `mutation_id`. Server behavior per item:

- If server `current_version == base_version` → apply, `version++`, record
  audit, return `{status: applied, new_version}`.
- If server `current_version != base_version` → reject with
  `{status: conflict, server_record, current_version}`.
- If `mutation_id` was already applied → return `{status: applied, new_version}`
  (idempotent; safe retry).

Batch returns per-item results so a single round-trip handles many mutations —
important when reconnect windows are short and volumes are high (≤40 photos +
many fields).

**Pull:** `GET /changes?since=<sync_cursor>` (or per-inspection
`?since=<version>`) returns server-side changes — supervisor edits, status
transitions (incl. `accepted`), and version bumps. Client applies them, updates
`base_version` and `sync_cursor`.

**Conflict handling:** on a `conflict` result the client performs a three-way
merge (ancestor = `base_version` state, ours = local edits, theirs = server
record) per §7, then retries with the new `base_version`.

**Attachments:** uploaded via resumable/chunked upload keyed by `attachment_id`
(idempotent). A photo/signature is linked to its record only after the record
exists server-side (or via the batch, referencing the client UUID). Upload state
advances `pending → uploading → uploaded`; failures are retried with
`Content-Range`/offset resume so partial uploads survive drops.

**Transport/auth:** TLS; refreshable token re-obtained on reconnect before
draining (A10, D9). Requests are retry-safe due to idempotency keys.

**Ordering & atomicity:** mutations for a record are applied in
`base_version` order; attachment links are applied after their blob upload
confirms. The worker is crash-safe: in-flight items return to `pending` on
restart and dedupe via `mutation_id`.

**Fallback (if A1 batch is unavailable):** sequential version-preconditioned
REST calls (`PATCH /inspections/{id}` with `If-Match: <base_version>`), still
idempotent via `mutation_id`; slower over flaky links but functionally
equivalent. Decided in M0/D1.

---

## 7. Conflict policy

Given "no full collaborative editor," we use **field-level three-way merge with
scoped ownership**, not CRDTs/OT.

**Ownership model (D2, D7):** define which fields/sections are
inspector-owned (form answers, photos, signature) vs supervisor-owned (review
notes, disposition/status). Most concurrency is disjoint and merges cleanly.

**Resolution rules:**

1. **Disjoint fields** → merge both; no conflict.
2. **Same field, both changed** → **server (supervisor) value wins** to keep a
   single authoritative record, **but** the inspector's offline value is written
   to audit (`overridden_value`) and the inspection is **flagged for review** in
   the UI/supervisor queue. No silent loss.
3. **Delete vs update** → delete wins for the record; the updated values are
   captured in audit before removal; if deletion is regulatory-sensitive, prefer
   tombstone over hard delete.
4. **Attachment collisions** → attachments are additive and keyed by UUID, so
   they coexist; they do not overwrite each other.
5. **Status races** (e.g., supervisor sets `accepted` while inspector still
   editing) → `accepted` is authoritative; any post-acceptance local edits are
   blocked at sync, surfaced to the user, and preserved in audit rather than
   force-applied.

**Why server-wins on true conflicts:** the server holds the integer version and
is the concurrency arbiter (A7); supervisor edits are typically later-in-time
review actions. Preserving the overridden value in audit satisfies the
"audit history" regulation and keeps the model simple. This is a **decision
(D2)** — if the business prefers inspector-wins or manual-merge-required for
critical fields, that is configured per field in M0.

**Guarantee:** every conflict path produces an audit entry; the pilot measures
conflict rate to validate A3.

---

## 8. Attachments

- **Capture:** up to 40 photos + one signature per inspection. Enforce the cap
  at capture time with clear feedback; compress/resize to a defined max
  per-item size (D9/M0) to bound storage and upload time.
- **Storage:** encrypted on disk (§9); metadata in `attachment`; binary in the
  app sandbox with platform file-based encryption.
- **Identity & idempotency:** client-generated `attachment_id` (UUID) +
  `content_hash` dedupe retries and prevent duplicates over flaky links (D3).
- **Upload:** resumable/chunked with offset continue; `upload_state` tracked; a
  photo is linked to the record after its blob confirms. Partial progress is
  shown honestly ("12/40 uploaded").
- **Ordering/failure:** a failed attachment does not block text/field sync; the
  record can sync while attachments finish, and the inspection is marked
  "attachments pending" until complete.
- **Purge:** attachment files and their customer metadata are deleted in the 24h
  purge (§9); the server retains the authoritative copies per retention rules.
- **Integrity:** `content_hash` verified after upload; mismatch triggers re-upload.

---

## 9. Security and 24-hour purge

**Encryption at rest (D4):**

- DB encrypted with **SQLCipher** (key in platform keystore / hardware-backed
  store); attachment files protected by platform file-based encryption
  (Android FBE / iOS Data Protection). Defense-in-depth given sensitive customer
  data and device-loss risk in the field. MDM enforces screen lock and offers
  remote wipe (A5).

**Encryption in transit:** TLS for all sync/upload; token-based auth with
refresh (A10).

**Audit history (A7):** server-authoritative, append-only, tamper-evident log of
every accepted mutation: actor, field, `old → new`, `server_version`, source
(`offline-sync` vs `web`), and server timestamp. Overridden conflict values are
logged (§7). Client keeps a display mirror only.

**24-hour local purge (D5) — dual mechanism:**

1. **Primary (status-driven):** when sync observes `accepted`, set
   `purge_deadline = accepted_at(server ts) + 24h` in `purge_queue`. A local
   scheduler executes purge at/after the deadline. **Purge is a local operation
   and needs no connectivity.** It deletes customer PII rows and attachment
   files for that inspection, retaining only a minimal non-customer tombstone +
   compliance receipt ("purged at `<ts>`, origin `accepted`").
2. **Backstop (conservative TTL):** because a device may stay offline and never
   learn the exact `accepted_at` (A4 risk), also auto-purge local customer data
   for any inspection `T_backstop` hours after last sync/capture, where
   `T_backstop` is chosen so the worst case still respects the 24h bound.
   Whichever deadline comes first triggers purge.
3. **MDM remote wipe** as a last-resort enforcement for lost/never-returning
   devices.

**Server-authoritative time (D8):** purge deadlines, audit timestamps, and
versions use server time; device clocks are treated as untrusted/advisory to
avoid skew breaking the regulatory window.

**Purge observability:** every purge (and any miss) emits an event; the pilot
tracks on-time purge rate as a compliance KPI.

---

## 10. Migration / backfill

- **Schema migration:** bump `schema_version`; migrate existing read-through
  cache tables to the durable model (add `base_version`, `dirty`, outbox,
  attachment, purge, audit-mirror). Migrations run in a transaction with a
  pre-migration backup and are idempotent/re-runnable.
- **Backfill versions:** the current cache does not track versions/dirt. On
  upgrade, treat all existing rows as **clean** and populate `base_version` from
  the server on first sync (or from cached version fields if present). No
  existing cached value is assumed dirty.
- **Fresh install vs upgrade:** both paths tested; fresh installs create the new
  schema directly, upgrades migrate.
- **Form schema evolution:** store `form_schema_version` per inspection so
  field keys remain stable across form changes; migrations map old→new keys
  where feasible.
- **Downgrade:** forward-only. If a device must roll back (§13), quarantine
  offline data (do not delete) so a re-upgrade can resume, unless purge deadline
  has passed.
- **No data loss:** migration acceptance requires zero loss of currently cached
  inspection data and correct version seeding.

---

## 11. Observability

Instrument early (wired from M2, reported via M7) so the pilot is measurable.

**Metrics:**

- Sync: success/failure rate, mutations pushed/pulled per session, retry count,
  time-to-first-sync and time-to-full-sync after reconnect, batch latency.
- Conflicts: rate, type (disjoint vs same-field), overrides, review-queue depth.
- Queue: outbox depth and age, attachment upload backlog, `pending`/`failed`
  counts, per-inspection "attachments complete" time.
- Offline sessions: duration, edits/photos captured offline, cache-hit rate.
- Purge: on-time purge rate, misses, TTL-backstop triggers, receipts written.
- Reliability: crash-free sessions, ANR/hang rate, data-loss incidents
  (target zero), migration success rate.

**Logging:** structured, sampled, privacy-safe logs (no raw customer PII in
logs); correlation ids per sync session; on-device ring buffer uploadable on
reconnect for support.

**Dashboards/alerts:** per-cohort sync health, conflict spikes, purge misses
(compliance alert), upload backlog growth. Alerts wired to on-call for the
pilot.

**Feature-flag telemetry:** which cohorts have offline enabled, kill-switch
actuations, rollback events.

---

## 12. Staged rollout

Product wants a pilot before broad rollout; gates are criteria-based, not
date-based.

1. **Internal / dogfood** — eng + QA on managed devices in a controlled
   no-signal environment ( Faraday / airplane-mode drills). Exit: no data-loss
   incidents; sync, conflict, and purge paths verified.
2. **Pilot cohort (D7)** — a small group of volunteer inspectors, one region,
   one inspection type, behind a feature flag. Real basements. Exit: success
   criteria in §1 met for a sustained period; conflict rate validates A3;
   purge compliance 100%; observability healthy; support runbook proven.
3. **Expanded cohorts** — additional regions/inspection types in waves, each
   gated on the prior wave's metrics, flag-controlled, with rollback armed.
4. **General availability** — offline enabled by default for eligible
   assignments, still flag-gated per cohort for safe throttle.

Each stage keeps the kill switch (§13) available and monitors the §11 KPIs
before advancing.

---

## 13. Rollback

- **Feature-flag kill switch:** disable offline capture/sync per user, cohort,
  or globally without an app release. On disable, the app falls back to
  online-only.
- **No-loss drain:** before/while disabling, the app attempts to drain the
  outbox; if connectivity is unavailable, it **preserves** queued data and
  resumes sync when re-enabled or when signal returns — captured work is never
  discarded by a rollback.
- **Server-side guard:** the sync endpoint can reject/queue client mutations
  under a server flag (e.g., if a bad client build is corrupting versions),
  returning a clear signal so clients pause and retry rather than lose data.
- **Schema safety:** downgrade is forward-only with **quarantine** of offline
  data (§10) so a re-upgrade resumes; purge deadlines still honored during
  quarantine.
- **Rehearsal:** rollback is exercised in the pilot with real captured data
  present (acceptance criterion in M8) — not assumed to work.

---

## 14. Testing

- **Unit:** sync engine (push/pull, batch parsing, idempotency dedupe),
  three-way merge and each conflict rule (§7), outbox transactionality,
  migration steps, purge scheduler (accepted + TTL backstop), attachment
  resume/hash logic.
- **Integration:** client↔server sync against a test backend exercising version
  preconditions and 409/conflict paths; concurrent supervisor-web edit + offline
  inspector edit reconciling correctly with audit preservation; attachment
  upload linking.
- **Network simulation / chaos:** flaky links — dropped, duplicated, reordered,
  and delayed requests; short reconnect windows; token expiry mid-drain. Verify
  idempotency (no double-apply), resumable uploads, and no data loss.
- **Offline durability:** process kill, app restart, device reboot, storage
  pressure, and low battery during capture; confirm persistence and correct
  unsynced-state UI.
- **Purge/compliance:** on-time purge at `accepted + 24h`; offline-at-deadline
  purge; TTL backstop firing; tombstone/receipt correctness; MDM wipe path.
- **Migration:** fresh install, upgrade from current cache build, downgrade +
  re-upgrade quarantine, form-schema-version changes.
- **Security:** encryption-at-rest verification (DB + files), key storage,
  no-PII-in-logs checks, TLS enforcement.
- **Device/OS matrix:** the managed tablet models and OS versions in scope (A5).
- **Regression guard:** an automated "lost notes" scenario reproducing the
  original bug (disconnect after opening) as a permanent test.
- **Pilot as test:** production metrics (§11) treated as acceptance evidence for
  rollout gates.

---

## 15. Milestone sequence (dependencies + acceptance criteria)

Sequencing only; **no dates, no headcount.** Complexity is qualitative
(S/M/L). Parallelizable work is noted where the dependency graph allows.

### M0 — Decisions & design freeze — blocking (size: S, high leverage)
- **Depends on:** —
- **Blocks:** all.
- **Acceptance:** Every decision in §16 has an owner, chosen option, and
  rationale. Server sync API contract agreed (batch endpoint, version
  precondition, `mutation_id`/`attachment_id` idempotency, client UUIDs,
  `accepted` status, resumable upload). Field-ownership map (inspector vs
  supervisor) documented. Threat model + purge approach approved by security/
  compliance. Attachment size/count ceilings and pilot form selected. A1/A3/A4
  validated or explicitly risk-accepted.

### M1 — Durable local data model & migration (size: L)
- **Depends on:** M0. **Blocks:** M2, M3, M4, M6.
- **Acceptance:** New SQLite schema (versions, dirty tracking, outbox,
  attachment, purge_queue, audit mirror, sync_meta) implemented; transactional
  data+outbox writes; migration from the current read-through cache passes for
  fresh install and upgrade with **zero data loss** and correct `base_version`
  seeding; `schema_version` tracked; offline edits survive restart and process
  kill.

### M2 — Offline read & form capture, single-writer (size: M)
- **Depends on:** M1. **Blocks:** M4. (Parallel with M3.)
- **Acceptance:** With no network, inspector opens an assigned inspection,
  edits every in-scope field, and each edit is durably stored + queued; reopening
  offline shows saved state; clear offline/unsynced UI; original "disconnect
  after open loses notes" bug is fixed and covered by a regression test.

### M3 — Offline attachments: photos + signature (size: M)
- **Depends on:** M1. **Blocks:** M4. (Parallel with M2.)
- **Acceptance:** Capture ≤40 photos + signature offline; stored encrypted with
  DB metadata; cap enforced with feedback; client-generated `attachment_id`;
  capture survives restart/reboot; queued for upload; signature includes capture
  metadata per D6.

### M4 — Sync engine: push/pull with version preconditions (size: L)
- **Depends on:** M2, M3. **Blocks:** M5, M6, M8.
- **Acceptance:** On reconnect the outbox drains via the agreed sync API;
  mutations apply server-side with `version++`; pull merges server changes and
  `accepted`; idempotent retries verified under simulated flaky network
  (dropped/duplicated/reordered requests); resumable/chunked attachment uploads
  complete and hash-verify; partial progress surfaced honestly; crash-safe
  in-flight recovery.

### M5 — Conflict resolution & audit (size: M)
- **Depends on:** M4. **Blocks:** M9.
- **Acceptance:** Concurrent supervisor-web + offline-inspector edits reconcile
  by field-level three-way merge; disjoint merges keep both; same-field conflicts
  apply the D2 policy with **no silent loss** (overridden value in audit +
  review flag); delete/update and status races handled per §7; server audit
  complete (actor, old→new, version, source, ts); conflict-rate telemetry
  emitted.

### M6 — Security & 24h purge (size: M)
- **Depends on:** M1, M4. **Blocks:** M9.
- **Acceptance:** Encryption at rest (SQLCipher DB + encrypted files, keystore
  keys) verified; no PII in logs; TLS enforced. Purge runs on `accepted` within
  24h using server time; **offline-at-deadline purge works**; conservative TTL
  backstop fires when `accepted` never observed; customer rows + attachment files
  deleted with tombstone/receipt retained; MDM remote-wipe path tested; purge
  compliance measurable.

### M7 — Observability & feature flags (size: M, cross-cutting)
- **Depends on:** M2 (instrumentation), integrated through M4–M6. **Blocks:**
  M9 (rollout gates need metrics), M8 (flags).
- **Acceptance:** §11 metrics, structured privacy-safe logs, dashboards, and
  alerts live; feature flags gate offline capture/sync per user/cohort; global
  kill switch functional; flag telemetry present.

### M8 — Rollback mechanism (size: S/M)
- **Depends on:** M7 (flags), M4. **Blocks:** M9.
- **Acceptance:** Disabling offline falls back to online-only **without losing
  captured/unsynced data** (drain-or-preserve verified); server-side guard can
  pause client sync; schema downgrade quarantines offline data and re-upgrade
  resumes; rollback **rehearsed with real data present**.

### M9 — Pilot (size: M)
- **Depends on:** M2, M3, M4, M5, M6, M7, M8. **Blocks:** M10.
- **Acceptance:** Limited cohort/region/form behind flag in real no-signal use;
  §1 success criteria met for the defined pilot duration; conflict rate validates
  A3; 100% on-time purge; rollback available and unexercised-or-successful;
  support runbook + feedback loop in place; exit criteria reviewed and signed off.

### M10 — Broad rollout (size: M)
- **Depends on:** M9 exit criteria met. **Blocks:** —
- **Acceptance:** Wave-based cohort expansion gated on §11 KPIs; offline enabled
  by default for eligible assignments (still flag-throttled); documentation,
  on-call, and rollback readiness confirmed for each wave.

**Critical path:** M0 → M1 → {M2 ∥ M3} → M4 → M5 → M9 → M10, with M6, M7, M8
joining before M9. M7 instrumentation should begin alongside M2 to avoid a
late observability crunch.

---

## 16. Decisions required before implementation (with recommendations)

Each must be resolved in **M0**. Recommendation given; owner to confirm.

- **D1 — Sync API shape: batch `POST /sync` vs sequential REST.**
  *Recommend:* batch endpoint with per-item `base_version` + `mutation_id`
  idempotency; sequential version-preconditioned `PATCH` (`If-Match`) as fallback
  if the server cannot add batch. *Why:* short reconnect windows + high mutation
  volume (≤40 photos + fields) make round-trips expensive; batch + idempotency is
  robust to retries. (Validates A1.)

- **D2 — Conflict granularity & winner.**
  *Recommend:* field-level three-way merge with scoped ownership; on true
  same-field conflict, **server/supervisor wins**, inspector value preserved in
  audit + review flag. *Why:* honors "no collaborative editor," keeps a single
  authoritative record, and satisfies the audit regulation with no silent loss.
  Per-field override (inspector-wins / manual-required) configurable for critical
  fields. (Validates A3.)

- **D3 — Identity for offline-created sub-records.**
  *Recommend:* client-generated UUIDs for attachments and offline-created
  answer/attachment rows as idempotency keys; server maps UUID→integer id on
  first apply. Inspections remain server-assigned (A2). *Why:* enables offline
  creation + idempotent retries without id collisions.

- **D4 — Encryption at rest.**
  *Recommend:* SQLCipher for the DB + platform file-based encryption for
  attachments, keys in hardware-backed keystore, MDM lock/wipe. *Why:*
  defense-in-depth for sensitive customer data and field device-loss risk;
  supports regulatory posture. (Validates A5.)

- **D5 — Purge trigger & offline enforcement.**
  *Recommend:* primary status-driven purge at `accepted_at + 24h` (server time),
  plus a conservative local TTL backstop, plus MDM wipe; purge is local (needs no
  connectivity); retain tombstone/receipt. *Why:* guarantees the 24h bound even if
  a device never re-syncs after acceptance. (Validates A4; risk in `RESPONSE.md`.)

- **D6 — Signature capture & legal validity.**
  *Recommend:* on-device signature image + capture metadata (timestamp, signer
  name, optional geo) submitted as an attachment; confirm legal sufficiency with
  compliance (whether additional ceremony/attestation is required). *Why:*
  signature is a named requirement; validity rules must be fixed before build.

- **D7 — Pilot scope (form / fields / region / cohort).**
  *Recommend:* one high-value inspection type with stable field keys and disjoint
  inspector/supervisor ownership; one region; small volunteer cohort. *Why:*
  bounds conflict complexity and tests the riskiest assumptions (A1/A3) first.

- **D8 — Clock-skew handling.**
  *Recommend:* server-authoritative timestamps for audit, versions, and purge
  deadlines; device clocks advisory only. *Why:* unreliable device time must not
  break the regulatory window or version ordering.

- **D9 — Attachment size/compression ceilings & transport.**
  *Recommend:* define max per-photo size with on-device compression, resumable
  chunked uploads, and `content_hash` verification; reuse existing auth with
  refresh-on-reconnect. *Why:* bounds storage/upload time within short reconnect
  windows and keeps retries safe. (Validates A6/A9.)

- **D10 — Form data representation.**
  *Recommend:* normalize answers keyed by stable `field_key` (not opaque blobs),
  versioned by `form_schema_version`. *Why:* prerequisite for field-level merge
  (D2) and for evolving forms without breaking sync/merge.

---

## 17. Open risks carried into M0

Tracked here and summarized in `RESPONSE.md`: A1 (server extensibility), A3
(field-level mergeability / disjoint ownership), and A4/D5 (guaranteeing the 24h
purge on devices that stay offline). These are the three riskiest assumptions and
gate the design; each has a mitigation and a validation point in M0/pilot.
