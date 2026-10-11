# Engineering & Product Plan: Offline Inspection Sync Engine

## 1. Executive Summary & Product Alignment

This document outlines the architectural, product, and operational plan for introducing offline capabilities to the tablet-based building inspection application. Based strictly on the requirements in `BRIEF.md`, field building inspectors frequently operate in zero-connectivity basement environments using company-managed tablets. Currently, intermittent or severed network connectivity causes data loss.

This plan transforms the tablet application from an online-dependent app with a read-through SQLite cache into an **offline-first, resilient inspection engine**. It establishes reliable local data capture for complex forms, up to 40 photos, and legally binding customer signatures, coupled with an asynchronous, conflict-resilient synchronization protocol that integrates with existing integer-versioned REST APIs. It enforces regulatory compliance by guaranteeing cryptographically verifiable local customer data destruction within 24 hours of inspection acceptance.

---

## 2. Explicit Assumptions

To ensure complete clarity, the following assumptions are established from `BRIEF.md` and industry best practices:

1. **Hardware & OS Fleet**: Tablets are company-managed devices (iOS or Android) enrolled in an Enterprise Mobility Management / Mobile Device Management (MDM) solution, allowing security policy enforcement (passcodes, full-disk encryption, OS updates).
2. **Assignment Model**: Inspections are dispatched and pre-assigned to a single primary inspector at a time. Multi-inspector simultaneous offline editing of the exact same inspection on multiple tablets is not supported.
3. **Web Supervisor Workflow**: Supervisors review and occasionally edit inspections via a web portal. Because Product has ruled out a real-time collaborative editor (CRDTs/OT), concurrent edits are handled via coarse-grained optimistic locking and field-aware merging.
4. **Basement Connectivity Profile**: Field inspectors experience binary or severely degraded connectivity: completely severed signal while underground, followed by brief, intermittent connectivity windows (e.g., ground floor stairwells, street level, vehicle transit, depot Wi-Fi).
5. **Inspection Lifecycle States**: 
   `Assigned` $\rightarrow$ `Downloaded / Local Ready` $\rightarrow$ `In Progress (Field)` $\rightarrow$ `Completed & Signed` $\rightarrow$ `Synced` $\rightarrow$ `Accepted (Supervisor)` $\rightarrow$ `Purged (Local Data Scrubbed)`.
6. **Regulatory Purge Mandate**: "Accepted" is an explicit terminal state granted on the server. The 24-hour countdown begins the moment the server marks the inspection as `Accepted`. All local personally identifiable information (PII), customer signatures, and photos must be purged from tablet storage within 24 hours of this event, even if the tablet is offline when the timer expires.
7. **Server Architecture**: The backend uses RESTful endpoints with monotonic integer record versions (`version: 1, 2, 3...`) for concurrency control.
8. **Attachment Volume**: An inspection contains up to 40 photos (uncooked device photos: 5–15 MB each; total raw 200–600 MB) plus 1 vector/raster customer signature (<100 KB). Bandwidth constraints require aggressive on-device compression prior to transmission.

---

## 3. Scope Boundaries

### In-Scope
* **Offline-First Data Capture**: Opening assigned inspections, navigating complex multi-section forms, validating entries, capturing form responses, attaching up to 40 photos, and capturing customer signatures without any network dependency.
* **Local Relational Persistence**: Upgrading the local SQLite database from a read-through cache to a fully normalized, local source-of-truth transactional database with Write-Ahead Logging (WAL).
* **Two-Tier Sync Protocol**: Decoupling lightweight JSON metadata/form sync from heavy binary attachment sync; background mutation queue with exponential backoff and jitter.
* **Optimistic Version-Aware Conflict Management**: Integration with existing integer record versioning; field-level three-way merge on the server for non-overlapping changes; supervisor review flagging for overlapping edits.
* **On-Device Media Pipeline**: Background image thumbnailing, resizing, EXIF sanitization, compression, and resumable multipart/chunked upload.
* **Regulatory Compliance & Purge Engine**: Tamper-resistant audit logging; automated local customer data shredding within 24 hours of server acceptance with verifiable server receipt.
* **Security at Rest**: Application-layer encryption (SQLCipher) and encrypted sandboxed filesystem storage.
* **Phased Pilot & Rollback**: Feature-flagged deployment starting with a pilot cohort, supported by non-destructive rollback capabilities.

### Out-of-Scope
* **Real-Time Collaborative Editing**: Operational Transformation (OT) or Conflict-Free Replicated Data Types (CRDTs) for simultaneous, live collaborative typing between supervisors and inspectors (explicitly excluded by Product).
* **Ad-Hoc Offline Inspection Creation**: Creating brand new, unassigned building inspection records while offline without prior server assignment.
* **Peer-to-Peer Tablet Sync**: Device-to-device Bluetooth/Wi-Fi Direct syncing between inspectors.
* **Server Architecture Replacement**: Migrating backend databases from REST/integer versions to GraphQL, CouchDB, or Firebase.

---

## 4. User Flow & Journey

```
[ Pre-Shift / Depot (Online) ]
  1. Inspector logs in; App authenticates and auto-prefetches assigned inspections.
  2. SQLite stores form templates, historical data, and customer info.
  3. Badge displays: "Downloaded & Ready for Offline".

[ On-Site Field Work (Offline / Basement) ]
  4. Inspector enters basement (Signal Lost -> UI shows "Offline Mode").
  5. Inspector opens inspection instantly (0ms latency, zero blocking spinners).
  6. Inspector fills fields: Auto-saved to SQLite on field blur / step change.
  7. Inspector captures photos (up to 40): Compressed in background, thumbnailed.
  8. Inspector captures customer signature: Vector & bitmap saved with timestamp.
  9. Inspector marks inspection "Completed" (Local validation enforced).

[ Transit / Intermittent Signal Re-acquired ]
  10. OS/Network listener detects connection.
  11. Sync Worker Phase 1: Uploads JSON form mutations & audit log (Lightweight, ~10-50 KB).
  12. Sync Worker Phase 2: Uploads photos sequentially/chunked with resume support.
  13. UI updates badge: "Syncing (12/40 photos)" -> "Fully Synced".

[ Post-Inspection / Supervisor Acceptance (Web & Backend) ]
  14. Supervisor reviews inspection on Web Portal and clicks "Accept Inspection".
  15. Server marks inspection `Accepted` with `accepted_at` timestamp.

[ Regulatory Purge Window (<24 Hours) ]
  16. Next tablet sync receives `Accepted` status and `purge_deadline = accepted_at + 24h`.
  17. At deadline (or immediately upon confirmation if configured):
      - Local customer PII fields in SQLite are scrubbed.
      - Photo and signature binaries in device storage are crypto-shredded.
      - Verifiable audit tombstone sent to server: "Local data purged at [Timestamp]".
```

---

## 5. Pre-Implementation Decisions & Recommendations

| Decision Topic | Options Evaluated | Trade-Offs & Rationale | Final Recommendation |
| :--- | :--- | :--- | :--- |
| **1. Conflict Resolution Policy** | **A.** Last-Write-Wins (Record Level)<br>**B.** Strict Rejection (HTTP 409)<br>**C.** Server-Side Field-Level 3-Way Merge | Option A causes silent data loss. Option B blocks field inspectors from submitting. Option C reconciles non-overlapping fields automatically using integer versions and base versions, flagging true field overlaps for supervisor review. | **Option C: Server-Side Field-Level 3-Way Merge** with Inspector Field Authority for on-site checklist data. |
| **2. Inspection Web Locking** | **A.** Hard Pessimistic Lock<br>**B.** No Locking<br>**C.** Soft / Advisory Lock on Web | Option A prevents supervisors from making urgent corrections if an inspector is delayed. Option B maximizes collision risk. Option C warns supervisors with an active banner: *"Inspector is currently offline on-site. Concurrent edits may create conflicts."* | **Option C: Soft Advisory Lock on Web Portal** with prominent banner and explicit confirmation modal before editing. |
| **3. Local Database & File Encryption** | **A.** OS Standard Sandbox Only<br>**B.** SQLCipher + OS Encrypted File API | Option A relies solely on tablet MDM passcodes; vulnerable if device is compromised or backup extracted. Option B ensures regulatory-grade encryption at rest using hardware Keystore/Keychain-backed keys. | **Option B: SQLCipher + EncryptedFile API** with AES-256 keys anchored in Android Keystore / iOS Keychain. |
| **4. Photo Upload Architecture** | **A.** Base64 inside JSON sync<br>**B.** Monolithic REST multipart<br>**C.** Dedicated Resumable Object Storage (S3/GCS) | Option A blows up JSON payloads and fails on flaky links. Option B re-starts entire batch on connection drop. Option C enables independent, parallel, resumable chunked uploads per image. | **Option C: Presigned Direct-to-Storage Resumable Uploads** coordinated via REST attachment metadata endpoints. |
| **5. 24-Hour Purge Enforcement** | **A.** Client-only timer<br>**B.** Server push notification only<br>**C.** Dual-Control Fail-Safe Timer | Option A risks clock tampering. Option B fails if tablet remains offline after job completion. Option C pairs server-issued UTC timestamp with local monotonic clock failsafe that triggers regardless of network state. | **Option C: Dual-Control Fail-Safe Timer** with local background worker and cryptographic deletion confirmation receipt. |

---

## 6. Local Data Model (SQLite Architecture)

The tablet SQLite database transitions from a volatile read-through cache to an ACID-compliant, offline-first transactional store.

### 6.1 Database Pragmas & Configuration
```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;          -- Write-Ahead Logging for concurrent read/write
PRAGMA synchronous = NORMAL;        -- Optimal durability and write performance
PRAGMA auto_vacuum = INCREMENTAL;   -- Reclaims space after photo/data purge
```

### 6.2 Schema Definition

```sql
-- 1. Inspections Table
CREATE TABLE inspections (
    id TEXT PRIMARY KEY,                       -- UUID v4
    server_id INTEGER UNIQUE,                  -- Backend primary key (nullable before first sync)
    template_id TEXT NOT NULL,                 -- Form template identifier
    assigned_inspector_id TEXT NOT NULL,
    status TEXT NOT NULL,                      -- 'assigned', 'in_progress', 'completed', 'synced', 'accepted', 'purged'
    server_version INTEGER NOT NULL DEFAULT 1, -- Integer record version from server
    base_version INTEGER NOT NULL DEFAULT 1,   -- Version tablet branched from
    customer_name TEXT,                        -- PII (Subject to 24h purge)
    customer_address TEXT,                     -- PII (Subject to 24h purge)
    customer_phone TEXT,                       -- PII (Subject to 24h purge)
    inspection_data_json TEXT NOT NULL,        -- Structured form answers/responses
    created_at INTEGER NOT NULL,               -- UTC epoch milliseconds
    updated_at INTEGER NOT NULL,
    accepted_at INTEGER,                       -- Server acceptance timestamp (starts 24h clock)
    purge_deadline_at INTEGER,                 -- accepted_at + 86,400,000 ms
    sync_status TEXT NOT NULL DEFAULT 'clean'  -- 'clean', 'dirty', 'syncing', 'conflict', 'error'
);

-- 2. Attachments Table (Photos and Signatures)
CREATE TABLE attachments (
    id TEXT PRIMARY KEY,                       -- UUID v4
    inspection_id TEXT NOT NULL,
    attachment_type TEXT NOT NULL,             -- 'photo', 'signature'
    caption TEXT,
    local_file_path TEXT NOT NULL,             -- Sandboxed private storage path
    thumbnail_path TEXT,
    file_size_bytes INTEGER NOT NULL,
    sha256_hash TEXT NOT NULL,                 -- For idempotency & integrity check
    mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
    upload_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'uploading', 'uploaded', 'failed'
    remote_url TEXT,
    uploaded_bytes INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    purged_at INTEGER,
    FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE
);

-- 3. Mutation Queue (Outbox Pattern)
CREATE TABLE mutation_queue (
    id TEXT PRIMARY KEY,                       -- UUID v4
    inspection_id TEXT NOT NULL,
    mutation_type TEXT NOT NULL,               -- 'UPDATE_FORM', 'SUBMIT_INSPECTION', 'ATTACH_FILE'
    payload_json TEXT NOT NULL,
    base_version INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',     -- 'queued', 'in_flight', 'failed'
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE
);

-- 4. Immutable Local Audit Log
CREATE TABLE local_audit_log (
    id TEXT PRIMARY KEY,                       -- UUID v4
    inspection_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,                      -- 'FIELD_EDIT', 'PHOTO_CAPTURED', 'SIGNATURE_CAPTURED', 'INSPECTION_SUBMITTED', 'PURGE_EXECUTED'
    field_key TEXT,
    old_value TEXT,
    new_value TEXT,
    timestamp INTEGER NOT NULL,
    device_id TEXT NOT NULL,
    synced_to_server INTEGER NOT NULL DEFAULT 0, -- Boolean: 0 = pending, 1 = synced
    FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_inspections_sync_status ON inspections(sync_status);
CREATE INDEX idx_inspections_purge_deadline ON inspections(purge_deadline_at);
CREATE INDEX idx_attachments_upload ON attachments(upload_status);
CREATE INDEX idx_mutation_queue_status ON mutation_queue(status, created_at);
CREATE INDEX idx_audit_log_synced ON local_audit_log(synced_to_server);
```

---

## 7. Sync Protocol & Network Resilience

### 7.1 Architecture: Decoupled Two-Tier Synchronization
Because cellular data in basements or stairwells is intermittent, the sync engine decouples lightweight form updates from heavy media assets.

```
       [ Tablet Client ]                                     [ REST Backend ]
              |                                                     |
              | ====== TIER 1: Form & Metadata (JSON) ======        |
              | POST /api/v1/inspections/{id}/sync                  |
              | (Payload: changes, base_version: 3, audit_events)   |
              | --------------------------------------------------> |
              |                                                     | Inspects version:
              |                                                     | If server_version == 3:
              |                                                     |   Applies diff, version -> 4
              | <-------------------------------------------------- |
              | HTTP 200 OK { new_version: 4, status: "merged" }    |
              |                                                     |
              | ====== TIER 2: Attachments (Resumable) ======       |
              | POST /api/v1/inspections/{id}/attachments/init      |
              | (Payload: id, sha256, size, type: "photo")          |
              | --------------------------------------------------> |
              | <-------------------------------------------------- |
              | HTTP 200 OK { upload_url: "https://...", token }    |
              |                                                     |
              | PUT [upload_url] (Chunked / Resumable Binary)       |
              | --------------------------------------------------> |
              | <-------------------------------------------------- |
              | HTTP 200 OK (ETag / Checksum confirmed)             |
              |                                                     |
              | POST /api/v1/inspections/{id}/attachments/confirm   |
              | --------------------------------------------------> |
              | <-------------------------------------------------- |
```

### 7.2 Idempotency & Batching
* Every mutation in the `mutation_queue` carries an immutable client-generated UUID (`mutation_id`).
* The server maintains an `idempotency_keys` table. Re-submitting the same mutation due to network dropouts returns the previous successful HTTP response without duplicating side effects.
* Mutations for the same inspection are squashed locally before transmission: multiple updates to the same form field within the offline session are collapsed to the final state while preserving all intermediate changes in the `local_audit_log`.

### 7.3 Intermittent Network Handling
* Network detection uses OS connectivity callbacks (`ConnectivityManager.NetworkCallback` on Android, `NWPathMonitor` on iOS).
* When a transition to `CONNECTED` occurs, the app does not blast the server immediately. It applies an initial stabilization delay (2 seconds) followed by exponential backoff with jitter:
  $$\text{Delay} = \min(60\text{s}, 2^{\text{retry\_count}} \times 1\text{s}) \pm \text{jitter}(0-500\text{ms})$$
* Background jobs use native OS background job schedulers (`WorkManager` with `NetworkType.CONNECTED` constraints on Android, `BGAppRefreshTask` / `BGProcessingTask` on iOS).

---

## 8. Conflict Policy & Concurrent Web Edits

### 8.1 The Concurrency Challenge
The server utilizes integer record versions (`1, 2, 3...`).
A conflict occurs when:
1. Tablet checks out inspection at version $V_{\text{base}} = 3$.
2. Inspector goes offline in a basement.
3. Supervisor edits the inspection via the web portal $\rightarrow$ Server advances version to $V_{\text{server}} = 4$.
4. Inspector comes online and attempts to sync with $V_{\text{base}} = 3$.

### 8.2 Three-Way Field-Level Merge Algorithm
When the server receives a sync request where $V_{\text{base}} \neq V_{\text{server}}$:
1. **Change Set Extraction**: The server loads the audit trail of modifications between $V_{\text{base}}$ and $V_{\text{server}}$ to identify which exact fields the supervisor modified: $\Delta_{\text{supervisor}}$.
2. **Disjoint Field Set (Automatic Merge)**:
   * If $\Delta_{\text{inspector}} \cap \Delta_{\text{supervisor}} = \emptyset$: The inspector and supervisor edited completely different fields (e.g., supervisor updated customer contact phone, inspector completed basement foundation checklist).
   * **Resolution**: The server applies both change sets, increments version to $V_{\text{server}} + 1$, persists all audit events, and returns `HTTP 200` with the updated full state.
3. **Overlapping Field Set (Domain-Specific Arbitration)**:
   * If $\Delta_{\text{inspector}} \cap \Delta_{\text{supervisor}} \neq \emptyset$: Both parties modified the same form field (e.g., "Foundation Structural Rating").
   * **Rule 1: On-Site Physical Precedence**: For field observations, photos, and checklist items, the on-site inspector's observation takes immediate precedence over desk-based edits, as the inspector is physically witnessing the building condition.
   * **Rule 2: Supervisor Review Flag**: Rather than rejecting the submission or silently overwriting, the server accepts the inspector's value as primary, writes the supervisor's prior edit to a `conflict_history` log, and triggers a web notification to the supervisor:
     > *"Field Conflict Notice: Inspector submitted on-site values for 'Foundation Structural Rating' which superseded your web edit made at 14:15. Please review the audit comparison."*
   * **Rule 3: Status Immutability**: If the supervisor marked the inspection as `Cancelled` or `Reassigned`, the tablet sync is halted, changes are safely preserved in a server review stash, and the inspector is notified.

---

## 9. Attachments Pipeline (Photos & Signatures)

### 9.1 The Photo Volume Problem
* Requirement: Up to 40 photos per inspection.
* Modern tablet cameras produce 12 MP images (~5–10 MB JPEG) or 48 MP RAW images. Uploading $40 \times 8\text{ MB} = 320\text{ MB}$ over poor 3G/intermittent cellular connections will cause timeouts, severe battery drain, and failed syncs.

### 9.2 On-Device Media Processing Pipeline
1. **Capture**: Photo taken via in-app camera interface. Raw bitmap saved temporarily in app cache.
2. **Compression Worker** (Executed on background thread immediately after capture):
   * Downscale maximum dimension to **2048px** (preserving aspect ratio).
   * Encode as JPEG at **80% quality factor**.
   * Strip unnecessary EXIF metadata (GPS/PII stripped or normalized into structured metadata table).
   * Result: File size drops from ~8 MB to **500–800 KB**. Total 40-photo payload drops from ~320 MB to **~25 MB**.
3. **Thumbnail Generation**: Generate a $256 \times 256$ WebP thumbnail (~15 KB) stored locally for instantaneous tablet gallery rendering without loading full bitmaps.
4. **Integrity & Deduplication**: Compute SHA-256 hash of the compressed file. Store in `attachments` table.

```
[ Camera Capture ] 
       │
       ▼
[ Background Compression Worker ]
  ├── Resize (Max 2048px)
  ├── 80% JPEG Compression (~600 KB)
  ├── Strip PII EXIF
  ├── Generate 256px WebP Thumbnail
  └── Compute SHA-256 Hash
       │
       ▼
[ Encrypted Sandbox Storage ] ──> Record in SQLite (Status: 'pending')
```

### 9.3 Resumable Upload Queue
* Attachments are uploaded independently from form data.
* WorkManager / Background URLSession dispatches uploads with a concurrency limit of **2 parallel streams** to prevent starving cellular radio bandwidth.
* Each photo upload is chunked (or uses presigned S3/GCS multipart with HTTP `Content-Range`).
* If signal drops on photo #18, bytes uploaded for photo #18 resume from the last committed chunk, while photos #1 through #17 remain completed.

### 9.4 Signature Capture Pipeline
* Captured via HTML5 Canvas / Native Touch View.
* Stored as:
  1. Scaled PNG bitmap with transparent background (<50 KB).
  2. SVG vector path data + timestamped cryptographic envelope.
* Checksum is calculated over: `SHA256(customer_signature_bytes + customer_name + timestamp + inspection_id)`.
* This ensures tamper evidence: any post-signature alteration of the inspection data invalidates the signature envelope.

---

## 10. Security Architecture & Regulatory Compliance

### 10.1 Storage Security at Rest
1. **Database Encryption**: SQLite database is fully encrypted using **SQLCipher** (AES-256 in CBC mode with HMAC-SHA512 page integrity). The encryption key is dynamically generated and stored in the hardware-backed keystore (Android Keystore / iOS Keychain) under biometric or device-passcode authentication.
2. **Filesystem Sandbox**: All photo and signature files are stored in the application's private sandbox directory (`no-backup` directory to prevent unencrypted cloud backups to iCloud or Google Drive).
3. **Transport Security**: All API traffic strictly enforced via TLS 1.3 with Certificate Pinning.

### 10.2 Tamper-Resistant Regulatory Audit Trail
* Regulations require an immutable audit trail of every inspection action.
* The `local_audit_log` records every field entry, modification, deletion, camera capture, and sync event with:
  `{ id, inspection_id, user_id, action, field_key, old_val, new_val, timestamp, device_id }`.
* Audit log records are append-only. SQLite triggers prevent `UPDATE` or `DELETE` on the `local_audit_log` table.
* Audit events are streamed to the server during every sync pulse.

### 10.3 The 24-Hour Regulatory Customer Data Purge Engine
Requirement: *"Removal of local customer data within 24 hours after an inspection is accepted."*

```
[ Server Marks 'Accepted' ] 
       │
       ▼
[ Sync Notification to Tablet ] ──> Stores accepted_at & purge_deadline_at
       │
       ▼
[ Purge Trigger: Reaching Deadline OR Explicit Server Purge Command ]
       │
       ├── 1. Crypto-Shredding Filesystem Binaries:
       │      Overwrite file bytes with zeros/random bytes, then unlink (Photos & Signatures).
       │
       ├── 2. Database Data Scrubbing:
       │      UPDATE inspections SET customer_name=NULL, customer_address=NULL,
       │                             customer_phone=NULL, inspection_data_json='{}',
       │                             status='purged' WHERE id = :id;
       │      DELETE FROM attachments WHERE inspection_id = :id;
       │
       ├── 3. Execute PRAGMA incremental_vacuum;
       │
       ├── 4. Generate Local Audit Log:
       │      Log ACTION: 'REGULATORY_PURGE_EXECUTED', timestamp, cert_hash.
       │
       └── 5. Transmit Verification Receipt to Server:
              POST /api/v1/inspections/{id}/purge-receipt
```

#### Failsafe Offline Purge
If a tablet is powered off or kept in a disconnected locker for 5 days after an inspection is accepted:
* The `purge_deadline_at` timestamp is already burned into SQLite.
* Upon device boot or app launch, the `PurgeEnforcementWorker` runs before any user interaction.
* If `CurrentTime >= purge_deadline_at`, the purge executes **immediately offline**.
* The deletion receipt is queued in the `mutation_queue` to sync whenever connectivity is re-established.

---

## 11. Migration & Backfill Strategy

### 11.1 Upgrading SQLite from Read-Through Cache to Authoritative Store
Currently, the mobile app treats SQLite as an ephemeral read-through cache. Transitioning requires a non-destructive migration path:

1. **Schema Versioning**: Use SQLite `PRAGMA user_version` to manage atomic migrations.
   * `Version 0`: Legacy read-through cache tables.
   * `Version 1`: Add `mutation_queue`, `local_audit_log`, `attachments`, and update `inspections` with version tracking columns (`server_version`, `base_version`, `sync_status`).
2. **Safe Migration Sequence**:
   * On app update launch, check if legacy cache contains un-synced dirty records (unlikely in pure read-through, but defensively checked).
   * Execute migration script inside a single SQLite transaction.
   * Flush volatile cache tables; re-initialize schema.
3. **Data Backfill & Pre-Warm**:
   * App invokes new server endpoint: `GET /api/v1/inspections/assigned-package`.
   * Server returns complete offline payloads for all inspections currently assigned to the logged-in inspector:
     - Form templates and dynamic field validation schemas.
     - Inspection metadata and customer contact records.
     - Historical building notes.
   * Tablet populates SQLite, marks status as `clean`, and downloads reference assets.

### 11.2 Backward Compatibility with Existing Server REST APIs
* Existing server endpoints use integer record versions (`PUT /api/v1/inspections/{id}`).
* Rather than rewriting existing endpoints, introduce versioned sync endpoints:
  - `POST /api/v1/inspections/{id}/sync` (Accepts base version, field delta array, and audit entries).
  - Existing web portal endpoints continue operating; the server's internal service layer delegates both web and mobile edits through the common optimistic locking & version increment logic.

---

## 12. Observability & Telemetry Framework

Because offline apps operate in a black box during field work, specialized observability is required to track sync health without violating customer privacy.

### 12.1 Buffered Local Telemetry
* Tablet logs structured metrics to a lightweight local buffer table `client_metrics`:
  - `offline_duration_ms`: Time elapsed between disconnection and re-connection.
  - `form_save_latency_ms`: SQLite transaction write latency.
  - `sync_queue_depth`: Number of pending mutations awaiting upload.
  - `upload_retry_count`: Number of network failures per photo.
  - `purge_execution_delay_ms`: Difference between `purge_deadline_at` and actual execution.
* Metrics are batched and uploaded to the observability backend (`POST /api/v1/telemetry`) during regular sync windows.

### 12.2 Critical Server-Side Metrics & Alerts
* **Conflict Rate Metric**: $\frac{\text{Syncs with } V_{\text{base}} \neq V_{\text{server}}}{\text{Total Sync Requests}}$. Alert threshold: $> 3\%$.
* **Sync Failure Rate**: Alert threshold: $> 0.5\%$ of mutation submissions failing after 5 retries.
* **Photo Upload Throughput**: P50, P90, P99 upload durations per MB.
* **Purge Compliance Monitor**: High-priority compliance alert triggered if server has not received a `purge-receipt` for an accepted inspection within 25 hours (24h SLA + 1h buffer).

---

## 13. Testing & Quality Assurance Plan

| Test Phase | Scope & Scenarios | Verification Method |
| :--- | :--- | :--- |
| **1. Unit & Database Tests** | • SQLite schema migrations from `user_version` 0 to 1.<br>• Idempotent insert/update in `mutation_queue`.<br>• Local 3-way merge logic and squashing functions.<br>• Photo compression algorithms (aspect ratio, quality, EXIF removal). | Automated CI tests using SQLite in-memory and Android/iOS unit test runners. |
| **2. Network Chaos & Flakiness** | • **Basement Simulation**: Sever connection immediately after form edits.<br>• **Intermittent Signal**: 10% packet drop, 500kbps bandwidth, 2000ms latency.<br>• **Mid-Flight Disconnect**: Sever connection while photo 23 of 40 is 50% uploaded. | Network Link Conditioner (iOS) & Charles Proxy / Toxiproxy throttling on Android. Verify resumption from photo 23 without re-uploading 1–22. |
| **3. Concurrency & Conflict Simulation** | • Inspector goes offline with version 4.<br>• Supervisor modifies field X on web (version 5).<br>• Inspector modifies field Y offline.<br>• Both sync: verify clean merge, version 6.<br>• Test overlapping edit on field Z: verify on-site inspector precedence and supervisor conflict flag. | Automated API integration tests simulating concurrent client requests against REST backend. |
| **4. Regulatory Purge Verification** | • Time-travel testing: Advance tablet system clock past 24 hours while offline.<br>• Verify customer PII fields in SQLite are scrubbed to `NULL`.<br>• Forensic filesystem check: Verify photo and signature files cannot be recovered via file carving tools.<br>• Verify deletion receipt is generated and sent upon reconnect. | Device test suite with direct SQLite inspection and raw filesystem byte verification. |

---

## 14. Staged Rollout Strategy

Product explicitly requires a pilot program prior to broad rollout to validate reliability in real-world basement conditions.

```
┌────────────────────────────────────────────────────────────┐
│ Stage 0: Internal Dogfooding (QA & Field Champions)        │
│ 5 Devices | Simulated Basements | 100% Synthetic Tests     │
└─────────────────────────────┬──────────────────────────────┘
                              │ Exit Criteria: Zero data loss, 100% purge compliance
                              ▼
┌────────────────────────────────────────────────────────────┐
│ Stage 1: Pilot Program (Single Branch / Depot)             │
│ 15-20 Inspectors | 2 Supervisors | 2-3 Weeks Live Inspections│
│ Feature Flag: `offline_sync_pilot = true`                  │
└─────────────────────────────┬──────────────────────────────┘
                              │ Exit Criteria: Conflict rate < 2%, Zero photo loss,
                              │ P95 sync time < 45s, Inspector NPS positive
                              ▼
┌────────────────────────────────────────────────────────────┐
│ Stage 2: Regional Rollout (25% -> 50% Fleet)               │
│ Feature Flag targeted by Depot ID                          │
└─────────────────────────────┬──────────────────────────────┘
                              │ Exit Criteria: Server error rate < 0.1%,
                              │ DB performance nominal
                              ▼
┌────────────────────────────────────────────────────────────┐
│ Stage 3: Broad Production Rollout (100% Fleet)             │
│ Deprecate legacy read-through cache codebase               │
└────────────────────────────────────────────────────────────┘
```

### Pilot Selection & Feedback Loops
* **Pilot Depot**: Select a depot operating in high-density urban areas with deep concrete basements and subterranean garages.
* **Instrumentation**: Daily automated health summaries comparing field submissions vs web approvals.
* **Weekly Pilot Retrospectives**: Direct feedback sessions between engineering, product, and pilot inspectors.

---

## 15. Rollback Strategy & Emergency Safeguards

A critical failure during rollout (e.g., local database corruption, sync deadlock) requires an immediate, non-destructive rollback mechanism.

### 15.1 Emergency Kill Switch
* Controlled via remote configuration / feature flag service: `offline_sync_enabled`.
* When flipped to `false`:
  1. The tablet app immediately disables the offline background sync engine.
  2. The UI falls back to the legacy online REST mode.

### 15.2 Safeguard Against Un-synced Field Work (Zero Data Loss Guarantee)
* **Never wipe the local database upon rollback!**
* If the kill switch is triggered while a tablet has un-synced inspections in the local `mutation_queue`:
  1. The app displays an emergency notification: *"System update in progress. You have offline changes stored safely on this tablet."*
  2. A dedicated diagnostic screen enables the inspector to trigger an **Emergency Data Flush** (submitting raw captured JSON directly to an S3 rescue bucket or emergency dump endpoint).
  3. Photos stored locally remain intact in the encrypted sandbox until manual verification confirms receipt.

---

## 16. Milestone Sequence, Dependencies & Acceptance Criteria

```
[ M1: Local Relational Store ] ─────┐
                                    ▼
[ M2: Media & Signature Pipeline ] ───> [ M4: Two-Way Sync Engine ] ───> [ M6: Observability & Flags ]
                                    ▲                                        │
[ M3: Server REST Sync Endpoints ] ─┘                                        ▼
                                                                        [ M7: Depot Pilot ]
[ M5: Security & 24h Purge System ] ─────────────────────────────────────────┤
                                                                             ▼
                                                                        [ M8: Fleet Rollout ]
```

### Milestone 1: Local Architecture & SQLite Engine Refactor
* **Dependencies**: None.
* **Key Deliverables**:
  - SQLite schema migration from cache to relational model with WAL mode.
  - CRUD operations for forms, inspections, and audit logs.
  - In-memory test suite for offline state management.
* **Acceptance Criteria**:
  - App opens, reads, and writes inspection forms with zero network connectivity.
  - App restart during form entry restores 100% of field state.
  - Zero disk leaks or unhandled SQLite lock exceptions.

### Milestone 2: On-Device Media & Signature Pipeline
* **Dependencies**: Milestone 1.
* **Key Deliverables**:
  - Camera integration with background compression worker (max 2048px, 80% JPEG).
  - Thumbnail generation (256px WebP).
  - Touch-based signature capture with SHA-256 cryptographic hashing.
  - Attachment storage table management.
* **Acceptance Criteria**:
  - Tablet captures 40 photos without memory pressure or UI frame drops.
  - Total on-disk footprint for 40 photos is $\le 30\text{ MB}$.
  - Signature capture outputs both vector points and PNG with valid checksum.

### Milestone 3: Server Sync Endpoints & Conflict Detection Engine
* **Dependencies**: Milestone 1.
* **Key Deliverables**:
  - Server endpoints: `POST /api/v1/inspections/{id}/sync`, `POST .../attachments/init`, `POST .../confirm`.
  - Integer version validation and 3-way field-level merge algorithm.
  - Web portal advisory lock banner for checked-out inspections.
* **Acceptance Criteria**:
  - Server successfully merges disjoint field updates between web supervisor and mobile client.
  - Server rejects or flags overlapping field conflicts without dropping inspector on-site checklist data.
  - Idempotency key prevents duplicate records on re-sent requests.

### Milestone 4: Two-Way Sync Protocol & Background Worker
* **Dependencies**: Milestone 2, Milestone 3.
* **Key Deliverables**:
  - Native background workers (WorkManager / BGTasks) managing `mutation_queue`.
  - Two-tier sync orchestrator: Metadata sync followed by chunked photo uploads.
  - Exponential backoff with jitter and network listener.
* **Acceptance Criteria**:
  - Form notes sync within 5 seconds of reconnecting to cellular network.
  - Interrupted photo uploads resume from last successful chunk.
  - All 40 photos successfully sync over an intermittent 3G simulated link.

### Milestone 5: Security Architecture & 24-Hour Purge System
* **Dependencies**: Milestone 4.
* **Key Deliverables**:
  - SQLCipher database encryption integration with OS Keystore.
  - Private filesystem sandbox protection with encrypted file APIs.
  - 24-hour post-acceptance regulatory purge worker with cryptographic shredding.
  - Server purge receipt verification endpoint.
* **Acceptance Criteria**:
  - Local customer PII, photos, and signatures are completely scrubbed within 24 hours of server acceptance timestamp.
  - Purge occurs even if tablet remains offline when deadline expires.
  - Cryptographic purge verification receipt successfully delivered to server.

### Milestone 6: Observability, Telemetry & Feature Flagging
* **Dependencies**: Milestone 4, Milestone 5.
* **Key Deliverables**:
  - Local buffered metrics logging and upload service.
  - Server dashboard for conflict rates, sync latency, and purge compliance.
  - Dynamic feature flags (`offline_sync_pilot`) with emergency kill switch.
* **Acceptance Criteria**:
  - Dashboard displays real-time sync metrics and conflict rates.
  - Flipping feature flag gracefully disables offline sync without deleting un-synced data.

### Milestone 7: Field Pilot Deployment
* **Dependencies**: Milestone 6.
* **Key Deliverables**:
  - Deployment to pilot depot (15–20 inspectors, 2 supervisors).
  - Daily triage and sync telemetry monitoring.
  - Weekly stakeholder reviews.
* **Acceptance Criteria**:
  - Zero lost inspections or lost notes over a 2-week active field evaluation period.
  - Conflict rate remains $< 2\%$.
  - 100% regulatory purge compliance verified within the 24-hour SLA.

### Milestone 8: Full Fleet Production Rollout
* **Dependencies**: Milestone 7.
* **Key Deliverables**:
  - Phased rollout to 100% of inspector fleet.
  - Removal of legacy read-through cache code paths.
  - Final operational documentation and runbooks.
* **Acceptance Criteria**:
  - 100% of company tablets running offline sync engine successfully.
  - Legacy code deprecated and removed.
