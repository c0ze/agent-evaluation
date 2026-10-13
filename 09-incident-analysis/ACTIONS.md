# Corrective actions — eu-west queue stall

Owners are roles, not individuals. Priority: P0 = containment / incident
closure, P1 = before any re-enable, P2 = hardening. Several containment steps
are already observed in the timeline (flag disabled 09:43, backlog cleared
10:18); they are listed so they are verified and held, not assumed.

## Immediate containment

| # | Action | Owner (role) | Verification signal | Rollback consideration |
|---|---|---|---|---|
| C1 | Keep `tenant_retry_policy` disabled in all regions; freeze changes to its rollout percentage. | Incident Commander with Release Manager | Flag state read back from config shows `false` everywhere; no `config_changed feature_flag=true` events. | Re-enabling is not a rollback option during containment; any re-enable follows P1 gates below. |
| C2 | Keep release `2026.09.23.1` rolled back / do not re-deploy the tenant retry change. | Release Manager | Deployed version in eu-west confirmed as the pre-incident release on API and worker images. | If business pressure requires re-deploy, deploy only with the flag off and the empty-policy fix (A1–A2) included. |
| C3 | Confirm backlog is genuinely drained and check per-job outcomes for the 09:07–10:18 window: failed, duplicated, or lost jobs; replay/reconcile any that need it. | Queue/Worker Service Owner with Support Operations | Queue depth and oldest-job age at normal baseline; a reconciliation report counts terminal states for jobs created in the window, with zero unexplained. | Replays must be idempotent or deduplicated; stop replay on duplicate-side-effect signals and revert to manual reconciliation list. |
| C4 | Right-size worker count back toward the pre-incident 40 (or current demand-based value) now that blocking has cleared; do not scale up into pool saturation again. | SRE On-Call | Worker count at target; db active connections well below 300; pool wait ≈ 0. | Worker count is trivially reversible; raise gradually only while pool-wait and job-age signals stay green. |
| C5 | Confirm database health after saturation: connections back to baseline, no sessions left in reserved/abnormal state from the incident. | Database Owner (DBA/SRE) | Active connections and pool waits at baseline for a sustained window; no `remaining connection slots reserved` errors. | No schema/data change involved; if cleanup of stuck sessions is needed, terminate only sessions attributable to the incident window and record them. |
| C6 | Hold a short monitoring watch (job age, queue depth, checkout latency, pool wait, `policy=""` occurrences). | Incident Commander / SRE On-Call | All listed signals at baseline for the agreed watch window; zero `retry_budget_exhausted policy=""` events. | Extending the watch is always safe; standing down early is the risk to avoid. |

## Prioritised corrective actions

| # | Priority | Action | Owner (role) | Verification signal | Rollback consideration |
|---|---|---|---|---|---|
| A1 | P1 | Fix retry-policy resolution: a missing/empty tenant policy must fall back to the configured default (`exponential`); an empty policy string must never be applied. Add a unit/integration test for a tenant with no configured policy. | Worker Service Owner (backend engineer) | Tests pass, including no-config tenant → default policy; staging run shows no `policy=""` in logs. | Fix ships behind the (disabled) flag, so rollback = keep flag off / revert the service release; no data migration expected — confirm before release. |
| A2 | P1 | Enforce a minimum retry delay and sane retry budget in code (reject/clamp `delay_ms=0` for retried jobs unless explicitly allow-listed); alert on `retry_budget_exhausted` with empty policy. | Worker Service Owner with SRE On-Call | Config/code review shows clamp; alert fires in a staging fault-injection test; zero-delay retry rate is a dashboarded metric. | Clamp values are config-tunable; reverting to prior limits is a config change, but do not remove the empty-policy alert. |
| A3 | P1 | Add a pre-re-enable gate: staged/canary flag enablement (e.g. one internal tenant → small % → region), with automatic halt on `policy=""`, zero-delay-retry, pool-wait, or job-age thresholds. | Release Manager with QA/Test Engineer | Canary plan documented; halt triggers demonstrated in staging or game-day; dashboards linked from the rollout ticket. | Halt = flag off (proven recovery path at 09:43); canary must be reversible by flag alone, without a deploy. |
| A4 | P1 | Make rollback effective for flag-gated features: runbook step requiring flag state to be checked/set on any rollback or worker restart, since the 09:24 rollback and 09:31 restart left `feature_flag=true` and the stall continued. | Incident Commander with Release Manager | Updated runbook reviewed; a drill shows rollback checklist includes flag read-back on API and workers. | Process change only; no technical rollback. |
| A5 | P1 | Determine and record the exact saturation mechanism (retry/requeue rate vs connections held/leaked) from the requested data (see `RESPONSE.md`); fix any connection handling fault found on the retry path (e.g. connection not released on retry/failure). | Worker Service Owner with Database Owner | Written mechanism note in the incident record backed by query/connection data; if a leak exists, a regression test or load test shows connections returning to baseline after forced retries. | Connection-handling changes ship behind the flag / in the worker release; rollback is the prior worker release with flag off. |
| A6 | P2 | Add database pool protection: per-service/tenant concurrency limits or pool partitioning so retry load cannot consume all 300 connections; consider a circuit breaker that sheds retry load when pool wait exceeds a threshold. | Database Owner with SRE On-Call | Load/fault test: injected retry storm cannot drive pool wait or checkout latency past agreed thresholds. | Limits are config values; loosening them is a reviewed config change. Avoid limits so low they starve normal tenants — validate with production-like load. |
| A7 | P2 | Add scaling guidance/automation guardrail: block or warn on worker scale-up while pool wait is high and worker CPU is falling (the 09:14 pattern). | SRE On-Call | Runbook/autoscaler rule updated; tabletop or staging scenario shows the warning/block triggering. | Guardrail must have a documented manual override for genuine CPU-bound backlogs. |
| A8 | P2 | Improve observability: log tenant, resolved policy, delay, and requeue outcome on every retry; dashboard retry rate by tenant/policy, including empty-policy count. (Current logs omit job 319's tenant.) | Worker Service Owner | New fields present in staging logs; dashboard shows per-tenant retry/policy breakdown; log volume within budget. | Logging changes are low-risk; sampling can be adjusted if volume is excessive. Retain fields needed for alerting (A2). |
| A9 | P2 | Audit tenant retry-policy configuration data: find tenants with missing/empty policies in every region and backfill explicit defaults before any re-enable. | Support Operations with Worker Service Owner | Config audit report shows zero empty tenant policies, or an explicit default recorded for each. | Backfill writes must be reversible per tenant (record prior value); the code fallback (A1) remains the safety net. |
| A10 | P2 | Complete the post-incident review: confirm customer-impact counts for the window, decide whether any customer follow-up beyond `CUSTOMER_UPDATE.md` is needed, and track A1–A9 to closure. | Incident Commander with Support Operations | Review document approved; impact counts sourced from checkout/job records (not estimated); action owners and dates recorded. | N/A (process). |

## Notes on sequencing

- Nothing above requires re-enabling `tenant_retry_policy`; the flag-off
  state is the safe configuration and was the observed recovery path.
- A1, A2, and A9 address the empty-policy trigger; A5 addresses the
  unproven saturation mechanism; A3, A4, and A7 address why containment
  took from 09:24 (rollback) to 09:43 (flag disable) to start working.
- Do not treat backlog clearance (10:18) as proof jobs succeeded — C3
  reconciliation is the check.
