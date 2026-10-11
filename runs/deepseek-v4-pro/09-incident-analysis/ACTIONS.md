# ACTIONS.md — Remediation plan

## Immediate containment (done or in-flight)

| Action | Owner | Status |
|--------|-------|--------|
| Disable feature flag `tenant_retry_policy` globally | Feature/Flag owner | Done (09:43) |
| Roll back API deploy `2026.09.23.1` | API deploy owner (on-call) | Done (09:24) |
| Reduce worker pool to pre-incident scale (40) to relieve DB pressure | Worker/Queue on-call | Verify completed |
| Confirm queue depth / job age / checkout latency return to baseline | SRE on-call | Verify |

## Corrective actions (prioritized)

### P1 — Eliminate zero-delay retries
- **Owner:** Worker/Queue engineering.
- **Action:** Enforce a minimum retry delay (backoff floor ≥ 100–1000 ms) and a
  hard cap on retry rate per tenant; fail fast when a resolved policy is empty
  or invalid instead of defaulting to `delay_ms=0`.
- **Verification signal:** No `retry_budget_exhausted policy=""` lines; all
  retries log `delay_ms > 0`; retry rate per tenant bounded in dashboards.
- **Rollback:** Config-only change; revert the floor/cap if it degrades
  legitimate throughput.

### P1 — Bound database-connection usage in the retry path
- **Owner:** Worker/Queue engineering + DB/Infra.
- **Action:** Add connection-acquisition timeouts and a per-service connection
  budget below the global pool max (headroom for the API), plus circuit
  breaker on `db pool wait exceeded`.
- **Verification signal:** `db pool wait exceeded` events drop to zero under
  load tests; API never logs "remaining connection slots reserved" during
  incident drills.
- **Rollback:** Disable circuit breaker / restore prior pool limits.

### P2 — Fix tenant-policy resolution bug
- **Owner:** Feature/Flag owner (with API team).
- **Action:** Root-cause why the flag yields `policy=""` and `delay_ms=0`;
  add validation and logging of the resolved policy per tenant at startup and
  on config change.
- **Verification signal:** Unit/integration test covering a tenant with no
  explicit policy returns a safe default (exponential), not empty/zero.
- **Rollback:** Ship behind the same flag; disable if behavior regresses.

### P2 — Gradual rollout / canary for the flag
- **Owner:** Feature/Flag owner.
- **Action:** Re-enable only via canary (e.g., 1–5% of tenants, then ramp)
  mirroring the US-region approach that did not alert; add SLO-based automatic
  flag kill-switch.
- **Verification signal:** Canary region stays below alert thresholds at each
  ramp step; kill-switch auto-disables flag if job age/latency breach.
- **Rollback:** Kill-switch / manual disable restores baseline.

### P3 — Harden incident response procedure
- **Owner:** SRE / on-call.
- **Action:** Update runbook: on queue+DB-pool incidents, do **not** scale
  workers up before confirming root cause (scaling 40→90 worsened exhaustion);
  prefer flag disable and bounded rollback.
- **Verification signal:** Runbook reviewed and exercised in next game day.
- **Rollback:** N/A (documentation).

## Cross-cutting notes
- Scaling workers up was counterproductive; document that DB pool is a shared,
  fixed resource.
- API rollback alone did not clear the backlog because workers retained the
  flag; ensure flags and deploys are rolled back together or flag-off is the
  first containment step.
