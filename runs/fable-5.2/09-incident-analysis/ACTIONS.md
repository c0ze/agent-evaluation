# Actions: eu-west job queue stall

Owners are roles. Priorities: P0 before the flag is re-enabled anywhere, P1 within the next sprint, P2 scheduled.

The sources do not record the current state of the flag in the US region, the worker count, or the release version in each region. The containment steps start by confirming those.

## Immediate containment

### C1. Keep `tenant_retry_policy` off in eu-west and freeze changes to it

- **Owner:** incident commander, with the feature flag administrator.
- **Verify:** flag audit log shows no change since 09:43; no new `retry_budget_exhausted policy=""` lines; no retries with `delay_ms=0`.
- **Rollback:** none needed. Flag-off is the behavior before the release, and it is the state in which recovery was observed.

### C2. Turn the flag off for the 2% of US tenants

- **Owner:** incident commander, with the feature flag administrator.
- **Why:** the US region runs the same release and the same code path. Its lack of alerts shows low exposure, not safety.
- **Verify:** US workers log `config_changed feature_flag=false`; US retry-exhaustion rate before and after is compared.
- **Rollback:** tenants in the 2% lose their tenant-specific retry behavior and return to the default. If any of them depends on it contractually, the product owner decides whether to keep that tenant on with close monitoring.

### C3. Return workers from 90 to 40 in steps

- **Owner:** on-call SRE.
- **Verify:** after each step, queue depth and job age stay flat and database connections stay well under 300.
- **Rollback:** scale back up one step if job age climbs. Do not exceed the worker count the connection limit can support (see A3).

### C4. Reconcile jobs handled between 09:02 and 09:45

- **Owner:** queue service engineer, with the checkout service owner.
- **What:** list every job that logged `retry_budget_exhausted` in the window and establish whether each one completed, was dropped, or ran more than once. Job 319 was reprocessed with its attempt counter reset, so duplicates are possible.
- **Verify:** every listed job has one terminal outcome; checkout-related jobs match order and payment records.
- **Rollback:** re-running a job is not reversible if it has side effects. Confirm a job is idempotent, or get the service owner's sign-off, before replaying it.

### C5. Align release versions across regions

- **Owner:** release manager.
- **What:** eu-west API is rolled back and the US region is on `2026.09.23.1`. Decide on one state. With the flag off everywhere, either is defensible; record the decision.
- **Verify:** version reported by API and worker instances in both regions.
- **Rollback:** if US is rolled back, confirm first that jobs enqueued by the new release are readable by the old one.

## Corrective actions

### A1 (P0). Reproduce the stall in staging before changing code

- **Owner:** queue service engineering lead.
- **What:** enable the flag for a tenant with no retry policy, make first attempts fail, and observe pool usage and worker state. The link from zero-delay retries to stalled workers is the least supported part of the analysis, and a fix aimed at the wrong mechanism will not hold.
- **Verify:** staging shows the same signature: `policy=""`, `delay_ms=0`, pool `idle=0`, CPU falling while queue depth rises. A thread or connection dump identifies what workers wait on.
- **Rollback:** staging only.
- **If it does not reproduce:** treat hypothesis A in `INCIDENT.md` as unconfirmed and keep the flag off.

### A2 (P0). Make an empty or missing tenant policy fall back to the default, with a minimum retry delay

- **Owner:** queue service engineering lead.
- **What:** resolve an empty policy to the configured default; reject empty policies at write time; enforce a non-zero delay floor regardless of policy.
- **Verify:** unit tests for empty, missing, and malformed policies; the A1 reproduction no longer stalls; in canary, zero `delay_ms=0` retries and zero `policy=""` lines.
- **Rollback:** the flag stays the kill switch. Re-enable by region and tenant percentage, starting with internal tenants, and turn it off on the first zero-delay retry.

### A3 (P1). Bound worker connections below the database limit

- **Owner:** database platform engineer.
- **What:** set worker count × pool size, plus API needs, below the 300 limit, or put a connection pooler in front of the database. Cap autoscaling and manual scaling at the count that budget allows. The current figures (pool of 10, up to 90 workers) are inferred from one log line and need confirming first.
- **Verify:** load test at maximum worker count keeps connections under 80% of the limit; the API logs no connection-slot errors during it.
- **Rollback:** smaller pools can lower throughput. Change one pool at a time and revert the configuration if job age rises under normal load.

### A4 (P1). Reserve database capacity for the API

- **Owner:** API service engineering lead, with the database platform engineer.
- **What:** give the API and the workers separate connection budgets (separate database roles with per-role limits, or separate pooler pools) so a worker-side problem cannot starve checkout.
- **Verify:** with worker pools saturated in a test, checkout latency stays within its objective.
- **Rollback:** per-role limits are a configuration change; revert if the API is throttled under normal load.

### A5 (P1). Alert on the stall signature, not only its effects

- **Owner:** observability engineer.
- **What:** alert on worker pool wait time, on the rate of `retry_budget_exhausted`, on any retry with zero delay, on queue depth rising while worker CPU falls, and on database connections above 80% of the limit.
- **Verify:** replaying this incident's metrics fires the new alerts at or before 09:07, ahead of the 09:11 job-age alert.
- **Rollback:** tune or mute an alert that proves noisy; do not delete it without a replacement.

### A6 (P1). Update the queue runbook

- **Owner:** on-call lead.
- **What:** add two rules. When queue depth rises and worker CPU falls, workers are blocked, so do not add workers until the blocking resource is identified. When an incident follows a release, list the flags that release introduced and turn them off alongside the rollback.
- **Verify:** a game-day exercise using this scenario reaches the flag within ten minutes of the first alert, against 32 minutes here.
- **Rollback:** not applicable.

### A7 (P2). Show flag changes next to deploys

- **Owner:** release engineering lead.
- **What:** put flag changes on the same dashboards and incident timeline as deploys, and require a staged percentage rollout with guard metrics for flags that alter retry or queue behavior.
- **Verify:** this incident's flag history is visible on the queue dashboard; a test flag change appears within one minute.
- **Rollback:** not applicable.

### A8 (P2). Define what happens when a retry budget is exhausted

- **Owner:** queue service engineering lead.
- **What:** send exhausted jobs to a dead-letter queue with a bounded number of redeliveries, and confirm job handlers are idempotent. Depends on the findings from C4.
- **Verify:** an exhausted job in test lands in the dead-letter queue once and is not redelivered with a reset attempt counter.
- **Rollback:** dead-lettering changes delivery behavior. Ship behind its own flag and watch dead-letter volume before making it the default.

### A9 (P2). Close the logging gaps found in this analysis

- **Owner:** queue service engineer.
- **What:** log the tenant, the policy source, and the failure reason on every retry and exhaustion line; log pool statistics per worker at a regular interval.
- **Verify:** a retry in staging produces a line carrying all three fields.
- **Rollback:** reduce log volume by sampling if cost rises; keep exhaustion lines unsampled.
