# Actions

## Immediate containment (done / verify)
1. Keep `tenant_retry_policy` flag disabled until fix is verified. Owner: On-call (SRE role). Verify: flag state `false` in all regions; queue depth falling; job age < SLO. Rollback: re-enabling the flag reintroduces the stall — do not re-enable without the guard below.
2. Freeze further deploys of api `2026.09.23.1` / retry-policy changes. Owner: Release manager role. Verify: deploy pipeline pinned; no new canary. Rollback: N/A.
3. Confirm backlog fully drained with no duplicate side effects. Owner: Support + SRE roles. Verify: queue depth ~0, checkout latency back to baseline, error rate normal for 30+ min. Rollback: N/A.

## Corrective actions (prioritized)

1. Add guard: reject empty policy and enforce minimum retry delay (e.g. fall back to `exponential` default, clamp `delay_ms >= 1000`, cap attempts). Owner: Backend engineer role. Verify: unit/integration test with missing tenant policy shows backoff, not tight loop; log sample shows `policy` never empty. Rollback: revert to prior commit; keep flag off.
2. Add retry-budget alerting and circuit breaker: alert on `retry_budget_exhausted` rate and `delay_ms=0` occurrences; shed or park offending tenant/job class. Owner: SRE role. Verify: synthetic empty-policy job fires alert in staging. Rollback: disable rule if noisy.
3. Cap retry concurrency / add backpressure: limit retry workers or DB demand per tenant so one tenant's storm cannot saturate the 300-connection pool. Owner: Backend engineer role. Verify: load test with retry storm keeps pool healthy. Rollback: revert limit change.
4. Fix scale-up runbook: do not scale workers into a suspected retry/DB-contention stall without checking `delay_ms`, pool waits, and connection counts first. Owner: SRE role. Verify: runbook updated and reviewed. Rollback: N/A.
5. Separate flag from deploy rollback: ensure rollback procedure also resets/flags worker config, or document that flag disable is the effective kill switch. Owner: Release manager role. Verify: tabletop exercise. Rollback: N/A.
6. Audit affected checkouts for duplicates/double-charges; remediate per support process. Owner: Support + Backend engineer roles. Verify: reconciled order/payment logs for the 09:07–10:18 window. Rollback: N/A.
7. Expand flag rollout guardrails: low-% canary with retry-storm metrics as promotion gate before eu-west-wide enablement. Owner: Release manager role. Verify: policy documented; US 2% vs eu-west contrast reviewed. Rollback: N/A.
