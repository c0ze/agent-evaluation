# Action Plan — eu-west queue incident (2026-09-23)

**Basis:** `TIMELINE.md`, `LOGS.txt`, and `INCIDENT.md`. Actions are ordered by risk reduction per unit effort. Owners are roles, not individuals. Verification signals are observables that should be checked before declaring an action complete.

---

## 1. Immediate containment (next few hours)

| # | Action | Owner (role) | Verification signal | Rollback / caution |
|---|---|---|---|---|
| C1 | Confirm `tenant_retry_policy` is disabled in **all** regions, not just eu-west; freeze re-enabling pending a code fix. | Release Manager + Service Owner (Queue Platform) | Flag state reads `false` for 100% of tenants in all regions; no `delay_ms=0` retries in logs for 30 min. | None — disabling is the known-good state (recovery began within 2 min at 09:43). |
| C2 | Revoke or gate flag-write permission so the flag cannot be turned on accidentally during the fix. | Platform/IAM owner | Change history shows no writes; alert on any flag mutation. | Reversible; re-grant after fix ships. |
| C3 | If backlog recurs, drain in a controlled way: keep worker count at baseline (do **not** scale up), cap per-worker DB pool usage, watch connection count. | SRE on-call + DBA | Queue depth decreases monotonically; DB connections stay below ~70% of max; `db pool wait` warnings stop. | Scaling down during drain slows recovery; scaling up worsens DB contention (observed at 09:14). Do not roll back the API alone as a containment step — it did not clear the backlog at 09:24. |
| C4 | Check for duplicate side effects from retried jobs (payments, notifications, webhooks) and replay idempotency keys for affected tenants. | Service Owner + Support/Customer Success | Reconciliation report shows no duplicate billable or customer-visible actions, or all duplicates corrected. | Reconciliation must be read-only first; do not re-run jobs blindly. |
| C5 | Send the customer update (`CUSTOMER_UPDATE.md`) and set a 24-hour follow-up cadence. | Support/Customer Success lead | Update published to affected accounts; next-update time recorded. | Do not state a confirmed root cause or affected-tenant count beyond what is known. |

**Exit criteria for containment:** flag off everywhere, no zero-delay retries for 60 min, queue depth at or below pre-incident baseline, DB connections below 70%, checkout latency back to baseline.

---

## 2. Prioritized corrective actions

### P0 — Prevent recurrence before any re-enable

| # | Action | Owner (role) | Verification signal | Rollback / considerations |
|---|---|---|---|---|
| P0-1 | Fix policy resolution: reject an empty/missing tenant policy at load time and fall back to `config_retry_default` ("exponential"). Treat `""` as invalid, never as "no delay". | Worker/Queue engineering lead | Unit + integration tests covering empty, null, malformed, and missing policy all produce the configured exponential backoff; no `policy=""` in logs. | Code change requires staged rollout; keep the flag off until the fix is verified in staging. |
| P0-2 | Enforce a retry floor: minimum delay (e.g. 250–1000 ms) plus jitter, regardless of tenant policy; hard cap on attempts and on retries per tenant per time window. | Worker/Queue engineering lead | Load test shows retries/sec bounded; p99 retry interval ≥ floor; per-tenant retry rate capped. | Jitter/floor adds tail latency for genuinely transient failures — tune with test data; config change should be hot-reloadable and reversible. |
| P0-3 | Add a retry-storm circuit breaker: if a tenant or the fleet exceeds a retry-rate threshold, pause that tenant's retries and shed/queue work instead of tight-looping. | Worker/Queue engineering lead + SRE | Breaker trips in a fault-injection test before DB pool wait exceeds 1 s; breaker state visible in metrics. | A breaker can delay legitimate retries; make thresholds and reset behavior configurable and documented. |
| P0-4 | Reconcile connection budget: total workers × per-worker pool size must stay below the DB `max_connections` with headroom (target ≤70%). Enforce per-worker pool caps and fail fast with backpressure. | DBA + Platform engineering | Calculated worst-case connections < 70% of 300; chaos test with 90 workers shows no "remaining connection slots" errors. | Changing `max_connections` needs a DB restart/maintenance window; prefer reducing per-worker pool size or worker count first. |
| P0-5 | Make rollback complete: a release rollback must also revert or disable any associated feature flags and worker config, and this must be a documented step in the deploy runbook. | Release Manager | Rollback drill shows flag + deploy revert together; checklist signed off. | Flag rollback is instant and safe; code rollback has its own verification. Do not rely on code rollback alone (observed insufficient at 09:24). |

### P1 — Detection, validation, and safe rollout

| # | Action | Owner (role) | Verification signal | Rollback / considerations |
|---|---|---|---|---|
| P1-1 | Emit structured logs/metrics per job: tenant, resolved policy, chosen delay, attempt, outcome, pool wait. Add an audit log for every feature-flag change (who/when/coverage). | Observability/SRE | Dashboards show resolved policy and delay distribution by tenant; flag changes appear in audit stream within 1 min. | High-cardinality tenant labels can be costly — aggregate where possible, sample raw logs. |
| P1-2 | Alert on retry storms and policy anomalies: retries/sec per tenant, fraction of jobs with `policy=""`, `delay_ms=0` count, DB pool wait p99, connection utilization. | SRE | Synthetic fault injection triggers alerts within 2 min, before queue-depth alert. | Tune thresholds to avoid noise; stage alerts in warn mode first. |
| P1-3 | Load-test with the flag at 100% tenant coverage plus injected failures; measure DB connections, retry rate, throughput, and queue drain time. | QA + Worker engineering | Test demonstrates stable throughput at 100% coverage and no connection exhaustion; results attached to release. | Test environment must mirror prod DB connection limits, or results are misleading. |
| P1-4 | Re-enable via staged rollout only: 1% → 5% → 25% → 100%, with automatic rollback on retry-rate, pool-wait, or queue-depth guardrails. | Release Manager + SRE | Each stage holds guardrails for an agreed soak period; auto-rollback fires correctly in a dry run. | Keep a manual kill switch independent of the rollout controller. Never jump stages based on time alone. |
| P1-5 | Update the queue incident runbook: scaling workers is contraindicated when the bottleneck is DB connections; restart gives only temporary relief; identify the flag kill switch first. | SRE lead | Runbook reviewed and used in a tabletop exercise; on-call can locate the kill switch in <2 min. | Runbook changes are low risk; ensure the old advice is removed, not just appended. |
| P1-6 | Scope affected tenants and quantify impact (jobs delayed/failed, checkout latency, SLO burn, duplicates) for the post-incident review and customer follow-up. | Service Owner + Data/Analytics | Report lists tenant count, job count, duration, and SLO burn with queries reproducible. | Handle tenant data per privacy policy; share aggregates externally. |

### P2 — Structural resilience

| # | Action | Owner (role) | Verification signal | Rollback / considerations |
|---|---|---|---|---|
| P2-1 | Add per-tenant fair scheduling / concurrency isolation so one tenant's retry storm cannot starve others. | Queue Platform engineering | Fault injection on one tenant shows other tenants' throughput unchanged. | Isolation adds scheduling complexity; roll out behind its own flag and measure overhead. |
| P2-2 | Add DB connection-pool saturation protection: bounded wait queues, load shedding, and graceful degradation instead of 5 s blocking waits. | Platform engineering + DBA | Under saturation, workers fail fast and recover without restart; p99 wait bounded. | Aggressive shedding can drop work; pair with durable queueing and retry-safe semantics. |
| P2-3 | Run a retry-storm game day with the new breaker and alerts; include flag rollback and DB saturation scenarios. | SRE + QA | Game day meets recovery-time targets without manual restarts; findings tracked to closure. | Schedule outside peak; announce to stakeholders. |
| P2-4 | Review all feature flags for "empty/invalid value" handling and add schema validation at config load across services. | Platform architecture | Audit lists every flag with validation status; invalid configs fail closed at startup. | Fail-closed startup could block deploys if configs are wrong — validate in CI first. |

---

## 3. Verification checklist before closing the incident

- [ ] Flag `tenant_retry_policy` disabled in every region; write access restricted.
- [ ] No `retry delay_ms=0` or `policy=""` entries in 60 consecutive minutes of logs.
- [ ] DB connections stable below 70% of maximum through a full traffic cycle.
- [ ] Queue depth at baseline; job-age and checkout-latency alerts resolved and stable.
- [ ] Duplicate-side-effect reconciliation complete for affected tenants.
- [ ] Customer update sent; follow-up scheduled.
- [ ] Root-cause review scheduled with code diff, flag audit log, and per-tenant config records attached.

---

## 4. Sequencing rationale

Fix the **trigger** first (flag off), then the **defect** (validation + backoff floor + breaker), then the **amplifier** (connection budget and scaling policy), then **detection** and **rollout safety**. Re-enabling the flag is the last step, gated on all P0 items and a successful staged rollout. Recovery should not depend on restarts, which were shown to provide only ~4 minutes of relief.
