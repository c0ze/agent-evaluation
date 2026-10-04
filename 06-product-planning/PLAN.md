# Plan — Offline inspection sync for tablet app

Source product input: `BRIEF.md` (only). This plan makes assumptions explicit
and lists the decisions that must be settled before implementation.

---

## 1. Assumptions

These are the working assumptions used to shape the plan. Each is restated as a
decision in §14 with a recommendation.

| # | Assumption | Source / basis |
|---|------------|----------------|
| A1 | An "offline inspection" is bounded to the duration of one site visit: a tablet leaves signal on entry and rejoins on exit (van, parking, lobby). | "basements with no signal" + "connectivity may return intermittently" |
| A2 | Inspectors do not collaborate in real time on the same inspection from two tablets. | Not stated; absence of multi-inspector requirement and product's "no full collaborative editor" stance. |
| A3 | Supervisor web edits are infrequent and typically happen before an inspection opens on the tablet or after it is submitted. Mid-visit supervisor edits are the edge case. | "Supervisors can edit the same inspection from the web" without more. |
| A4 | Average per-inspection payload: ~30 form fields, ≤40 photos at ~3–6 MB each, 1 signature image, free-text notes. Worst-case ≈ 300 MB local. | Stated photo cap; common tablet camera defaults. |
| A5 | The tablet fleet is company-managed (MDM/DEP), single primary user per device, OS-level encryption at rest is on, and the app is forced-managed. | "company-managed tablets"; standard posture. |
| A6 | "Customer data" in the 24h rule includes the inspection record, notes, photos, signature, and derived metadata; it excludes server-side IDs, sync log, and audit copies. | Reasonable reading of the regulation phrasing. |
| A7 | Existing REST APIs already return integer `recordVersion` on inspection reads and accept it on writes (If-Match style). | "Existing server APIs use REST with integer record versions." |
| A8 | The pilot is a single region / customer / team, gated by a server-side feature flag and an MDM config, not a separate code branch. | "Product wants a pilot before broad rollout." |
| A9 | Photo upload can be deferred relative to form + signature: form must reach the server to mark an inspection "submitted"; photos can drain afterwards. | Common offline pattern; reduces required online window. |
| A10 | Tablets run a recent OS version that allows background fetch and constrained network access. | "company-managed tablets"; standard fleet. |

---

## 2. Goals and non-goals

### 2.1 Goals
- G1. Inspectors can open an assigned inspection, fill forms, take up to 40 photos, and capture a signature with no network.
- G2. Submitted inspections are durable across app crash, OS kill, and forced reboot.
- G3. Sync is automatic and opportunistic; an inspector does not have to "press sync."
- G4. Server remains authoritative; conflicts are detected, surfaced, and resolved by a defined policy.
- G5. Local customer data is removed within 24 h of an inspection being marked accepted on the server.
- G6. A regulator-grade audit history exists for every record field, photo, and signature.
- G7. Pilot can be enabled for a subset of users and rolled back without a client release.

### 2.2 Non-goals
- N1. Real-time multi-user collaborative editing (no operational transform, no CRDT, no live cursors).
- N2. Inspector-to-inspector chat or handoff of an in-progress inspection.
- N3. Offline supervisor workflows. Supervisors continue to require a connection; offline shows a banner.
- N4. General-purpose offline mode for unrelated modules of the app. Scope is inspection write path only.
- N5. A new backend service. We extend existing REST endpoints and a single new endpoint family.
- N6. Server-side conflict resolution UI for inspectors. Conflicts surface on the tablet, not in a web tool.

---

## 3. User flow

### 3.1 Inspector flow (offline-first)
1. Inspector opens the app while online. App pulls the assigned inspection list (delta since last sync) and pins it locally.
2. Inspector taps an inspection. App verifies the record and attachments are fully local; otherwise shows a "needs sync" indicator and queues a fetch.
3. Form opens from local SQLite. Status banner: "Offline — saving locally."
4. Inspector edits fields. Each edit writes a row in `local_change` (append-only log) tied to the current local version.
5. Photos are captured to the app's sandboxed storage; metadata is added to `local_change` with a content-hash and byte size; the binary is uploaded separately.
6. Signature is captured as an SVG (or PNG fallback) and added to `local_change`.
7. Inspector taps **Submit**. App:
   - Marks the local record `pending_submit` (still in sync queue even if online).
   - Promotes changes to a "submission" envelope: form patch + ordered list of photo IDs + signature ID.
   - On any next network event, pushes the submission.
8. After successful form push, photos drain in the background. Status changes `syncing_photos` → `synced`.
9. Once `synced` reaches the server, the record transitions to `submitted` server-side and surfaces in supervisor view.

### 3.2 Inspector flow (intermittent connectivity)
- The app listens for network changes. On every transition to "connected," it:
  1. Pulls deltas for assigned inspections and any open record.
  2. Drains pending submissions oldest-first.
  3. Drains pending photo uploads, newest-photo-first skipped if size budget exceeded.
  4. Resumes any failed transfer from a checkpoint.

### 3.3 Supervisor flow (web, mostly online)
- Continues to work against the server.
- If supervisor opens an inspection that an inspector is currently editing offline, the supervisor sees a "device last seen offline; edits will reconcile on sync" banner with the device's last-known local version.
- Supervisor saves with their own `recordVersion`. The inspector's later push hits a version conflict; the inspector resolves per §6.

### 3.4 Conflict UX (inspector)
- On opening a record post-sync, if the server version advanced while the inspector was offline, the app shows a side-by-side conflict view:
  - Left: my offline changes.
  - Right: server (supervisor) changes.
  - Per field: keep mine / keep theirs / (where allowed) merge text.
  - For photos: keep both. For signature: server wins if supervisor added one; otherwise keep mine.
- The inspector must explicitly resolve before resubmitting. The audit log records every decision.

---

## 4. Scope boundaries

| In scope | Out of scope | Why |
|----------|--------------|-----|
| Inspection write path on tablet | Other modules (e.g., schedule, messaging) | BRIEF and N4 |
| Form fields, notes, photos, signature | Live co-editing, presence | N1 |
| Up to 40 photos per inspection | Larger or video attachments | BRIEF; storage and bandwidth |
| Background sync while app backgrounded | Foreground-only sync | G3 |
| Conflict detection on submit | Automatic silent merging of supervisor edits | Risk; brief on no collab editor |
| Local data purge after acceptance | Selective retention for QA | Regulation |
| Pilot flag + MDM gate | Per-user opt-in toggle in UI | Avoids accidental offline use outside pilot |

---

## 5. Local data model (SQLite extensions)

The existing read-through cache schema is extended; no tables are removed.

### 5.1 New / changed tables

**`inspection`** (extended; not replaced)
- `id` (text/uuid, PK)
- `server_version` (int) — last known server `recordVersion`
- `local_version` (int) — monotonic, increments on every local edit
- `state` (text) — `cached | open | pending_submit | submitting | syncing_photos | synced | accepted | purged`
- `last_touched_at` (int, ms epoch)
- `opened_locally_at` (int, nullable)
- `body_json` (text) — current local snapshot of form fields
- `etag` (text) — server ETag if provided

**`local_change`** (new, append-only)
- `id` (int, PK autoinc)
- `inspection_id` (text, FK)
- `local_version_before` (int)
- `local_version_after` (int)
- `kind` (text) — `form_patch | photo_add | photo_remove | signature_set | signature_clear | state_change | meta`
- `payload_json` (text)
- `created_at` (int, ms)
- `submitted_in_envelope_id` (int, nullable, FK→`envelope`)
- `client_change_id` (text, UUID) — idempotency key

**`envelope`** (new)
- `id` (int, PK autoinc)
- `inspection_id` (text, FK)
- `base_version` (int) — server_version captured when envelope was created
- `state` (text) — `queued | in_flight | accepted | conflicted | failed`
- `attempt_count` (int)
- `last_error` (text, nullable)
- `created_at`, `next_retry_at`

**`photo`** (new)
- `id` (text/uuid, PK) — client-assigned
- `inspection_id` (text, FK)
- `local_path` (text) — sandboxed file path
- `byte_size` (int)
- `content_sha256` (text)
- `captured_at` (int, ms)
- `upload_state` (text) — `pending | uploading | uploaded | failed`
- `server_id` (text, nullable)
- `bytes_sent` (int) — for resume

**`signature`** (new)
- `id` (int, PK autoinc)
- `inspection_id` (text, FK)
- `format` (text) — `svg | png`
- `local_path` (text)
- `byte_size` (int)
- `upload_state` (text) — same enum as photo

**`sync_run`** (new, observability)
- `id` (int, PK)
- `started_at`, `ended_at`, `trigger` (text) — `manual | on_connect | on_open | periodic`
- `pulled`, `pushed_envelopes`, `pushed_photos`, `conflicts`, `errors`

**`purge_log`** (new)
- `inspection_id` (text, PK)
- `accepted_at_server` (int, ms)
- `purge_deadline_at` (int, ms)
- `purged_at` (int, nullable)
- `purge_reason` (text, nullable) — `deadline | manual_admin | device_wipe`

### 5.2 Invariants
- The form snapshot in `inspection.body_json` is the source of truth for rendering. `local_change` is the audit / replay source.
- `local_version` is monotonic per inspection. Every read of `body_json` is paired with the current `local_version` so editors can detect clobber.
- Photo binaries live on the filesystem; the row tracks the path and content hash. The hash is also sent to the server for de-duplication.

### 5.3 Storage budget
- Per-device cap on pending inspection size (configurable, default 1 GB). The app refuses to start a new offline inspection when the cap would be exceeded and offers "submit or purge" actions.

---

## 6. Sync protocol

### 6.1 Pull (server → client)
- `GET /inspections/assigned?since=<cursor>&limit=N` — list delta.
- `GET /inspections/{id}` — full record with `recordVersion`, ETag, and links to expected attachments.
- `GET /inspections/{id}/attachments?ids=...` — resumable attachment download (range requests) for any blob the client does not already have by content hash.
- All GETs are idempotent. Cursor is server-issued; client persists last cursor per device.

### 6.2 Push (client → server)
Two-stage:

**Stage A — form submission envelope**
- `POST /inspections/{id}/submissions`
- Headers: `Idempotency-Key: <envelope.client_change_id>`, `If-Match: <envelope.base_version>`.
- Body: form patch (JSON Patch or simple `{field: value}` diff), ordered list of photo IDs (client UUIDs, content hashes, sizes), signature ID, local audit tail hash.
- Server response:
  - `200` with new `recordVersion` → mark envelope `accepted`.
  - `409` with `{ serverVersion, conflicts: [{field, mine, theirs}] }` → mark envelope `conflicted`; client renders the conflict UI.
  - `412` (precondition failed) → fetch latest, recategorize as conflict, recurse.
  - `429` with `Retry-After` → schedule retry.

**Stage B — photo uploads** (deferred)
- `POST /inspections/{id}/photos` with multipart, `Idempotency-Key`, `Content-SHA256`.
- Resumable: if a transfer is interrupted, the next call resumes from `bytes_sent`.
- Server may return `200` immediately if the hash matches an existing photo on the inspection (dedupe).

### 6.3 Push ordering
- Stage A for an inspection must complete before Stage B for the same inspection.
- Across inspections: oldest first by `envelope.created_at`.
- Photos: largest first within an inspection (frees local space faster) — but the server may override.

### 6.4 Idempotency
- Every write carries `Idempotency-Key` and is stored on the server with TTL ≥ 7 days. A retried envelope with the same key returns the original outcome.
- The client's `local_change.client_change_id` is the idempotency key.

### 6.5 Bandwidth and battery controls
- Sync runs only on Wi-Fi by default for photo uploads unless the user toggles "use cellular" for a session.
- Sync is throttled (configurable concurrency, default 2 photo uploads in flight).
- Sync backs off on low battery (<20%) for non-critical transfers.

### 6.6 Server assumptions
- Server stores `recordVersion` per inspection and increments on every accepted write.
- Server treats `Idempotency-Key` as a write-once key.
- Server returns 409 conflicts with structured payloads; it does not silently overwrite.

---

## 7. Conflict policy

The product explicitly rejects a full collaborative editor. We use **detection + explicit per-field resolution** on the device, with the server as authority.

| Field type | Policy | Notes |
|------------|--------|-------|
| Free-text form fields | Per-field: keep mine / keep theirs | No automatic merge. |
| Enum / status fields | Last-writer-wins, with the **server write losing if my change was made first locally** (LWW by `local_version` ordering) | Simpler; conflicts are rare. |
| Photos | Additive; both kept | List semantics, not field semantics. |
| Signature | Server wins if a supervisor uploaded one; otherwise keep mine | Regulation: the captured signature is the customer's. |
| Audit metadata (timestamps, device id) | Server always wins | Don't fight on system data. |
| State transitions (open → submitted → accepted) | Server is the only writer for `accepted` | Inspector never marks accepted. |

The conflict UI (§3.4) is mandatory: the inspector must resolve before the resubmission is queued. There is no automatic re-submit after a conflict. Every resolution choice is written to `local_change` with `kind=conflict_resolution` for the audit trail.

---

## 8. Attachments

### 8.1 Photos
- Capture: stream directly to the app's encrypted sandboxed directory; never to the OS gallery.
- Naming: `inspection_<id>/photo_<uuid>.jpg` plus a sidecar `.json` with EXIF minus GPS, capture time, hash.
- Strip GPS at capture time if device policy allows; otherwise flag for the post-accept purge.
- Compression: client-side downscale to a configured max edge (default 2048 px) and quality (default 0.8) before storing. Originals are not kept.
- Thumbnail generated at capture (256 px, low quality) for fast list rendering.

### 8.2 Signature
- SVG first; PNG fallback for older firmware.
- Stored as a separate record, not embedded in form JSON, so it can be replaced or audited independently.

### 8.3 Uploads
- Photos are uploaded **after** the form submission envelope accepts. This decouples the regulatory "submitted" state from photo transfer success and lets a flaky link still deliver the data.
- A photo is `uploaded` only when the server returns success. Until then, the local copy is the source of truth.
- Storage pressure: if local storage drops below a threshold, the app uploads the largest pending photos first.

### 8.4 Other attachments
- Out of scope. No PDFs, videos, or voice memos in v1. If added later, they use the same photo pipeline with a different MIME profile.

---

## 9. Security

### 9.1 At rest
- Rely on OS-level full-disk encryption (assumption A5).
- App sandbox on iOS / Android is non-negotiable; no world-readable files.
- Optional: an additional per-app key wraps the SQLite file via SQLCipher. **Decision D1** (see §14). Default off unless compliance requires it.

### 9.2 In transit
- TLS 1.2+ only; certificate pinning for the inspection API host. Pin rotation requires a server-side pin-overlap window.
- Reject any non-TLS connection, including captive portals that downgrade.

### 9.3 Authentication
- Same identity as the existing tablet app. Token is refreshed online; offline use is bounded by the existing token TTL.
- Offline window must not exceed token TTL minus a safety margin; if it does, the app requires re-auth before allowing edits and surfaces a clear message.

### 9.4 Authorization
- Server-side: the same checks as today. A new "write offline envelope" permission is added; existing users in the pilot group receive it; others don't.

### 9.5 Data minimization
- Strip EXIF GPS unless policy says otherwise.
- Do not log raw field values to client logs; only record IDs and counts.
- The audit log on the device mirrors the server audit log and is itself scrubbed on the same 24h clock.

### 9.6 MDM posture
- App is managed; remote wipe of the app's data is supported via the standard managed-app remove signal.
- "Block screenshot of inspection screen" is enabled on iOS where possible, given signatures and customer data appear on screen.

---

## 10. Migration and backfill

### 10.1 Schema migration
- Migration scripts are versioned; the new tables are additive. Existing rows in the read-through cache are forward-compatible.
- A migration test seeds a v0 database (current schema) and asserts v1 upgrades cleanly with no data loss and the new tables empty.

### 10.2 Backfill of existing inspections
- No data migration is required for inspections already on the server. They stay on the web/online path.
- An inspection opened for the first time on a tablet after rollout is downloaded with the new schema, including `body_json` populated from the existing API response.

### 10.3 Pilot user backfill
- Pilot users get the new build via MDM. Their local cache is rebuilt on first launch (full pull, not delta) so the new tables and state machine start clean.
- A "reset local cache" admin action is available for support.

### 10.4 Deprecation
- The old read-through cache path is kept for read-only flows outside the inspection write path. Removal is a later project.

---

## 11. Observability

### 11.1 Client-side
- Every sync run writes a `sync_run` row.
- Emit (locally, with sampling) metrics: time-to-first-paint for an inspection, time between edits, time from "online" to "submitted accepted," photo queue depth, retry counts, conflict counts.
- Client logs are scrubbed; no PII in logs.

### 11.2 Server-side
- New counters and traces: `offline_envelope_received_total`, `offline_envelope_conflict_total`, `offline_photo_upload_bytes_total`, `offline_idempotent_replay_total`.
- Trace each envelope end-to-end via `Idempotency-Key`.
- Dashboards split by pilot cohort.

### 11.3 Alerts
- Pilot-only alerts: spike in `409` conflicts, spike in envelope failure rate, drop in submission throughput, surge in client crash reports on inspection screen.
- An alert on `accepted_but_photos_not_uploaded` is a first-class signal; both must converge.

### 11.4 Audit
- The audit log captures who, what, when, from which device, on which `recordVersion`. It is replicated to long-term storage and is regulator-readable.

---

## 12. Staged rollout

Each stage has a go / no-go gate. Rollback path is defined per stage.

### 12.1 Stage 0 — internal dogfood
- Audience: engineers and a small QA team, synthetic data.
- Goal: prove the state machine, conflict UI, and idempotency on the wire.
- Exit criteria: 200 successful synthetic submissions offline→online; 50 synthetic conflicts resolved; no data loss across app kill mid-submit.

### 12.2 Stage 1 — closed pilot
- Audience: one customer or one region, ≤ 25 inspectors, with their supervisors still on the web tool.
- Goal: validate the inspector experience in real basements.
- Flags: server-side `OFFLINE_INSPECTION_PILOT` and an MDM configuration profile. Off by default.
- Exit criteria: ≥ 90% pilot inspections complete without manual supervisor help; no unresolved data loss; conflict rate < 5% of submissions; 24h purge verified on at least 20 accepted inspections.

### 12.3 Stage 2 — expanded pilot
- Audience: 1–3 more customers, up to 200 inspectors.
- Goal: stress on bandwidth variability and concurrent supervisor edits.
- Exit criteria: same as Stage 1 plus supervisor-edit-during-offline scenario tested with at least 10 real occurrences and no customer-visible data corruption.

### 12.4 Stage 3 — general availability
- Server flag flipped to on for all customers. MDM config no longer required to enable.
- Rollback is the same flag flip.

---

## 13. Rollback

| Layer | Rollback action | Data impact |
|-------|-----------------|-------------|
| Server flag | Flip `OFFLINE_INSPECTION_PILOT` off | New offline submissions rejected with a clear error. In-flight envelopes are allowed to drain. |
| App build | MDM removal of the offline-enabled build | Tablets re-downgrade to the previous build; new edits become online-only. |
| Local data | App detects flag-off and stops opening offline records; existing cached records remain read-only. | No data loss; offline records become ghost rows. |
| Server endpoint | Disable new endpoints behind feature flag | Clients see 404 on submit; UX is "this inspection can only be edited online." |
| Worst case | App + server flag both off, all clients downgraded | The system is back to pre-rollout behavior with a clean cutoff. |

No destructive server action is required to roll back. Because the server is authoritative and the offline envelope uses `Idempotency-Key`, no partially-applied state is created during rollback.

---

## 14. Decisions to make before implementation

Each decision has a recommendation. The first three are the highest-priority and feed directly into the conflict policy and the data model.

### D1. Storage encryption layer
- **Options**: (a) OS-only, (b) SQLCipher wrap, (c) per-blob AES-GCM with KMS-derived keys.
- **Recommendation**: (a) OS-only for v1. Tablets are managed and FDE is on. Add (b) if a security review or regulation demands it; the schema is ready. (c) is overkill and complicates resume.

### D2. Conflict resolution model
- **Options**: (A) Per-field explicit resolution only, (B) Automatic LWW for non-overlapping fields + explicit for overlaps, (C) CRDT-style merge for text fields, (D) Server-side merge tool.
- **Recommendation**: (A). Matches the "no full collaborative editor" stance. Keep the audit trail simple. Revisit if pilot shows >10% of submissions hit conflicts.

### D3. Photo upload timing
- **Options**: (1) Photos ship in the same envelope, (2) Photos upload only after form submission is accepted, (3) Photos upload as soon as the device is online, regardless of form.
- **Recommendation**: (2). Decouples regulatory "submitted" from photo transfer. Lets the inspector leave the basement as soon as the form is uploaded. Worst case: accepted form with photos not yet uploaded is visible in the supervisor UI as a banner.

### D4. Token TTL and offline window
- **Options**: extend token TTL to cover a worst-case visit, shorten offline capability, or require re-auth after N hours.
- **Recommendation**: keep current TTL, hard-cap offline writes at `TTL - 30 min` with a visible timer, and require re-auth to extend. Aligns with security without server changes.

### D5. Pilot gating mechanism
- **Options**: server-side feature flag, MDM config, or both.
- **Recommendation**: both. Server flag for the contract, MDM config for the app's UI, kept in sync via a `capabilities` endpoint the app calls on launch.

### D6. Cellular data policy
- **Options**: Wi-Fi only for photos, Wi-Fi only for everything, allow cellular with opt-in.
- **Recommendation**: Wi-Fi-only for photos by default, cellular opt-in per session, form + signature can use any network. Document the cost implications for the customer.

### D7. EXIF / GPS handling
- **Options**: keep, strip GPS only, strip all EXIF, keep EXIF but redact GPS server-side.
- **Recommendation**: strip all EXIF at capture. Storage and privacy win; audit timestamps come from the app, not the file.

### D8. Storage budget per device
- **Options**: hard cap at 1 GB, configurable per cohort, no cap.
- **Recommendation**: configurable per cohort, default 1 GB. Inspectors in the pilot are told the cap; the app enforces it.

### D9. Server dedup of photos
- **Options**: dedup by content hash globally, per inspection only, no dedup.
- **Recommendation**: per inspection, by content hash. Cheap server-side, removes accidental duplicates, no cross-customer storage cost.

### D10. Audit retention
- **Options**: retain device audit log only until purge, retain server audit for N years, replicate to WORM storage.
- **Recommendation**: server audit is retained per the existing records-retention policy (decision belongs to compliance — flag it). Client audit is purged on the same 24h clock as data.

---

## 15. Testing strategy

### 15.1 Unit
- State machine transitions for `inspection.state`.
- Local change log replay correctness.
- Conflict resolution rules.
- 24h purge scheduler edge cases: app killed, clock skew, accepted-while-offline.

### 15.2 Integration
- End-to-end: offline edits → online → envelope accepted → photos uploaded → state `synced`.
- Idempotency: replaying the same envelope key returns the same server result; double-tap on submit does not double-write.
- Version conflict: a synthetic supervisor edit between envelope creation and submit triggers the conflict UI and audit row.
- Resume: kill the app mid-photo-upload; on relaunch, the photo resumes from `bytes_sent`.

### 15.3 Network conditions
- A network lab profile (network link conditioner or app-level proxy) covering:
  - No signal for the full visit, then Wi-Fi only.
  - Flapping connection every 30 s.
  - Captive portal that returns HTTP 200 to a body that is not JSON.
  - TLS interception (must be rejected by pinning).
  - High-latency, low-bandwidth (GPRS-equivalent).

### 15.4 Device conditions
- Storage pressure (≥95% full).
- Low battery.
- OS upgrade mid-visit.
- Forced reboot.
- Two backgrounded sync runs racing.

### 15.5 Compliance
- Audit log integrity check (tamper-evident hash chain over `local_change` rows).
- 24h purge verification on a fleet of test devices with a wall-clock advance.
- Privacy review of every field, photo, and signature stored at any lifecycle stage.

### 15.6 Performance budget
- Cold start to first inspection: target under the existing app's current number plus a documented overhead.
- Edit-to-disk: target < 50 ms on mid-tier tablet hardware.
- Photo capture to local write: target < 200 ms.
- Sync drain of a 40-photo, fully-pending inspection on good Wi-Fi: target bounded by bandwidth; tracked, not asserted.

### 15.7 Security
- Pen test of the new endpoints, including the `Idempotency-Key` semantics.
- Token-expiry mid-visit test.
- Screenshot-block enforcement on iOS.

---

## 16. Milestone sequence

Milestones are ordered; later milestones can start once their dependencies are met. Effort is described as scope, not headcount, to avoid unjustified staffing estimates.

### M0. Decisions and design freeze
- **Dependencies**: none.
- **Work**: ratify D1–D10, finalize data model, finalize conflict UX mocks, finalize server endpoint contract.
- **Acceptance**: this document is approved, mockups are clickable, the server team has an API spec merged.

### M1. Local data + state machine
- **Dependencies**: M0.
- **Work**: SQLite migrations, `inspection` state column, `local_change`, `envelope`, `photo`, `signature` tables, state machine with unit tests.
- **Acceptance**: 100% state transition coverage, migration test from v0 → v1 passes, replay test passes.

### M2. Form-only offline (no photos, no signature)
- **Dependencies**: M1.
- **Work**: form editing offline, push on connect, version conflict path on the form fields, audit log.
- **Acceptance**: synthetic end-to-end test passes; conflict UI renders and resolves correctly.

### M3. Photos and signature
- **Dependencies**: M2.
- **Work**: photo capture pipeline, signature capture, photo upload (resumable), signature upload, storage budget enforcement.
- **Acceptance**: 40-photo inspection uploads and resumes correctly under flaky network; signature upload is atomic.

### M4. Server-side changes
- **Dependencies**: M0 (API spec), M2 (form).
- **Work**: `recordVersion` semantics, `If-Match` and `Idempotency-Key` middleware, conflict response shape, photo dedup, new endpoints.
- **Acceptance**: contract tests pass against the M2 client; load test of 10x pilot volume shows acceptable p95.

### M5. Observability and audit
- **Dependencies**: M3, M4.
- **Work**: client metrics, server metrics, audit hash chain, dashboards, alerts.
- **Acceptance**: every metric in §11.2 has a dashboard and a documented alert; audit chain verification tool exists.

### M6. Pilot enablement
- **Dependencies**: M3, M4, M5.
- **Work**: feature flag, MDM config, capabilities endpoint, pilot runbook, support tooling (reset local cache, force resync, view device state).
- **Acceptance**: dogfood (Stage 0) exits its go/no-go gate.

### M7. Closed pilot (Stage 1)
- **Dependencies**: M6.
- **Work**: pilot cohort onboarding, training, daily ops check-in.
- **Acceptance**: Stage 1 exit criteria met.

### M8. Expanded pilot (Stage 2)
- **Dependencies**: M7.
- **Work**: more cohorts, supervisor-edit scenarios.
- **Acceptance**: Stage 2 exit criteria met.

### M9. GA (Stage 3)
- **Dependencies**: M8.
- **Work**: flip flag, communication, deprecate any temporary workarounds.
- **Acceptance**: flag-on cohort = all customers; rollback drill run successfully.

### M10. Post-GA hardening
- **Dependencies**: M9.
- **Work**: revisit conflict policy if real rate > threshold, revisit encryption decision, revisit photo size policy, document known limits.
- **Acceptance**: known-limits doc is published; backlog is groomed.

---

## 17. Open questions for the product owner

These are not blockers for M0, but they shape the UX.

- Q1. What is the maximum acceptable time from "form submitted" to "all photos visible to the supervisor"? This drives photo upload prioritization.
- Q2. Can the supervisor web tool add a "currently being edited offline" banner sourced from a heartbeat, or is that out of scope for v1?
- Q3. Is the 24h purge measured from server-acceptance timestamp or from device-side clock? Server timestamp is the only honest answer; confirm.
- Q4. Are there any inspections that must be 100% online (e.g., for legal reasons in a given jurisdiction)? If yes, the app must be able to block offline open for those records.
- Q5. What is the contractual SLA for "submitted but photos not yet uploaded" visibility, if any?

---

## 18. Summary

The plan is an offline-first write path on the tablet, with explicit conflict
resolution, deferred photo upload, server-authoritative versioning via the
existing integer `recordVersion`, and a strict 24h local-data purge. It is
delivered in additive migrations, gated by a feature flag, and rolled out
through three pilot stages before general availability. The next move is to
ratify the ten decisions in §14 and freeze the API contract.
