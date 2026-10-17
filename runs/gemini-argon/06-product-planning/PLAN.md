# Product & Engineering Plan: Offline Inspection Sync

## 1. Executive Summary

Inspectors using company-managed tablets frequently work in building basements with zero or intermittent cellular/Wi-Fi connectivity. Currently, the mobile app uses SQLite strictly as a read-through cache and performs direct synchronous writes against REST APIs; losing connectivity after opening an inspection risks discarding inspector notes and blocks photo and signature capture.

This plan defines the product and engineering architecture to transition the tablet application to an **offline-capable, local-first read/write architecture** backed by SQLite and encrypted local file storage, synchronized with the existing integer-versioned REST backend. The design guarantees zero data loss across dead zones, supports up to 40 photos and an offline signature per inspection, resolves concurrent web edits by supervisors without building a complex real-time collaborative editor, preserves a regulator-grade audit trail, and enforces cryptographically verifiable removal of local customer data within 24 hours of inspection acceptance.

---

## 2. Explicit Assumptions

Because `BRIEF.md` is the sole product input, the following assumptions are made explicit. The three highest-risk assumptions are analyzed in detail in `RESPONSE.md`.

### Connectivity & Workflow Assumptions
1. **A1 — Pre-Basement Assignment Sync (High Risk):** Tablets have network connectivity at some point *after* an inspection is assigned and *before* the inspector enters a zero-signal basement (e.g., at dispatch/shift start or en route), allowing the app to automatically pre-fetch assigned inspection payloads, form schemas, and customer metadata.
2. **A2 — Inspection Scope & Attachment Volume:** A single inspection contains structured form fields/notes, at most 1 signature, and up to 40 photos (assumed to be standard compressed JPEG/HEIC images of 2–5 MB each, totaling up to ~200 MB per inspection). Inspectors may hold up to 10–15 assigned inspections on a tablet simultaneously (~2–3 GB peak local storage).
3. **A3 — Tablet Hardware & MDM Control:** "Company-managed tablets" run a modern mobile OS (iOS/iPadOS or Android) managed via an enterprise MDM solution with hardware-backed keystore encryption, minimum 32 GB storage (at least 5 GB free), and enforced device passcodes.

### Concurrency & Domain Assumptions
4. **A4 — Low-Contention Supervisor Edits (High Risk):** While an inspection is assigned to an inspector in the field, supervisor web edits primarily target administrative metadata, scheduling, access instructions, or high-level review comments rather than simultaneously editing the exact same field observation checkboxes/notes the inspector is filling out in a basement.
5. **A5 — Signature & Submission Lock Semantics:** Collecting a signature offline represents inspector/client sign-off on the field findings; once signed and marked "Submitted" by the inspector, field observation and signature data become immutable to the inspector (unless explicitly reopened/rejected by a supervisor).
6. **A6 — Existing REST API Capabilities:** The existing server API uses REST with a single integer `version` per inspection record (optimistic concurrency control) and can be extended with minor backward-compatible endpoints or headers (e.g., idempotency keys, field-level patch/merge payloads, and attachment upload presigned URLs or multipart endpoints) without replacing the core REST architecture.

### Regulatory & Security Assumptions
7. **A7 — Regulatory Purge Window vs. Offline Duration (High Risk):** Once an inspection reaches the `Accepted` state on the server, the tablet will either connect to the network within 24 hours to receive the `Accepted` status trigger, *or* regulations permit proactive purging of local customer PII/attachments earlier in the lifecycle (e.g., immediately upon confirmed sync of a `Submitted` inspection, or upon a local time-to-live after submission) so an offline tablet sitting in a vehicle/locker cannot violate the 24-hour post-acceptance rule.
8. **A8 — Single Inspector per Tablet Session:** Tablets are either assigned 1:1 to an inspector or use individual authenticated OS/app sessions; multiple inspectors do not concurrently edit the same inspection on the same physical tablet while offline.
9. **A9 — Client Clock Reliability for Audit Logs:** Tablet system clocks are NTP-synced whenever online and restricted from manual tampering via MDM, allowing client-recorded timestamps (`occurred_at_client`) paired with monotonic sequence numbers and server receipt timestamps (`synced_at_server`) to satisfy regulatory audit history requirements.

---

## 3. Scope Boundaries

| Category | In Scope | Out of Scope (Non-Goals) |
| :--- | :--- | :--- |
| **Core Offline Actions** | Opening pre-fetched assigned inspections; editing form fields/notes; capturing up to 40 photos; capturing 1 signature; queueing submission offline. | Creating brand-new unassigned inspections or modifying master form templates while offline. |
| **Concurrency & Sync** | Optimistic concurrency using integer record versions; deterministic three-way field merge (`base`, `local`, `server`); targeted conflict resolution UI/workflow. | Real-time collaborative editing (CRDTs, Operational Transformation, live cursors, sub-second WebSocket co-editing). |
| **Attachments** | Offline capture, local filesystem encryption, thumbnail generation, resumable/chunked background upload of up to 40 photos + 1 signature per inspection. | Offline video recording, CAD/blueprint editing, or arbitrary document attachments beyond photos and signature. |
| **Compliance & Security** | Append-only offline audit log synced to server; automatic purge of local customer data within 24h of inspection acceptance; encryption at rest. | Full redesign of enterprise IAM/SSO provider or server-side archival/retention systems beyond receiving client audit/purge events. |
| **Platform** | Company-managed tablet app (SQLite + local file store) and supporting REST API extensions. | Offline mode for the supervisor web application (web remains online-only). |

---

## 4. User Flow & UX States

### 4.1 Pre-Fetch & Readiness ("Basement-Ready" Indicator)
1. When the tablet has connectivity, the background sync service polls (and listens for push triggers) for inspections assigned to the logged-in inspector.
2. Assigned inspections are downloaded in full (form schema, existing field values, integer `version`, customer details, and any pre-existing thumbnails) into SQLite.
3. Each inspection card on the dashboard displays a clear **Offline Readiness Badge**:
   - **Ready for Offline (Green Check):** Full inspection record and schema cached locally.
   - **Syncing Down (Spinner):** Pre-fetch in progress.
   - **Online Required (Warning):** Assigned awareness exists (e.g., partial list item), but payload has not finished downloading.

### 4.2 Working Offline in a Basement
1. Inspector enters a basement and loses connectivity. A non-intrusive status bar banner indicates `Offline Mode — Changes saved to this tablet`.
2. Inspector opens a "Ready for Offline" inspection.
3. **Form & Notes Editing:** Every field edit or note keystroke (debounced at 300 ms and flushed immediately on field blur/navigation) writes transactionally to local SQLite and appends an entry to the local audit log.
4. **Photo Capture (0–40 photos):** Inspector captures photos using the native camera integration. The app enforces the 40-photo cap locally, writes the compressed image and a generated thumbnail to encrypted app storage, computes a SHA-256 hash, and links the attachment metadata in SQLite.
5. **Signature Capture:** Inspector collects the required signature on the canvas. The app records the stroke vector/PNG image, signer name/role, declaration text hash, and timestamp.
6. **Offline Completion / Queueing Submission:** Inspector taps **Complete & Submit Inspection**. Validation runs locally against the cached schema. The inspection transitions locally to `Pending Submission`, locking field observation inputs and queueing the final submission mutation behind all pending attachment uploads.

### 4.3 Intermittent Connectivity & Background Sync
1. As the inspector moves between floors or exits the building, connectivity returns intermittently.
2. The Sync Engine automatically wakes up and processes the outbox without blocking the UI:
   - **Priority 1 (Fast Lane):** Auth token refresh (if needed), textual form mutations, and audit history logs (small JSON payloads, completes in < 2 seconds).
   - **Priority 2 (Heavy Lane):** Pending photos and signature binary uploads (resumable/parallel-capped).
   - **Priority 3 (Finalization):** Once all attachments for a `Pending Submission` inspection are confirmed uploaded, the final `Submit` transition is sent to the server.
3. The inspection list shows clear sync progress (`Syncing 14/40 photos...`, `Synced`, or `Action Required: Sync Conflict`).

### 4.4 Conflict Resolution UX
1. If a supervisor edited the same inspection on the web while the inspector was offline:
   - **Non-overlapping edits** (e.g., supervisor updated `access_notes` while inspector filled out `boiler_pressure` and `electrical_panel_notes`) merge automatically on sync. An informational toast/log notes that supervisor updates were applied.
   - **Overlapping field edits** (both modified the exact same field since `base_version`): The sync engine preserves both values in the audit log, applies the deterministic conflict policy (see Section 7), and surfaces a **Conflict Review Banner** on the affected field(s) so the inspector (or supervisor during acceptance review) can confirm or toggle between `"Your Offline Entry"` and `"Supervisor Web Entry"`.

### 4.5 Post-Acceptance Data Purge
1. A supervisor reviews the synced inspection on the web and marks it `Accepted`.
2. On the next sync cycle (or immediately upon submission if proactive purge policy is active; see Section 9.4), the tablet receives the `Accepted` status and `accepted_at` timestamp.
3. The inspection remains visible in a read-only summary state (or stripped stub) only until the purge deadline, and is **hard-purged of all customer PII, notes, photos, and signatures within 24 hours of acceptance** (target: purged within 1 hour of receiving `Accepted`, strictly bounded at < 24 hours).

---

## 5. Local Data Model

### 5.1 Architectural Pattern: Three-Layer Local State
Instead of a single read-through cache table where incoming network reads overwrite local edits (or vice versa), SQLite is structured around a **Three-Layer State Model** per inspection:
1. **Base Snapshot (`base_payload`, `base_version`):** The exact state and integer version of the inspection last acknowledged by the server. Used as the common ancestor for three-way merges.
2. **Working State (`working_payload`, `local_status`):** The live state rendered by the tablet UI, reflecting `base_payload` plus all uncommitted/unsynced local edits.
3. **Transactional Outbox & Audit Log (`outbox_mutations`, `local_audit_log`):** Ordered queue of atomic operations and regulatory audit events awaiting server acknowledgement.

### 5.2 SQLite Schema Design

```sql
-- 1. Core Inspection Store (Three-Layer Model)
CREATE TABLE inspections (
    inspection_id TEXT PRIMARY KEY,
    assigned_inspector_id TEXT NOT NULL,
    server_status TEXT NOT NULL,          -- ASSIGNED, IN_PROGRESS, SUBMITTED, ACCEPTED, REJECTED
    local_sync_status TEXT NOT NULL,      -- CLEAN, DIRTY, SYNCING, CONFLICT, PENDING_PURGE, PURGED
    base_version INTEGER NOT NULL,        -- Last known server integer version
    base_payload_json TEXT NOT NULL,      -- Server snapshot at base_version (for 3-way merge)
    working_payload_json TEXT NOT NULL,   -- Current UI state (base + local dirty fields)
    dirty_fields_json TEXT NOT NULL DEFAULT '{}', -- Map of field_path -> last_modified_at_client
    schema_version TEXT NOT NULL,
    accepted_at_server TEXT,              -- ISO-8601 UTC timestamp when accepted
    purge_deadline_utc TEXT,              -- Hard deadline (accepted_at_server + 24h)
    last_synced_at_utc TEXT,
    created_at_utc TEXT NOT NULL,
    updated_at_utc TEXT NOT NULL
);

-- 2. Attachments (Photos & Signatures) Metadata
-- Binary files live on encrypted filesystem; SQLite tracks state and integrity.
CREATE TABLE attachments (
    attachment_id TEXT PRIMARY KEY,       -- Client-generated UUIDv4
    inspection_id TEXT NOT NULL REFERENCES inspections(inspection_id) ON DELETE CASCADE,
    attachment_type TEXT NOT NULL,        -- PHOTO | SIGNATURE
    sequence_num INTEGER NOT NULL,        -- 1..40 for photos, 1 for signature
    field_key TEXT,                       -- Associated form section/item if applicable
    local_file_path TEXT,                 -- Relative path in encrypted sandbox (NULL after purge)
    thumbnail_file_path TEXT,
    mime_type TEXT NOT NULL,
    byte_size INTEGER NOT NULL,
    sha256_checksum TEXT NOT NULL,
    capture_metadata_json TEXT NOT NULL,  -- Signer info / EXIF timestamp / offline flag
    upload_status TEXT NOT NULL,          -- LOCAL_ONLY, UPLOADING, UPLOADED, VERIFIED, FAILED, PURGED
    remote_blob_url TEXT,
    upload_retry_count INTEGER NOT NULL DEFAULT 0,
    last_upload_error TEXT,
    created_at_client_utc TEXT NOT NULL
);

CREATE INDEX idx_attachments_inspection_status ON attachments(inspection_id, upload_status);

-- 3. Transactional Outbox for Ordered Sync Operations
CREATE TABLE outbox_mutations (
    mutation_id TEXT PRIMARY KEY,         -- Client-generated UUIDv4 (Idempotency Key)
    inspection_id TEXT NOT NULL REFERENCES inspections(inspection_id) ON DELETE CASCADE,
    sequence_id INTEGER PRIMARY KEY AUTOINCREMENT,
    operation_type TEXT NOT NULL,         -- PATCH_FIELDS, LINK_ATTACHMENT, SUBMIT_INSPECTION, RESOLVE_CONFLICT
    base_version INTEGER NOT NULL,        -- Version this mutation was authored against
    delta_payload_json TEXT NOT NULL,     -- Changed fields { field_path: { old, new } }
    status TEXT NOT NULL,                 -- PENDING, IN_FLIGHT, BLOCKED_CONFLICT, FAILED_PERMANENT
    retry_count INTEGER NOT NULL DEFAULT 0,
    next_retry_at_utc TEXT,
    last_error_code TEXT,
    created_at_client_utc TEXT NOT NULL
);

-- 4. Regulatory Audit Log (Append-Only Local Buffer)
CREATE TABLE local_audit_log (
    audit_event_id TEXT PRIMARY KEY,      -- Client-generated UUIDv4
    inspection_id TEXT NOT NULL,
    actor_user_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    monotonic_seq INTEGER NOT NULL,       -- Strictly increasing per device
    event_type TEXT NOT NULL,             -- FIELD_EDIT, PHOTO_ADDED, PHOTO_DELETED, SIGNATURE_CAPTURED, SUBMITTED, DATA_PURGED
    field_path TEXT,
    previous_value_redacted_hash TEXT,    -- Or full value prior to purge
    new_value_json TEXT,
    is_offline_capture INTEGER NOT NULL,  -- 1 if captured without connectivity, 0 if online
    occurred_at_client_utc TEXT NOT NULL,
    sync_status TEXT NOT NULL DEFAULT 'PENDING' -- PENDING, SYNCED
);

-- 5. Compliance Purge Ledger (Retained after customer data removal, contains zero PII)
CREATE TABLE purge_compliance_log (
    purge_id TEXT PRIMARY KEY,
    inspection_id TEXT NOT NULL,
    accepted_at_server_utc TEXT,
    purged_at_client_utc TEXT NOT NULL,
    purge_reason TEXT NOT NULL,           -- ACCEPTED_TTL_EXPIRED, PROACTIVE_POST_SUBMIT, MDM_WIPE
    files_deleted_count INTEGER NOT NULL,
    sqlite_rows_scrubbed INTEGER NOT NULL,
    receipt_synced_to_server INTEGER NOT NULL DEFAULT 0
);
```

### 5.3 Local State Machine
```
[Assigned / Pre-fetching]
        │ (Payload + Schema Stored)
        ▼
     [CLEAN] ◄──────────────────────────────────────┐
        │ (User edits field / adds photo / signs)   │
        ▼                                           │ (Server acks new integer version;
     [DIRTY]                                        │  base_version = N+1, outbox empty)
        │ (Connectivity detected)                   │
        ▼                                           │
    [SYNCING] ──────────────────────────────────────┘
        │
        ├──► (HTTP 409 + Overlapping Field Edit) ──► [CONFLICT] ──► (Resolved) ──► [DIRTY]
        │
        └──► (Server status == ACCEPTED) ──────────► [PENDING_PURGE]
                                                            │ (< 24h Purge Job)
                                                            ▼
                                                        [PURGED]
```

---

## 6. Sync Protocol

### 6.1 Transport & Concurrency Primitives
- **Existing Server Primitive:** Each inspection resource `/api/v1/inspections/{id}` maintains an integer `version` (incremented by 1 on every write).
- **Idempotency:** Every client write request includes header `Idempotency-Key: <mutation_id>`. The server caches idempotency keys for 7 days so retries over flaky basement connections never duplicate mutations or double-increment integer versions.
- **Optimistic Concurrency Control:** Mutation requests send `base_version` in the body (and/or `If-Match: "<base_version>"`).

### 6.2 Sync Execution Sequence (Per Inspection)
To handle intermittent connectivity efficiently, synchronization is decoupled into four prioritized steps:

1. **Step 1: Audit Log Batch Push (`POST /api/v1/inspections/{id}/audit-events`)**
   - Append-only batch upload of `local_audit_log` entries where `sync_status = 'PENDING'`.
   - Server deduplicates by `audit_event_id` and records `synced_at_server_utc` alongside `occurred_at_client_utc`.
   - Independent of inspection record `version` so regulatory history is preserved even if a field conflict occurs.

2. **Step 2: Field Delta Sync (`PATCH /api/v1/inspections/{id}`) — Fast Lane**
   - Coalesces pending `PATCH_FIELDS` outbox entries for the inspection into a single delta request:
     ```json
     {
       "mutation_id": "d8f1...",
       "base_version": 4,
       "client_timestamp_utc": "2026-10-17T01:15:00Z",
       "changes": {
         "sections.electrical.main_breaker_amps": 200,
         "sections.electrical.notes": "Panel label legible; minor surface rust on conduit."
       }
     }
     ```
   - **Case A (`server.version == 4`):** Server applies changes, increments `version` to `5`, and returns `200 OK` with the updated canonical payload and `version: 5`. Client updates `base_version = 5`, `base_payload_json`, and deletes the processed outbox rows.
   - **Case B (`server.version > 4`):** Server returns `409 Conflict` along with the current server representation (`server_version`, `server_payload`, and `field_last_modified_by` metadata) so the client (or server-side merge handler) can immediately execute the conflict policy without an extra round-trip.

3. **Step 3: Binary Attachment Sync — Heavy Lane**
   - Runs concurrently or immediately after Step 2, capped at 2 parallel uploads to avoid saturating weak cellular uplinks.
   - Uses presigned upload URLs or resumable chunked uploads (details in Section 8).
   - Once a binary upload is verified via SHA-256, client calls `POST /api/v1/inspections/{id}/attachments` with `Idempotency-Key: <attachment_id>` to link the metadata to the inspection record.

4. **Step 4: Inspection Submission (`POST /api/v1/inspections/{id}/submit`)**
   - Executed only when:
     1. All `PATCH_FIELDS` mutations are synced (`dirty_fields` empty), AND
     2. All local attachments (`PHOTO` and `SIGNATURE`) have `upload_status = 'VERIFIED'`.
   - Sends the final `base_version` and signature verification hash. Server transitions status to `SUBMITTED` and increments `version`.

### 6.3 Intermittent Connectivity & Backoff Rules
- **Network Reachability Probe:** Do not rely solely on OS Wi-Fi/cellular link indicators (captive portals and basement repeater dead-ends trigger false positives). Verify connectivity via a lightweight `/api/v1/health` ping or direct sync attempt with a 5-second connection timeout.
- **Backoff Schedule:** Exponential backoff with full jitter (`base = 2s`, `max = 5m`) on network timeouts or `5xx` responses. Immediate trigger on OS network regain event (debounced by 3 seconds to allow radio stabilization).

---

## 7. Conflict Policy

### 7.1 Design Goal
Supervisors can edit an inspection from the web while an inspector edits the same inspection offline. Product explicitly does **not** want a full collaborative editor (no CRDTs, no real-time character-level merging). We need a deterministic, low-friction conflict strategy built on integer record versions and three-way field comparison.

### 7.2 Three-Way Field-Level Merge Engine
Because the tablet stores `base_payload_json` (version $V_{\text{base}}$) and `working_payload_json` (local edits), whenever a `409 Conflict` returns `server_payload_json` (version $V_{\text{server}} > V_{\text{base}}$), the client compares every field $f$ across `(Base, Local, Server)`:

| Condition for Field $f$ | Meaning | Resolution Action |
| :--- | :--- | :--- |
| $\text{Local}(f) == \text{Base}(f)$ and $\text{Server}(f) \neq \text{Base}(f)$ | Only Supervisor changed $f$ on web | **Auto-accept Server value.** Update `base` and `working` state. |
| $\text{Local}(f) \neq \text{Base}(f)$ and $\text{Server}(f) == \text{Base}(f)$ | Only Inspector changed $f$ offline | **Auto-keep Inspector value.** Re-base mutation onto $V_{\text{server}}$ and retry `PATCH`. |
| $\text{Local}(f) \neq \text{Base}(f)$ and $\text{Server}(f) == \text{Local}(f)$ | Both made the exact same change | **No-op merge.** Advance `base_version` to $V_{\text{server}}$. |
| $\text{Local}(f) \neq \text{Base}(f)$ and $\text{Server}(f) \neq \text{Base}(f)$ and $\text{Local}(f) \neq \text{Server}(f)$ | **True Conflict:** Both edited the same field differently | Apply **Domain Partition & Conflict Resolution Rule** below. |

### 7.3 Domain Partition & True Conflict Resolution Rules
1. **Attachments (Photos):** Photos are keyed by client UUID (`attachment_id`) and merged as a **Set Union**. If a supervisor adds a reference photo on the web and an inspector captures 20 photos offline, both sets merge cleanly unless total count exceeds 40 (if combined count > 40, server allows overflow buffer up to 45 for supervisor additions or flags excess for review rather than dropping inspector photos).
2. **Free-Text Notes Fields (`notes`, `comments`):** If both supervisor and inspector modified the same free-text note field while disconnected, **never overwrite either note**. Auto-merge by appending with explicit attribution headers:
   ```text
   [Inspector Offline Entry — 2026-10-17 10:14 Local]:
   Main shutoff valve corroded; requires replacement.
   ---
   [Supervisor Web Update — 2026-10-17 10:30 UTC]:
   Customer requested check on secondary shutoff valve in utility closet.
   ```
   Both raw edits are also recorded individually in the regulatory audit history.
3. **Structured Discrete Fields (Checkboxes, Dropdowns, Measurements, Header Metadata):**
   - **Field Observations (Checklist ratings, measurements):** The on-site inspector has physical ground truth, while the supervisor must approve the final report. If a discrete field collides, the inspection transitions to `CONFLICT_REVIEW` on the tablet (or surfaces a `Resolve 1 Conflict` modal showing **Your Value** vs. **Supervisor's Value** with timestamps). If the inspector is no longer actively in the app (background sync), the client uploads both the inspector's value as the candidate value and flags `has_unresolved_conflict = true` on the field so the supervisor sees both values side-by-side before clicking `Accept`.
4. **Lifecycle State Collisions:**
   - **Supervisor Reassigned or Canceled Inspection while Inspector was Offline:** Server rejects normal `PATCH` with `409 Conflict (status = REASSIGNED | CANCELED)`. The tablet still uploads the `local_audit_log` and uploads any captured photos/notes into an unattached **Orphan Recovery / Salvage Bundle** associated with the inspection ID so the inspector's basement work is never lost and can be attached by the supervisor, then marks the local assignment read-only and schedules local data purge.
   - **Supervisor Edited After Inspector Captured Offline Signature:** If a supervisor modifies any substantive inspection field *after* `base_version`, and the inspector has already captured a customer/inspector signature offline against `base_version`, the signature cannot legally bind modified contents silently. During sync, the field changes and signature upload are preserved in the audit log, but the submission is flagged as `SUBMITTED_WITH_CONFLICT_DIFF` requiring either supervisor sign-off on the delta or re-signature if customer-facing terms changed.

---

## 8. Attachment Handling (Photos & Signatures)

### 8.1 Capacity & Storage Architecture
- **Volume:** Up to 40 photos + 1 signature per inspection.
- **Why Not SQLite BLOBs:** Storing 40 × 4 MB = 160 MB of binary data directly inside SQLite rows causes database file bloat, long write transactions, high memory pressure during cursors, and slow `VACUUM` operations during the 24-hour purge.
- **Storage Split:**
  - **Filesystem:** Photos and signatures are written to a dedicated app-private directory (`/inspections/{inspection_id}/attachments/{attachment_id}.enc`) protected by OS Data Protection / File-Based Encryption plus an app-level AES-256-GCM key per inspection (enabling instant cryptographic erasure alongside file deletion).
  - **SQLite:** Stores metadata, file path, byte size, `sha256_checksum`, `sequence_num` (enforcing `COUNT(PHOTO) <= 40`), and `upload_status`.

### 8.2 Capture & Compression Pipeline
1. **Camera Capture:** Photo is captured to a temporary buffer (never saved to the tablet's public OS camera roll/photo library to avoid leaking customer data outside the 24-hour purge boundary!).
2. **Standardization:** Image is downscaled if exceeding 2560px on the longest edge and compressed (JPEG quality 80%, typical size 1.2–2.5 MB) while preserving required inspection EXIF metadata (capture timestamp, orientation). A 256×256px thumbnail (~25 KB) is generated for fast UI rendering.
3. **Atomic Persist:** File is written and `fsync`ed to the encrypted inspection directory, SHA-256 is computed, and the `attachments` + `local_audit_log` rows are inserted in a single SQLite transaction.

### 8.3 Resumable Upload Protocol
1. **Request Upload Slot:** Client sends `POST /api/v1/inspections/{id}/attachments/upload-intent` with `attachment_id`, `byte_size`, `sha256_checksum`, and `mime_type`.
2. **Deduplication Check:** If the server already received and verified the binary for `attachment_id` during a prior interrupted sync, it immediately returns `200 OK (status: ALREADY_UPLOADED)`.
3. **Chunked / Presigned Transfer:** Otherwise, server returns a presigned S3/Object-Store URL (supporting HTTP `Range` / multipart resumable upload in 2 MB chunks) or a tus-compatible resumable upload endpoint.
4. **Finalize & Link:** After bytes transfer, client calls `POST /api/v1/inspections/{id}/attachments/{attachment_id}/complete`. Server verifies the SHA-256 checksum, attaches the record to the inspection, writes a server audit log entry, and returns `VERIFIED`.

### 8.4 Signature Specifics
- Captured as both an immutable PNG rendering (for PDF report generation) and stroke coordinate JSON (bounding box, stroke timing, signer printed name, signer role, `occurred_at_client_utc`).
- Cryptographically bound to the inspection state at signing time by computing `signature_digest = SHA256(inspection_id || working_payload_json || signature_png_sha256 || occurred_at_client_utc)` and storing this digest in `capture_metadata_json` and `local_audit_log`.

---

## 9. Security & Regulatory Compliance

### 9.1 Encryption at Rest
- **Database:** SQLite database encrypted using **SQLCipher (AES-256-CBC)** with the database encryption key stored in the hardware-backed OS keystore (iOS Keychain `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` / Android Keystore).
- **Attachment Files:** Stored only inside the app sandbox with public gallery export disabled (`UIImageWriteToSavedPhotosAlbum` / Android `MediaStore` strictly prohibited). Each inspection's attachment folder is encrypted with a per-inspection Data Encryption Key (DEK) stored in SQLite/Keystore.
- **OS Backups:** Mark the SQLite database and attachment directories as excluded from cloud/iTunes/ADB backups (`NSURLIsExcludedFromBackupKey = true` / `android:allowBackup="false"`) so customer data cannot escape the 24-hour purge via tablet backups.

### 9.2 Offline Authentication & Session Lifecycle
- **Problem:** An inspector opens the app online at 08:00, enters a basement for 6 hours, and a short-lived 1-hour JWT access token expires while offline. Locking the inspector out of the UI while offline would cause data loss or halt work.
- **Solution:**
  1. **Decouple Local UI Access from Network Token Expiry:** While an active offline session exists on a company-managed tablet, the inspector can continue viewing and editing locally cached assigned inspections using a local session lock (biometric/PIN re-unlock after 15 minutes of screen inactivity, verified against MDM/local credentials) even if the OAuth/JWT access token has expired.
  2. **Refresh Token Strategy:** Store a long-lived Refresh Token (e.g., 14-day sliding window) in the hardware keystore. When connectivity returns, the background Sync Engine silently exchanges the Refresh Token for a new Access Token before draining the outbox.
  3. **Revocation / Termination:** If the Refresh Token is rejected with `401 Invalid Grant` (e.g., inspector was terminated), the app locks the UI immediately, attempts an emergency background upload of any unsynced outbox data using a restricted device-level certificate/token so company inspection work is not lost, and then wipes local data.

### 9.3 Regulatory Audit History
- Regulations require a complete, tamper-evident audit history.
- Every offline mutation creates a `local_audit_log` row containing:
  - `audit_event_id` (UUIDv4)
  - `actor_user_id` & `device_id` (MDM hardware serial/UDID)
  - `monotonic_seq` (prevents reordering even if clock shifts)
  - `occurred_at_client_utc` (when the inspector performed the action)
  - `is_offline_capture = true`
  - `event_type`, `field_path`, old value, new value, and `prev_event_hash` (hash chain per inspection on client to detect local SQLite tampering).
- Upon sync, the server persists both `occurred_at_client_utc` and `synced_at_server_utc` and merges offline audit events into the master inspection audit history.

### 9.4 24-Hour Post-Acceptance Local Data Removal
- **Requirement:** Remove all local customer data within 24 hours after an inspection is accepted.
- **What Constitutes Customer Data:** Customer name, phone, email, site address, access notes, all inspection form responses/notes, all photos/thumbnails, signature files, and cached audit log values.
- **Dual-Trigger Purge Architecture (Solving the Offline Tablet Edge Case):**
  - *Standard Trigger (Accepted Notification):* When the server transitions an inspection to `ACCEPTED` at $T_{\text{accept}}$, it pushes a silent push notification and returns `server_status = 'ACCEPTED'` + `accepted_at_server` on sync. The tablet sets `purge_deadline_utc = min(now + 1h, accepted_at_server + 23h)`.
  - *Proactive Offline Safeguard (Preventing >24h Violations on Offline Tablets):* What if an inspector submits an inspection at 14:00, it syncs completely at 14:05, the supervisor accepts it on the web at 14:30, and the inspector leaves the tablet powered off or in a dead-zone basement for 48 hours? If the tablet relies *only* on receiving the `ACCEPTED` state from the server, customer data would remain on disk past 24 hours.
  - **Safeguard Policy:** As soon as an inspection is `SUBMITTED` **and** 100% of its outbox mutations and attachments are `VERIFIED` on the server (`local_sync_status == 'CLEAN'` and `server_status == 'SUBMITTED'`), the tablet immediately strips or encrypts-and-purges local binary attachments and schedules a **Proactive Local Purge within 12 hours of confirmed submission sync** (or immediately converts the local record to a non-PII metadata stub). If the supervisor rejects the inspection later, the tablet simply re-fetches it when back online.
- **Secure Deletion Execution:**
  1. Destroy the per-inspection AES-256 file encryption key from Keystore (instant cryptographic erasure).
  2. Unlink/delete all photo, thumbnail, and signature files from the filesystem.
  3. Execute SQLite purge with `PRAGMA secure_delete = ON` (overwrites deleted database pages with zeroes) and `PRAGMA wal_checkpoint(TRUNCATE)` to ensure no customer PII lingers in the `-wal` write-ahead log file.
  4. Record a non-PII compliance entry in `purge_compliance_log` and sync a `LOCAL_DATA_PURGED` receipt to the server for regulatory auditing.

---

## 10. Migration & Backfill Strategy

The app currently has a SQLite database used as a read-through cache. Upgrading existing field tablets must not discard in-progress work or require manual app reinstallation.

1. **Pre-Upgrade Drain Guidance (Operational):** Prior to pushing the app update via MDM, notify inspectors to keep tablets online for 5 minutes at shift end so legacy versions sync any open sessions.
2. **In-Place SQLite Schema Migration (`v_legacy` -> `v_offline_1`):**
   - Run inside an atomic SQLite transaction on first app launch after update.
   - Read existing cached inspections from the legacy cache tables.
   - For each cached inspection:
     - Populate `inspections` with `base_version = legacy.version`, `base_payload_json = legacy.json`, `working_payload_json = legacy.json`, and `local_sync_status = 'CLEAN'`.
     - If the legacy cache contains any un-Removed historical `ACCEPTED` inspections (since legacy read-through cache may not have enforced the new strict local purge table), immediately mark them `PENDING_PURGE` and execute the secure purge job before unlocking the UI!
3. **Shadow / Dual-Read Verification:**
   - During Milestone 1/2 internal rollout, the new `InspectionRepository` reads from and writes to the new `inspections` table while logging any structural discrepancies against legacy cache models before deprecating and dropping the legacy tables (`DROP TABLE legacy_cache` + `VACUUM`).

---

## 11. Observability & Telemetry

Because failures happen in basements without connectivity, real-time crash/error reporting alone is blind during the offline window.

### 11.1 Store-and-Forward Client Telemetry
- Maintain a lightweight circular SQLite table `telemetry_events` (capped at 5,000 rows, zero customer PII) that logs offline lifecycle breadcrumbs and sync transitions, uploaded in batches when online.

### 11.2 Key Metrics, SLIs & Alerts

| Metric / SLI | Target / SLO | Alert Threshold |
| :--- | :--- | :--- |
| **Outbox High-Water Age** (`now - oldest_pending_mutation.created_at`) | < 4 hours for active online tablets | Alert P2 if any tablet reports unsynced mutations > 12 hours after coming online. |
| **Sync Success Rate (Per Attempt)** | > 98% on healthy connections | Alert P1 if `5xx` or unhandled client sync exceptions exceed 2% over 15 minutes. |
| **Conflict Frequency Rate** (`409` responses / total `PATCH` syncs) | < 3% of inspections; < 0.5% true same-field conflicts | Alert Product/Eng if true conflicts > 2% (indicates Assumption A4 is violated). |
| **Attachment Upload Completion Time** (40 photos on 10 Mbps uplink) | p95 < 90 seconds | Alert P2 if attachment permanent failure rate > 0.1%. |
| **24-Hour Purge SLA Compliance** (`purged_at - accepted_at_server`) | 100% < 24 hours (Target p99 < 2 hours) | **Alert P0 (Regulatory Compliance)** if any inspection reports `purged_at - accepted_at > 20 hours` or if server lacks a `LOCAL_DATA_PURGED` receipt 22 hours after `Accepted` (triggers MDM push wakeup / remote wipe command). |
| **Local Storage Free Space** | > 2 GB available on tablet | Warn inspector + block new pre-fetches if free space < 500 MB. |

---

## 12. Staged Rollout Plan

Product requires a pilot before broad rollout. Rollout is controlled via server-driven feature flags cached locally on the tablet (`offline_mode_enabled`, `proactive_prefetch_enabled`, `three_way_merge_enabled`).

1. **Stage 0: Internal Dogfood & Basement Simulation (Engineering + QA)**
   - 5–10 managed test tablets running against staging and production shadow accounts in physical basement/Faraday-bag conditions.
2. **Stage 1: Dark Launch / Shadow Outbox (10% of Fleet)**
   - App writes to the new Three-Layer SQLite model and outbox locally, and executes the 24-hour purge job, while requiring online connectivity for final submission. Validates SQLite migration stability, disk usage, and purge compliance metrics in production with zero conflict risk.
3. **Stage 2: Controlled Field Pilot (1–2 Inspection Teams / ~15–25 Inspectors)**
   - Enable full offline mode (`offline_mode_enabled = true`) for a single regional branch known for frequent basement inspections, paired with their supervising web users.
   - **Pilot Exit / Gate Criteria to Broad Rollout:**
     - Zero instances of lost inspector notes or orphaned photos across ≥ 100 completed offline inspections.
     - 100% compliance with the < 24-hour post-acceptance local data purge SLA verified via server purge receipts.
     - True same-field conflict rate < 2%, with 100% of conflicts resolved without engineering intervention.
     - P95 local UI save latency < 50 ms.
4. **Stage 3: Broad Rollout (25% -> 50% -> 100% of Fleet)**
   - Progressive cohort expansion via MDM/feature flag configuration, monitoring server attachment ingestion bandwidth and conflict rates at each tier.

---

## 13. Rollback Strategy

Rolling back an offline-first system requires special care: **simply disabling the feature flag or downgrading the app while a tablet has unsynced mutations in `outbox_mutations` would orphan inspector data on disk.**

### 13.1 Three-Mode Feature Flag (`ENABLED` | `DRAIN_ONLY` | `LEGACY_ONLINE`)
If a critical bug is discovered during the Pilot or Rollout, we do **not** immediately cut over to legacy online-only reads/writes. Instead, we flip the remote configuration flag to **`DRAIN_ONLY`**:
1. **`DRAIN_ONLY` Behavior:**
   - For any inspection where `local_sync_status == 'DIRTY'` or `outbox_mutations` is non-empty, the app **continues running the Sync Engine** until the outbox and attachments are 100% flushed to the server (`CLEAN`).
   - For all `CLEAN` inspections, the app disables offline pre-fetching and requires active connectivity to open/edit, falling back to synchronous online behavior while still enforcing the 24-hour local purge job.
2. **Emergency Outbox Diagnostic Export:**
   - If a bug in the Sync Engine itself prevents a specific tablet from draining a poison-pill mutation in `outbox_mutations`, the app provides a "Send Diagnostic Sync Bundle" action (and automatic error-path upload) that ships the raw encrypted `outbox_mutations` + `local_audit_log` + `attachments` bundle to a dedicated server salvage endpoint (`/api/v1/recovery/bundles`) so zero inspector field work is ever lost.
3. **Server API Backward Compatibility:**
   - All server REST extensions (`Idempotency-Key`, `base_version` conflict body, attachment upload endpoints) are strictly additive. Older tablet app versions continue operating against `/api/v1/inspections/{id}` with integer versions without disruption.

---

## 14. Testing Strategy

| Test Layer | Scenarios Covered | Verification Method |
| :--- | :--- | :--- |
| **1. Unit & State Machine Tests** | Three-way merge matrix (all permutations of `Base`, `Local`, `Server` across discrete fields, free-text notes, and photo sets); outbox coalescing; state transitions; SHA-256 signature digest generation. | Automated deterministic test suite (100% branch coverage on merge engine and state transitions). |
| **2. SQLite Migration & Storage Integrity** | Upgrade from populated legacy read-through cache; crash/power-loss simulation mid-transaction; `PRAGMA secure_delete = ON` verification (scanning raw `.db` and `.db-wal` binary files for residual customer PII strings after purge). | Automated integration tests inspecting raw SQLite file bytes post-purge to guarantee zero residual PII substrings. |
| **3. Network Chaos & Basement Flap Harness** | Simulated connectivity transitions: 100% packet loss, 80% packet loss with 2000 ms latency, TCP connection drop mid-photo upload (after 50% bytes sent), DNS failure, captive portal HTML response on API calls. | Automated Toxiproxy / Network Link Conditioner suite verifying idempotency (no duplicate records or double version bumps) and resumable photo recovery. |
| **4. Concurrent Supervisor Conflict Simulation** | Inspector edits offline at `version=3`; supervisor edits same/different fields on web (`version=4, 5`), reassigns inspection, or accepts/rejects inspection; inspector reconnects. | End-to-end API + client sync harness verifying deterministic resolution and complete audit history preservation. |
| **5. High-Load 40-Photo & Battery Stress Test** | Capture 40 high-resolution photos + signature + 200 form fields on a reference company tablet while offline; force-kill app mid-capture; resume and sync over throttled 3G/LTE profile. | Automated UI device test verifying memory ceiling (< 250 MB RAM), zero UI frame drops, enforcement of photo #41 rejection, and full upload completion. |
| **6. 24-Hour Purge & Auth Expiry Compliance** | Advance device/server clock past JWT access token expiry (verify offline editing continues) and past `accepted_at + 24h` (verify local files + SQLite rows are wiped and compliance receipt is logged). | Time-travel integration test verifying both online `Accepted` purge and proactive offline post-submit purge. |

---

## 15. Milestone Sequence, Dependencies & Acceptance Criteria

No calendar dates or staffing estimates are assumed. Milestones are ordered by technical dependency.

```
[M0: Pre-Impl Decisions & Contracts]
         │
         ├──────────────────────────────┐
         ▼                              ▼
[M1: Local Storage, Migration]   [M2: Server REST Extensions,
 & Security Foundation]           Merge & Audit APIs]
         │                              │
         ▼                              │
[M3: Offline Form UX, 40-Photo          │
 Capture & Signature Engine]            │
         │                              │
         └──────────────┬───────────────┘
                        ▼
         [M4: Sync Engine, 3-Way Merge
          & Conflict Resolution UX]
                        │
                        ▼
         [M5: Regulatory 24h Purge,
          Observability & Chaos Hardening]
                        │
                        ▼
         [M6: Staged Pilot & Rollout Readiness]
```

### Milestone 0: Pre-Implementation Decisions & API Contract Lock
- **Dependencies:** None.
- **Scope:** Resolve the pre-implementation decisions in Section 16; finalize OpenAPI specification for idempotent `PATCH`, `409` conflict payload format, attachment resumable upload endpoints, audit batch ingestion, and purge receipt logging.
- **Acceptance Criteria:**
  - OpenAPI spec and SQLite DDL signed off by Mobile, Backend, and Security/Compliance stakeholders.
  - Field-level conflict behavior approved by Product for every field category in the inspection schema.

### Milestone 1: Local-First SQLite Foundation, Encryption & Cache Migration
- **Dependencies:** M0.
- **Scope:** Implement SQLCipher encryption, the Three-Layer `inspections` schema (`base`, `working`, `outbox`, `local_audit_log`, `attachments`), migration from the existing read-through cache, and offline session lock decoupling from short-lived JWT expiry.
- **Acceptance Criteria:**
  - Upgrading an app instance with populated legacy SQLite cache preserves 100% of cached records and migrates cleanly in < 500 ms.
  - All local UI reads and form edits execute against SQLite in < 20 ms with airplane mode enabled and expired JWT access token.
  - App sandbox files and SQLite DB are encrypted at rest and excluded from OS backups.

### Milestone 2: Server REST Extensions & Audit/Attachment Endpoints
- **Dependencies:** M0.
- **Scope:** Add `Idempotency-Key` middleware, enhanced `409 Conflict` response body (returning current server state + per-field modification metadata), `/audit-events` batch ingestion (storing both client and server timestamps), resumable/presigned attachment upload endpoints, and `/purge-receipts` endpoint.
- **Acceptance Criteria:**
  - Replaying identical `PATCH` or `POST /submit` requests with the same `Idempotency-Key` returns the original response without incrementing `version` a second time.
  - Out-of-order and offline audit events ingest cleanly and render accurately in the regulatory audit history view.
  - Legacy client versions pass 100% of existing regression tests against the updated REST API.

### Milestone 3: Offline Form Editing, 40-Photo Pipeline & Signature Capture
- **Dependencies:** M1.
- **Scope:** Build background pre-fetch for assigned inspections ("Ready for Offline" badge), debounced auto-save for form fields/notes, private camera capture pipeline (compression, thumbnailing, SHA-256 hashing, 40-photo hard limit), and offline signature capture with cryptographic payload digest.
- **Acceptance Criteria:**
  - Force-closing the app within 1 second of typing a note, taking the 40th photo, or signing in airplane mode loses zero data upon relaunch.
  - Attempting to add a 41st photo displays a clear validation message.
  - Zero captured photos appear in the tablet's public OS photo library.

### Milestone 4: Sync Engine, Intermittent Network Recovery & Conflict Resolution
- **Dependencies:** M2, M3.
- **Scope:** Implement prioritized outbox processor (Fast Lane JSON sync before Heavy Lane binary photo uploads), resumable photo upload worker, three-way merge engine on `409 Conflict`, conflict resolution UI banner/modal, and orphan salvage bundle upload for canceled/reassigned inspections.
- **Acceptance Criteria:**
  - Under simulated intermittent connectivity (30 seconds online / 2 minutes offline cycles), an inspection with form edits, 40 photos, and a signature syncs to `SUBMITTED` without manual retry or duplicate uploads.
  - Non-overlapping concurrent edits by a web supervisor and an offline inspector merge automatically and advance `base_version`.
  - Overlapping edits on the same field preserve both entries in the regulatory audit trail and surface the deterministic resolution UI.

### Milestone 5: 24-Hour Regulatory Purge, Telemetry & Rollback Hardening
- **Dependencies:** M4.
- **Scope:** Implement the dual-trigger local customer data purge job (`Accepted` notification trigger + proactive post-submit offline TTL safeguard), raw SQLite `secure_delete` verification, store-and-forward telemetry, `DRAIN_ONLY` rollback mode, and server alert monitors for missing purge receipts.
- **Acceptance Criteria:**
  - Raw binary inspection of `.db`, `.db-wal`, and filesystem directories after purge execution confirms zero residual customer PII strings or image bytes.
  - Server records a verified `LOCAL_DATA_PURGED` receipt within 24 hours of `Accepted` across both online and simulated post-submit offline scenarios.
  - Switching feature flag to `DRAIN_ONLY` drains dirty outboxes before reverting to online-only behavior.

### Milestone 6: Pilot Execution & Broad Rollout Readiness
- **Dependencies:** M5.
- **Scope:** Execute Stage 1 (Shadow Outbox) and Stage 2 (Controlled Field Pilot), monitor SLIs, validate support runbooks for stuck outboxes/conflicts, and review pilot exit criteria.
- **Acceptance Criteria:**
  - All Stage 2 Pilot Exit Criteria (Section 12) met in production field usage.

---

## 16. Pre-Implementation Decisions & Recommendations

The following decisions must be finalized with Product, Compliance, and Engineering before starting Milestone 1. A concrete recommendation is provided for each.

| # | Decision Required | Options Considered | Recommendation & Rationale |
| :--- | :--- | :--- | :--- |
| **D1** | **Overlapping Same-Field Conflict Winner Policy:** When an inspector offline and a supervisor on the web modify the exact same discrete field (e.g., a checklist status) since `base_version`, what happens during background sync? | **Option A:** Last-write-wins by timestamp.<br>**Option B:** Supervisor always wins.<br>**Option C:** Free-text notes auto-append with attribution; discrete checklist fields default to the **Inspector's physical observation** as the working value while flagging the field as `CONFLICT_PENDING_REVIEW` for both inspector and supervisor, and logging both in the audit history. | **Recommend Option C.** Timestamps across offline devices and web servers are prone to skew and silently discard ground-truth field observations (violating regulatory intent). Preserving both in the audit log, auto-appending notes, and flagging discrete field collisions for explicit confirmation gives safety without building a complex collaborative editor. |
| **D2** | **Offline Compliance Strategy for the 24-Hour Post-Acceptance Purge:** How do we guarantee local customer data is removed within 24 hours of acceptance if a tablet goes offline *after* syncing its submission and remains offline when the supervisor clicks "Accept"? | **Option A:** Purge only after the tablet receives the `Accepted` webhook/poll from the server (accepting risk if tablet stays offline > 24h).<br>**Option B:** Purge customer PII and photo binaries proactively within **12 hours of confirmed `Submitted` sync** (once outbox is 100% verified on server), or immediately upon receiving `Accepted`, whichever comes first. | **Recommend Option B.** Once an inspector has signed, submitted, and 100% synced the inspection to the server, the tablet no longer needs offline write access to that customer's PII. Proactively purging synced `Submitted` inspections on a 12-hour local timer guarantees strict compliance with the 24-hour post-acceptance rule even if the tablet is powered off in a locker when the supervisor clicks "Accept". |
| **D3** | **Supervisor Editing While Inspection is Actively Assigned / Signed:** Should supervisors on the web be allowed to edit field checklist items while an inspection is `In Progress` on a tablet, or after an inspector has collected a signature? | **Option A:** Unrestricted web editing at all times.<br>**Option B:** Soft-lock / warning banner on the web UI (`"Assigned to Inspector X — edits to checklist items may cause offline sync conflicts"`) and require supervisor to explicitly `Reject / Reopen` if modifying findings after signature submission. | **Recommend Option B.** Soft-partitioning the workflow in the web UI prevents 90%+ of conflicts at the source without restricting supervisors from updating administrative/access notes or reassigning inspections when needed. |
| **D4** | **Pre-Fetch Scope & Cellular Data Policy:** When should the tablet download assigned inspections and schemas for offline readiness? | **Option A:** On-demand only when the inspector taps "Download for Offline".<br>**Option B:** Automatic background pre-fetch of all assigned inspections (JSON + schema + lightweight thumbnails) over both Wi-Fi and cellular as soon as assigned, plus a visible "Ready for Offline" badge. | **Recommend Option B.** Inspectors forget to tap manual download buttons before walking into basements. JSON payloads and schemas are tiny (< 100 KB per inspection) and should auto-prefetch immediately on any connection. |
| **D5** | **Server Merge Responsibility (Client-Driven vs. Server-Driven Merge):** Should the three-way field merge (`base`, `local`, `server`) execute on the server during `PATCH` or on the client upon receiving `409`? | **Option A:** Client-only merge after `409`.<br>**Option B:** Client sends `base_version` + field delta (`changes` map); **Server** attempts non-overlapping field merge against the historical diff from `base_version` to `current_version` first, returning `200 OK (version: N+1)` if no fields overlap, and returning `409 Conflict` only when the exact same field was modified! | **Recommend Option B.** Having the server auto-accept `PATCH` deltas when modified field keys do not intersect eliminates extra network round-trips over flaky basement connections and keeps integer `version` increments atomic on the server. |
