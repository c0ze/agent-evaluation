# Summary of the Three Riskiest Assumptions

Based on the requirements in `BRIEF.md` and the implementation architecture in `PLAN.md`, the three riskiest assumptions for adding offline capabilities to the building inspection app are summarized below:

---

### 1. Assumption: Intermittent Connectivity Windows are Sufficient for 40-Photo Uploads Without Severe Battery Drain or Operational Delays
* **The Assumption**: Field inspectors working in subterranean basements will reliably encounter sufficient cellular or Wi-Fi connectivity windows (e.g., stairwells, vehicle transit, depot return) to transfer up to 40 photos per inspection without manual intervention or system failure.
* **Why It Is Risky**: Modern tablet cameras produce high-resolution images (5–15 MB raw each). Even when compressed on-device to ~600 KB, 40 photos represent ~25–30 MB of binary data per inspection. Cellular connectivity at building perimeters or in moving vehicles is notoriously flaky (high packet loss, 2G/EDGE speeds, frequent radio dropouts). If the synchronization engine attempts continuous uploads over degraded links, the cellular radio will remain at maximum power, rapidly draining tablet batteries before a shift ends. Furthermore, stalled uploads delay supervisor review, creating operational bottlenecks.
* **Mitigation Strategy in Plan**: 
  1. Decoupled two-tier sync: form metadata syncs immediately in seconds (<50 KB), while media syncs asynchronously in the background.
  2. Aggressive on-device image optimization (downscaling to max 2048px, 80% JPEG compression, metadata stripping).
  3. Resumable, chunked multipart uploads with SHA-256 deduplication.
  4. Concurrency throttling (maximum 2 parallel streams) and exponential backoff with jitter to protect battery life and radio health.

---

### 2. Assumption: Concurrent Supervisor Web Edits and Offline Field Work Can Be Harmonized Without a Collaborative Editor or Unacceptable Data Loss
* **The Assumption**: Supervisors editing inspections via the web portal and inspectors editing offline in basements can coexist using existing integer REST versioning and automated merging, without requiring a full real-time collaborative editor (CRDTs/OT) and without causing destructive data conflicts.
* **Why It Is Risky**: Product explicitly rejected a full collaborative editor, yet business operations permit supervisors to edit the same inspection from the web. If an inspector enters a basement with integer record version 3, and a supervisor modifies the inspection on the web (advancing the server to version 4), an optimistic concurrency clash is guaranteed when the inspector reconnects. If conflict resolution is too aggressive (Last-Write-Wins), critical field observations or supervisor compliance edits will be silently destroyed, creating legal and regulatory liability. Conversely, if the server strictly rejects conflicted submissions (HTTP 409), field inspectors will be blocked from submitting completed work.
* **Mitigation Strategy in Plan**:
  1. Advisory/soft checkout locking on the web portal: displaying a clear warning to supervisors when an inspection is checked out offline by an inspector in the field.
  2. Server-side three-way field-level merge algorithm for disjoint field edits.
  3. Clear domain authority rules: on-site inspector observations take precedence for physical checklist items and photos, while supervisor edits to non-overlapping administrative fields are preserved.
  4. Non-destructive conflict handling: conflicting supervisor edits are staged in an audit table and flagged with a web notification for supervisor review rather than dropped.

---

### 3. Assumption: The 24-Hour Regulatory Customer Data Purge Can Be Reliably Enforced and Forensically Verified on Disconnected Mobile Hardware
* **The Assumption**: Client-side background execution and device lifecycle states will reliably execute and verify the complete destruction of local customer PII, signatures, and photos within strictly 24 hours of server acceptance.
* **Why It Is Risky**: Mobile tablets are semi-connected, client-controlled edge devices subject to OS constraints outside the application's direct control. Tablets may be turned off at the end of a shift, stored in vehicles or metal lockers over weekends without cellular service, or subjected to aggressive OS battery-saving mechanisms (such as Android Doze or iOS background task throttling) that terminate background workers. If the 24-hour regulatory timer expires while the tablet is offline, powered down, or suspended, sensitive customer data remains on the device, exposing the business to severe regulatory penalties. Furthermore, standard filesystem unlinks do not overwrite flash memory, leaving data potentially recoverable by forensic tools.
* **Mitigation Strategy in Plan**:
  1. Dual-control failsafe timer: the server passes `accepted_at` and `purge_deadline_at` during synchronization; the tablet enforces this deadline locally, even if completely offline when the deadline arrives.
  2. Boot/launch-level guard: a startup interceptor checks purge deadlines before permitting any user interaction, ensuring that sleeping or newly powered-on devices immediately purge expired data.
  3. Cryptographic shredding: overwriting image and signature files with random bytes prior to unlinking, scrubbing SQLite PII fields, and executing incremental vacuuming.
  4. Verifiable audit receipts: generating a cryptographically signed purge receipt that is queued in the mutation table and transmitted to the server as proof of compliance upon reconnection.
