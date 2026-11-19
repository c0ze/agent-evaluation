# Engineering & Product Plan: Offline Building Inspection Sync

## 1. Executive Summary & Goals

Inspectors using company-managed tablets in basements currently lose notes whenever connectivity drops after opening an inspection. This plan transitions the mobile application from an online-dependent client with a SQLite read-through cache to a **local-first, durably synchronized offline inspection system** built atop the existing integer-versioned REST architecture.

### Core Objectives
- **Zero data loss**: Every form edit, photo (up to 40 per inspection), and signature is persisted atomically on-device before being acknowledged to the inspector.
- **Reliable intermittent sync**: Resume form mutations and large media transfers safely across flaky networks without duplicating writes or losing progress.
- **Deterministic conflict handling without collaborative editing**: Reconcile concurrent supervisor web edits using optimistic integer versions, field-level 3-way merge where safe, and explicit conflict resolution where edits overlap or affect signed data.
- **Regulatory compliance**: Preserve a complete, immutable audit history across offline and online edits, and enforce removal of local customer data within 24 hours after an inspection is accepted.
- **Low-risk delivery**: Ship behind feature flags with safe migration from the existing read-through cache, a controlled pilot before broad rollout, and a data-preserving rollback path.

---

## 2. Explicit Assumptions

All planning decisions below rest on the following explicit assumptions derived from `BRIEF.md`. Any invalidated assumption requires revisiting the linked pre-implementation decisions in Section 3.

| ID | Assumption | Rationale / Basis | Impact if False | Validation Method |
| :--- | :--- | :--- | :--- | :--- |
| **A1** | **24-hour purge compliance allows sync-triggered deletion plus a local offline fallback TTL.** Regulators accept purging local customer data immediately upon receiving `accepted` status (always <24h while connected), paired with an automated local TTL/post-submission purge safeguard when a tablet remains offline. | An offline tablet physically cannot observe a server-side acceptance event until it reconnects. | If strict wall-clock deletion within 24h of server acceptance is required regardless of connectivity, the app must enforce aggressive pre-acceptance purge on submission or strict MDM check-in/wipe SLAs. | Legal & compliance sign-off (`D1`) before M1. |
| **A2** | **Concurrent supervisor web edits are low-frequency and mostly disjoint from active offline inspector edits (especially post-signature).** | Product explicitly does not want a full collaborative editor, implying infrequent contention rather than real-time co-authoring. | High contention on identical fields or frequent post-signature edits would cause excessive `409` conflicts, inspector friction, or site re-visits for re-signing. | Analyze historical web/tablet edit overlap logs; confirm conflict & signature rules (`D2`, `D3`) before M1; measure conflict rate in pilot. |
| **A3** | **Existing REST APIs can be extended additively, and regulators accept dual-timestamped offline audit records.** The backend team can add idempotency keys, field-level patch/conflict responses, decoupled resumable upload endpoints, and audit entries capturing both client event time and server ingest time. | Brief states existing APIs use REST with integer versions; intermittent-network sync requires idempotent retries and decoupled media uploads. | If backend APIs are frozen/third-party or regulators reject client-recorded offline timestamps, the sync protocol cannot guarantee duplicate-free retries or compliant audit logs without a proxy/middleware layer or hardware attestation. | Backend architecture & compliance review (`D6`, `D9`) before M1. |
| **A4** | **Company-managed tablets are assigned 1:1 to inspectors (or strictly isolated per user profile) and enforce MDM passcode + OS disk encryption.** | Brief specifies company-managed tablets. | Shared shift tablets without strict per-user encrypted storage partitioning risk cross-inspector customer data exposure and stranded unsynced queues across logins. | IT/MDM & field operations audit (`D4`) before M1. |
| **A5** | **Inspectors connect online before entering basements to prefetch assigned inspections, and only assigned inspections are worked offline.** | Brief states inspectors "need to open assigned inspections" offline. | If inspectors must create unscheduled inspections from scratch offline or handle mid-basement reassignments without prior signal, the prefetch-only model and offline ID generation must be expanded. | Field workflow review with product & dispatch (`D8`) before M1. |
| **A6** | **Managed tablets have sufficient local storage headroom for active assigned inspections plus media.** (E.g., 40 compressed photos ≈ 40–60 MB per inspection; multiple queued inspections fit comfortably with OS headroom.) | Photo capture up to 40 images per inspection requires bounded local disk storage before upload completes. | Low-storage devices could fail photo capture or trigger OS eviction/SQLite write failures mid-inspection. | Fleet device telemetry check & storage quota design before M2. |
| **A7** | **Authentication can support offline local re-unlock without discarding queued local data on access-token expiry.** | Inspectors in basements cannot complete OAuth/SSO token refreshes while disconnected. | Aggressive session timeouts that wipe local storage on 401/expiry would destroy unsynced basement work. | Security & IAM review (`D7`) before M1. |
| **A8** | **Inspection form definitions/schemas are versioned and cacheable locally.** | Offline form rendering and client-side validation require the form schema without live server calls. | Unversioned dynamic server-rendered forms would fail offline or silently drop fields when templates change mid-flight. | Inspect current form schema representation during M0. |
| **A9** | **Target tablet OS(es) provide standard SQLite (with SQLCipher support), hardware-backed Keychain/Keystore, and background transfer APIs.** | Brief notes the mobile app already uses SQLite on company-managed tablets. | Lack of SQLCipher or background transfer support would require alternative encryption or foreground-only sync constraints. | Mobile platform technical spike in M0. |
| **A10** | **`ACCEPTED` is a server-authoritative lifecycle state with a canonical `accepted_at` timestamp.** | Local 24-hour post-acceptance purge requires an unambiguous server timestamp defining when acceptance occurred. | If acceptance happens in an external system without propagating `accepted_at` promptly to the inspection API, purge timers cannot be reliably enforced. | Backend workflow & schema check in M0. |

---

## 3. Pre-Implementation Decisions

The following decisions **must be finalized in Milestone M0** before engineering implementation begins.

### D1: 24-Hour Post-Acceptance Local Purge Trigger & Offline Gap Policy
- **Options**:
  1. *Sync-triggered purge only*: Purge within 24h after device learns of acceptance.
  2. *Purge immediately upon verified submission sync + sync-triggered acceptance purge + hard local TTL*: Once an inspector submits and the server confirms receipt of all fields/photos/signature, purge local customer data promptly (e.g., immediately or after a short configurable read-only window such as 4 hours), *and* always purge immediately upon receiving `ACCEPTED` status (well under 24h). Pair with a hard local fallback TTL and server-side >18h overdue-purge alerts.
  3. *Strict wall-clock 24h via forced MDM wipe*: Trigger MDM wipe if tablet doesn't confirm purge within 24h.
- **Recommendation**: **Option 2**. Purging local customer PII promptly after verified submission sync means that in the normal workflow customer data is already gone before the supervisor even accepts the inspection—eliminating the "tablet stays offline >24h after acceptance" compliance gap—while still supporting reopen/re-download if a supervisor returns an inspection for rework. Confirm exact legal wording with Compliance.
- **Owners**: Legal/Compliance, Product, Security.

### D2: Conflict Resolution Strategy & Ownership
- **Options**:
  1. *Last-Write-Wins (LWW)* at whole-record level (high risk of silent supervisor/inspector overwrite).
  2. *Field-level 3-way merge + explicit manual resolution for overlapping fields*, owned by the inspector on the tablet (with option to escalate/handoff to supervisor).
  3. *Server always wins*, saving inspector edits as a separate unstructured attachment.
- **Recommendation**: **Option 2**. Store `base_snapshot` at download/last-sync so the system can safely auto-merge disjoint field edits and append-only photos, while surfacing true same-field conflicts side-by-side to the inspector with actor/timestamp context. No collaborative editor is needed.
- **Owners**: Product, Engineering, Field Operations.

### D3: Signature Integrity When Supervisor Edits Occur
- **Options**:
  1. *Auto-merge supervisor edits and keep the offline signature attached*.
  2. *Cryptographically bind the signature to a canonical hash of attested fields*; block auto-merge if any attested field changed on the web, flagging `SIGNATURE_INVALIDATED_CONFLICT` for explicit review/re-signature.
  3. *Lock the inspection on the web* whenever assigned to a tablet.
- **Recommendation**: **Option 2** (plus soft UI warning on web when an inspection is checked out/in-progress on a tablet). Attaching an inspection signature to silently altered facts creates legal and regulatory liability.
- **Owners**: Legal/Compliance, Product, Engineering.

### D4: Tablet Ownership & Multi-User Isolation
- **Options**:
  1. *Single-user 1:1 assigned tablets* (block logout while unsynced changes exist).
  2. *Shared pool tablets* with isolated per-user encrypted SQLite databases and per-user media directories.
- **Recommendation**: **Option 1 for pilot**, while structuring local storage paths and encryption keys per `user_id` so **Option 2** can be supported cleanly if operations later requires shared shift tablets. Never allow silent data deletion on logout.
- **Owners**: IT/MDM, Field Operations, Security.

### D5: Attachment Upload Protocol & Photo Compression Spec
- **Options**:
  1. *Inline base64 photos inside REST JSON payloads* (fragile, massive payloads, fails on flaky links).
  2. *Decoupled resumable uploads* (presigned multipart object storage or `tus` protocol) with client-side resize/JPEG compression (e.g., max 2048px longest edge, ~80% quality, ~1 MB target) and SHA-256 verification.
  3. *Uncompressed raw camera originals* via resumable upload.
- **Recommendation**: **Option 2**. Decoupling media from JSON prevents 40 photos (~40–60 MB) from blocking form/status sync and allows chunk-level resumption across intermittent connectivity. Confirm with domain stakeholders whether 2048px JPEG meets inspection detail requirements.
- **Owners**: Mobile, Backend, Product/Compliance.

### D6: REST Sync Contract & Mutation Granularity
- **Options**:
  1. *Reuse whole-record `PUT` with integer `version`* (no partial merge, retry ambiguity on dropped responses).
  2. *Additive field-patch / mutation endpoint* (`PATCH /api/v1/inspections/{id}` or `POST /api/v1/inspections/{id}/mutations`) requiring `base_version`, `Idempotency-Key`, field-level diff payload, and client event metadata, while keeping existing REST endpoints backward-compatible.
- **Recommendation**: **Option 2**. Keeps REST and integer record versions intact while enabling idempotent retries, clean 3-way conflict responses, and granular audit logs.
- **Owners**: Backend, Mobile.

### D7: Offline Authentication & Session Expiry Policy
- **Options**:
  1. *Force online login whenever access token expires* (locks inspector out in basements).
  2. *Decouple local offline unlock from online API tokens*: Require online login initially; allow offline work gated by OS biometric/PIN re-unlock up to an MDM-configured offline session window (e.g., 24–72h). On reconnect with an expired token, pause sync and prompt re-auth without touching local data.
- **Recommendation**: **Option 2**. Balances security with basement operability and guarantees expired tokens never cause data loss.
- **Owners**: Security/IAM, Mobile.

### D8: Offline Inspection Creation & Reassignment Handling
- **Options**:
  1. *Assigned-only offline*: Only pre-downloaded assigned inspections can be edited offline; if reassigned away on server while edited offline, preserve local work as a detached conflict/addendum for supervisor review.
  2. *Allow creating new inspections offline* with client-generated UUIDs.
- **Recommendation**: **Option 1** (matches `BRIEF.md`: "open assigned inspections"). Preserving reassigned offline work as an addendum ensures zero data loss even during unexpected dispatch changes.
- **Owners**: Product, Field Operations.

### D9: Offline Audit Trail Semantics & Clock Skew
- **Options**:
  1. *Record only server receipt timestamp* (loses true offline sequence/time of inspection events).
  2. *Dual-timestamp append-only audit trail*: Record `client_occurred_at`, monotonic sequence per device, estimated clock skew at sync, `server_recorded_at`, `device_id`, `actor_id`, `channel` (`tablet_offline` / `tablet_online` / `web`), and before/after field values.
- **Recommendation**: **Option 2**. Provides transparent, regulator-defensible provenance without falsely trusting device wall clocks.
- **Owners**: Compliance, Backend.

---

## 4. Scope Boundaries

| In Scope (Pilot & GA) | Explicitly Out of Scope (Non-Goals) |
| :--- | :--- |
| Offline opening, reading, and editing of **assigned** inspections | Full collaborative editing (CRDTs, OT, real-time cursors, live co-authoring) |
| Durable local form editing with cached/versioned form schemas | Creating brand-new unassigned inspections from scratch offline |
| In-app capture of up to **40 photos** per inspection offline (with compression, thumbnails, delete/retake) | Video, audio, or arbitrary non-image document capture offline |
| Offline **signature** capture bound to attested inspection state | Offline mode for the supervisor web application |
| Intermittent connectivity sync with idempotent retries and resumable photo uploads | Peer-to-peer tablet-to-tablet sync (Bluetooth/local Wi-Fi) |
| Field-level 3-way merge & manual conflict resolution UI for concurrent supervisor web edits | Editing an inspection after it has been formally `ACCEPTED` |
| End-to-end immutable regulatory audit history (offline + online + conflict resolutions) | Multi-tenant external API redesign (moving off REST / integer versions) |
| Automated local customer-data purge within 24 hours after acceptance (+ fallback safeguards) | Unmanaged / BYOD personal tablets |
| Feature-flagged staged rollout (dogfood -> pilot -> GA) and data-safe rollback | Automatic AI/OCR analysis of inspection photos |

---

## 5. User Flow

```text
[Online: Prefetch] --> [Offline: Basement Work] --> [Intermittent Reconnect] --> [Server Acceptance]
  - Sync assigned        - Open instantly from        - Health check + auth        - Status = ACCEPTED
    inspections &          encrypted SQLite           - Push form patches          - Local purge runs
    form schemas         - Auto-save every edit         (fast lane)                  (<24h, default
  - Show "Ready            atomically to WAL          - Resume 40 photos &           immediate once
    Offline" badge       - Capture <=40 photos          signature (media lane)       dirty=false)
  - Check storage          in app sandbox             - Handle 409 conflicts       - Purge confirmation
    headroom             - Capture signature            if supervisor edited         sent to server
                         - Mark "Ready to Sync"       - Confirm "Synced"
```

### Detailed Walkthrough
1. **Pre-Visit Preparation (Online)**
   - On app launch / foreground while online, the app prefetches assigned inspections, their referenced form schemas, and existing attachment thumbnails.
   - Each inspection displays an explicit readiness badge (`Available Offline`, `Downloading…`, `Needs Download`). Inspectors also have a manual **"Prepare for Offline"** action before heading into basements, which validates sufficient free storage.
2. **Offline Inspection & Form Editing**
   - Opening an assigned inspection reads exclusively from local SQLite—zero network calls required on the critical path.
   - A persistent, calm banner indicates `Offline — Changes saved on this device`.
   - Every form field change commits immediately (debounced briefly for typing, flushed on field blur/screen background) inside an atomic SQLite transaction. Losing signal, backgrounding, or battery death cannot discard saved notes.
3. **Offline Photo Capture (Up to 40 Photos)**
   - Photos are captured via an in-app camera view directly into encrypted app-private storage (never saved to the OS camera roll).
   - UI displays a clear counter (`18 / 40 photos`), instant thumbnail preview, caption/tag support, and local delete/retake. Capture blocks cleanly at 40 photos (or if device free storage drops below a safety floor).
4. **Offline Signature Capture**
   - Inspector collects signer name, role, and drawn signature offline.
   - App computes a canonical hash of the attested form fields and binds it to the signature artifact.
   - If the inspector subsequently modifies an attested field locally, the UI warns that the signature will be invalidated and prompts to re-sign before marking complete.
5. **Local Completion & Queuing**
   - Inspector taps **Submit / Complete Inspection** offline. Client runs full validation against the cached form schema, locks the inspection against accidental edits (unless explicitly reopened locally prior to sync), and moves it to `PENDING_SYNC`.
6. **Intermittent Reconnect & Background Sync**
   - When connectivity returns (verified via lightweight API probe to bypass captive portals), the sync engine automatically runs in the foreground or OS background:
     - Structured form patches and status updates drain first.
     - Photos and signature upload via resumable chunked transfers with progress (`Uploading 23/40 photos`).
   - If signal drops mid-upload, progress is preserved in SQLite and resumes from the last acknowledged chunk on next reconnect.
   - Per-inspection status badges clearly distinguish `Saved Locally`, `Syncing…`, `Synced`, and `Needs Attention (Conflict / Re-auth)`.
7. **Conflict Resolution (When Supervisor Edited on Web)**
   - If a disjoint web edit occurred, the server auto-merges cleanly and shows a non-blocking banner (`Updated with supervisor edits`).
   - If an overlapping field edit or post-signature conflict occurred, only that inspection enters `CONFLICT` (other inspections continue syncing).
   - Opening the inspection presents a focused **Conflict Resolution** view listing only conflicting fields: *Your Offline Value* vs. *Supervisor Web Value* (with editor name and timestamp), allowing explicit selection per field (or escalation to supervisor) before resubmitting.
8. **Acceptance & 24-Hour Local Purge**
   - Once the supervisor accepts the inspection on the web, the next sync delivers `status = ACCEPTED` and `accepted_at` (or if D1 Option 2 is adopted, local PII is already purged shortly after verified submission sync).
   - The app immediately locks and purges all local customer data, photos, thumbnails, and signatures for that inspection, compacts/checkpoints SQLite, and uploads a non-PII purge confirmation receipt.

---

## 6. Local Data Model (SQLite as Source of Truth)

### Architectural Shift
Previously, SQLite acted as a disposable **read-through cache**—server fetches overwrote local rows and cache clears wiped state. In the new architecture, SQLite is the **authoritative local store** split cleanly into three planes:
1. **Server Snapshot Plane** (`inspections_server_snapshot`): Last server-confirmed state and integer `server_version`. Never edited by UI; used as the common ancestor (`base`) for 3-way conflict detection.
2. **Local Working Plane** (`inspections_local`, `attachments`): Current user-visible draft state on the device.
3. **Sync & Compliance Control Plane** (`outbox_ops`, `local_audit_events`, `sync_metadata`, `purge_ledger`): Durable mutation queue, offline audit trail, sync cursors, and non-PII purge receipts.

### SQLite Engine Configuration
- **Encryption**: SQLCipher (AES-256) with database key stored in OS Keychain / Android Keystore.
- **Durability**: `PRAGMA journal_mode = WAL;`, `PRAGMA synchronous = FULL;`, `PRAGMA foreign_keys = ON;`.
- **Secure Deletion**: `PRAGMA secure_delete = ON;` (overwrites deleted B-tree content with zeros) + explicit `PRAGMA wal_checkpoint(TRUNCATE);` and scheduled `VACUUM` after customer-data purges.

### Core Schema

| Table | Purpose | Key Columns |
| :--- | :--- | :--- |
| `inspections_server_snapshot` | Last known server state (`base`) | `inspection_id (PK)`, `user_id`, `server_version (INT)`, `status`, `accepted_at`, `form_schema_id`, `form_schema_version`, `payload_json`, `payload_sha256`, `fetched_at` |
| `inspections_local` | Current editable working state | `inspection_id (PK)`, `user_id`, `local_payload_json`, `dirty_fields_json`, `sync_state` (`CLEAN`, `DIRTY`, `PENDING_SYNC`, `SYNCING`, `CONFLICT`, `ACCEPTED_PENDING_PURGE`), `signed_content_hash`, `local_updated_at`, `submitted_synced_at`, `purge_deadline_at`, `purge_deadline_monotonic_ms` |
| `form_schemas` | Cached offline templates | `schema_id`, `schema_version`, `definition_json`, `cached_at` (`PK(schema_id, schema_version)`) |
| `outbox_ops` | Durable ordered mutation queue | `op_id (PK UUID / Idempotency-Key)`, `inspection_id (FK)`, `seq_num (INTEGER AUTOINCREMENT)`, `op_type` (`PATCH_FIELDS`, `ATTACH_COMMIT`, `SUBMIT`, `RESOLVE_CONFLICT`), `base_version (INT)`, `payload_json`, `client_occurred_at`, `monotonic_ms`, `state` (`PENDING`, `IN_FLIGHT`, `BLOCKED_CONFLICT`, `FAILED_PERMANENT`, `ACKED`), `attempt_count`, `next_retry_at`, `last_error_code` |
| `attachments` | Photos (<=40) & signatures | `attachment_id (PK UUID)`, `inspection_id (FK)`, `kind` (`PHOTO`, `SIGNATURE`), `local_rel_path`, `thumb_rel_path`, `sha256`, `byte_size`, `mime_type`, `metadata_json` (caption, orientation, signer info, `signed_content_hash`), `captured_at`, `upload_state` (`LOCAL_ONLY`, `INITIATED`, `UPLOADING`, `UPLOADED`, `COMMITTED`), `upload_session_url`, `bytes_uploaded`, `server_attachment_id`, `deleted_locally (BOOL)` |
| `local_audit_events` | Offline event provenance | `event_id (PK UUID)`, `inspection_id`, `op_id`, `actor_id`, `event_type`, `field_diffs_json`, `client_occurred_at`, `monotonic_ms`, `synced (BOOL)` |
| `sync_metadata` | Cursors & clock skew | `user_id (PK)`, `pull_cursor`, `last_successful_pull_at`, `estimated_clock_offset_ms`, `schema_migration_version` |
| `purge_ledger` | Non-PII compliance proof | `inspection_id (PK)`, `accepted_at`, `purged_at`, `purge_reason` (`ACCEPTED`, `POST_SUBMIT_TTL`, `REASSIGNED`, `REVOKED`), `confirmed_to_server (BOOL)` |

### Atomic Write & File Layout Rules
- **Atomic form edits**: Updating `inspections_local`, appending/coalescing an entry in `outbox_ops`, and recording `local_audit_events` occur inside a **single SQLite transaction**.
- **Atomic photo capture**: Write encrypted image + thumbnail to app-private non-cache directory (`<app_private>/users/<user_id>/media/<inspection_id>/`) using write-to-temp-then-rename; only after `fsync` succeeds, insert the `attachments` row inside a SQLite transaction.
- **No OS-evictable directories**: Never place unsynced photos or SQLite files in OS `Caches` or `tmp` directories. Mark all data directories excluded from cloud backup.

---

## 7. Sync Protocol

The protocol builds directly on the existing REST + integer record version architecture using additive endpoints and strict idempotency.

### Pull Protocol (Prefetch & Reconciliation)
1. **Delta List**: `GET /api/v1/inspections/sync?assigned_to=me&cursor=<pull_cursor>`
   - Returns: changed/new assigned inspections (`inspection_id`, `version`, `status`, `accepted_at`, `form_schema_id`, `form_schema_version`), plus `removed_ids` (reassigned, cancelled, or accepted inspections) and `next_cursor`.
   - Server response includes authoritative `Date` / `X-Server-Time` header to update `estimated_clock_offset_ms`.
2. **Detail Fetch**: For inspections where `server.version > local_snapshot.server_version` or not yet cached locally, `GET /api/v1/inspections/{id}` fetches full record + attachment metadata (and caches any missing `form_schemas`).
3. **Safe Local Reconciliation**:
   - If `inspections_local.sync_state == CLEAN`: overwrite `inspections_server_snapshot` and `inspections_local` atomically.
   - If `inspections_local` has unsynced local edits: update `inspections_server_snapshot` only when reconciling after push/conflict, or run local pre-check so the user is aware of status changes (e.g., `ACCEPTED` / `REASSIGNED`) without losing local draft data.

### Push Protocol (Two-Lane Outbox)
Separating lightweight structured mutations from heavy binary uploads prevents 40 photos from starving form saves and status updates on intermittent networks.

#### Lane 1: Structured Mutations (High Priority)
- `POST /api/v1/inspections/{id}/mutations`
  - **Headers**: `Idempotency-Key: <op_id>`, `X-Device-Id: <device_id>`, `X-Sync-Session-Id: <uuid>`, `Authorization: Bearer <token>`
  - **Body**:
    ```json
    {
      "base_version": 7,
      "op_type": "PATCH_FIELDS",
      "changed_fields": { "panel_condition": "corroded", "inspector_notes": "Water intrusion near SE wall" },
      "base_values": { "panel_condition": "ok", "inspector_notes": "" },
      "client_occurred_at": "2026-11-19T14:05:12Z",
      "estimated_clock_offset_ms": 420,
      "audit_events": [ ... ]
    }
    ```
  - **Server Behavior**:
    1. Check `idempotency_keys` table for `(actor_id, op_id)`. If already processed, return the exact stored response (`200` or `409`) without re-applying. (Critical for intermittent networks where the response drops after server commit.)
    2. Lock inspection row in DB transaction and compare `inspection.version` against `base_version`.
    3. If `version == base_version`: apply patch, increment `version`, write immutable `inspection_audit_events`, persist idempotency result, return `200 OK` with `{ new_version, server_snapshot }`.
    4. If `version > base_version`: invoke server-side Conflict Policy (Section 8). Either return `200 OK` with `{ new_version, merged_snapshot, auto_merged_fields }` or `409 Conflict` with full conflict payload.
    5. On `200 OK`, client atomically updates `inspections_server_snapshot`, advances `base_version` on remaining queued ops for that inspection, marks `op` as `ACKED`, and clears dirty flags for acknowledged fields.

#### Lane 2: Resumable Media Uploads (Bounded Concurrency)
- Runs concurrently with or immediately following draft mutation sync (max 2 parallel uploads on cellular, up to 4 on Wi-Fi).
- **Submission Ordering Invariant**: A `SUBMIT` mutation includes an `attachment_manifest` (list of non-deleted `attachment_id`s + SHA-256 hashes + signature `attachment_id` + `signed_content_hash`). The client withholds sending `SUBMIT` until all manifest attachments reach `UPLOADED`, and the server rejects `SUBMIT` (`422`) if any referenced attachment is missing or fails hash verification.

### Intermittent Connectivity & Error State Machine
- **Usable-Network Probe**: Before draining the outbox on OS network-change events, send a lightweight `HEAD /api/v1/health` (timeout ~5s) to avoid burning retries against captive portals or dead basement repeaters.
- **Per-Inspection Isolation**: Operations for the same `inspection_id` execute strictly FIFO; different inspections sync independently so a `409 Conflict` on Inspection A never blocks Inspection B.
- **Retry & Error Classification**:
  - *Transient (`timeout`, DNS, `429`, `5xx`)*: Exponential backoff with full jitter (`2s`, `4s`, `8s`, …, capped at `5m`); reset immediately on verified network reconnect.
  - *Auth (`401`)*: Pause sync engine globally, attempt silent refresh token exchange; if refresh fails, prompt user re-authentication while keeping all local data and outbox intact.
  - *Conflict (`409`)*: Mark op `BLOCKED_CONFLICT`, transition inspection to `CONFLICT`, notify user.
  - *Permanent Client/Validation Error (`400`, `422`)*: Mark op `FAILED_PERMANENT` (quarantine), surface actionable banner + emit telemetry alert; never retry infinitely.

---

## 8. Conflict Policy

Consistent with product requirements, **there is no collaborative editor**. Conflicts are resolved deterministically at sync time using 3-way comparison between `base_snapshot` (at `base_version`), `local_state`, and current `server_state`.

### Conflict Resolution Matrix

| Scenario | Detection Condition | Policy & System Behavior | Audit Requirement |
| :--- | :--- | :--- | :--- |
| **1. Clean Fast-Forward** | `server.version == base_version` | Apply local changes cleanly; increment `version`. | Record offline edits with dual timestamps. |
| **2. Disjoint Field Edits** | `server.version > base_version`; modified field sets on tablet and web have empty intersection; no terminal status change; no signed-field violation. | **Auto-merge** field-level changes on server; increment `version`; push merged state back to tablet with subtle info notice. | Log auto-merge event linking both actors' field changes and versions. |
| **3. Append-Only Collections (Photos / Log Notes)** | Both tablet and web added distinct UUID-keyed photos or timestamped notes. | **Union merge** if total photos <= 40. If combined count > 40, return `409 PHOTO_LIMIT_EXCEEDED` for user selection. | Record each added item with original actor & capture time. |
| **4. Overlapping Field Edit (Hard Conflict)** | Same field modified by both inspector offline and supervisor on web since `base_version` with different values. | Server returns **`409 FIELD_CONFLICT`** with `{ server_version, conflicts: [{ field, base_value, local_value, server_value, server_actor, server_updated_at }] }`. Tablet displays side-by-side resolution UI; user chooses value per field and submits `RESOLVE_CONFLICT` against the new `server_version`. | Log `CONFLICT_RESOLVED` with winning value, rejected value, resolver ID, and both source versions. |
| **5. Signature Integrity Conflict** | Offline signature exists (`signed_content_hash`), and supervisor edited any attested field on web since `base_version`. | **Never auto-merge.** Server returns **`409 SIGNATURE_CONFLICT`**. Inspector/supervisor must resolve field differences and re-collect signature (or follow compliance waiver workflow if defined in `D3`). | Log signature invalidation reason and subsequent re-signature artifact. |
| **6. Terminal / Reassignment Conflict** | Inspection became `ACCEPTED`, `CANCELLED`, or `REASSIGNED` on web while inspector edited offline. | Reject direct write to main inspection (`409 TERMINAL_STATE` / `409 REASSIGNED`). Server saves inspector's unsynced notes/photos to a **quarantined conflict addendum** (visible to supervisor for review) so field work is never silently discarded, unless `ACCEPTED` policy forbids late additions (in which case preserve locally until supervisor acknowledges or purge timer expires). | Log rejected offline submission attempt + addendum creation (if saved). |

### Web Safeguards (Low-Cost Conflict Reduction)
- Display a soft visual indicator on the supervisor web UI when an inspection is currently assigned and downloaded to a tablet (`Downloaded on Tablet — Offline edits may be in progress`), discouraging unnecessary concurrent edits without introducing brittle distributed locks.

---

## 9. Attachments (Up to 40 Photos & Signature)

### Capture, Processing & Storage Limits
- **In-App Isolation**: Camera capture writes directly into encrypted app-private storage; images are never saved to the OS photo library/gallery.
- **Image Processing Pipeline**:
  - Normalize orientation, resize longest edge to max `2048px`, compress to JPEG (~80% quality; typical size `0.8–1.5 MB`, ~`32–60 MB` for 40 photos).
  - Strip extraneous camera EXIF while retaining compliance-required metadata (capture timestamp, orientation, optional GPS if mandated) in `attachments.metadata_json`.
  - Generate an encrypted thumbnail (`~300px`, ~`30–50 KB`) for fast offline gallery rendering.
  - Compute SHA-256 hash over the final compressed payload immediately upon capture.
- **Quota & Disk Protection**:
  - Enforce hard cap of **40 active photos** per inspection (soft warning at 35/40; deleted photos don't count toward cap).
  - Pre-capture disk check: warn inspector when free disk space drops below `500 MB`; block new photo capture below `150 MB` so SQLite WAL commits never hit `ENOSPC`.
  - Optional LRU eviction of *already server-committed* full-resolution photo binaries (retaining thumbnails) under disk pressure while keeping all unsynced photos protected.

### Signature Capture & Immutability
- Capture vector stroke coordinates plus a rendered PNG (`<100 KB`), signer full name, signer role, client timestamp, and `signed_content_hash` (canonical SHA-256 of attested inspection fields).
- Signatures are immutable once captured: modifying attested fields locally invalidates the signature and requires a new signature capture; prior signatures remain recorded in audit history if already synced.

### Resumable Upload Architecture
1. **Init**: `POST /api/v1/inspections/{id}/attachments/init` with `{ attachment_id, kind, sha256, byte_size, mime_type, metadata }` and `Idempotency-Key`.
   - Server validates inspection access and 40-photo cap, checks if `(inspection_id, attachment_id)` is already committed (returns `ALREADY_COMMITTED` idempotently), or creates a staged record and returns a resumable upload session URL (e.g., `tus` endpoint or presigned S3/GCS multipart URLs).
2. **Chunked Transfer**: Client uploads in `512 KB` chunks (adaptive down to `128 KB` on high-error links), persisting `bytes_uploaded` / completed part ETags in SQLite after each chunk. Interruptions resume from the last confirmed offset.
3. **Commit & Verification**: `POST /api/v1/inspections/{id}/attachments/{attachment_id}/commit`
   - Server verifies uploaded object size, magic-byte MIME type, and SHA-256 match against the initialized hash; marks attachment `COMMITTED`; links it to the inspection; writes an audit entry.
4. **Orphan Garbage Collection**:
   - Server runs a periodic cleanup job deleting uncommitted staged blobs older than 7 days.
   - Client immediately removes local files for photos deleted prior to upload and wipes all local attachment binaries on acceptance/post-submission purge.

---

## 10. Security, Compliance & 24-Hour Local Purge

### Device & Data-at-Rest Security
- **MDM Prerequisites**: Company-managed tablets must have MDM enrollment, device passcode/biometric lock, OS full-disk encryption, and remote-wipe capability verified prior to enabling offline access.
- **Defense-in-Depth Encryption**:
  - SQLite encrypted via SQLCipher (AES-256).
  - Every photo, thumbnail, and signature encrypted on disk (AES-256-GCM) with per-user or per-inspection data keys wrapped by a master key in OS Keychain / Android Keystore (hardware-backed, `WhenUnlockedThisDeviceOnly`).
- **Leakage Prevention**:
  - Exclude app database and media directories from iCloud / Android Auto Backup / device backups.
  - Blur/mask app preview in OS task switcher.
  - Strip all customer PII, addresses, notes, signer names, and photo bytes from logs, crash dumps, and analytics payloads.
  - Enforce TLS 1.2+ with certificate validation (and optional pinning via MDM-managed config).

### Authentication & Lost/Revoked Devices
- **Offline Unlock**: Local encrypted data remains accessible offline after initial login, gated by local biometric/PIN re-authentication after an inactivity timeout (e.g., 15–30 minutes).
- **Token Expiration**: Expired OAuth access tokens pause sync and prompt re-login without deleting local unsynced data.
- **Revocation / Lost Tablet**: If an employee is offboarded or a tablet is reported lost, IT triggers MDM remote wipe **and** server revokes the device/session. If the app reaches the server while revoked (`403 DEVICE_REVOKED`), it immediately destroys local encryption keys and wipes all local customer data.

### Regulatory Audit History
- **Immutable Server Audit Store**: Append-only database table (`inspection_audit_events`) with DB-level permissions forbidding `UPDATE` and `DELETE` by application roles.
- **Captured Fields**: `event_id`, `inspection_id`, `actor_id`, `actor_role`, `channel` (`tablet_offline`, `tablet_online`, `web`), `device_id`, `client_occurred_at`, `estimated_clock_offset_ms`, `server_recorded_at`, `base_version`, `new_version`, `event_type`, `before_after_diff_json`, `attachment_sha256` (for media/signatures), `idempotency_key`.
- **Fail-Closed Guarantee**: Server inspection mutations and audit log inserts execute in the same database transaction—no mutation can succeed without its audit record.

### 24-Hour Post-Acceptance Local Purge
To meet the regulatory requirement of removing local customer data within 24 hours after an inspection is accepted—even under intermittent connectivity—the system uses **three layered controls**:

1. **Layer 1 — Early Post-Submission Purge (Recommended in `D1`)**: Once an inspection is `SUBMITTED` and all mutations + attachments are server-confirmed (`local_dirty == false`, zero pending outbox ops), purge local customer data promptly (immediately or after a short read-only grace window, e.g., 4 hours). If a supervisor later returns the inspection for rework, the tablet simply re-downloads it on next sync.
2. **Layer 2 — Acceptance-Triggered Purge**: For any inspection still present on the tablet when `status = ACCEPTED` arrives via sync (or optional silent push wake-up), set `purge_deadline_at = accepted_at + 24h` and execute purge **immediately** once no unsynced local changes exist (or if `accepted_at` is already approaching/past deadline, force purge and log compliance exception).
3. **Layer 3 — Clock-Tamper-Resistant Local Sweeper & Server Compliance Monitor**:
   - A local background sweeper runs on app launch, foreground, and periodic OS background tasks. Deadlines are tracked with both wall-clock UTC and **monotonic uptime delta** so rolling back the tablet clock cannot delay deletion.
   - **Purge Procedure** (executed per inspection):
     1. Unlink encrypted photo files, thumbnails, and signature files (destroying per-inspection key if per-inspection key wrapping is used).
     2. Delete customer rows from `inspections_local`, `inspections_server_snapshot`, `attachments`, synced `local_audit_events`, and acked `outbox_ops` with `PRAGMA secure_delete = ON`.
     3. Run `PRAGMA wal_checkpoint(TRUNCATE);` (and periodic `VACUUM` when idle/charging) to eliminate residual pages in WAL/freelist.
     4. Clear in-memory caches and HTTP response caches for the inspection.
     5. Record a non-PII entry in `purge_ledger` and send `POST /api/v1/devices/purge-confirmations` to the server.
   - **Server SLA Alerting**: Track every `(device_id, inspection_id)` downloaded to a tablet. If an inspection reaches `ACCEPTED` and a tablet has not reported a purge confirmation within **18 hours**, trigger an operational warning (notify supervisor/IT to bring tablet online); at **24 hours**, escalate to compliance/IT (MDM check-in or remote wipe).

---

## 11. Migration & Backfill

### Client-Side Migration (Read-Through Cache -> Offline-First Store)
1. **Zero-Loss Upgrade Path**:
   - Ship the encrypted offline-first schema behind a versioned migration runner executed synchronously before UI render (with a brief upgrade progress screen).
   - If the existing SQLite read-through cache is unencrypted: create a new SQLCipher-encrypted database, copy any durable state via `sqlcipher_export` (or rebuild snapshot cleanly from server if existing DB is purely ephemeral cache with zero unsaved drafts), verify with `PRAGMA integrity_check`, atomically swap files, and securely delete the old unencrypted `.db`, `-wal`, and `-shm` files.
   - Guard against partial migration crashes: keep the migration idempotent so restarting the app cleanly finishes or retries without corrupting storage.
2. **Mixed-Fleet Compatibility**:
   - Tablets not yet upgraded (or without the pilot feature flag) continue using existing online REST endpoints seamlessly while backend migrations roll out.

### Server-Side Migration & Backfill (Expand-Contract)
1. **Additive Schema Migrations (Zero Downtime)**:
   - Add `idempotency_keys`, `inspection_audit_events`, `attachment_uploads`, `device_inspection_downloads`, and `purge_confirmations` tables.
   - Ensure `inspections.version` is `NOT NULL` integer (backfill any null/missing versions to `1`).
   - Add `accepted_at` timestamp column to `inspections` (if not already present) and backfill historical accepted inspections from existing status-history/updated-at records, tagging backfilled rows cleanly.
2. **Unified Audit & Version Hook**:
   - Update existing web and legacy mobile REST endpoints so *every* write increments `inspections.version` and writes to `inspection_audit_events` inside the same DB transaction. This guarantees supervisor web edits and tablet sync mutations share a single consistent version and audit timeline.
3. **Attachment Metadata Backfill**:
   - Backfill `sha256` and `byte_size` for existing active (non-accepted) inspection attachments via a low-priority background job (or lazily on first prefetch) so offline clients can verify downloaded media.

---

## 12. Observability & Operations

### Privacy-Safe Client Telemetry
- Store structured diagnostic events in a bounded local ring buffer (e.g., max 5 MB), strictly scrubbed of customer PII, notes, addresses, and media content, and flush in batches when online.
- Propagate correlation headers (`X-Device-Id`, `X-Sync-Session-Id`, `Idempotency-Key`, `X-App-Version`) across all sync and attachment requests.

### Core SLIs, Dashboards & Alerts

| Category | Metrics / SLIs | Alert / Action Threshold |
| :--- | :--- | :--- |
| **Durability & Sync** | Confirmed unsynced data-loss reports; sync success rate; p50/p95 sync latency post-reconnect; oldest pending outbox item age; `FAILED_PERMANENT` quarantined op count | Any confirmed data-loss event (P0); quarantined ops > 0 (page/triage); outbox age > 24h for active online device |
| **Media Pipeline** | Attachment upload success rate; chunk resume rate; SHA-256 mismatch count; uncommitted orphan count; client low-storage warning frequency | SHA-256 mismatch > 0 (investigate corruption); upload failure rate > 2% over 15m |
| **Conflicts** | Conflict rate per 100 synced inspections; auto-merge vs. manual conflict ratio; signature-invalidation conflict count; median conflict resolution time | Manual conflict rate spike (e.g., > 5%); any unexpected `5xx` during conflict merge |
| **Compliance & Purge** | % of accepted inspections with server-confirmed local purge < 24h; overdue purge count (>18h, >24h); audit log write error count | Audit write error > 0 (P0, fail-closed); device overdue > 18h (ops warning), > 24h (compliance escalation) |
| **Client Health** | SQLite migration success rate; crash-free session rate; SQLCipher open errors; local disk usage p95 | Migration failure rate > 0.1%; spike in DB open/corruption errors |

### Support & Diagnostic Tooling
- **In-App Sync Diagnostics Screen** (non-PII): Displays app version, offline mode flag status, queued op count, photo upload progress, last successful sync timestamp, free storage, and a **"Copy/Upload Diagnostics Bundle"** button for IT support.
- **Server Support View**: Shows device sync history, active downloaded inspections, purge confirmation status, and quarantined mutations for rapid pilot triage.

---

## 13. Staged Rollout

Progression between stages is strictly **metric-gated** (not schedule-driven), controlled via server-evaluated feature flags scoped by user/office and enforced by minimum app version checks.

### Rollout Stages

1. **Stage 0: Internal Dogfood / Dark Launch**
   - **Audience**: Engineering, QA, and internal operations staff on managed test tablets.
   - **Activities**: Real physical dead-zone testing (basements, parking structures, elevators); end-to-end conflict drills with web supervisors; forensic purge verification.
   - **Exit Gate**: Zero data-loss incidents; 100% pass on chaos, migration, and forensic purge suites; all P0/P1 defects resolved.

2. **Stage 1: Controlled Field Pilot**
   - **Audience**: Small volunteer cohort of field inspectors and their corresponding supervisors (e.g., 1–2 offices/districts) using production workflows.
   - **Activities**: Dedicated pilot feedback channel; daily telemetry and conflict review; verify inspector training and supervisor web workflow.
   - **Exit Gate**:
     - Zero confirmed data-loss incidents across pilot inspections.
     - 100% of accepted pilot inspections achieve confirmed local purge within 24 hours.
     - Sync completion rate >= 99.5% upon reconnect (zero unresolved stuck/quarantined inspections).
     - Manual conflict rate and signature-conflict frequency within acceptable operational bounds validated with Product & Field Ops.
     - Attachment upload success rate >= 99% across 40-photo inspections.
     - Positive/acceptable inspector and supervisor UX sign-off.

3. **Stage 2: Expanded Rollout**
   - **Audience**: Progressive expansion across remaining offices/cohorts (e.g., 25% -> 50% of active inspectors).
   - **Activities**: Validate backend throughput (presigned upload bandwidth, DB write load on audit/idempotency tables), monitor conflict patterns across diverse supervisor teams.
   - **Exit Gate**: Stable SLIs across cohorts; backend latency & error budgets healthy; support ticket volume within steady-state capacity.

4. **Stage 3: General Availability (100%)**
   - **Audience**: Full managed tablet fleet.
   - **Activities**: Enable feature flag globally; enforce minimum app version via MDM; deprecate and eventually remove legacy online-only write paths once legacy traffic reaches zero.

---

## 14. Rollback Strategy

Rolling back an offline-first mobile feature requires special care: **a rollback must never strand or wipe unsynced field work sitting on tablets**.

### Three-State Feature Flag Kill Switch
1. **`OFFLINE_FULL`**: Normal offline authoring, prefetch, and sync enabled.
2. **`OFFLINE_DRAIN_ONLY` (Primary Incident Rollback)**:
   - Immediately prevents opening *new* offline-only workflows or prefetching additional inspections, reverting new inspections to online-only behavior.
   - **Keeps the outbox, resumable upload engine, conflict resolver, and 24h purge engine active** so every tablet with pending local edits/photos drains cleanly to the server without data loss.
3. **`ONLINE_LEGACY` (Complete Client Fallback)**:
   - Automatically activates per device **only after** `outbox_ops` has zero unacknowledged mutations and zero pending attachments.

### Server & Fleet Rollback Controls
- **Expand-Contract Backend Safety**: Because all backend schema and API changes are strictly additive, server binaries can roll back without dropping columns/tables or breaking deployed pilot tablets. Keep `idempotency_keys` and integer-version checks active even during rollback so client retries stay safe.
- **Attachment Pipeline Fallback**: If resumable object-storage uploads fail due to provider/configuration issues, pause media uploads cleanly (preserving local files and retry backoff) without blocking structured form mutations.
- **MDM App Downgrade Rule**: Never push an app binary downgrade via MDM until server telemetry confirms affected devices have zero pending unsynced inspections (or explicit supervisor sign-off is obtained), as older app versions cannot read the encrypted offline-first schema.
- **Quarantined Mutation Recovery**: Provide an admin-assisted recovery runbook to inspect and replay or manually reconcile any `FAILED_PERMANENT` outbox operations without losing inspector notes.

---

## 15. Testing Strategy

| Test Layer | Scope & Key Scenarios | Pass Criteria |
| :--- | :--- | :--- |
| **Unit & Property-Based Tests** | 3-way merge logic (disjoint fields, overlapping fields, append-only photo union, 40-photo cap overflow, signature invalidation, terminal states); outbox FIFO & backoff scheduler; SHA-256 & canonical hash determinism; clock-skew math. | 100% branch coverage on merge & state-machine transitions; property tests confirm merge determinism and idempotency. |
| **Durability & Crash-Kill Tests** | Hard process kill / simulated battery pull mid-form edit, mid-photo save, mid-SQLite migration, mid-outbox commit, and mid-purge. | Zero SQLite corruption (`integrity_check` passes); zero lost committed notes or photos; clean recovery on restart. |
| **Network Chaos & Fault Injection** | Airplane-mode toggles; captive portal (`200` HTML redirect); high packet loss / throttled link; TCP drop mid-chunk on photo 23 of 40; server commits write then drops response (retry hits `Idempotency-Key`); `429`/`503` bursts; `401` token expiry mid-sync. | Zero duplicate mutations or duplicate photos; uploads resume without restarting from photo 1; expired token pauses sync without data loss. |
| **Dual-Client Concurrency E2E** | Automated tablet + web tests: disjoint web edit during offline work; overlapping field edit; supervisor edit after offline signature; supervisor accepts or reassigns inspection while tablet offline; multi-round conflict resolution. | Exact match with Conflict Policy matrix; audit log contains full lineage of both actors and resolution. |
| **Scale, Storage & Performance** | Multiple prefetched inspections each with 40 full-res photos + signature; low-disk-space simulation (<500 MB and <150 MB thresholds); background upload battery/memory profiling. | Smooth UI scrolling (<16ms frame drops avoided via thumbnails); graceful storage warnings/blocks before `ENOSPC`; zero OOM crashes. |
| **Security & Forensic Compliance** | Inspect raw SQLite file, `-wal`, `-shm`, app filesystem, OS photo gallery, backup exclusions, and log outputs before and after 24h purge; test system clock rollback; verify SQLCipher encryption and Keychain/Keystore locking. | Zero recoverable customer PII strings or image bytes after purge; clock rollback cannot bypass purge; zero photos in OS gallery; zero PII in logs. |
| **Migration & Upgrade Tests** | Upgrade from legacy read-through-cache DB (empty, populated, stale, and interrupted-upgrade states) to encrypted offline-first DB across supported tablet OS versions. | 100% clean migration with zero startup crashes and secure removal of unencrypted legacy DB files. |
| **Physical Field Dry Run** | Walk managed tablets into real basement/garage dead zones, execute full 40-photo + signature inspections, return intermittently to weak cellular/Wi-Fi, test supervisor web edits concurrently. | All field workflows succeed cleanly before Stage 1 pilot launch. |

---

## 16. Milestone Sequence, Dependencies & Acceptance Criteria

Milestones are ordered strictly by technical and product dependencies. *(No arbitrary dates or staffing assumptions are included; delivery pacing should be sized by the owning engineering teams after M0 scope freeze.)*

```text
M0 (Decisions & Contracts)
 ├──> M1 (Backend Sync, Audit & Media APIs) ──────────┐
 └──> M2 (Mobile Encrypted Store & Offline Authoring) ├──> M3 (Sync Engine, Conflicts & Uploads)
                                                            └──> M4 (Purge, Security Hardening & Observability)
                                                                  └──> M5 (Chaos/Compliance QA & Dogfood)
                                                                        └──> M6 (Staged Pilot -> GA Rollout)
```

### M0: Pre-Implementation Alignment & Architecture Freeze
- **Dependencies**: None.
- **Deliverables**:
  - Written sign-off on Decisions `D1`–`D9` (especially Legal sign-off on `D1`, `D3`, `D9`).
  - OpenAPI specification for additive REST sync, attachment init/commit, and purge-confirmation endpoints.
  - Formal 3-way merge specification and form-schema versioning contract.
  - Mobile technical verification of SQLCipher, OS Keychain/Keystore, and background upload behavior on target managed tablets.
- **Acceptance Criteria**: All 9 decisions documented with accountable owners; backend, mobile, security, and legal approve the sync/purge/audit contract.

### M1: Backend Foundations (Additive Sync APIs, Audit & Media)
- **Dependencies**: M0.
- **Deliverables**:
  - Additive DB migrations (`idempotency_keys`, `inspection_audit_events`, `attachment_uploads`, `device_inspection_downloads`, `purge_confirmations`, `accepted_at` / `version` backfills).
  - Delta pull endpoint, idempotent mutation endpoint with integer-version optimistic locking + 3-way conflict detection, resumable attachment init/commit endpoints with SHA-256 validation, and purge-confirmation endpoint.
  - Unified version increment & append-only audit logging across existing web and legacy mobile endpoints.
  - Server-side orphan upload cleanup job.
- **Acceptance Criteria**:
  - Automated integration tests prove idempotent retries produce zero duplicate writes or false `409`s.
  - Every mutation (web, legacy mobile, offline sync) atomically writes an immutable audit entry and increments `version`.
  - Legacy mobile and web clients pass regression suite unchanged against upgraded backend.

### M2: Mobile Encrypted Local Store & Durable Offline Authoring
- **Dependencies**: M0.
- **Deliverables**:
  - Safe migration from unencrypted read-through SQLite cache to SQLCipher-encrypted 3-plane schema (`WAL`, `secure_delete=ON`, Keychain/Keystore key management).
  - Prefetch/download flow with offline readiness indicators and cached form schemas.
  - Atomic offline form editing, in-app camera capture (<=40 photos with resize/compression, SHA-256, thumbnails, storage guardrails, zero gallery leakage), and offline signature capture with `signed_content_hash`.
- **Acceptance Criteria**:
  - Crash/kill-9 tests mid-edit and mid-photo capture demonstrate **zero lost notes or corrupted DBs**.
  - Inspector can complete an entire assigned inspection (form + 40 photos + signature) in airplane mode from cold app launch.
  - Legacy cache upgrade test passes with legacy unencrypted DB securely deleted.

### M3: Sync Engine, Resumable Uploads & Conflict Resolution UX
- **Dependencies**: M1, M2.
- **Deliverables**:
  - Two-lane background/foreground sync engine with captive-portal probe, per-inspection FIFO isolation, and jittered exponential backoff.
  - Resumable chunked upload worker for 40 photos + signature with SQLite offset persistence and manifest-verified submission.
  - Conflict resolution UI for overlapping fields, photo-cap conflicts, signature-invalidation conflicts, and terminal/reassignment states.
  - Offline re-unlock and expired-token pause/re-auth flow; soft web warning indicator for active tablet downloads.
- **Acceptance Criteria**:
  - Dual-client E2E tests pass for all 6 scenarios in the Conflict Policy matrix.
  - Network fault-injection tests confirm mid-upload drops on 40-photo inspections resume cleanly and never corrupt or duplicate uploads.
  - Token expiry during offline work never discards local mutations.

### M4: 24-Hour Purge Engine, Security Hardening & Observability
- **Dependencies**: M1, M3.
- **Deliverables**:
  - Layered purge engine (post-submission early purge per `D1`, acceptance-triggered purge, clock-tamper-resistant sweeper, `secure_delete` + WAL truncation + file deletion + `purge_ledger` reporting).
  - Leakage hardening (backup exclusions, task-switcher blur, PII log scrubbing, device revocation wipe).
  - Privacy-safe client telemetry buffer, server dashboards, SLI alerts (including >18h / >24h purge compliance alerts), in-app diagnostics screen, and 3-state feature-flag rollback controls (`OFFLINE_FULL` / `OFFLINE_DRAIN_ONLY` / `ONLINE_LEGACY`).
- **Acceptance Criteria**:
  - Forensic test confirms zero recoverable customer PII or image data in SQLite, WAL, filesystem, gallery, or logs post-purge.
  - Clock-rollback test confirms purge deadline still fires on time.
  - Flipping flag to `OFFLINE_DRAIN_ONLY` drains existing dirty inspections cleanly before falling back to online mode.

### M5: Verification, Chaos Testing & Internal Dogfood (Stage 0)
- **Dependencies**: M4.
- **Deliverables**:
  - Full automated chaos, durability, scale (40 photos × multi-inspection), security, and migration test runs.
  - Physical dead-zone dogfood exercise on company-managed tablets.
  - Support runbooks, inspector quick-start guide, and supervisor conflict handling guide.
- **Acceptance Criteria**:
  - 100% pass across compliance, forensic purge, and data-loss chaos suites.
  - Stage 0 exit gates met with zero open P0/P1 defects.

### M6: Staged Pilot & General Availability Rollout (Stages 1–3)
- **Dependencies**: M5.
- **Deliverables**:
  - Stage 1 controlled pilot launch, metric review, and pilot retrospective adjustments.
  - Stage 2 progressive cohort expansion.
  - Stage 3 GA enablement and legacy online-only write-path deprecation.
- **Acceptance Criteria**:
  - Stage 1 pilot meets all quantitative promotion gates (zero data loss, 100% <24h purge confirmation on active tablets, >=99.5% reconnect sync completion, acceptable conflict UX).
  - Stage 2 & 3 achieve target SLIs at full fleet load with zero unresolved compliance escalations.
