# Plan: Offline work for tablet building-inspection app

## 1. Assumptions (explicit)

| # | Assumption | If wrong |
|---|------------|----------|
| A1 | Company-managed tablets have a local auth session (token or cert) that remains valid for a full offline shift (≥ 24h) | Need offline-issued short-lived credentials or a device unlock flow |
| A2 | Assigned inspections can be listed and fully downloaded before signal is lost; inspectors know which assignment they will work | Need an always-cached "my queue" and forced prefetch on assignment |
| A3 | Acceptance (supervisor sign-off) is a server-side state transition; the tablet only submits, it does not accept | Acceptance path also needs offline rules; scope grows |
| A4 | "Removal of local customer data within 24h after acceptance" means: after sync confirms `accepted`, the device may purge that inspection; no need to keep a local audit replica | Must retain a minimal audit stub locally and prove retention to auditors |
| A5 | Forms are structured (schema-versioned fields + free-text notes), not freeform documents | Richer offline editing model required |
| A6 | Photo metadata (time, inspector, inspection id) is the compliance artifact; exact original bytes may be recompressed for transfer | Must keep original bytes bit-for-bit |
| A7 | Integer record versions on the server are monotonically increasing per inspection record and can be used as sync tokens | Need a richer revision/history API |
| A8 | One inspector owns field edits on a given inspection during a session; supervisor edits are rare and can lose to "last writer with version check" rather than merge | True multi-author field-level merge is required (out of scope per product) |
| A9 | Pilot devices can receive app updates and server feature flags; pilot users tolerate occasional re-sync prompts | No remote control channel; bake everything into releases |

## 2. Goals / non-goals

**Goals**
- Open assigned inspections, fill forms, attach up to 40 photos, capture a signature with zero connectivity.
- Survive intermittent connectivity with automatic retry; never silently discard user-entered data.
- Keep a tamper-evident audit history of field-level changes and sync events.
- Purge customer data from the device within 24h of server-side acceptance.
- Pilot with a small cohort before broad rollout.

**Non-goals**
- Real-time collaborative editing / CRDTs / presence.
- Offline creation of brand-new inspections.
- Offline editing by supervisors on the web (web stays online-only).
- Cross-device handoff of an in-progress offline inspection.

## 3. User flow

1. **Prep (online):** Inspector signs in, opens *My assignments*. App downloads each assigned inspection (schema + current answers + photo list + version) and marks it `local-ready`. Badge: "Available offline".
2. **Site (offline):** Inspector opens a local-ready inspection. Forms save to SQLite on every field commit. Photos write to app-private storage with a local blob id; thumbnails cached. Signature captured as vector + raster; hash recorded.
3. **Intermittent sync:** When the network returns (app foreground, or background fetch every N minutes when permitted), the app drains a per-inspection outbox: metadata/answers first, then attachments in priority order (signature > small fields > photos). Progress UI shows pending count. Retry with exponential backoff + jitter; never drop an outbox entry without either success or explicit user confirmation of abandon.
4. **Submit offline:** Inspector marks the inspection `ready-to-submit`. If offline, it queues as the final outbox item. On successful submit, server returns new version + `submitted` state.
5. **Acceptance (supervisor, web):** Supervisor reviews, may edit (online). Server bumps version and records audit. When state becomes `accepted`, the next device sync response includes `accepted` + purge-after timestamp (`accepted_at + 24h`).
6. **Purge:** App deletes local answers, photos, signature, and derived thumbnails for that inspection at purge time (or on next launch if device was off), keeps only a purge receipt (inspection id, purge time, content hashes) unless A4 says otherwise, and reports purge to the server for compliance.

## 4. Scope boundaries

- Offline is available **only** for inspections that were successfully opened/downloaded while online at least once ("local-ready set").
- Edits are whole-inspection last-writer-wins at field granularity with version precondition; no merge UI in v1 (conflict surface is a dialog, see §7).
- Photos: up to 40 per inspection, compressed for upload (configurable max edge / JPEG quality), originals retained locally until purge.
- Signature: one inspector signature offline; countersign (if any) is online-only in v1.
- No offline export/email of reports; report PDF generation stays server-side.

## 5. Local data model (SQLite + blob store)

Tables (illustrative):

- `inspections(id PK, server_version, state, assigned_to, schema_id, schema_version, downloaded_at, accepted_at, purge_after, dirty)`
- `answers(inspection_id, field_id, value_text, value_num, value_bool, updated_at, updated_by, local_rev, sync_state)` — PK `(inspection_id, field_id)`
- `attachments(id PK, inspection_id, kind /*photo|signature*/, local_path, sha256, bytes, mime, captured_at, server_id NULL, upload_state, retries)`
- `outbox(id PK, inspection_id, op /*upsert_answers|upload_attachment|submit|ack_purge*/, payload_json, created_at, next_attempt_at, attempts, state)`
- `audit_events(id PK, inspection_id, at, actor, device_id, event_type /*edit|photo_add|sign|sync_ok|sync_fail|submit|purge*/, field_id NULL, old_hash, new_hash, prev_event_hash, event_hash)` — hash chain per inspection
- `schema_cache(schema_id, version, form_json, fetched_at)`

Blobs in `files/attachments/<sha256>` (content-addressed). DB stores only hashes + paths. All writes go through a single repository layer so purge and audit cannot be bypassed.

`local_rev` is a per-device monotonic counter for idempotent outbox identity; the server still owns `server_version`.

## 6. Sync protocol

Keep REST; extend, don't replace.

1. **Pull** `GET /inspections/{id}?since_version=v` → record + version + state. Also `GET /assignments` for queue refresh (online only).
2. **Push** `POST /inspections/{id}/changes` with:
   - `base_version` (precondition),
   - `client_change_id` (UUID, idempotency key),
   - field upserts (only dirty fields) + `client_rev`,
   - optional `op=submit`.
   Response: `200` new `server_version`, or `409` with server field snapshot for conflict handling, or `422` schema/validation error (do not retry blindly — surface to user).
3. **Attachments** `POST /inspections/{id}/attachments` (multipart or resumable upload session for photos; chunk size ~1–2 MB). Server returns `server_id`. Upload is content-hash idempotent. Signature uploads first and is required before `submit` succeeds.
4. **Purge ack** `POST /inspections/{id}/purge-ack` with device id, purge time, list of deleted hashes.
5. Ordering per inspection: answer upserts → attachment uploads → submit → (later) purge-ack. Across inspections, outbox is parallelizable but bounded (2 workers) to protect radio/battery.
6. Idempotency: every push carries `client_change_id`; server stores it and returns the original result on replay (covers timeout-after-commit).
7. Clock skew: server timestamps are authoritative for `accepted_at` / `purge_after`; device uses them verbatim.

## 7. Conflict policy

Product decision: **no collaborative editor**. Policy:

- Every push requires `base_version == server_version`, else `409`.
- On `409`, app compares dirty local fields vs server snapshot:
  - If disjoint field sets → auto-rebase: retry push with new `base_version` (still recorded in audit).
  - If same field edited → **local field loses** (server wins) for supervisor-originated changes; show a non-blocking toast listing overwritten fields, and keep the local discarded value in `audit_events` (not as an editable answer).
  - If local has `submit` pending and server moved past `submitted`/`accepted` → drop local submit, adopt server state.
- Photo/signature blobs never conflict (append-only by hash); duplicates deduped server-side.
- Rationale: supervisors are the reviewers; their online corrections are authoritative. Field-level LWW avoids silent data loss better than whole-record LWW.

## 8. Attachments

- Cap 40 photos/inspection (enforced locally and server-side). Show remaining count.
- Local pipeline: capture → downscale preview → store original → enqueue upload of *transfer* encoding (config: max edge 2048, JPEG q≈80) plus EXIF time. Strip precise GPS by default (policy flag).
- Resumable uploads; cancel/retry UI; upload only on Wi-Fi toggle (default on for company-managed devices).
- Signature stored as PNG/SVG + device-local cert binding (see §9). Hash of signature payload written to audit chain before first upload attempt.

## 9. Security

- Auth tokens in platform keystore/Keychain; biometric/passcode device unlock required before first offline edit of the day (gate for offline use of cached credentials).
- App-private storage; no customer data on shared storage. Screen capture discouraged via OS flags where available (not compliance-critical).
- All sync traffic TLS 1.2+; certificate pinning optional for pilot (decide via D1).
- Field-level values never logged; logs carry ids/hashes only.
- Remote wipe / selective purge command path (MDM or server "revoke inspection" push) — MDM wipe covers lost devices; in-app purge covers retention.
- Signature integrity: hash of signature image + inspection id + schema version chained into audit; server verifies hash on submit.

## 10. Migration / backfill

- Server: add `client_change_id` idempotency store, attachment upload sessions, `purge-ack` endpoint, `accepted_at` on inspections. Additive, versioned (`Accept: application/vnd.insp.v2+json`).
- Device: migrate `answers` table from cache semantics to durable outbox-backed store (`local_rev`, `sync_state` columns; backfill `local_rev=0`). Migration is transactional; on failure app falls back to read-only cache mode and forces resync rather than risking corruption.
- Existing cached inspections are re-downloaded once (treat as not local-ready until re-fetched) — simplest correct backfill.
- Audit chain starts at migration time; a server-side `audit_created` root event anchors the chain per inspection.

## 11. Observability

- Client metrics (aggregated, no PII): outbox depth/age, sync success/409/422 rates, attachment upload retries/time-to-drain, purge latency after `accepted_at`, crash-free sessions on pilot builds.
- Server metrics: 409 rate by field, idempotent replays, purge-ack lag, attachment integrity mismatches.
- Per-inspection audit chain export endpoint for regulators (server-side; device contributes events via sync).
- Alerting: purge-ack lag > 20h in pilot → page on-call (compliance clock).

## 12. Staged rollout

| Stage | Cohort | Gate to next |
|-------|--------|--------------|
| S0 | Internal dogfood (2–3 devices, synthetic buildings) | 2 full offline-to-accept-to-purge cycles per device; zero silent data loss |
| S1 | Pilot: 5–15 inspectors, one region, real jobs | ≥ 95% sessions complete offline path without support ticket; purge-ack lag p95 < 12h; 409 auto-rebase success ≥ 90% of conflicts |
| S2 | Expand regions + supervisor conflict tooling polish | S1 metrics hold for 2 weeks of real volume |
| S3 | Broad rollout | No open Sev-1/2 from S2 |

Feature flag `offline_mode` (server-driven) plus minimum app version flag. Kill switch flips devices to read-only cache behavior on next connect.

## 13. Rollback

- **Flag off:** devices stop accepting offline edits; pending outboxes still drain (never discard). New edits require connectivity.
- **App release rollback:** schema migrations written backward-compatible within one minor (additive columns only for 2 releases) so store rollback doesn't brick local DB.
- **Server rollback:** v2 routes are additive; v1 clients unaffected. Idempotency store retained.
- **Data rollback:** purge is destructive by design — not reversible; rollback of the *feature* does not resurrect purged device data (server remains system of record).
- Declare explicitly: accept loss of in-flight offline edits only via user-mediated "abandon changes" — no automatic rollback path drops outbox.

## 14. Testing

- Unit: outbox state machine, conflict rebase/field-diff, audit hash chain, purge scheduler.
- Integration: REST sync against staging with fault injection (timeouts after commit, 409 storms, chunked upload interrupt).
- Device lab: airplane-mode runs for full inspection + 40 photos + signature; intermittent network (monkey/chaos profile); force-quit mid-upload; clock skew.
- Compliance tests: simulated `accepted` → verify purge within 24h including device-off window at purge time; audit chain verification job.
- Pilot exit checklist = S1 gate metrics above.

## 15. Milestone sequence (no dates, no staffing)

**M1 — Offline capture core** (depends: schema cache, device storage migration)
- Durable answers + local attachments + outbox; no network required after download.
- AC: airplane-mode inspection completion with 40 photos + signature intact after force-quit.

**M2 — Sync engine** (depends: M1, server idempotent change API, attachment upload API)
- Ordered drain, retries, `409` auto-rebase, field-conflict surfacing.
- AC: fault-injection suite green; replaying `client_change_id` yields single commit.

**M3 — Submit + supervisor convergence** (depends: M2)
- Offline submit queue; server 409 policy as in §7; audit chain upload.
- AC: concurrent supervisor edit vs offline submit converges deterministically; audit chain verifies.

**M4 — Retention & purge** (depends: M3, `accepted_at` + purge-ack API)
- Purge scheduling, receipts, compliance metric.
- AC: purge-ack p95 < 12h in S0/S1; regulator export job runs clean.

**M5 — Pilot hardened** (depends: M1–M4, feature flag, observability)
- Kill switch, Wi-Fi-only toggle, support tooling (per-device sync dump), S0 exit.
- AC: S0 checklist passed; docs for field support.

**M6 — Pilot & evaluate** (depends: M5)
- S1 cohort run; go/no-go for S2.
- AC: S1 gate metrics met or explicit product sign-off to iterate.

Dependencies: M1→M2→M3→M4 is the critical path; M5 can overlap late M4 (flags/observability); M6 is strictly gated.

## 16. Decisions required before implementation (with recommendations)

| ID | Decision | Recommendation | Why |
|----|----------|----------------|-----|
| D1 | TLS pinning on/off | Off for pilot, measure; decide before S2 | Pinning complicates enterprise proxy debugging; pilot risk is low on managed networks |
| D2 | Photo transfer encoding vs originals | Upload compressed derivative + hashes of original; keep original until purge | Bandwidth in basements/street 4G; regulators accept hash-anchored originals |
| D3 | GPS in EXIF | Strip by default; site id is the location record | Avoid precise home location retention; simpler purge surface |
| D4 | Conflict: who wins on same-field edit | Server (supervisor) wins; local discarded value kept in audit only | Matches "not a collaborative editor"; reviewers are authoritative |
| D5 | Offline auth lifetime | Require daily unlock (biometric/passcode) to use cached creds; session ≤ 7 days device-bound | Limits lost-device exposure while keeping full-shift offline |
| D6 | Purge receipt contents | Store id, times, hash list only — no field values | Satisfies A4 with minimal residual risk; easy to extend if auditors demand more |
| D7 | Attachment upload radio policy | Wi-Fi preferred, cellular allowed after 30 min backlog | Pilot devices are cellular-enabled; don't strand evidence |
| D8 | Schema evolution while offline | Pin `schema_version` at download; edits with old schema still accepted if field ids stable; force re-download if schema `breaking: true` | Avoids mid-form surprise; server remains flexible |
| D9 | Signature acceptance offline | Capture full signature packet offline; mark `submitted` only after signature hash reaches server | Signature is the legal artifact; don't let submit succeed without it |
| D10 | Kill-switch behavior | Read-only cache mode, outbox drains, no new offline edits | Never destroy user work when disabling the feature |

## 17. Open questions (explicitly deferred)

- Countersignature workflow and whether it needs offline support (assume no for pilot).
- Cross-inspection batching for sites with many units.
- Long-term device audit retention if A4 is later rejected by compliance.
