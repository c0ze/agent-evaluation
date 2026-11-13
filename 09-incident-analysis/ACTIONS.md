# Incident Action Plan

## 1. Immediate Containment

| Action | Owner (Role) | Verification Signals | Rollback Considerations |
| :--- | :--- | :--- | :--- |
| **Keep `tenant_retry_policy` disabled globally** (`eu-west` and `US`, removing the 2% US cohort as well until fixed). | Incident Commander / On-Call SRE | All worker pools log `feature_flag=false`; zero `policy=""` or `delay_ms=0` retry entries in logs; retries use `config_retry_default="exponential"` (`delay_ms > 0`). | Do not re-enable `tenant_retry_policy` until the empty-policy fallback and DB pool behavior are verified in staging. If a specific tenant needs custom retry limits urgently, adjust global/static config only after verifying backoff floors. |
| **Scale workers down from `90` to safe baseline (`<= 40` or DB-budget cap)** and confirm DB connection headroom. | On-Call SRE / Platform Infrastructure Engineer | Active DB connections stay well below `300` (e.g., `< 70%`); zero `db remaining connection slots reserved` errors on API pods; zero `db pool wait exceeded` warnings; queue age remains within SLO. | If queue depth grows under legitimate load, scale up gradually (e.g., +5 workers per step) while monitoring active DB connections rather than jumping to `90`. |
| **Audit jobs that logged `retry_budget_exhausted` (`09:06–09:45 UTC`)** for silent drops, stuck states, or duplicate execution. | Backend Checkout Engineer + On-Call SRE | Reconciliation confirms all jobs from the incident window reached terminal `success` or deterministic DLQ handling, with zero orphaned checkouts. | Read-only audit carries no rollback risk; if any dropped jobs require replay, run idempotency checks first and rate-limit replay concurrency. |

---

## 2. Prioritized Corrective Actions

### P0 — Critical / Blocker Before Re-enabling Feature

1. **Fix missing/empty tenant retry policy fallback and enforce non-zero retry backoff floor**
   - **Owner:** Backend Engineering Lead (Queue & Retry Systems)
   - **Scope:** Reject or ignore empty/invalid retry policies (`policy=""`) at both API/config write and worker evaluation time, explicitly falling back to `config_retry_default="exponential"`. Enforce a minimum backoff floor with jitter on retries so misconfiguration cannot produce `delay_ms=0` tight loops.
   - **Verification Signals:**
     - Unit and integration tests pass for unset/empty/malformed tenant policies and dynamic `feature_flag` toggling without worker restart.
     - Staging fault-injection test (forcing `attempt=1` failures for tenants without custom policies) emits zero `policy=""` or `delay_ms=0` logs and executes exponential backoff (`delay_ms >= 1000` on first retry).
   - **Rollback Considerations:**
     - Keep `tenant_retry_policy` disabled by default on deploy. If the updated worker/API code triggers unexpected retry latency or serialization errors, toggle `tenant_retry_policy=false` immediately and roll back the deployment while ensuring job deserialization remains backward-compatible with queued payloads.

2. **Audit DB connection lifecycle on retry/exhaustion paths and bound total DB connection demand below `300`**
   - **Owner:** Platform / Database Reliability Engineering Lead
   - **Scope:** Inspect worker code to ensure DB connections are released before retry sleep and on `retry_budget_exhausted` (eliminating any connection hold/leak causing `active=10 idle=0`). Enforce connection-budget math (`max_workers * worker_pool_size + api_max_connections + admin_reserved <= 300`), isolate API and worker pools (e.g., separate DB users/pool limits or connection pooler like PgBouncer), and reserve dedicated slots for checkout API traffic.
   - **Verification Signals:**
     - Load test triggering sustained `retry_budget_exhausted` bursts shows worker DB `active` connections return to baseline (`idle` recovers) with zero connection leaks and zero `db pool wait exceeded` warnings.
     - Even at maximum autoscaled worker count, total DB connections remain `<= 80%` of `300`, and checkout API pods record zero `db remaining connection slots reserved` errors.
   - **Rollback Considerations:**
     - Apply pool-size limits and pooler routing via versioned config so previous limits can be restored per service/region in minutes. Reducing per-worker pool size can increase local wait times if worker thread concurrency exceeds pool size, so match worker concurrency to pool size and monitor `db pool wait exceeded` during rollout.

### P1 — High Priority / Systemic Resilience

3. **Fix API/worker release coupling and update incident runbooks for flag kill-switches & scaling**
   - **Owner:** Site Reliability Engineering (SRE) Lead & Checkout Architecture Lead
   - **Scope:** Clarify and eliminate hidden coupling where rolling back the API deploy (`2026.09.23.1`) leaves workers stalling on `feature_flag=true` or pre-rollback payloads. Update incident response runbooks to: (a) check active feature flags first and execute flag kill-switches before/alongside service rollbacks, and (b) require checking DB connection headroom before scaling up workers.
   - **Verification Signals:**
     - Game-day simulation confirms checkout API p99 latency stays within SLO during a simulated worker queue retry storm.
     - On-call drill validates DB connection check prior to worker scale-up and flag kill-switch execution under 5 minutes.
   - **Rollback Considerations:**
     - Runbook and quota adjustments are reversible via configuration; if conservative worker DB quotas slow normal backlog recovery after traffic spikes, adjust worker pool caps incrementally without touching reserved API connection slots.

4. **Enforce progressive canary rollouts on retry/queue feature flags and bound post-exhaustion re-queueing**
   - **Owner:** Release Engineering Lead & Queue Platform Engineer
   - **Scope:** Require staged rollout gates (`1% -> 5% -> 25% -> 100%`) with automated rollback on `retry_budget_exhausted` spikes, `delay_ms=0` occurrences, or queue-age alerts (preventing uneven high regional exposure vs. `2%` in US). Ensure `retry_budget_exhausted` routes jobs to a bounded dead-letter/backoff queue rather than re-entering immediate execution.
   - **Verification Signals:**
     - Feature-flag controller automatically reverts `tenant_retry_policy` to `false` in staging when simulated errors breach thresholds.
     - DLQ metrics confirm exhausted jobs exit active hot queues after max attempts without tight re-delivery loops.
   - **Rollback Considerations:**
     - Automated flag gates must fail closed (`false`). Any DLQ routing change must preserve safe manual/automated replay with idempotency protection so jobs are neither lost nor stuck permanently if DLQ thresholds are tuned too aggressively.

### P2 — Medium Priority / Observability

5. **Add targeted observability and alerting for policy fallbacks, DB pool saturation, and worker stall signatures**
   - **Owner:** Observability / Monitoring Lead
   - **Scope:** Emit metrics and alerts for: empty/fallback retry policy hits (`policy=""`), `delay_ms=0` retries, per-worker DB pool wait/exhaustion (`active/idle`), DB connections broken down by service (`api` vs. `worker`), and the worker stall signature (falling worker CPU paired with rising queue depth). Include `job_created_at` and `deploy_version` context in structured worker logs.
   - **Verification Signals:**
     - Staging chaos tests trigger alerts within `1–2 minutes` when `policy=""` appears or DB pool wait exceeds `1000ms`.
     - Incident dashboard cleanly separates API vs. worker DB connection utilization and overlays deploy/flag-change events.
   - **Rollback Considerations:**
     - Roll out alerts in warning mode first to tune thresholds and avoid alert fatigue; keep high-cardinality fields (e.g., `job_id`) in logs rather than metric labels so time-series cardinality does not impact monitoring stability.
