# Actions — Queue Retry-Policy Incident

## Immediate containment (already executed / in progress)

| # | Action                                                                                | Owner (role)         | Verification signal                                            | Rollback consideration                                       |
|---|---------------------------------------------------------------------------------------|----------------------|----------------------------------------------------------------|---------------------------------------------------------------|
| 1 | Disable `tenant_retry_policy` feature flag in eu-west (done 09:43).                    | SRE on-call          | `retry_budget_exhausted` log rate drops; `delay_ms` becomes >0.| Re-enable only after the fix in Action 4 ships via canary.    |
| 2 | Drain eu-west backlog and confirm queue depth returns to baseline.                     | Queue Ops            | Queue depth matches 7-day baseline at 10:30 UTC.               | Drain is one-way; no rollback needed.                         |
| 3 | Hold the API deploy `2026.09.23.1` as rolled back; do not re-promote.                  | Release Manager       | Deploy board shows rollback as the active artifact.            | Re-promotion requires all Actions 4–7 in this table.          |
| 4 | Communicate externally (see `CUSTOMER_UPDATE.md`).                                     | Comms / Support Lead  | Update on status page.                                           | Update is additive; revisions are fine.                       |

## Prioritized corrective actions

Priority key: **P0** = block re-enabling the flag; **P1** = must ship before
the next tenant-policy rollout; **P2** = ship within the quarter.

### P0 — Required to re-enable the flag safely

| # | Action                                                                                                              | Owner (role)               | Verification signal                                                  | Rollback consideration                                              |
|---|---------------------------------------------------------------------------------------------------------------------|----------------------------|----------------------------------------------------------------------|----------------------------------------------------------------------|
| 5 | Fix the `policy=""` fallback: any unresolved policy must inherit the safe default (`exponential` with min delay ≥ 1s), never `delay_ms=0`. | Tenant Service Engineering | Unit test covering `policy=""`, `policy=null`, `policy=unknown`; integration test shows non-zero `delay_ms` for all unknown inputs. | Code change; rollback to previous commit is safe once flag is off.     |
| 6 | Add config-load validation: workers must refuse to start (or must log FATAL and exit) if the resolved retry policy lacks a delay schedule. | Worker Platform Team       | Worker boot fails closed in tests when policy is missing/invalid.    | Validation is opt-in via env flag during rollout; rollback = revert env. |
| 7 | Add a per-tenant retry budget guard that caps attempts within a window and trips a circuit-breaker on the tenant when exhausted. | Queue Ops + Tenant Service | Tripped circuit-breaker count rises in load test; retry storm on one tenant no longer fans out to the pool. | Circuit breaker can be disabled per tenant; safer than current behaviour. |

### P1 — Required before the next policy rollout of this shape

| # | Action                                                                                                              | Owner (role)               | Verification signal                                                  | Rollback consideration                                              |
|---|---------------------------------------------------------------------------------------------------------------------|----------------------------|----------------------------------------------------------------------|----------------------------------------------------------------------|
| 8  | Introduce a staged tenant rollout for `tenant_retry_policy`: 2% → 10% → 25% → 100%, with automated halt if job-age p99 regresses >2× for 5 min. | Release Manager + SRE     | Canary dashboard shows progressive stages; auto-halt fires on synthetic fault. | Auto-halt is reversible; manual re-promotion after fix.              |
| 9  | Separate the API-tier retry config from the worker-tier retry config so an API rollback actually stops worker behavior too. | Platform Architecture      | API rollback flips worker config in the same change; test asserts both tiers observe new behavior within 1 minute. | Architecturally reversible by re-merging, but new code is strictly safer. |
| 10 | Worker auto-scale must back-pressure when DB pool wait exceeds a configurable threshold (e.g., 500 ms p95), instead of adding more workers into a saturated downstream. | SRE / Capacity             | Synthetic load test: scale-up pauses when pool wait p95 > threshold. | Threshold is configurable; rollback = restore prior autoscaler policy. |
| 11 | Add structured retry telemetry: per-job `delay_ms`, `policy`, `attempt`, `tenant`, exposed as a metric and a dashboard. | Observability              | Dashboard shows `delay_ms` distribution; alerting on `delay_ms=0` rate > 0. | Telemetry is additive; no rollback risk.                            |

### P2 — Within the quarter

| # | Action                                                                                                              | Owner (role)               | Verification signal                                                  | Rollback consideration                                              |
|---|---------------------------------------------------------------------------------------------------------------------|----------------------------|----------------------------------------------------------------------|----------------------------------------------------------------------|
| 12 | Move the DB connection pool so API and worker paths have separate budgets, with a shared overflow gate. | Database Team              | Load test: worker storm no longer starves API path.                  | Pool split is reversible; traffic can be re-pooled behind a flag.    |
| 13 | Add a chaos test that injects a `delay_ms=0` retry storm on one tenant and asserts the system stays within SLOs. | SRE                        | Quarterly chaos drill passes; alert fires on injected storm.          | Test is read-only against prod traffic shape; rollback = disable drill. |
| 14 | Post-incident review document and circulate to engineering; track Action items to closure in the incident tracker. | Incident Commander         | Review held within 5 business days; action items have owners and dates. | N/A.                                                                  |