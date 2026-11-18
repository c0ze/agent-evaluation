# eu-west queue incident

## Impact

The eu-west queue began growing around 09:07 UTC, and job age and checkout latency alerted at 09:11. Processing began to recover within two minutes of the 09:43 flag disable, and the backlog cleared at 10:18. The US region ran the same release with the flag enabled for 2% of tenants and had no alert. The available records do not quantify affected tenants, checkout failures, or the full duration of elevated checkout latency.

## Timeline (UTC)

| Time | Observed event |
| --- | --- |
| 09:02 | API release `2026.09.23.1` deployed with tenant-specific retry policy support. |
| 09:06:58–09:07:03 | Job 81 logged three attempts with a retry delay of zero and exhausted its budget in 41 ms with `policy=""`. Another worker reported exceeding a five-second wait for a database connection with all 10 pool connections active. Job 92 succeeded. Around 09:07, queue depth began rising and worker CPU dropped from 65% to 18%. |
| 09:11–09:20 | Job age and checkout latency alerted. Workers increased from 40 to 90 at 09:14, and queue growth accelerated afterward. The API reported that only reserved database slots remained at 09:19:52, and connections reached the configured maximum of 300 around 09:20. |
| 09:24 | The API rollout was reverted. New job creation normalized, but the backlog remained stuck. |
| 09:31–09:35 | One restarted pool processed jobs normally for about four minutes. It then stalled, and worker-51 logged job 319 exhausting its retry budget in 38 ms with `policy=""`, despite reporting an exponential default at startup. |
| 09:43–10:18 | The `tenant_retry_policy` flag was disabled. Worker-51 logged the change at 09:43:07, a 1,000 ms retry delay for job 319 at 09:43:09, and success for that job at 09:43:10. Recovery began within two minutes, and the backlog cleared at 10:18. |

## Causal assessment

The most likely trigger was a failure in the flag-enabled retry-policy path that let some jobs retry with little or no backoff. The empty policy field is a clue to policy resolution or fallback behavior. Its exact meaning and the code path that produced the delay are unknown. Rapid retries could have increased pressure on database connections, while connection waits could have reduced worker throughput and kept the backlog growing. The records establish that these symptoms overlapped, but they do not establish which symptom began first across the fleet.

| Hypothesis | Supporting evidence | Evidence that weakens or limits it |
| --- | --- | --- |
| The flag-enabled retry path produced ineffective backoff. | Job 81 logged zero-delay retries with an empty policy. The empty policy recurred after a worker restart even though startup reported an exponential default. Job 319 logged a 1,000 ms delay and then succeeded just after the flag changed, and the queue began recovering. The US region had low flag exposure and no alert. | The logs cover a few jobs, and an empty log field does not identify the effective configuration or fallback branch. The regional comparison lacks matched workload, database capacity, and eu-west exposure data. Other conditions may also have changed near recovery. |
| A database problem initiated the incident and the retries followed. | A database pool wait was logged near onset, worker CPU fell while the queue grew, and the database later exhausted available connection slots. These observations are consistent with blocked workers. | The first sampled zero-delay retries precede the first sampled pool wait, and the flag change coincides with a change in retry behavior and recovery. There is no pre-onset database telemetry or session attribution to establish an independent database trigger. |
| An API-side change in job creation was the primary driver. | The queue grew soon after the API release, and new job creation normalized after rollback. | The backlog remained stuck after the rollback. The worker logs and recovery after the flag disable support an ongoing processing problem. Job arrival rates and payload changes are unavailable, so an API-side contribution remains possible. |

## Contributing factors

- Database connection pressure was observed both in worker pools and at the database limit. The simultaneous CPU drop is consistent with workers spending time waiting on connections. The fraction of worker time spent waiting is unknown.
- The increase from 40 to 90 workers may have amplified connection pressure. Queue growth accelerated after the change, but there is no breakdown of database sessions or worker throughput to isolate its effect.
- The API rollback and single-pool restart produced partial or temporary improvement. Worker-51 still reported the flag enabled after restart, and empty-policy failures recurred in that pool.

## Open questions

- What did `policy=""` represent, which tenants and jobs received it, and why did an exponential default at startup coexist with rapid retry exhaustion?
- How much of the backlog came from new arrivals, repeated attempts, or falling completion rates? Which clients held or waited for database connections before and during onset?
- What was the eu-west flag exposure, and how many customer checkouts and jobs were delayed, failed, or affected by retry-budget exhaustion? Did exhausted jobs require reprocessing?
