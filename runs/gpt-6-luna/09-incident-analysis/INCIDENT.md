# Queue incident analysis

## Impact

**Observed:** The timeline records a growing eu-west queue from 09:07 UTC, alerts for job age and checkout latency at 09:11, and database connections reaching the configured maximum of 300 at 09:20. Rolling back the API deployment normalized new job creation, but the backlog remained stuck. Recovery began within two minutes of disabling `tenant_retry_policy` at 09:43; the backlog was cleared by 10:18. The US region ran the same release with the flag enabled for 2% of tenants and had no alert.

**Inferred:** EU customers likely experienced slower checkout and delayed queued work. The evidence does not establish the number of affected customers or jobs, whether any jobs were lost, or whether checkout requests failed. The incident window for the reported backlog was about 71 minutes (09:07–10:18 UTC); checkout impact may have started later or ended earlier.

## Concise timeline (UTC)

- **09:02 — Observed:** API `2026.09.23.1` deployed with a tenant-specific retry policy change.
- **09:06:58–09:07 — Observed:** A worker logged three immediate retries for one job (`delay_ms=0`), then `retry_budget_exhausted` with an empty policy. Queue depth began rising and worker CPU fell from 65% to 18%.
- **09:11 — Observed:** Job-age and checkout-latency alerts fired.
- **09:14 — Observed:** Worker count increased from 40 to 90; the queue then rose faster.
- **09:20 — Observed:** Database connections reached the configured maximum of 300; a worker log also shows a 5-second DB-pool wait.
- **09:24 — Observed:** API rollback normalized new job creation, but the backlog remained stuck.
- **09:31–09:35 — Observed:** A restarted worker pool processed normally for four minutes, then stalled. Startup logged the default retry mode as exponential while the feature flag was true; a later job again exhausted its retry budget with an empty policy.
- **09:43 — Observed:** The flag was disabled. Within two minutes recovery began. The same job then retried after 1,000 ms and succeeded on its second attempt.
- **10:18 — Observed:** Backlog cleared.

## Most likely root cause

**Inference — moderate-high confidence:** The feature-flagged tenant retry-policy path most likely caused or enabled the eu-west failure. The strongest mechanism indicated by the logs is that an empty/unresolved tenant policy allowed rapid retries with zero delay, exhausting retry budgets within tens of milliseconds and adding pressure while workers were already waiting on the database. Disabling the flag changed the observed retry behavior to a 1,000 ms delay and was followed closely by recovery. The supplied evidence does not prove the precise code defect or establish that retries alone caused the database connection limit to be reached.

## Hypotheses and evidence

### H1: The flagged tenant retry-policy path triggered retry amplification and queue stalls — most likely

- **Supports (observed):** The release introduced the policy change; a worker logged three zero-delay attempts followed by an exhausted budget and `policy=""`. After a restart, the flag remained true and the same empty-policy warning recurred. Following flag disablement, the logged retry used a 1,000 ms delay and succeeded. The timeline says recovery began within two minutes of disablement.
- **Weakens / limits:** Only a few log lines are provided, with no retry-rate totals, tenant-level policy resolution, or direct trace from retries to DB connections. The logs do not show why the policy was empty. The 1,000 ms retry and success are one job, not proof that all jobs followed this path.

### H2: Database connection exhaustion was the primary cause

- **Supports (observed):** The connection limit of 300 was reached, and a worker reported no idle DB connections and a 5-second pool wait.
- **Weakens / limits:** Queue growth and worker CPU decline began before the reported connection maximum. API rollback did not clear the stuck backlog, whereas flag disablement was followed by recovery. Database saturation is strongly supported as a proximate condition or contributing factor, but a separate database fault is not established.

### H3: The API release caused a job-creation defect independent of the flag

- **Supports (observed):** Queue growth began five minutes after the API deployment; rollback normalized new job creation.
- **Weakens / limits:** The backlog stayed stuck after rollback and recovery followed flag disablement. The US region ran the same release without an alert at 2% flag exposure. This points toward exposure or workload differences, but does not isolate the flag because regional conditions are not provided.

### H4: Insufficient worker capacity or a worker-pool defect was the initiating cause

- **Supports (observed):** Worker CPU fell, scaling the pool coincided with faster queue growth, and a restart only helped temporarily.
- **Weakens / limits:** These changes may be responses to the retry/DB pressure rather than independent causes. No worker saturation, scheduling, or pool-health diagnostics are provided. Increasing workers may have added concurrent DB demand, but that is an inference.

## What remains unknown

- The exact deployed code/configuration and how empty tenant policies were resolved.
- Retry volume, retry delay distribution, affected tenants/jobs, and per-region flag exposure over time.
- Whether database connection growth was caused by retry amplification, worker scaling, a leak, or another workload.
- The number of customers affected, checkout failure rate, job loss/duplication, and any data integrity impact.
- Why the worker pool stalled again after its restart and how much of the 10:18 recovery was due to backlog draining versus restored processing.
