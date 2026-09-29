# Queue incident analysis

## Impact and scope

**Observed:** In eu-west, queue depth began rising at 09:07 UTC. Alerts for job age and checkout latency fired at 09:11. Database connection capacity was reached around 09:20, and an API database-connection error was logged at 09:19:52. Recovery began within two minutes of the 09:43 flag disable; the backlog cleared at 10:18. The documented queue degradation lasted 71 minutes from first visible growth to clearance. This is not a measured duration of checkout unavailability.

**Observed:** No alert fired in the US, which ran the same API release with the flag enabled for 2% of tenants. That does not establish that every US request was unaffected.

**Unknown:** Affected customer and job counts, checkout latency distribution and error rate, individual job delays, and whether jobs or checkout side effects were lost or duplicated. The records do not establish a complete outage or data loss.

## Concise timeline

All times are UTC. Sources are [TIMELINE.md](TIMELINE.md) and [LOGS.txt](LOGS.txt); events below are recorded observations.

| Time | Event |
| --- | --- |
| 09:02 | API release `2026.09.23.1` deployed, adding tenant-specific retry policy. |
| 09:06:58 | Job 81 for tenant acme logged three retry attempts with `delay_ms=0` in one second, then budget exhaustion with `policy=""`, `elapsed_ms=41`. |
| 09:07 | eu-west queue depth began rising; worker CPU fell from 65% to 18%. At 09:07:01 one worker logged a 5-second pool wait, `active=10`, `idle=0`. Job 92 for beta succeeded at 09:07:03. |
| 09:11–09:20 | Job-age and checkout-latency alerts fired; workers increased from 40 to 90 at 09:14, followed by faster queue growth. Database connections reached the configured maximum of 300 around 09:20. |
| 09:24 | API release rolled back. New job creation normalized, but the backlog remained stuck. |
| 09:31–09:35 | One worker pool restarted and processed normally for four minutes before stalling. Startup logged default `exponential` and flag `true`; at 09:35:12 job 319 exhausted its retry budget with `policy=""`, `elapsed_ms=38`. |
| 09:43–09:45 | `tenant_retry_policy` disabled; recovery began within two minutes. Worker 51 logged flag `false` at 09:43:07, a 1-second retry delay for job 319 at 09:43:09, and success at 09:43:10. |
| 10:18 | Backlog cleared. |

## Most likely root cause

**Inference, moderate confidence:** The enabled tenant-specific retry path likely allowed rapid retries for some jobs, increasing pressure on a shared database and starving workers of connections. This would explain growing queues alongside falling CPU, and why adding workers could worsen contention. The strongest evidence is the combination of zero-delay retries and blank logged policies before degradation, recurrence after restart despite an exponential startup default, and delayed retry plus success immediately after flag disable.

The precise defect is unconfirmed. A blank tenant policy overriding or bypassing the default is a plausible implementation explanation, not an observed fact. The logs do not establish what `policy=""` means internally, whether retries each open or retain connections, or how many jobs used this path. They also do not reveal the original failure that triggered retry. Flag disable is strong intervention evidence, but a single recovery sequence cannot exclude simultaneous changes or independent dependency recovery.

## Competing hypotheses and evidence

| Hypothesis | Supporting observations | Weakening evidence and limits | Assessment |
| --- | --- | --- | --- |
| H1: Flagged retry behavior amplified database load, possibly through an empty-policy fallback defect. | Job 81 had repeated zero-delay retries and a blank policy near onset. Job 319 had a blank policy after restart with the flag enabled, then a delayed retry and success after disable. The API rollback alone did not clear the backlog. US flag exposure was only 2%. | Few sampled jobs; no implementation, effective tenant configuration, retry-volume metrics, or controlled reproduction. EU flag exposure is unspecified. Regions may differ in load or dependencies. Blank policy logging alone does not prove faulty fallback. | Leading explanation; exact code/configuration cause remains unknown. |
| H2: An independent database leak, lock, slow-query problem, or capacity shortage caused the stalls; retries were a symptom. | A worker pool was full and waiting near onset; global capacity was later reached. Low CPU and transient restart relief are compatible with blocked work or accumulating resources. | Global saturation occurred after queue growth began. Recovery aligned with flag disable, and job 319 then succeeded. Neither observation excludes a database problem, but both favor a retry-related component. No session, lock, or query evidence identifies a leak or bottleneck. | Plausible underlying trigger or co-cause; unproven as the sole cause. |
| H3: The new API release increased job creation enough to overload the system. | Degradation followed deployment; new job creation normalized after API rollback. | Existing backlog stayed stuck after rollback. Flag disable aligned with recovery. The US shared the release without an alert. No arrival-rate measurements establish overload magnitude. Worker version and rollback propagation are unknown. | Possible contributor; insufficient explanation for persistent processing failure. |
| H4: A tenant-specific job or downstream failure triggered otherwise expected retries. | Acme retried while beta succeeded shortly afterward, consistent with differing inputs, configurations, or dependencies. | No original error, downstream-health record, or representative tenant sample. Zero-delay retries and blank policies still require explanation. Job 319's tenant is not given. | Possible initiating condition; does not by itself explain regional queue and database behavior. |

## Contributing factors

- **Observed:** The database had a shared maximum of 300 connections. One worker reported 10 active and zero idle connections. **Inference:** Connection contention constrained useful processing; those local counts do not establish every worker pool's size or ownership of all 300 connections.
- **Observed:** Worker count increased from 40 to 90 before faster queue growth and global saturation. **Inference:** More workers may have increased concurrent connection demand. Temporal association does not prove that scaling caused the worsening; existing retry load may also have grown.
- **Observed:** API rollback normalized new creation but did not free the backlog; restart relief lasted four minutes. **Inference:** The continuing flagged/configured worker path or accumulating database pressure was not removed by those interventions. The supplied records do not establish worker deployment versions or stale configuration.
- **Observed:** The restarted worker advertised an exponential default but later logged a blank job policy. **Inference:** Effective per-job policy validation, fallback handling, or logging needs investigation. An absent safeguard is not yet demonstrated.

## Remaining unknowns

The effective policies and flag exposure by tenant and region; policy parsing and fallback behavior; original retryable errors; retry counts and database work per attempt; whether transactions or connections remained held during retry; database session ownership, locks and query latency; deployment/configuration propagation across producers and workers; other interventions around 09:43; and the extent and integrity of customer outcomes. The next evidence requests are specified in [RESPONSE.md](RESPONSE.md).
