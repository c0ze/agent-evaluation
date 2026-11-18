# Queue incident in eu-west

## Observed impact and timeline

Jobs accumulated in eu-west from 09:07 UTC. Job age and checkout latency crossed alert thresholds at 09:11. At least one job still succeeded during the buildup. The backlog cleared at 10:18, 71 minutes after it began growing. The records give no count of affected tenants, delayed jobs or failed checkouts, and no time when checkout latency returned to normal.

| UTC | Observations from TIMELINE.md and LOGS.txt |
| --- | --- |
| 09:02 | API release `2026.09.23.1` introduced a tenant-specific retry policy. |
| 09:06:58–09:07:03 | Worker 17 logged three retries with zero delay for job 81, then exhausted its budget in 41 ms with an empty policy field. The queue began growing and worker CPU fell from 65% to 18%. Worker 22 reported a five-second database pool wait with all ten connections active. Job 92, for another tenant, succeeded on its first attempt. |
| 09:11–09:20 | Job age and checkout latency triggered alerts. The worker count rose from 40 to 90 at 09:14, and queue growth accelerated. The API reported a database connection refusal at 09:19:52. Connections reached the configured maximum of 300 by 09:20. |
| 09:24–09:35 | After the API rollback, new job creation normalized, but the backlog remained stuck. A restarted worker pool processed jobs normally for about four minutes. Worker 51 logged an exponential default and an enabled flag at startup, then logged an exhausted budget and empty policy for job 319 at 09:35:12. |
| 09:43–10:18 | The retry flag was disabled. At 09:43:09 worker 51 logged a 1,000 ms retry delay for job 319. The next attempt succeeded. Regional recovery began within two minutes and the backlog cleared at 10:18. |

## Causal assessment

| Hypothesis | Supporting evidence | Limits and interpretation |
| --- | --- | --- |
| **Most likely cause — the enabled tenant retry path allowed immediate retries for some jobs.** Those retries likely consumed worker and database capacity needed for other jobs. | Job 81 shows three zero-delay retries and an empty logged policy. Job 319 exhausted its budget despite a configured exponential default. The same worker and job then showed a delayed retry and success immediately after the flag change. The US ran the same release with only 2% of tenants enabled and had no alert. | The logs show neither the effective policy lookup nor why the first attempts needed a retry. An empty log field alone cannot establish a missing tenant setting or a fallback bug. The US comparison lacks matched load and tenant data. |
| **Database contention likely amplified the incident.** A database slowdown as the initial trigger also remains possible. | A worker reported a pool wait early, CPU fell as jobs accumulated, and the database later refused connections. Adding workers could have increased competition for connections, consistent with faster queue growth after 09:14. | The first recorded zero-delay burst precedes the pool warning by three seconds, but the warning describes a five-second wait. Their onset order is unresolved. There is no pre-incident query-latency series or measure of connections added by scaling. |
| **Higher job intake may have contributed to the buildup.** | New job creation normalized after the API rollback at 09:24. | The existing queue stayed stuck, a pool restart brought only four minutes of progress, and a worker still reported the flag enabled. Intake alone poorly explains the sustained stall. |

The remaining gaps are the scope of customer impact, the errors that triggered retries, the source of the empty policy field, and the share of database pressure attributable to retries, worker scaling or an independent slowdown.
