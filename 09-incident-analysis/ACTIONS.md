# Actions — eu-west queue/checkout degradation (2026-09-23)

Owners are roles, not individuals. Priorities: P0 = now / this week, P1 = within 2 weeks, P2 = within a month.

## Immediate containment (status as of incident close)

| # | Action | Owner (role) | Status | Verification signal | Rollback consideration |
|---|--------|--------------|--------|--------------------|------------------------|
| C1 | Keep `tenant_retry_policy` disabled in eu-west (and any other broadly-enabled region) | Incident commander / SRE on-call | Done at 09:43 UTC | `config_changed feature_flag=false` logged by every worker pool, not just restarted ones | Re-enable only after A1/A2 verified, via staged rollout (start ≤2%) with DB monitoring; the disable itself is proven safe |
| C2 | Keep API on pre-`2026.09.23.1` release | API service owner | Done at 09:24 UTC | New job creation stable; queue depth flat at baseline | Redeploy `2026.09.23.1` only when the policy-resolution fix is included and canaryed |
| C3 | Return worker count from 90 to baseline 40 now that the backlog is cleared | SRE on-call | To do | Queue depth stays flat after step-down; DB connections fall well below 300 max | Stepping down too far risks queue growth; watch job-age alert for 30 min after change |
| C4 | Audit `retry_budget_exhausted` jobs (job=81, job=319, all instances) for requeue vs. drop; reprocess anything dropped | Queue platform owner + support lead | To do, before customer follow-ups | List of affected tenants/job IDs; count of reprocessed jobs matches exhausted count | Reprocessing must be idempotent — check dedup keys before replay to avoid duplicate side effects |
| C5 | Watch DB connection recovery and residual pool waits for 24h | DBA on-call | Active | No `db pool wait exceeded` WARNs; connections below alert threshold | None |

## Corrective actions (prioritized)

**P0 — root-cause hardening**
| # | Action | Owner (role) | Verification signal | Rollback consideration |
|---|--------|--------------|--------------------|------------------------|
| A1 | Make the retry path fail safe: when a tenant policy resolves empty or invalid, fall back to `config_retry_default` (exponential); reject/assert any `delay_ms=0` retry schedule | Worker platform tech lead | Unit + integration tests with empty/missing policy; zero `delay_ms=0` retries in logs after rollout; soak test shows backoff curves | Config-level default; safe to revert, but reverting reintroduces the incident signature — do not ship A-dependent code before this |
| A2 | Find why `policy=""` resolved: audit the tenant policy store/load path and per-tenant records (incl. acme) around 09:02–09:43 | API service owner + config-store owner | Policy field populated for every tenant in a dry-run resolver over production config; missing-config tenants counted | Read-only investigation first; any store fix needs migration review and a staged tenant |
| A3 | Decouple kill switches from API deploys: workers must hot-reload flags/config (no restart required), as worker-51's startup `feature_flag=true` showed they currently don't | Worker platform tech lead + SRE | Staging drill: disable a flag, observe `config_changed` on all pools within 1 min, no restart | Hot-reload adds a config-event failure mode; add config-change alerting as part of the same work |

**P1 — amplification and detection**
| # | Action | Owner (role) | Verification signal | Rollback consideration |
|---|--------|--------------|--------------------|------------------------|
| A4 | DB guardrails: per-service connection-pool caps, worker backpressure when DB wait rises, alert at 80% of max | DBA lead | Load test saturating workers cannot exhaust the 300 max; alert fires in test | Backpressure slows throughput under load — tune thresholds so normal peaks are untouched |
| A5 | Update the scaling runbook: check DB saturation *before* scaling workers (40→90 at 09:14 made the queue rise faster) | On-call lead / SRE manager | Runbook merged; game-day exercise shows DB-saturated scaling is refused/gated | None |
| A6 | Add alerting on the leading signature: rate of `retry_budget_exhausted`, any `delay_ms=0` retries, worker-CPU-fall-with-queue-rise | Observability lead | Synthetic bad policy triggers page within 2 min in staging | None |
| A7 | Enforce staged flag rollout in every region (2% → gradual), matching what US did and eu-west didn't | Release engineering lead | Rollout plans blocked at review without staged exposure percentages | None |

**P2 — closure**
| # | Action | Owner (role) | Verification signal | Rollback consideration |
|---|--------|--------------|--------------------|------------------------|
| A8 | Complete the per-job impact reconciliation (C4) and follow up directly with affected accounts if anything was dropped | Support lead | Customer-facing report; follow-ups sent where needed | n/a |
| A9 | Run post-incident review within 5 business days; confirm/retire hypotheses H1–H4 with the new data from RESPONSE.md | Incident commander | Review published; action items tracked to closure | n/a |

## General rollback guidance

- The flag disable (C1) is the primary, proven rollback and stays in place until A1/A2 are verified; re-enablement is itself a risky "forward" change and must be staged.
- Any code fix (A1) ships dark behind a new flag with a canary; if the fix misbehaves, disable its flag rather than redeploying.
- Prefer hot-reloaded config changes over restarts; restarts lose in-flight job state and caused a ~4-minute false recovery during the incident.