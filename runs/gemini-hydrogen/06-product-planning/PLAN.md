# Offline Inspection Sync — Product & Engineering Plan

> **Input constraint:** Derived solely from [BRIEF.md](BRIEF.md). Items not specified in the brief are explicitly recorded below as **Assumptions** or **Pre-Implementation Decisions**.

---

## 1. Explicit Assumptions

| ID | Assumption | Basis / Gap in Brief |
|---|---|---|
| **A1** | **Managed Tablet Runtime & SQLite:** Company-managed tablets run a modern mobile OS (iOS/iPadOS or Android) under MDM, with an application-accessible SQLite engine supporting WAL mode, ACID transactions, and encryption (e.g., SQLCipher + OS Keychain/Keystore), though the OS may suspend background execution unpredictably. | Brief states "company-managed tablets" and "has SQLite", without specifying OS, hardware spec, or background policy. |
| **A2** | **Offline Window Duration:** Typical offline field work lasts 1–8 hours (a single shift in signal-dead basements), with tablets normally reconnecting within 24 hours; multi-day offline periods (e.g., weekends/powered-off devices) can still occur occasionally. | Brief states "basements with no signal" and "Connectivity may return intermittently", without specifying shift length. |
| **A3** | **Single-Inspector Field Ownership & Low Overlap Rate:** Each inspection is assigned to one primary inspector in the field. Supervisors can edit metadata, status, or review fields concurrently from the web, but simultaneous co-editing of the *same* form fields by web and offline mobile is infrequent enough that deterministic conflict resolution (not a collaborative editor) is viable. | Brief states "open assigned inspections", "Supervisors can edit the same inspection from the web", and "does not want a full collaborative editor". |
| **A4** | **Backend REST Extensibility:** While existing server APIs use REST with integer record `version`s, the backend can add backward-compatible extensions (idempotency keys, field-level `PATCH` / delta sync, resumable attachment upload, and offline audit fields) alongside existing endpoints. | Brief specifies existing REST + integer record versions; client-only changes cannot guarantee idempotent retries or regulatory audit provenance alone. |
| **A5** | **Attachment Size & Device Storage Capacity:** Client-side compression keeps photos around ~1–2 MB each (≤ 80 MB for 40 photos + < 200 KB signature), and managed tablets have sufficient app storage (e.g., ≥ 2 GB free) to hold multiple assigned inspections locally. | Brief requires "up to 40 photos, and collect a signature offline" without payload or device storage specs. |
| **A6** | **Acceptance Trigger & 24h Removal Semantics:** "Accepted" is a server-authoritative workflow state (typically triggered by supervisor/QA approval after submission). Because an offline tablet cannot learn of a server acceptance event while disconnected, compliance depends either on immediate post-sync eviction of *synced* inspections plus immediate purge upon receiving `accepted`, or an explicit legal interpretation of when the 24h clock begins. | Brief requires "removal of local customer data within 24 hours after an inspection is accepted" without defining offline-at-acceptance behavior. |
| **A7** | **Offline Auth Session Continuity:** Company-managed tablets retain usable offline unlocking (device PIN/biometric + MDM-backed refresh tokens or device certificates) across offline periods, and returning to connectivity with an expired access token does not force a destructive sign-out that wipes SQLite. | Brief notes company-managed tablets and current note loss on dropped connections, without specifying SSO/IdP token lifetimes. |
| **A8** | **Versioned Form Schemas:** Inspection form definitions, validation rules, and lookup catalogs are versioned, change infrequently relative to a field shift, and are small enough to cache locally with assigned inspections. | Brief states inspectors "fill forms" offline, requiring offline validation and rendering. |

---

## 2. Scope Boundaries

### In Scope
- **Offline Read & Write Core:** Pre-fetching assigned inspections, form schemas, and reference lookups; durable local persistence in SQLite for form edits, notes, up to 40 photos, and a signature per inspection.
- **Store-and-Forward Sync:** Background and manual synchronization over intermittent networks with idempotent mutation queues, resumable attachment uploads, and integer-version optimistic concurrency control (OCC).
- **Deterministic Conflict Handling:** Field-level / section-level 3-way diffing where possible, explicit conflict resolution UI / precedence rules (no silent Last-Write-Wins), and full preservation of both values in the regulatory audit history.
- **Regulatory Compliance & Security:** At-rest encryption, offline auth continuity, immutable audit attribution (offline vs. server timestamps, device/actor IDs), and verified deletion of local customer data within 24 hours of acceptance.
- **Rollout Readiness:** Legacy SQLite cache migration, zero-PII observability, gated pilot rollout, safe drain-first rollback, and fault-injection testing.

### Out of Scope
- **Full Collaborative Editor:** No CRDTs, Operational Transformation, real-time presence, or live multi-user cursor/field merging (explicitly excluded by brief).
- **Multi-Inspector Offline Co-Editing:** Simultaneous offline field edits by two inspectors on the same inspection are not supported.
- **Ad-Hoc Offline Inspection Creation:** Creating brand-new unassigned inspections while offline is excluded (brief specifies opening *assigned* inspections).
- **Extended Media Types:** Video, audio, or > 40 active photos per inspection.
- **Unmanaged / BYOD Tablets:** Security and purge controls assume company-managed MDM devices.
- **Offline Supervisor Web Client:** Supervisor web remains an online REST client, receiving only the minimal API/UI additions required for audit visibility, versioned edits, and conflict escalation.

---

## 3. User Flow (End-to-End Lifecycle)

```
[Online Depot / Pre-Shift]
  Assigned list + form schemas + existing inspection snapshots prefetched
  Badge: "Ready Offline" (or "Incomplete — Retry Sync" if template/data failed)
          │
          ▼
[Basement / Zero Signal]
  Banner: "Offline — Changes saved locally"
  Open inspection -> Fill form (local schema validation, instant SQLite persistence)
                  -> Capture up to 40 photos (private encrypted store, thumbnails)
                  -> Capture signature (binds to form+photo digest; locks or requires re-sign)
          │
          ▼
[Intermittent / Restored Signal]
  Reachability probe passes (captive portals rejected) -> Background sync drains outbox
  Badges: "Pending Sync" -> "Syncing (14/40 photos)" -> "Synced" OR "Conflict — Needs Review"
          │
          ├──► [Supervisor Edited Web Concurrently] -> Disjoint fields auto-merge (audited);
          │       Overlapping/state conflicts pause sync & preserve both sides for resolution
          │
          ▼
[Inspection Accepted (or Submitted & Synced)]
  Server marks Accepted -> Next sync delivers accepted_at (or proactive post-submit eviction)
  Tablet scrubs local customer data (SQLite rows + WAL + attachments + caches) <= 24h
```

### Detailed Flow & Edge States
1. **Pre-Shift Readiness (Online):** On app launch, foreground, or manual refresh, the app prefetches assigned inspections, versioned form schemas, and required prior notes/metadata. Each row displays an explicit readiness badge (`Ready Offline`, `Downloading`, or `Download Failed`). Inspectors cannot accidentally walk into a basement assuming an inspection is cached when a schema or snapshot failed to download.
2. **Offline Form Editing:** Opening an inspection reads exclusively from local SQLite. Every field edit validates against the cached form schema and commits atomically to SQLite (on short debounce ≤ 300 ms, field blur, navigation, and app background) so OS kills, crashes, or battery loss never discard notes.
3. **Photo Capture (≤ 40 Photos):** In-app camera captures directly into private encrypted app storage (never the OS public photo library). Client enforces the 40 active-photo cap per inspection, shows remaining count (`18/40`), allows local deletion/retake before or after upload, and warns if free disk space drops below safety thresholds (without ever blocking text note saves).
4. **Offline Signature Capture:** Before signing, client validates required fields locally. Signature capture stores vector/PNG data, signer name/role, client timestamp, and a cryptographic hash (`form_snapshot_sha256`) of the form values and photo list being attested. **Once signed, local edits are locked** unless the inspector explicitly chooses *Void Signature & Edit* (which clears the signature and requires re-signing).
5. **Intermittent Sync & Partial Connectivity:** When connectivity returns, the sync engine drains pending text mutations and photo chunks asynchronously in the background without blocking UI work on other inspections. If signal drops after uploading 17 of 40 photos, completed photos stay recorded on device and server; upload resumes from the exact missing photos/byte offsets on reconnect.
6. **Conflict Encountered:** If a supervisor edited the inspection on the web while the inspector had unsynced local mutations, non-overlapping edits merge automatically (with audit entries). Overlapping field edits or lifecycle changes (cancelled/reassigned/accepted) place only that inspection into `Conflict — Needs Review` with both values visible; no offline notes are ever silently dropped.
7. **Post-Acceptance Cleanup:** Once `accepted` is received (and local outbox is empty), customer data is scrubbed locally immediately (keeping only a zero-PII tombstone/status receipt if needed for UI confirmation, then removing from active worklist).

---

## 4. Local Data Model (SQLite Architecture)

The mobile app replaces its read-through cache with a **local-first store-and-forward engine** backed by SQLite in WAL mode (`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA secure_delete=ON;`), encrypted via SQLCipher. The UI reads from and writes **only** to SQLite, online or offline.

### Core Tables
1. **`form_templates`** *(Non-PII — retained across purges)*
   - `template_id`, `template_version` (PK), `schema_json`, `checksum`, `fetched_at`.
2. **`inspections_server_snapshot`** *(Last server-acknowledged baseline for 3-way diffing)*
   - `inspection_id` (PK), `server_version` (int), `status`, `assigned_to`, `template_id`, `template_version`, `snapshot_fields_json`, `accepted_at`, `server_updated_at`, `last_synced_at`, `is_offline_ready` (bool).
3. **`inspection_local_fields`** *(Field-level dirty tracking & materialized draft)*
   - `(inspection_id, field_key)` (PK), `local_value_json`, `base_value_json` (value at `base_server_version`), `is_dirty` (bool), `client_updated_at`, `dirty_since_version` (int).
   - Keeping `base_value_json` + `is_dirty` per field enables exact 3-way conflict detection (`base` vs. `new_server` vs. `local`) rather than blindly re-submitting unchanged fields.
4. **`mutation_outbox`** *(Durable ordered store-and-forward queue)*
   - `mutation_id` (UUIDv4 PK, sent as `Idempotency-Key`), `inspection_id` (FK), `seq_no` (monotonic int per inspection), `op_type` (`PATCH_FIELDS`, `ATTACH_COMMIT`, `DELETE_ATTACHMENT`, `COMMIT_SIGNATURE`, `SUBMIT`, `RESOLVE_CONFLICT`), `payload_json`, `base_server_version` (int), `client_timestamp`, `state` (`pending`, `in_flight`, `acked`, `conflict`, `failed_permanent`), `attempt_count`, `next_retry_at`, `last_error`.
   - *Coalescing rule:* Pending `PATCH_FIELDS` mutations for the same inspection may coalesce before entering `in_flight` and never across barrier operations (`COMMIT_SIGNATURE`, `SUBMIT`, `RESOLVE_CONFLICT`).
5. **`local_attachments`** *(Photos + Signature metadata & upload state)*
   - `attachment_id` (UUIDv4 PK), `inspection_id` (FK), `kind` (`photo` | `signature`), `local_rel_path` (inside encrypted private sandbox), `thumb_rel_path`, `sha256`, `mime_type`, `byte_size`, `metadata_json` (capture time, caption, signer metadata), `upload_state` (`queued`, `uploading`, `uploaded_binary`, `committed`, `deleted_locally`, `failed_permanent`), `server_attachment_id`, `upload_session_url`, `uploaded_offset`, `attempt_count`, `next_retry_at`.
   - Active photo count invariant (`kind = 'photo' AND upload_state != 'deleted_locally'`) enforced atomically ≤ 40 per inspection.
6. **`conflict_records`** *(Staged conflict state until resolved)*
   - `conflict_id` (PK), `inspection_id`, `detected_at`, `base_version`, `server_version`, `server_snapshot_json`, `local_dirty_fields_json`, `conflicting_keys_json`, `status` (`open`, `resolved`, `escalated_audit`).
7. **`purge_tombstones`** *(Zero-PII compliance proof & stale-response guard)*
   - `inspection_id` (opaque UUID PK — contains zero customer names/addresses/notes), `accepted_at`, `purged_at`, `purge_reason` (`accepted` | `post_submit_eviction` | `reassigned` | `cancelled`), expires after configurable retention (e.g., 30 days).
8. **`telemetry_outbox`** *(Zero-PII operational diagnostics)*
   - `event_id` (PK), `event_type`, `timestamp`, `metrics_json`, `sent_state`.

---

## 5. Sync Protocol

### Protocol Principles
- **Single-Flight Sync Coordinator:** A single background sync worker runs per app process with a per-inspection lock so app foreground, network-change callbacks, and manual refreshes never race on the same outbox item.
- **Captive-Portal & Reachability Guard:** Before draining outboxes on a network-up signal, perform a tiny authenticated health ping (`GET /sync/ping`) expecting a signed JSON response; captive portals returning HTML `200 OK` are treated as offline.

### Sync Sequence
1. **Pull / Delta Check (Metadata & Acceptance Discovery):**
   - `GET /inspections/sync-delta?assigned_to=me&since=<cursor>` returns lightweight records: `(inspection_id, server_version, status, assigned_to, accepted_at, deleted_or_unassigned)`.
   - Also periodically query assigned/cached inspection IDs still on device so `accepted` or `reassigned` transitions are never missed even if an inspection left the active "assigned" filter.
   - If `server_version > local.server_version`: fetch `GET /inspections/{id}` (+ `form_templates` if missing).
     - If `mutation_outbox` for that inspection is empty: replace `inspections_server_snapshot` and `inspection_local_fields` cleanly.
     - If `mutation_outbox` is non-empty: do **not** overwrite local edits; run the Conflict Policy's 3-way evaluation.
2. **Phase A Push — Early Field Deltas (`PATCH_FIELDS`):**
   - Small JSON field deltas can sync independently *before* large photos finish, giving supervisors early progress visibility (while `SUBMIT` waits on attachments).
3. **Phase B Push — Resumable Attachment Binary Uploads:**
   - For each attachment where `upload_state IN ('queued', 'uploading')` (max 2 concurrent uploads to avoid saturating weak links):
     1. `POST /inspections/{id}/attachments/init` with `Idempotency-Key: <attachment_id>`, `sha256`, `byte_size`, `kind`, `mime_type` -> returns `server_attachment_id` + resumable upload session (or returns already-completed status on retry).
     2. Upload chunks (`PUT`/`PATCH` with `Content-Range` and chunk checksums, e.g., 256–512 KB chunks) querying offset (`HEAD`) on reconnect so interrupted transfers resume without re-sending uploaded bytes.
     3. Server verifies full `sha256` on final chunk; client marks `upload_state = 'uploaded_binary'`.
   - `COMMIT_SIGNATURE` and `SUBMIT` mutations are dependency-blocked in the outbox until every referenced active attachment reaches `uploaded_binary` and every `DELETE_ATTACHMENT` mutation succeeds.
4. **Phase C Push — Versioned State Transitions & Idempotent Mutations:**
   - Process per-inspection outbox sequentially by `seq_no`.
   - Every write carries:
     - `Idempotency-Key: <mutation_id>` (server caches responses by key so a timeout *after* server commit returns the cached `200 OK` + new `version` instead of a spurious `409`).
     - `base_version` (integer `If-Match` / request body `version`) matching `inspections_server_snapshot.server_version`.
     - Audit provenance (`client_timestamp`, `offline_created`, `device_id`, `dirty_fields`).
   - **Response Handling:**
     - `200/201`: Commit `new_version` to `inspections_server_snapshot`, clear matching dirty flags, mark mutation `acked` in one SQLite transaction.
     - `409 Conflict` / `412 Precondition Failed`: Fetch latest `GET /inspections/{id}` (`version = M`), execute Conflict Policy, pause *only* this inspection's outbox until resolved (other inspections continue syncing).
     - `401 Unauthorized`: Pause entire outbox (never wipe SQLite!), prompt re-auth; verify re-authenticated user matches local outbox owner before resuming.
     - `403 Forbidden`: Inspection reassigned/revoked -> escalate unsynced local mutations to conflict/orphan audit endpoint (see Conflict Policy).
     - `422 Unprocessable Entity`: Mark `failed_permanent`, surface field validation error to user.
     - `5xx` / Timeout / Network Drop: Exponential backoff with jitter (e.g., `2s -> 4s -> 8s ... capped at 15m`), keep `Idempotency-Key` unchanged.

---

## 6. Conflict Policy

Silent whole-record Last-Write-Wins (LWW) is prohibited because it drops supervisor or inspector findings and breaks regulatory auditability. Because the brief excludes a collaborative editor and uses REST integer versions, conflicts follow a **3-way deterministic policy**:

| Scenario | Detection | Automated / User Resolution | Audit History Behavior |
|---|---|---|---|
| **1. Disjoint Field Edits** (Supervisor changed field A on web; Inspector changed field B offline) | `3-way diff` between `base_snapshot(N)`, `server_snapshot(M)`, and `local_dirty_fields` finds `dirty_server ∩ dirty_local == ∅`. | **Auto-merge:** Client rebases `local_dirty_fields` onto `server_snapshot(M)`, sets `base_version = M`, and retries `PATCH` with a new `Idempotency-Key` + `original_base_version = N`. (Server validates no overlap since `M`.) | Server records both the supervisor edit (`N→N+1`) and the inspector's offline edit (`M→M+1` with `client_timestamp`, `offline_created=true`, and `rebased_from_version=N`). |
| **2. Additive Photos** (Web and mobile both added photos) | Photos carry client-generated UUIDs. | **Auto-merge** if combined active photo count ≤ 40. If combined > 40, trigger manual conflict selection before deletion. | Server logs each photo addition with uploader actor and timestamp. |
| **3. Overlapping Field Edits** (Both edited field X on unsubmitted inspection) | `dirty_server ∩ dirty_local ≠ ∅` on same field key(s). | **Pause & Inspector Resolution UI:** Inspection enters `Conflict — Needs Review`. Show field-by-field comparison (*Supervisor value + time* vs. *Your offline value + time*). Inspector selects *Keep Mine*, *Accept Supervisor's*, or edits value (must re-sign if previously signed). | **Both values preserved:** Audit record stores `resolution_strategy`, winning value, AND `superseded_candidate_value` + original actor/timestamps. |
| **4. Lifecycle Conflict: Accepted / Submitted on Web while Tablet Offline** | `server_status ∈ {submitted, accepted}` and tablet has non-empty outbox. | **Server/Supervisor State Prevails on Record + Exception Escalation:** Do NOT overwrite an accepted/submitted legal record, and do NOT delete inspector's unsynced notes! Client uploads pending delta + photos to an immutable `POST /inspections/{id}/conflict-audit-bundle` for supervisor review/amendment workflow, confirms receipt, then clears local draft. | Full unsynced inspector submission preserved in immutable audit/review log linked to the inspection. |
| **5. Lifecycle Conflict: Reassigned or Cancelled on Web** | `403` or `assigned_to != me` or `status == cancelled` with non-empty outbox. | Same escalation: upload unsynced work to `conflict-audit-bundle` for supervisor disposition; only purge local copy after server acknowledges audit preservation. | Preserves evidence of work performed offline prior to reassignment/cancellation. |

---

## 7. Attachments (Up to 40 Photos + Signature)

- **Private Encrypted Storage:** Captured photos and signature files are stored solely in the app's private data directory with file-level encryption (or per-inspection symmetric keys wrapped by OS Keystore), explicitly excluded from OS media galleries/camera roll and OS cloud backups (`NSURLIsExcludedFromBackupKey` / `android:allowBackup="false"` + `.nomedia`).
- **Compression, Thumbnails & EXIF:** Compress photos on capture (e.g., max 2048 px long edge, JPEG ~80% quality → ~1–2 MB; configurable) to prevent OOM and cellular stalls across 40-photo jobs. Generate lightweight local thumbnails (~30–50 KB) for UI lists. Strip non-essential EXIF tags unless required by compliance (see Decision D5), retaining orientation and capture timestamp. Compute `sha256` immediately on write.
- **40-Photo Cap & Edits:** Enforced inside SQLite transactions counting non-deleted photos per inspection. Deleting a photo locally before upload deletes the local file immediately; deleting an already-uploaded photo queues `DELETE_ATTACHMENT` before `SUBMIT`.
- **Storage Quotas & Low-Disk Guard:** Before starting prefetch or taking new photos, verify free storage (e.g., warn at < 500 MB free; disable prefetching *other* inspections at < 250 MB free, while never blocking saving text notes on an active open inspection).
- **Resumable Chunked Upload & Cleanup:** Bounded concurrency (2 parallel photo uploads), chunked transfer (`256–512 KB`) with server-side byte-offset query and end-to-end `sha256` validation. Server runs periodic garbage collection (e.g., 7-day TTL) on `uploaded_binary` files that were never committed to an inspection due to aborted conflicts or deleted drafts.
- **Signature Binding:** Signature captured as vector strokes + rendered PNG (< 200 KB) alongside `signer_name`, `signer_role`, `signed_at_client`, and `form_snapshot_sha256` (covering current form fields + sorted attachment `sha256`s).

---

## 8. Security & 24-Hour Post-Acceptance Compliance

### Encryption & Device Hardening
- **SQLite & File Encryption:** Enable SQLCipher (AES-256) with key stored in hardware-backed OS Keychain/Keystore; wrap attachment encryption keys per inspection to enable instant **cryptographic erasure**.
- **Transport & Cache Hygiene:** Enforce TLS 1.2+/1.3; disable OS-level HTTP disk caches (`OkHttp` disk cache / `NSURLCache` disk storage) for all customer-data API responses so unencrypted PII never leaks outside SQLCipher.
- **Zero-PII Logging & App Hardening:** Redact customer names, addresses, notes, and payloads from crash reporters, analytics, and device logs; optionally obscure app-switcher screenshot previews when backgrounded; exclude all app data from cloud/USB backups.

### Offline Authentication Resilience
- Offline access to already-cached assigned inspections is protected by managed-tablet device lock (PIN/biometric via MDM) rather than blocking on live network token introspection.
- On `401 Unauthorized` during background sync, **never clear SQLite or drop the outbox**. Pause sync, surface a non-destructive *Sign in to resume sync* banner, verify that the newly authenticated user ID matches the local outbox owner, and resume draining. (If a different inspector logs into a shared tablet, require draining or isolating per-user encrypted DB partitions—never allow user B to submit user A's outbox or view user A's cached PII.)

### 24-Hour Local Data Removal After Acceptance
1. **What Must Be Removed:** All `inspections_server_snapshot`, `inspection_local_fields`, `conflict_records`, `mutation_outbox` payloads (once acked), full-res photos, thumbnails, signature binaries, and any residual temp files associated with the inspection. Non-PII `form_templates` and zero-PII `purge_tombstones` remain.
2. **How Removal Is Verified Forensically:**
   - Destroy per-inspection attachment keys (crypto-shredding) and unlink attachment + thumbnail files.
   - Delete inspection rows in SQLite with `PRAGMA secure_delete = ON;` (zeroes freed B-tree pages) followed immediately by `PRAGMA wal_checkpoint(TRUNCATE);` (prevents deleted customer records from lingering inside the `-wal` file!).
3. **Trigger & Watchdog Schedule (Addressing the Offline Paradox):**
   - **Immediate Purge on Synced Acceptance:** As soon as sync confirms `status = accepted` and `outbox == 0`, run the purge synchronously (removing the inspection from local storage within seconds, well under the 24h limit).
   - **Proactive Post-Submission Eviction (Recommended Defense-in-Depth):** Once an inspection is `submitted` and **100% synced (`outbox == 0`)**, evict local full-res photos and customer PII immediately (or after a short read-only grace window, e.g., ≤ 2 hours) rather than keeping cached customer PII until acceptance. That way, if a tablet goes powered-off for a weekend right after syncing and the supervisor accepts it on the web, zero customer data remains on the tablet!
   - **Startup & Background Watchdog:** On every app foreground/launch and scheduled OS background task, scan for any local inspection with `accepted_at` (or post-submit eviction deadline) exceeded and execute synchronous purge + WAL truncate before rendering inspection lists.

---

## 9. Migration & Backfill

### Mobile Client Migration (Read-Through Cache → Local-First)
1. **Versioned Non-Destructive Schema Upgrade (`PRAGMA user_version`):**
   - Inspect existing SQLite database on first launch of upgraded app.
   - If legacy DB is unencrypted, create new SQLCipher-encrypted DB, migrate non-PII templates/settings and active assigned inspection snapshots into `inspections_server_snapshot`, and **securely delete + overwrite/unlink** legacy unencrypted `.db`, `-wal`, and `-shm` files.
   - Mark migrated snapshots `is_offline_ready = false` until the new prefetch verifies complete form schema + baseline fields (preventing partial read-through cache entries from impersonating complete offline packages).
   - Run migration inside an atomic recovery wrapper with fallback to re-initializing a clean encrypted DB if a corrupted legacy read-through cache fails integrity check (`PRAGMA integrity_check`), since legacy cache held no authoritative unsynced mutations.

### Backend Migration, Backfill & Mixed-Version Compatibility
- **Backfill Tasks:**
  1. Ensure all active inspection records have non-null integer `version >= 1` and canonical field structure.
  2. Backfill `accepted_at` timestamps from historical status audit logs for any existing `accepted` inspections so newly upgraded tablets immediately purge stale cached copies.
  3. Seed baseline audit snapshots for open inspections if historical audit rows lack pre-change baselines.
- **Backward Compatibility During Transition:**
  - Keep existing REST `GET`/`PUT` integer-`version` endpoints intact for legacy non-pilot clients and web UI; enforce that **all writers** (web, legacy mobile, new offline sync) increment the exact same integer `version` column and write to the same immutable audit table inside one DB transaction.
  - Add new capabilities additively (`Idempotency-Key` middleware + idempotency table with 7–30 day TTL, `PATCH` / field-level delta sync, `/sync-delta`, resumable attachment endpoints).

---

## 10. Observability

All mobile telemetry is **strictly zero-PII** (uses opaque UUIDs, error codes, and counts only), buffered locally in `telemetry_outbox`, and uploaded asynchronously when online.

### Key Metrics & Dashboards
- **Data Durability & Sync Health:**
  - `outbox_depth` (pending mutations & attachments per device), `oldest_pending_mutation_age_seconds` (alert if > 12h / > 24h while device checked in).
  - Sync completion rate, average/p95 sync duration for 40-photo inspections, `Idempotency-Key` deduplication hit rate on server (validates intermittent retry safety).
  - Failure breakdown (`409_conflict`, `401_auth`, `422_validation`, `5xx`, `network_timeout`, `captive_portal_blocked`, `low_disk_space`).
- **Conflict & Audit Health:**
  - Rate of `auto_disjoint_merge` vs. `manual_conflict_review` vs. `post_acceptance_escalation` (tracks whether non-collaborative policy stays comfortable in practice).
  - Server audit write failures (fail-closed metric; any audit write error alerts immediately).
- **24-Hour Purge Compliance SLA:**
  - Client-reported `purge_lag_seconds = purged_at - accepted_at` (and `purged_at - device_received_accepted_at`).
  - Server-side compliance monitor: flag any inspection where `status = accepted`, a tablet previously checked out an offline copy (`device_lease`), and no purge confirmation receipt (or post-submission eviction receipt) was reported within 18h / 24h.
- **Storage & Stability:** Crash-free rate, SQLite migration failure count, WAL size anomalies, client disk-full warnings, orphaned server attachment GC volume.

---

## 11. Staged Rollout

Controlled via server-driven feature flags + MDM device/user cohort targeting:

| Stage | Target Cohort | Controls & Focus | Exit Gate to Next Stage |
|---|---|---|---|
| **Stage 0: Dark Launch & Schema Prep** | Server + Shadow Client (Flag OFF) | Deploy backend API extensions & backfill; ship client SQLite migration behind `offline_sync_enabled = false`. | Zero web/legacy mobile regressions; clean SQLite migration telemetry across fleet. |
| **Stage 1: Internal Dogfooding** | Internal QA, Engineering, Ops champs (non-production / monitored test inspections) | Enable `offline_sync_enabled`; execute real basement dead-zone walk-throughs (40 photos, signature, forced app kills, concurrent web edits). | 0 lost mutations; 100% forensic post-purge cleanliness; 100% audit completeness; safe rollback drill passed. |
| **Stage 2: Limited Field Pilot** *(Per Brief)* | 1–2 branch cohorts (paired inspectors + their supervisors) via MDM allowlist | Live production inspections under daily telemetry & support triage; collect inspector/supervisor conflict UX feedback. | Pilot validation period completes with 0 unrecovered data-loss incidents, acceptable manual conflict rate, 0 missed purge SLAs on online/synced tablets, and Product/Security/Ops sign-off. |
| **Stage 3: Canary Ring Expansion** | Progressive rings (e.g., 10% → 25% → 50% → 100% by region/MDM group) | Automated rollout halt triggers on elevated `5xx`, `409` spike, purge lag, or crashes. | Stable SLOs across each ring before expanding. |
| **Stage 4: GA & Legacy Retirement** | 100% fleet | Enforce minimum app version; retire legacy read-through-only write behavior. | 100% active tablets on offline-capable versions. |

---

## 12. Rollback

Because offline tablets may hold un-synced notes and photos in `mutation_outbox`, **never roll back by simply disabling SQLite or wiping client state**:

1. **Remote Kill-Switch Modes (Flag-Driven, No Binary Needed):**
   - **`disabled_drain_only` (Primary Safe Rollback):** Prevents starting or editing *new* offline inspections (requires live connectivity again), **while keeping the Sync Engine and attachment uploader active** until `mutation_outbox` and pending `local_attachments` reach `0`. Only after draining does the device revert to online-only UI.
   - **`prefetch_disabled` / `attachments_throttled`:** Partial switches if photo upload bandwidth or background sync overloads servers, without discarding local form saves.
2. **Binary Rollback Constraints:**
   - Because SQLite schema versions (`PRAGMA user_version`) move forward, an emergency MDM binary downgrade must either wait for `disabled_drain_only` to report empty outboxes across the cohort, or ship a forward-compatible hotfix binary rather than downgrading onto a newer DB schema.
3. **Backend Rollback:**
   - All backend API/schema changes (idempotency table, audit metadata columns, resumable attachment staging) are additive; existing integer-`version` REST routes remain intact so application rollback does not corrupt existing records.
4. **Compliance Emergency Purge Switch:**
   - Independent remote flag/MDM action to immediately purge **already-synced (`outbox == 0`)** local customer caches across devices if a purge defect is detected.

---

## 13. Testing Strategy

1. **Unit & State-Machine / Property-Based Tests:**
   - Randomized state transitions across outbox coalescing, dependency barriers (`COMMIT_SIGNATURE` / `SUBMIT` blocked on attachments), retry backoff, 40-photo cap accounting, signature hash invalidation, and 3-way field diffing.
2. **Crash-Recovery & Migration Tests:**
   - Force-kill (`SIGKILL`) mid-SQLite transaction, mid-photo compression, mid-legacy-cache migration, and mid-purge; verify ACID durability and zero lost saved notes.
   - Run automated migration tests against snapshot fixtures of legacy read-through SQLite databases (empty, populated, partially corrupt).
3. **Network Chaos & Fault-Injection Tests:**
   - Simulate TCP drop *after* server DB commit but *before* client receives `200 OK` → confirm `Idempotency-Key` returns cached success with zero `409` or duplicate photos/audit rows.
   - Simulate captive portal returning HTTP `200` HTML, oscillating 5-second signal bursts during a 40-photo upload, and token expiry (`401`) mid-drain → verify zero data loss and full resumability.
4. **Dual-Actor Concurrency & Conflict Integration Tests:**
   - Parallel test harness running Mobile Offline Actor + Web Supervisor Actor: test disjoint auto-merge, overlapping field conflict resolution, reassignment/cancellation while offline, and post-acceptance offline edit escalation, verifying server audit log completeness for every case.
5. **Forensic 24-Hour Purge & Security Tests:**
   - Seed canary PII strings and known image hashes into an inspection, complete sync & acceptance, run purge, then inspect raw `.db`, `.db-wal`, `.db-shm`, app sandbox dirs, OS photo library, HTTP caches, and logs → assert **zero** occurrences of canary strings or image bytes.
6. **Scale, Storage & Pilot UAT:**
   - Multi-inspection load test (multiple queued inspections × 40 compressed photos + signature) measuring RAM usage, UI write latency, upload completion on throttled cellular, and low-disk handling.
   - Physical dead-zone basement walk-throughs before pilot sign-off.

---

## 14. Milestone Sequence (Dependencies & Acceptance Criteria)

*(No calendar dates or staffing estimates are included per instructions; sequencing is dependency-driven.)*

```
M0 (Decisions & Contract Lock)
 ├──► M1 (Backend Sync, Audit & Backfill) ──┐
 └──► M2 (Mobile Encrypted DB & Migration) ─┼──► M3 (Offline Capture & Sync Engine)
                                            │       └──► M4 (Conflicts, 24h Purge & Observability)
                                            │               └──► M5 (Dogfood & Field Pilot)
                                            │                       └──► M6 (Staged GA & Retirement)
```

| Milestone | Depends On | Key Deliverables | Acceptance Criteria |
|---|---|---|---|
| **M0: Architecture & Decision Lock** | — | Signed-off Pre-Implementation Decisions (`D1–D7`); REST sync/idempotency/audit API spec; SQLite schema & crypto spec. | Written sign-off from Product, Security/Compliance, Legal, Backend, and Mobile leads. |
| **M1: Backend Sync Foundation, Audit & Backfill** | M0 | `Idempotency-Key` support; field-level `PATCH` & `/sync-delta`; resumable chunked attachment endpoints; conflict audit endpoint; audit schema extensions; `version` & `accepted_at` backfill. | Existing web/mobile regression suites pass 100%; fault tests prove idempotent retries on post-commit drops, exact OCC `409` behavior, chunked upload resume, and 100% audit coverage. |
| **M2: Local-First Encrypted SQLite & Cache Migration** | M0 | SQLCipher local tables (`snapshot`, `local_fields`, `outbox`, `attachments`, `conflicts`, `tombstones`); encrypted private file store; legacy read-through cache migrator; kill-switch flags (`offline_sync_enabled`, `disabled_drain_only`). | Legacy DB migration suite passes with 0 data/app errors; forced-kill tests lose 0 committed edits; UI reads/writes solely via SQLite without network calls. |
| **M3: Offline Capture UX & Store-and-Forward Engine** | M1, M2 | Prefetch & `Ready Offline` UX; offline form validation; ≤ 40 photo capture/compression/thumbnails; offline signature binding; outbox drain + chunked uploader; captive-portal guard; `401`-safe pause/resume. | Fault-injection suite passes (post-commit drops, flapping 40-photo uploads, `401` mid-sync); UI stays responsive during background sync; low-storage guards protect notes. |
| **M4: Conflict Policy, 24h Purge & Observability** | M1, M3 | 3-way diff & disjoint auto-merge; conflict resolution UI & post-acceptance escalation bundle; 24h purge engine + proactive post-submit eviction + WAL truncate; zero-PII telemetry outbox & dashboards/alerts. | Dual-actor conflict suite passes all 5 cases with full audit trail; forensic post-purge disk/WAL scan finds 0 canary PII bytes; compliance dashboard tracks purge lag and outbox age accurately. |
| **M5: Internal Dogfood & Limited Pilot** | M4 | Stage 1 physical dead-zone dogfood; Stage 2 MDM-gated pilot cohort; verified `disabled_drain_only` rollback drill. | Dogfood UAT passes; safe rollback drill drains outboxes with 0 loss; Pilot meets stability, conflict-manageability, and 24h purge exit gates with cross-functional sign-off. |
| **M6: Progressive Rollout & Legacy Retirement** | M5 | Stage 3 canary rings to 100%; minimum-version enforcement and retirement of non-idempotent legacy write paths. | All rings meet sync, crash, conflict, and compliance SLOs; legacy write paths retired. |

---

## 15. Pre-Implementation Decisions Required (With Recommendations)

| ID | Decision Needed Before Implementation | Options & Tradeoffs | Recommended Choice | Owners |
|---|---|---|---|---|
| **D1** | **How is the "within 24 hours after accepted" purge enforced if a tablet is offline when accepted?** | **(A)** Start 24h clock strictly on server `accepted_at` (unavoidable breach if tablet is powered off > 24h). **(B)** Purge immediately upon synced `accepted` status **AND** proactively evict local customer data once a submitted inspection is 100% synced (`outbox == 0`), plus clarify regulatory interpretation for un-synced multi-day offline edge cases. **(C)** Blindly delete unsynced local work after 24h (causes severe data loss). | **Option B:** Immediately evict local customer data once submitted & fully synced (eliminating weekend-offline exposure), purge immediately when `accepted` syncs, and obtain Legal sign-off on edge cases with unsynced offline data. | Legal / Compliance, Product, Security |
| **D2** | **Will the backend add field-level `PATCH` / 3-way conflict handling, and who wins overlapping field conflicts?** | **(A)** Keep whole-record `PUT` with integer `version` (any supervisor edit triggers manual whole-form conflict). **(B)** Add `Idempotency-Key` + field-level `PATCH` so disjoint edits auto-merge; overlapping unsubmitted edits go to inspector resolution UI, while post-submit/accepted conflicts preserve inspector delta in an audit exception bundle. | **Option B:** Required to avoid `409` storms without building a collaborative editor, while guaranteeing zero silent overwrites in audit history. | Backend, Product, Mobile |
| **D3** | **Are forms locked locally after capturing a signature?** | **(A)** Hard-lock form/photos after signing; edits require explicitly voiding & re-collecting the signature. **(B)** Allow silent post-signature edits (undermines legal attestation of what was signed). | **Option A:** Bind signature to `form_snapshot_sha256` and require re-signing after any post-signature modification. | Product, Legal / Compliance |
| **D4** | **What offline auth lifetime & re-auth behavior will MDM/IdP enforce?** | **(A)** Short-lived tokens blocking offline app access on expiry (breaks basement work). **(B)** Device-locked offline session continuity with MDM-managed refresh lifetime (e.g., ≥ 7 days) and non-destructive `401` pause-and-reauth. | **Option B:** Guarantee `401` never discards SQLite/outbox and align IdP token lifetimes with shift/multi-day field reality. | Security / IT (MDM), Mobile |
| **D5** | **What are exact photo compression, EXIF metadata, and multi-inspection cache limits?** | Tradeoff between image detail for defect review vs. upload reliability/disk capacity across 40 photos; plus whether GPS EXIF is required for audit or must be stripped as PII. | Standardize client downscaling (~2048 px, ~1–2 MB JPEG), keep capture timestamp/orientation, confirm GPS EXIF requirement with Legal, and cap concurrent offline prefetch based on free disk space. | Product, Field Ops, Security |
| **D6** | **What granularity is required in the regulatory audit history for offline edits?** | **(A)** Log every intermediate offline keystroke/draft save. **(B)** Coalesce rapid offline edits to the same field between barrier events (`opened`, `synced`, `signed`, `conflict_resolved`), logging final changed value + `client_updated_at` + offline provenance. | **Option B:** Meets regulatory audit attribution (`who`, `what`, `when`, `before/after`, `offline` flag) without bloating sync queues or audit storage. | Compliance, Backend, Product |
| **D7** | **What exact pilot cohort size, geography, and quantitative exit criteria gate Stage 3 expansion?** | Need concrete branch selection (paired active supervisors + inspectors) and numeric thresholds (sync success %, max conflict rate, pilot duration). | Define a dedicated 1–2 branch cohort with active web-supervisor/mobile-inspector pairing and explicit quantitative exit thresholds prior to M5 launch. | Product, Field Ops |
