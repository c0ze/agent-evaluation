# Riskiest Assumptions — RESPONSE.md

## 1. "Tablets reliably regain connectivity within 24 hours for purge compliance"

**Why it's risky**: The 24-hour local-data-purge requirement (regulation-driven) depends on the tablet syncing to the server so `synced_at` is set. If an inspector works in a basement for 3 days without signal, local PII persists beyond the regulatory window. The brief states "connectivity may return intermittently" but doesn't bound the maximum offline duration.

**Impact if wrong**: Regulatory violation; potential fines; data breach liability if tablet is lost/stolen during extended offline period.

**Mitigation in plan**: 
- Purge timer starts at server-acknowledged `synced_at`, not local completion
- Daily background job enforces purge; logs missed deadlines
- MDM can remote-wipe on demand

**Validation needed in pilot**: Measure actual offline durations across pilot team; add telemetry for "hours since last sync." If >5% of inspections exceed 24h offline, we need a fallback (e.g., local purge after 24h with server reconciliation on next sync, accepting brief inconsistency).

---

## 2. "Last-Writer-Wins per field is acceptable for all regulated inspection fields"

**Why it's risky**: The brief mentions "regulations require an audit history" but not whether specific fields (e.g., "pass/fail", "hazard_present") require human review on conflict. LWW silently discards the inspector's offline value when a supervisor edits the same field. If a safety-critical field is overwritten without traceability, the audit log shows *that* a conflict occurred but not *why* the supervisor's value was chosen.

**Impact if wrong**: Failed audit; legal challenge if a failed inspection appears as "passed" due to silent LWW; erosion of inspector trust.

**Mitigation in plan**:
- All conflicts recorded in audit log with both values
- Conflict banner forces inspector acknowledgment
- Config flag per field type to escalate to mandatory manual resolution

**Validation needed in pilot**: Review every conflict with compliance officer during pilot. Classify fields as "LWW-safe" vs. "requires manual." If any regulated field falls in the latter, the config flag becomes a launch blocker.

---

## 3. "Existing REST + integer version APIs can support bidirectional sync without server-side architectural changes"

**Why it's risky**: The brief states "Existing server APIs use REST with integer record versions." The sync protocol designed here assumes the server can: (a) accept a `base_version` for optimistic concurrency, (b) return merged results with conflict arrays, (c) serve audit logs since a version, and (d) assign server IDs to offline-created records. If the current API layer lacks version-checking middleware, audit tables, or idempotency keys, the server work expands from "add endpoints" to "rewrite data access layer."

**Impact if wrong**: 2-3x engineering effort on server side; pilot delay; potential schema migrations on production DB affecting web supervisors.

**Mitigation in plan**:
- Server migration adds `version` column + audit_log table behind feature flag
- Sync endpoint spec defined upfront for backend team estimation
- Pilot uses isolated test environment

**Validation needed in pilot**: Backend spike (2 days) to implement `POST /sync` against a copy of production schema before M3. If version checks require row-level locks that deadlock under load, we may need a separate sync service — a major scope change.