# Action plan — eu-west queue stall

## Immediate containment (done during incident, for the record)
1. **Disable the `tenant_retry_policy` feature flag** in eu-west — done 09:43; recovery began within two minutes (TIMELINE.md:11). Keep it disabled everywhere until the fix is verified.
2. **Hold the worker scale-up** — the 40 → 90 increase at 09:14 made queue depth rise faster; do not add workers against a saturated DB pool. If scaling is ever needed again, pair it with a DB connection increase.
3. **Confirm backlog drain** — backlog cleared at 10:18 (TIMELINE.md:13); verify no jobs were dropped (see verification below).
4. **Freeze release `2026.09.23.1`** from further rollout; US is at 2% flag exposure — keep it there or roll the flag back to 0% pending the fix.

## Prioritized corrective actions

### P0 — Fix the retry policy fallback (blocks re-enable)
- **Action:** Make the tenant-specific retry policy fall back to the built-in `exponential` default when the tenant policy is empty, missing, or unparseable; enforce a minimum retry delay (e.g., >= 100 ms) and add jitter. Treat `policy=""` as invalid config, not as "retry immediately."
- **Owner:** Payments/Queue Engineering (team owning the worker retry library).
- **Verification signals:** Unit/integration tests covering empty, missing, and malformed tenant policy all produce `delay_ms >= 100` with the exponential default; in staging, a failing job shows non-zero, increasing retry delays and the `retry_budget_exhausted` log carries a non-empty policy string.
- **Rollback consideration:** The fix is additive to the fallback path; if it misbehaves, re-disable `tenant_retry_policy` (known-good state, verified at 09:43) and keep the exponential default. No data migration involved.

### P0 — Add a guard against zero-delay retry loops
- **Action:** Reject or clamp `delay_ms=0` retries at the worker level (config validation + runtime assertion), and cap per-worker concurrent retries / add a circuit breaker that pauses retries when DB pool wait exceeds a threshold.
- **Owner:** Queue Engineering, with SRE review.
- **Verification signals:** Staging fault injection (DB pool saturated) shows retries pause instead of hammering the pool; alert fires on `retry delay_ms=0` events.
- **Rollback consideration:** If the circuit breaker false-positives and delays legitimate jobs, loosen the threshold or disable the breaker only — the minimum-delay clamp can stay.

### P1 — Alerting and detection
- **Action:** Add alerts on: retry rate per worker, zero-delay retries (`delay_ms=0`), retry policy string empty, and DB pool wait time / saturation ratio. Current detection lagged onset by ~4-5 minutes (onset 09:07, alerts 09:11).
- **Owner:** SRE / Observability.
- **Verification signals:** In a staging game-day replay of this incident, the new alerts fire within 1 minute of retry-loop onset, before job-age alerts.
- **Rollback consideration:** Alert-only change; tune thresholds if noisy. No rollback risk to production traffic.

### P1 — Make scaling safe under pool saturation
- **Action:** Add runbook guidance and, if feasible, an autoscaling guard: do not scale workers when DB pool utilization is high; scale DB connections (or read replicas / pooler) alongside workers.
- **Owner:** SRE.
- **Verification signals:** Game-day: scaling event during pool saturation no longer increases queue depth growth rate.
- **Rollback consideration:** Runbook text only; the autoscaling guard can be disabled independently.

### P1 — Staged flag rollout
- **Action:** Roll out `tenant_retry_policy` (after the P0 fix) with the same staged approach that limited US exposure: 1% → 10% → 50% → 100% with soak periods and automatic rollback on the new retry/pool alerts.
- **Owner:** Release Engineering with Queue Engineering.
- **Verification signals:** Each stage soaks without retry-rate or pool-saturation alerts; canary dashboards clean.
- **Rollback consideration:** Kill switch is the feature flag itself — proven effective at 09:43.

### P2 — Clarify retry-budget semantics
- **Action:** Determine whether `retry_budget_exhausted` jobs are re-queued or dropped (job 319 reappeared as `attempt=1` after the flag change). If re-queued, confirm no duplicate side effects; if dropped, add a dead-letter path and alerting.
- **Owner:** Queue Engineering.
- **Verification signals:** Documented behavior plus a test showing exhausted jobs land in a dead-letter queue with an alert; reconciliation query shows zero lost jobs from the incident window.
- **Rollback consideration:** Documentation/behavior change in worker only; if the dead-letter change misroutes jobs, fall back to previous re-queue behavior via config.

### P2 — Post-incident verification of data integrity
- **Action:** Reconcile jobs created 09:02-10:18 in eu-west against expected outcomes; confirm none failed permanently and quantify customer-visible checkout latency impact for the customer update and any credits.
- **Owner:** Data/Support Engineering with SRE.
- **Verification signals:** Reconciliation report with zero unexplained missing jobs; latency percentiles for the window published.
- **Rollback consideration:** Read-only analysis; no rollback needed.

## Standing rule for the next occurrence
Disable `tenant_retry_policy` first (fastest known mitigation, verified in this incident), then drain, then diagnose.
