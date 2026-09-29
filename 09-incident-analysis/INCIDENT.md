# Queue incident analysis

## Scope and impact — observed facts

Sources: `TIMELINE.md` and `LOGS.txt` only. Times are UTC; the incident date is not explicitly stated. The release identifier is not sufficient to establish that date.

- In eu-west, queue depth began rising at 09:07 and the backlog cleared at 10:18: approximately 71 minutes from the first reported queue degradation to clearance, not necessarily 71 minutes of uniform customer impact.
- Job-age and checkout-latency alerts fired at 09:11. This establishes delayed processing and a checkout-latency signal; affected customer counts, actual latency, failed checkout counts, and financial impact are unavailable.
- Worker CPU fell from 65% to 18%. Database connections reached the configured maximum of 300 at 09:20; an API connection-allocation error was logged at 09:19:52.
- Impact was not universal: job 92 for tenant beta succeeded at 09:07:03. The US region ran the same release with the flag enabled for 2% of tenants and had no alert. Absence of an alert does not establish absence of degradation.
- The record does not establish lost jobs, duplicate processing, data corruption, or their absence. Backlog clearance alone does not verify correct completion of every job.

## Concise timeline — observed facts

| Time (UTC) | Recorded event |
| --- | --- |
| 09:02 | API release `2026.09.23.1` deployed, adding a tenant-specific retry policy. |
| 09:06:58 | Worker 17 logged three retries for acme job 81 with `delay_ms=0`, then budget exhaustion with `policy=""` and `elapsed_ms=41`. |
| 09:07–09:11 | eu-west queue depth rose and worker CPU fell. At 09:07:01, worker 22 reported a 5,000 ms DB pool wait with 10 active and zero idle connections. Job-age and checkout-latency alerts fired at 09:11. |
| 09:14 | Workers increased from 40 to 90; queue depth subsequently rose faster. |
| 09:19:52–09:20 | API logged unavailable DB connection slots; DB connections reached the configured maximum of 300. |
| 09:24 | API deployment rolled back. New job creation normalized, but the backlog remained stuck. |
| 09:31–09:35 | One worker pool restarted and processed jobs normally for four minutes, then stalled. Worker 51 started with default `exponential` and flag enabled; at 09:35:12 it logged budget exhaustion for job 319 with `policy=""` and `elapsed_ms=38`. |
| 09:43–09:45 | Retry-policy flag disabled at 09:43; recovery began within two minutes. Worker 51 saw `feature_flag=false` at 09:43:07; job 319 then retried with a 1,000 ms delay and succeeded at 09:43:10. |
| 10:18 | Backlog cleared. |

## Most likely root cause — inference, moderate confidence

The leading explanation is a defect in the flag-controlled tenant retry-policy path, potentially involving policy resolution or fallback when a policy is empty. That path appears associated with immediate retries and rapid budget exhaustion. Retry pressure likely contributed to DB contention and stalled queue processing; increasing worker concurrency may then have amplified contention.

This is a causal hypothesis, not an established implementation diagnosis. The evidence does not show whether an empty policy actually selects zero delay, whether it is merely a logging artifact, whether retries retain connections, or which failures initiated the retries. Three retries followed by budget exhaustion demonstrate a bounded sequence in the sample, not an infinite retry loop or a measured system-wide retry storm.

The flag intervention is more diagnostic than deployment timing alone: one worker logged a flag change followed by a delayed retry and success for the same job that had exhausted its budget earlier, and regional recovery followed. It is still not a controlled experiment; unrecorded changes or changing load could contribute. Rolling back the API did not establish that the worker-side policy path or its configuration had been reverted.

## Competing hypotheses and evidence

| Hypothesis | Supporting observations | Evidence that weakens or limits it | Assessment |
| --- | --- | --- | --- |
| Tenant retry-policy resolution/fallback defect caused excessive immediate retries and downstream contention. | Feature introduced shortly before degradation; job 81 has zero-delay retries and an empty policy; job 319 repeats empty-policy budget exhaustion after restart despite an exponential startup default. Flag disable is followed by a 1,000 ms retry, success, and recovery. Lower US flag exposure coincides with no alert. | No code, effective tenant settings, underlying retry errors, aggregate retry rate, or connection ownership traces. US traffic and eu-west exposure are unknown. Empty-policy logging alone does not prove bad execution. | Leading trigger; moderate confidence. Exact code defect and resource mechanism remain unproven. |
| Primary DB slowdown, lock contention, or connection leak caused retries and queue stalls. | Pool waits, low worker CPU, connection exhaustion, and temporary benefit from restart fit resource contention. | Immediate retries are logged before the first supplied pool-wait warning; recovery tracks flag disable. These weaken a DB-only explanation but cannot exclude earlier unlogged DB trouble. No query, lock, session-age, or DB resource data. | Plausible initial cause or co-cause; insufficient evidence to establish a leak or lock fault. |
| Worker scale-up independently caused connection exhaustion. | Raising workers from 40 to 90 preceded the global connection maximum; queue growth accelerated afterward. | Queue degradation and a local pool wait preceded scale-up. Only one pool's active count is supplied, so total demand cannot be calculated from the logs. | Cannot explain onset; likely amplifier if additional workers opened or competed for connections. |
| API release produced excess or malformed jobs, leaving a persistent backlog. | Release preceded onset; new job creation normalized after API rollback. | Backlog remained stuck after rollback; restarting a worker pool helped only briefly; flag disable preceded sustained recovery. No enqueue-rate or payload samples show excess or malformed jobs. | Possible upstream contributor, but an API-only explanation is incomplete. |
| Tenant-specific workload or a problematic job was the primary trigger. | acme job 81 retried while beta job 92 succeeded; job 319 later exhausted its budget. | Tiny sample; tenant for job 319 and per-tenant exposure/load are unknown. Job 319 succeeded after flag disable, which points toward an interaction with retry behavior. | Plausible reason retries began or impact varied; unsupported as a standalone root cause. |

## Contributing factors — inference unless stated otherwise

- **Concurrency under DB pressure:** scale-up occurred after a pool-wait warning and before global exhaustion (observed). Additional connection demand likely reduced headroom, but per-process pool sizes and actual connections are missing.
- **Uneven mitigation coverage:** API rollback normalized creation without clearing the stall; a worker subsequently reported the flag enabled (observed). The worker policy path likely remained active, but worker versions and the rollback's exact scope are unknown.
- **Policy/default inconsistency:** an exponential startup default and a later empty logged policy coexist (observed). A tenant override, dynamic config refresh, or fallback defect could explain this; none is confirmed.
- **Retry pressure with limited progress:** immediate retries, budget exhaustion, and DB waits coexist (observed). They may form a feedback loop that reduces useful throughput. The four-minute restart reprieve is compatible with resource accumulation or repeated workload exposure, not proof of either.
- **Detection and rollout visibility:** supplied alerts cover job age and checkout latency. The record does not establish whether retry-rate, config-validation, or DB-headroom alerts existed or whether this rollout was canaried.

## Remaining unknowns

- Exact policy implementation, meaning of `policy=""`, tenant overrides, flag evaluation history, worker versions, and configuration propagation across rollback/restart.
- Original retryable errors; aggregate attempts per job; delay distributions; requeue, budget-reset, and terminal-failure behavior; whether retries hold DB connections.
- DB connection ownership and limits by service, pool sizes, transaction/query duration, locks, resource pressure, and possible leaks before onset.
- Arrival versus completion rates, actual queue/job-age and checkout-latency values, eu-west flag exposure, and comparable US workload and alert sensitivity.
- Affected tenants/jobs/checkouts; final job outcomes, duplicates, data integrity, and whether service remained stable after 10:18.
- Any concurrent infrastructure changes or interventions omitted from the supplied timeline.
