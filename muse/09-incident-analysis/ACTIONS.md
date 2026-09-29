# Corrective actions — eu-west queue stall 2026-09-23

Owner convention: roles, not individuals.

## Immediate containment (already taken — verify they hold)

1. Keep `tenant_retry_policy` disabled in all regions until the fix is validated.
   - Owner: Release Manager / Feature Flag Owner.
   - Verification: flag state reads `false` everywhere; worker logs show no `policy=""` and no `delay_ms=0`; `retry_budget_exhausted` rate at baseline.
   - Rollback: re-enabling is the rollback of this containment — do not re-enable except under the staged rollout below.
2. Confirm full recovery and job disposition.
   - Owner: On-call / SRE.
   - Verification: queue depth and job age at baseline since 10:18 with no rebound; worker CPU back to ~65%; DB connections well below 300 with no pool-wait warnings; audit dead-letter/dropped jobs from 09:07–10:18 and replay or notify as policy requires.
   - Rollback: n/a (observational).
3. Freeze related deploys and flag changes until reviewed.
   - Owner: Incident Commander.
   - Verification: deploy/flag audit log shows no retry-policy changes.
   - Rollback: lift freeze explicitly after P0 fixes land.

## Prioritized corrective actions

### P0 — Fix unsafe retry fallback (root-cause fix)

- Action: when tenant policy is missing/empty/unparseable, fall back to the configured default (`exponential`) instead of zero delay; reject `delay_ms=0` with a validated minimum backoff plus jitter; add unit + integration tests for empty/missing/legacy tenant configs.
  - Owner: Backend / Worker Service Owner.
  - Verification: tests cover `policy=""`, missing tenant, malformed policy; staging chaos test shows `delay_ms >= floor` always; canary shows zero `policy=""` / `delay_ms=0` events.
  - Rollback: revert to prior worker build and keep flag off; rollback signal is any recurrence of `delay_ms=0` or `retry_budget_exhausted` spike on canary.

### P0 — Cap retry amplification

- Action: enforce per-job minimum delay, per-worker retry rate limit, and a time-based retry budget (not just attempt count); add a circuit breaker that pauses retries for a tenant/worker when exhaustion rate spikes.
  - Owner: Backend / Worker Service Owner.
  - Verification: load test with forced downstream errors shows bounded retry rate and stable DB connections; breaker trips and recovers in staging.
  - Rollback: disable breaker via flag if it false-trips; keep minimum-delay floor in place (do not roll back to zero-delay behavior).

### P0 — Protect the database bottleneck

- Action: split and cap connection budgets (API vs. workers, per pool) so workers cannot starve the API and vice versa; set per-worker pool max consistent with DB max (e.g., total possible < 300 with headroom); add pool-wait and connection-use alerts.
  - Owner: Database Reliability Engineer with SRE.
  - Verification: worst-case connection math documented; saturation test shows graceful queueing with alerts before errors; `remaining connection slots` never recurs below declared capacity.
  - Rollback: restore prior pool settings if throughput regresses; change one pool at a time during low traffic.

### P1 — Safe scaling and backpressure

- Action: block worker scale-up when pool waits or DB saturation are active; scale on job age only when downstream headroom exists; document "do not scale into saturation" in the runbook.
  - Owner: SRE.
  - Verification: game-day replay of 09:14 shows autoscaler/runbook refusing scale-up and paging instead.
  - Rollback: revert autoscaler policy change; manual scaling remains available.

### P1 — Staged flag rollout with auto-halt

- Action: roll out `tenant_retry_policy` progressively (e.g., 1% → 10% → 50% → 100% per region) with automatic halt/rollback on guardrails: `delay_ms=0` count, `retry_budget_exhausted` rate, queue age, worker CPU drop, DB waits.
  - Owner: Release Manager / Feature Flag Owner with SRE.
  - Verification: staged rollout in US first with halt drill; eu-west re-enable only after P0 fixes and soak period.
  - Rollback: one-click flag disable; pre-tested kill switch.

### P1 — Detection and alerting gaps

- Action: alert on leading indicators, not just lagging job age: rate of `retry_budget_exhausted`, any `delay_ms=0`, worker CPU drop concurrent with queue rise, DB pool-wait p99, connection utilization >80%.
  - Owner: SRE / Observability Owner.
  - Verification: replay 09:06–09:11 logs against new rules — alert would have fired by ~09:07.
  - Rollback: tune thresholds if noisy; do not delete without replacement.

### P2 — Post-incident hygiene

- Action: publish incident review; reconcile dead-lettered jobs; add a worker/DB saturation load test to CI; separate API-deploy rollback from worker/flag state in runbooks.
  - Owner: Incident Commander (review); Backend Owner (tests); SRE (runbooks).
  - Verification: review approved; job audit complete; new load test passing.
  - Rollback: n/a.
