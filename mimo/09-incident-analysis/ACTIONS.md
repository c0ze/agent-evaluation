# Actions — queue incident 2026-09-23

## Immediate containment (done or do now)
1. **Keep `tenant_retry_policy` disabled** globally until the empty-policy path is fixed. Owner: On-call SRE. Verify: no `retry_budget_exhausted policy=""` log lines; queue age falling. Rollback: re-enable flag only behind a 1% canary.
2. **Do not scale workers further** while retry thrash is unresolved. Owner: On-call SRE. Verify: DB active connections < 250. Rollback: N/A (safety hold).
3. **Drain/inspect jobs that exhausted retry budget** in 09:00–09:45 (e.g. job=81). Owner: Checkout Platform on-call. Verify: no silent drops; DLQ or retry status accounted for. Rollback: restore jobs from DLQ if dropped.

## Prioritized corrective actions

### P0 — Fix empty-policy retry fallback
- Add a hard default: when tenant policy resolves empty, use the global exponential backoff (`config_retry_default`), never `delay_ms=0`. Cap attempts and enforce minimum backoff > 0. Owner: Checkout Platform (API/retry library). Verify: unit/integration test — empty policy ⇒ `delay_ms>=1000` exponential; staging log shows `policy` never empty in the retry path. Rollback: revert library version behind a config flag; default stays safe.

### P0 — Fail loudly on policy resolution failure
- Emit ERROR + metric (`retry_policy_resolution_failure`) on empty resolution; alert on rate > 0. Owner: Checkout Platform + Observability. Verify: synthetic misconfigured tenant produces ERROR and alert within 5 min. Rollback: revert alert rule (keep log).

### P1 — Guard retry load before it reaches the DB
- Per-tenant and per-worker retry rate limit / circuit breaker; shed or defer retries under DB pool pressure (pause retries when pool wait > threshold). Owner: Checkout Platform. Verify: load test — retry storm holds DB connections < 200 and queue age stable. Rollback: disable limiter via flag `retry_guard`.

### P1 — DB connection budget and scale-out safety
- Reserve connection slots for non-retry paths (e.g. checkout writes); alert at 80% of 300; require DB headroom check before worker scale-out runbooks. Owner: DBA / SRE. Verify: alert fires in staging at 240 conns; scale-out runbook includes check. Rollback: restore previous pool limits.

### P1 — Canary and flag exposure limits
- Require canary (≤2% tenants) for flag-gated policy changes before regional rollout; EU/US parity checks. Owner: Release Engineering. Verify: release checklist blocks full rollout without canary metrics; US-style low exposure can be reproduced in EU. Rollback: flag dial-down is the rollback path (already used).

### P2 — Rollback runbook: flags ride with deploys
- Bundled rollback must disable related feature flags and restart worker pools that cached flag/config (see 09:31 stall). Owner: SRE / Platform. Verify: game-day — rollback clears backlog signals within 10 min. Rollback: restore previous runbook.

### P2 — Retry observability
- Per-attempt metrics (delay, policy name, budget remaining) and dashboard panels for `delay_ms=0` rate. Owner: Observability. Verify: dashboard shows the 09:06 pattern within 30 s of onset in replay test. Rollback: keep logs; remove dashboard.

## Verification signals (summary)
- No `retry_budget_exhausted policy=""` lines.
- Worker CPU in normal band while queue drains (not collapsed to <20%).
- DB connections stable below 250 under peak.
- Queue age and checkout latency SLOs recovered and hold for 30 min after any flag change.
- `retry_policy_resolution_failure` metric rate is zero.

## Rollback considerations
- Every fix above ships behind a flag or is version-revertible; P0 fallback default must be safe when the flag is off.
- Never roll back code without also flipping the associated feature flags and restarting worker pools (config caching caused the 09:31 false recovery).
- Roll back in this order: disable flag → revert code → scale workers back to baseline only after DB headroom is confirmed.
