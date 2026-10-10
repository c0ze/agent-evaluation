# Actions: eu-west queue stall (2026-09-23)

Owners are listed as roles. The priorities assume the leading hypothesis in `INCIDENT.md` (H1). Any action that depends on unconfirmed parts of H1 is marked.

## Immediate containment (next 24 hours)

| # | Action | Owner | Verification signal | Rollback consideration |
|---|---|---|---|---|
| C1 | Keep `tenant_retry_policy` **off in all regions**, including the 2% in the US. Lock the flag so that changing it requires incident-commander approval. | Incident commander | The flag service shows 0% in every region. Workers log `feature_flag=false`. No `policy=""` log lines appear. | Low risk: the flag was already off in eu-west during recovery. Tenants that expected custom retry behavior fall back to the default. Tell their account owners. |
| C2 | Check the **US 2% cohort** for the same pattern over the same window: `policy=""`, `delay_ms=0`, `retry_budget_exhausted`, and DB pool waits. | On-call SRE (US) | A search of the US logs returns a count, even if it is zero. | Read-only. |
| C3 | Find every job that logged `retry_budget_exhausted` in eu-west and the US between 09:00 and 09:45. Work out what happened to each one: completed, dead-lettered, dropped or duplicated. | Owning service engineer + Support lead | A reconciled list: each job ID with its final state. | Re-running jobs can cause double side effects, such as double charges. Confirm the jobs are idempotent before bulk replay. Replay in small batches. |
| C4 | Return the worker count to a size whose total connection pools fit under the DB maximum, with room left for the API. Confirm no idle or leaked connections remain. | On-call SRE + DBA | DB connections are well below 300. Pool-wait warnings are at zero. The API has no `remaining connection slots reserved` errors. | Scale down gradually while watching queue depth. Keep the previous worker count on record. |
| C5 | Hold further deploys of the retry-policy change until P0 items are fixed. | Release manager | The release calendar shows the hold. | None. |

## Corrective actions (prioritized)

### P0: Fix the trigger

| # | Action | Owner | Verification signal | Rollback consideration |
|---|---|---|---|---|
| P0-1 | Fix policy resolution: when a tenant policy is empty, null or unknown, **fall back to the configured default**. Validate tenant policies when they are loaded and written, and reject `""`. | Owning service team (tech lead) | Unit tests for empty, null, unknown and valid policies. In staging, a tenant with no policy logs `policy="exponential"` (or whatever the default is) and `delay_ms>0`. | Ship behind the same flag, off by default. The flag stays the kill switch. |
| P0-2 | Enforce a **minimum retry delay with jitter** in the retry library, whatever the policy says. This protects against any future bad policy. | Platform / retry-library owner | Tests: no retry has `delay_ms` below the minimum. Production logs have no `delay_ms=0`. | The change is a library default. If it slows recovery for latency-sensitive jobs, allow a per-job override that has to be reviewed. |
| P0-3 | Find out what the `retry_budget_exhausted` path does with DB connections, transactions and job state. Confirm or rule out a connection leak or held lock. This tests the weakest link in H1. | Owning service engineer + DBA | A reproduction in staging with pool metrics. After the fix, active connections return to their baseline after exhaustion. | Investigation only. Any fix it leads to goes through normal review. |

### P1: Limit the blast radius and speed up mitigation

| # | Action | Owner | Verification signal | Rollback consideration |
|---|---|---|---|---|
| P1-1 | **Connection budget:** make sure `max_workers × pool_size + API pool + headroom ≤ DB max`. Enforce it in autoscaling. Give the API its own reserved connections or a separate pool or proxy. | Platform/SRE + DBA | A config check fails CI if the budget is exceeded. A load test at the maximum worker count keeps DB connections below 90%. | Lowering pool sizes can reduce throughput. Roll out one region at a time and compare job throughput. |
| P1-2 | **Runbook:** when rolling back a release, list and turn off any feature flags changed or introduced with it. Warn against scaling workers when DB pool waits or connection limits are firing. | SRE lead | The runbook is updated, and a game day exercises it. | Documentation only. |
| P1-3 | **Alerts** on the cause, not only on symptoms: the rate of `retry_budget_exhausted`, retries with `delay_ms=0`, DB pool-wait warnings, DB connections above 80%, and worker CPU falling while queue depth rises. Add equivalent alerts in the US. | Observability owner | The alerts fire in staging when a tenant with no policy is replayed. | Tune thresholds to avoid alert fatigue. Start with notification-only alerts for a week. |
| P1-4 | Show flag changes and deploys together on the incident dashboards and timeline. | Observability owner | Flag changes appear as annotations on the queue and DB graphs. | None. |

### P2: Prevent similar incidents

| # | Action | Owner | Verification signal | Rollback consideration |
|---|---|---|---|---|
| P2-1 | Roll out flags gradually, **per region, with automated safety checks**: automatic rollback on queue age, retry exhaustion or DB connection signals. Start with 1–5% in each region. | Release engineering | The flag platform records the stages and automatic rollbacks. A test flag rolls back automatically in staging. | If the safety checks are too sensitive, fall back to a manual rollout. |
| P2-2 | Audit tenant retry-policy data for empty or invalid values before turning the flag back on. | Owning service team + Data owner | Audit report: zero invalid records, or each one fixed. | Read-only, apart from data fixes, which should be backed up. |
| P2-3 | Hold a blameless post-incident review once the data from `RESPONSE.md` is collected. Confirm or revise the root cause. | Incident commander | Review published, with root cause marked confirmed or revised. | None. |

## Re-enable criteria for `tenant_retry_policy`

Turn the flag back on only when all of the following are true:

- P0-1, P0-2 and P0-3 are done.
- P1-1 and P1-3 are in place.
- The tenant data audit (P2-2) is clean.
- The rollout follows P2-1, starting at 1% in one region.
- For 24 hours at each stage: no `policy=""` lines, no zero-delay retries, and DB connections below 70%.
