# Three Riskiest Assumptions in the Offline Inspection Sync Plan

Based on `BRIEF.md` and the architecture defined in `PLAN.md`, the three riskiest assumptions—where a false premise could cause data loss, regulatory non-compliance, or major scope creep—are detailed below along with validation steps and fallback designs.

---

## 1. Regulatory 24-Hour Data Purge vs. Offline Tablet Availability (Assumption A7)

### The Assumption
Regulations require removing local customer data within 24 hours after an inspection is **accepted** on the server. Our baseline assumption is either that tablets reconnect within 24 hours of supervisor acceptance to receive the `Accepted` trigger, **or** that product/operations permit proactively purging local customer data on a short timer (e.g., within 12 hours) once a `Submitted` inspection has fully synced to the server.

### Why It Is a Top Risk
If an inspector finishes an inspection at 15:00 on Friday, the tablet syncs the submission in the parking lot at 15:10, the inspector turns the tablet off (or leaves it in an underground office) for the weekend, and the supervisor clicks **Accept** on the web at 16:00 on Friday, the tablet has no network path to learn that `Accepted` occurred. By Saturday at 16:01, customer PII and photos sitting on that offline tablet violate the 24-hour regulatory mandate—exposing the company to compliance penalties during an audit.

### How to Validate & Mitigation in `PLAN.md`
- **Pre-Implementation Validation (Decision D2):** Confirm with Legal/Compliance and Product during Milestone 0 whether inspectors ever require offline access to an inspection *after* it has been signed, submitted, and 100% synced to the server.
- **Built-In Architectural Safeguard:** `PLAN.md` implements a **Dual-Trigger Purge**:
  1. Immediately delete local photo binaries and scrub customer PII within 12 hours of confirmed `Submitted` sync (`outbox` empty and all attachments `VERIFIED` on server)—even before the supervisor clicks `Accept`.
  2. If the tablet is still online/awake when `Accepted` occurs, purge immediately (bounded at < 24 hours) and send a cryptographic `LOCAL_DATA_PURGED` receipt to the server. If the server does not receive a purge receipt within 20 hours of acceptance, it triggers an MDM wake/wipe alert.

---

## 2. Pre-Basement Connectivity for Inspection Assignment Pre-Fetch (Assumption A1)

### The Assumption
Inspectors have network connectivity for at least a brief window *after* an inspection is assigned to them and *before* they walk into a zero-signal basement, allowing the tablet to pre-fetch the assigned inspection record, customer details, and form schema.

### Why It Is a Top Risk
The brief notes that *"Today, a lost connection after opening an inspection can discard notes"* and that inspectors *"need to open assigned inspections... offline."* If dispatch assigns an inspection while the inspector is already inside a dead-zone basement—or if the inspector previously had to open each inspection manually online to trigger the read-through cache—then an inspector arriving in a basement without pre-fetched data will be completely blocked from opening the assigned inspection offline. Furthermore, if local form templates/schemas are not pre-cached, the tablet cannot render the form offline.

### How to Validate & Mitigation in `PLAN.md`
- **Pre-Implementation Validation (Decision D4):** Shadow field dispatch workflows before Milestone 1 to verify when assignments are created relative to basement entry, and whether inspectors ever start an inspection on-site before dispatch creates the assignment record.
- **Built-In Architectural Safeguard:**
  1. Replace lazy read-through caching with **Proactive Background Pre-Fetching** of all assigned inspections and all active master form schemas as soon as the tablet has any connectivity, paired with an explicit **"Ready for Offline" badge** on the assignment list.
  2. **Fallback if Assumption Fails:** If field discovery reveals that inspectors must occasionally start an inspection in a basement before receiving the server assignment payload, add a lightweight **"Start Provisional Offline Inspection"** flow using pre-cached master form schemas and an offline job/building code, which reconciles and binds to the server assignment ID once connectivity returns.

---

## 3. Low Field-Level Contention Between Web Supervisors and Offline Inspectors (Assumption A4)

### The Assumption
While supervisors can edit the same inspection from the web while an inspector works offline, their edits rarely collide on the exact same discrete checklist fields at the same time (e.g., supervisors mostly edit scheduling, access notes, or review sections, while inspectors record physical observations), OR supervisors do not structurally mutate the inspection (reassigning it, changing its form template, or accepting it) while the inspector is still capturing offline data.

### Why It Is a Top Risk
Product explicitly ruled out a full collaborative editor (no CRDTs/OT) and the server uses a single integer `version` per inspection record. If supervisors routinely edit the exact same checklist items simultaneously, or if they reassign/cancel/accept an inspection while an inspector is spending 3 hours taking 40 photos and collecting a signature in a basement:
1. Naive optimistic concurrency (`version` check on the whole inspection record) would reject 100% of offline inspector syncs with `409 Conflict` even when unrelated fields were changed.
2. Worse, if a supervisor edits inspection terms *after* `base_version` while a customer signs the tablet offline against `base_version`, the signature's legal integrity is compromised.

### How to Validate & Mitigation in `PLAN.md`
- **Pre-Implementation Validation (Decisions D1, D3, D5):** Query production server audit logs/database timestamps before Milestone 1 to measure how often—and on which specific fields—supervisors edit inspections that are currently `In Progress` by an inspector.
- **Built-In Architectural Safeguard:**
  1. **Three-Way Field-Level Merge (`Base`, `Local`, `Server`):** Rather than failing the whole inspection when `server.version > base_version`, non-overlapping field edits merge automatically without user friction, and concurrent free-text notes auto-append with attribution so zero notes are ever lost.
  2. **Signature Digest Binding & Salvage Bundles:** Signatures are cryptographically hashed against the exact `working_payload_json` signed offline, and if a supervisor cancels or reassigns an inspection while the inspector is offline, the tablet uploads all offline notes and photos into a **Salvage Bundle** and appends the offline events to the regulatory audit log so field work is never discarded.
