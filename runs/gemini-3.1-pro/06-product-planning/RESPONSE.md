# Summary of the Three Riskiest Assumptions

Based on the product brief and the architecture defined in `PLAN.md`, the following three assumptions present the highest product, engineering, and regulatory risks to the project:

---

### 1. Assumption: Intermittent Connectivity Windows are Sufficient to Synchronize Large Media Volumes (Up to 40 Photos per Inspection)

* **The Risk**: Each inspection permits up to 40 photos. Uncompressed camera captures easily reach 400–600 MB; even with aggressive client-side compression (max 2048px, JPEG 82%), the media payload remains substantial (35–45 MB per inspection). Inspectors spend hours in zero-signal basements and experience highly degraded, flapping, or captive-portal connectivity when returning to street level or transiting between sites. Assuming that brief, intermittent connectivity bursts are adequate to upload tens of megabytes of media assumes high connection stability and bandwidth.
* **Potential Failure Mode**: If cellular connections flap or reset frequently, standard HTTP uploads will abort repeatedly, creating runaway network retries, severe battery drain in the field, and ballooning outbox queues. Inspections will remain stuck in "Syncing" state, preventing supervisors from completing reviews on time and frustrating inspectors.
* **Validation & Mitigation in Plan**: 
  * Implements a **strict two-phase sync protocol**: Form data, checklist notes, and legal signatures (small JSON payloads < 100 KB) are synced in Phase 1 within milliseconds of reconnection, ensuring the inspection core is safe immediately.
  * Media upload (Phase 2) uses **direct-to-object-storage presigned URLs with resumable chunked streaming** (TUS / S3 Multipart via OS background workers) so interrupted photo uploads resume from the exact byte offset rather than restarting.
  * The beta pilot depot specifically benchmarks upload throughput, battery consumption, and completion rates in known signal-dead districts.

---

### 2. Assumption: Field-Level Domain Partitioning Can Prevent Concurrency Collisions Without a Real-Time Collaborative Editor

* **The Risk**: Product explicitly rejected a full collaborative editor (such as CRDTs or Operational Transformation), yet supervisors regularly edit inspections on the web console while inspectors work offline on tablets. The plan assumes that field inspectors and web supervisors operate on largely disjoint field sets, or that a deterministic domain-partitioned 3-way merge (where the inspector’s physical on-site findings take precedence for checklist items, while supervisors retain authority over administrative fields) will satisfy business and operational needs.
* **Potential Failure Mode**: If supervisors actively correct checklist notes, adjust severity ratings, or modify inspection scopes while an inspector is underground, a naive REST version mismatch (`409 Conflict`) would block the inspector from submitting hours of work. Conversely, automatic inspector precedence could silently overwrite supervisory corrections or policy overrides, generating supervisor distrust or audit inconsistencies. Furthermore, if a supervisor reassigns or cancels an inspection while an inspector is offline completing it, the inspector's legal submission could be stranded or rejected.
* **Validation & Mitigation in Plan**:
  * Adopts a **domain-partitioned 3-way merge engine** that auto-merges disjoint field edits and provides a **non-blocking inspector upload guarantee**: field findings from physical presence are never dropped or rejected.
  * In the event of direct field collisions, the inspector's finding is committed, the supervisor's edit is preserved in the immutable audit log, and the web portal presents an **asynchronous Diff Drawer** notifying the supervisor to review and reconcile the discrepancy.
  * If an inspection was cancelled or reassigned remotely, the inspector’s upload is preserved in a `SUBMITTED_DETACHED` state for administrative review.
  * Pilot metrics monitor collision frequency to confirm the hypothesis that field collision rates remain below 3%.

---

### 3. Assumption: Mobile Operating Systems Can Reliably Enforce the Regulatory 24-Hour Post-Acceptance Local Data Purge

* **The Risk**: Regulations mandate that all local customer data (PII, signatures, and photos) must be removed from the tablet within 24 hours after an inspection is accepted. The plan relies on client-side background workers and device scheduling to execute this secure deletion. However, mobile operating systems (Android Doze mode, iOS Background App Refresh) aggressively suspend or terminate background tasks when battery is low, memory is constrained, or the application is force-closed. Moreover, inspectors frequently power down company tablets over weekends or leave them offline in transit vehicles for multiple days.
* **Potential Failure Mode**: A tablet notified on Friday afternoon of inspection acceptance that is subsequently turned off or placed in a deep sleep state will fail to execute the 24-hour background purge worker on time. A regulatory device inspection on Monday morning could discover lingering unencrypted customer PII, signatures, or photos on the filesystem, triggering severe statutory non-compliance penalties, fines, or audit failures.
* **Validation & Mitigation in Plan**:
  * Implements a **multi-layered, failsafe purge architecture**:
    1. Background workers execute every 60 minutes when the device is active.
    2. A mandatory **synchronous app-launch purge gate**: On every application startup, before any user interface or database query is served, all records where `current_time >= purge_deadline` are purged immediately.
    3. **Cryptographic zeroization**: Application-level SQLCipher database encryption and sandbox file shredding ensure that once encryption keys or records are wiped, raw disk blocks contain zero recoverable plaintext data.
    4. Hardware monotonic uptime tracking prevents device clock rollback tampering.
    5. Local audit logs record a `DATA_PURGED` event with verification timestamps transmitted to the backend compliance telemetry dashboard upon the next connection.
