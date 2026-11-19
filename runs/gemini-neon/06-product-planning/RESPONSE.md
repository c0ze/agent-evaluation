# Three Riskiest Assumptions

The offline inspection sync plan in `PLAN.md` depends on ten explicit assumptions (`A1`–`A10`). The three below carry the highest regulatory, product, and architectural risk if wrong and **must be validated during Milestone M0 before implementation begins**.

---

## 1. Regulatory Interpretation of the 24-Hour Post-Acceptance Local Purge Under Offline Conditions (`A1` / Decision `D1`)

- **The Assumption**: Regulators accept removing local customer data immediately upon a tablet syncing `ACCEPTED` status (paired with early post-submission purge and a clock-tamper-resistant local fallback TTL), rather than requiring guaranteed wall-clock deletion within 24 hours of server acceptance even while a tablet is offline or powered off.
- **Why It Is Risky**: An offline tablet physically cannot observe a supervisor's web acceptance until it reconnects. If regulators enforce a strict wall-clock 24-hour rule starting at server acceptance regardless of connectivity, a tablet sitting in a truck or basement over a weekend creates an unavoidable compliance violation unless local customer data is purged *before* acceptance. Conversely, purging too aggressively before mutations sync would destroy field work.
- **Mitigation & Validation Gate**: Obtain written Legal/Compliance sign-off on `D1` before M1. Architecturally, mitigate the offline gap by purging local customer data promptly upon **verified submission sync** (so PII is usually already deleted before acceptance occurs), combined with `PRAGMA secure_delete=ON`, WAL truncation, encrypted file deletion, and server-side >18h/>24h overdue-purge escalations.

---

## 2. Low-Contention Supervisor Web Edits & Post-Signature Stability Without a Collaborative Editor (`A2` / Decisions `D2`, `D3`)

- **The Assumption**: Concurrent supervisor edits on the web while an inspector is offline are infrequent and mostly touch disjoint fields—and rarely modify attested fields after an inspector captures a customer signature—making field-level 3-way merge plus manual conflict resolution sufficient.
- **Why It Is Risky**: Product explicitly ruled out a full collaborative editor, and the backend uses integer record versions. If supervisors routinely edit the same fields, reassign inspections mid-visit, or alter facts after an offline signature is collected, inspectors will face frequent `409 Conflict` interruptions—and worse, silently merging edits under a previously captured signature creates legal/audit liability, while invalidating signatures may force costly return visits to the building.
- **Mitigation & Validation Gate**: Audit historical web vs. mobile edit overlap before M1, lock conflict ownership (`D2`) and signature-hash invalidation rules (`D3`), add a soft web warning when an inspection is downloaded to a tablet, and make manual/signature conflict rates an explicit promotion gate in the Stage 1 pilot.

---

## 3. Extensibility of Existing REST APIs & Regulatory Acceptability of Deferred Offline Audit Logs (`A3` / Decisions `D6`, `D9`)

- **The Assumption**: The existing integer-version REST APIs can be extended additively (with `Idempotency-Key` support, field-level patch/conflict responses, and decoupled resumable attachment uploads), and regulators accept append-only audit records capturing dual timestamps (`client_occurred_at` + estimated clock offset + `server_recorded_at`) for offline-originated work.
- **Why It Is Risky**: Under intermittent basement connectivity, retrying standard integer-version REST `PUT` requests without server-side idempotency causes duplicate writes or false `409` self-conflicts whenever a network drops after server commit, and bundling up to 40 photos into standard REST calls will repeatedly fail. Equally, if regulators reject device-generated offline timestamps or deferred ingestion without hardware attestation, the audit model—and potentially what can legally be completed offline—must be redesigned.
- **Mitigation & Validation Gate**: Freeze the additive REST contract (`D6`) and secure Compliance sign-off on dual-timestamped offline audit entries (`D9`) in M0, keeping legacy endpoints intact for zero-downtime migration and rollback.
