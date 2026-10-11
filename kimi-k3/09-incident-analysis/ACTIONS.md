# Actions — eu-west queue incident

## Immediate containment (do now / keep in place)

1. **Keep `tenant_retry_policy` disabled globally.** Owner: On-call Engineer /
   Incident Commander. Verification: no `policy=""` or `delay_ms=0` log lines;
   retry logs show `delay_ms>=1000`. Rollback consideration: re-enabling is the
   known regression trigger — do not re-enable until corrective actions land.
2. **Freeze deploys of the queue/api services.** Owner: Release Manager.
   Verification: deployment pipeline shows no pending rollouts. Rollback: unfreeze
   once root cause is confirmed and fixed.
3. **Drain/verify no poisoned jobs remain.** Owner: On-call Engineer.
   Verification: zero jobs older than threshold; no `retry_budget_exhausted`
   entries in the last hour. Rollback: n/a (read-only verification).

## Corrective actions (prioritized)

### P0 — this week
1. **Fix retry-policy resolution: reject empty policies and enforce a minimum
   delay floor (e.g., >=500 ms) with a safe default.** Owner: Queue Platform Team.
   Verification: unit/integration tests with a flagged tenant lacking config show
   fallback to the exponential default, never `delay_ms=0`; staging replay of the
   incident workload completes without a retry storm. Rollback consideration:
   ship behind the same flag so it can be disabled instantly; keep flag default off.
2. **Route exhausted-retry-budget jobs to a dead-letter queue instead of
   requeueing into the hot path.** Owner: Queue Platform Team. Verification:
   chaos test forcing budget exhaustion shows jobs landing in DLQ, queue depth
   stable, worker CPU normal. Rollback: DLQ is additive; old behavior restorable
   via config toggle.

### P1 — next two weeks
3. **Add guardrails to worker scaling: block/alert on scale-up when DB pool
   saturation, not worker count, is the bottleneck.** Owner: SRE Team.
   Verification: game-day shows scale-up suppressed with a runbook prompt when
   pool wait > threshold. Rollback: guardrail is advisory-config; can be turned off.
4. **Isolate DB connection pools (separate pools/quotas for API vs workers) and
   alert at 70% utilization.** Owner: SRE Team + DBA. Verification: load test
   shows worker retry storms cannot consume API's reserved connections; alert
   fires before the 300 max. Rollback: pool sizing is config-only; revert sizes.
5. **Standardize flag rollouts: same percentage stages in every region, with
   automated canary analysis on job-age and retry-rate metrics.** Owner:
   Release Manager + Feature Flag Platform Owner. Verification: next flagged
   change shows staged rollout config and auto-halt on canary regression.
   Rollback: halt rollout / set flag to 0%.

### P2 — follow-up
6. **Write postmortem and add per-tenant flag state + resolved policy name to
   retry log lines.** Owner: Incident Commander + Queue Platform Team.
   Verification: logs include `flag_state` and `resolved_policy` fields, removing
   the current inference gap. Rollback: n/a.
7. **Add alerts on retry-rate and zero-delay retries** (early signal; the first
   alert came ~9 min after onset). Owner: SRE Team. Verification: alert fires
   within 2 min in a staged retry-storm drill. Rollback: alert tuning only.
