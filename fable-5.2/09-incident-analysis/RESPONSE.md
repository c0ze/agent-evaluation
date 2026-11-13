# Response: Task 09

I wrote `INCIDENT.md`, `ACTIONS.md`, and `CUSTOMER_UPDATE.md` from `TIMELINE.md` and `LOGS.txt` only. Nothing was run or reproduced; every conclusion rests on a 12-line log excerpt and a 10-entry timeline.

## Confidence

| Claim | Confidence | Why |
|---|---|---|
| The flag-on `tenant_retry_policy` path was needed for the stall | High, about 85% | Recovery within two minutes of flag-off after 19 minutes of none; job 319 failed with the flag on and succeeded on the same worker two seconds after it went off; a restarted pool with the flag on stalled again |
| The specific defect is an empty policy that does not fall back to the default, giving zero-delay retries | Moderate, about 60% | Seen on two jobs only; `policy=""` could be a logging gap |
| Zero-delay retry exhaustion is what stalled workers and exhausted database connections | Low, about 35% | No evidence links the two. One worker's pool was already full about two seconds before the first exhaustion in the excerpt, and worker CPU fell rather than rose |
| The scale-up from 40 to 90 workers made things worse | Moderate, about 60% | Ordering fits and the connection arithmetic is plausible, but the pool size comes from one log line |

## Next two pieces of data

1. **The flag audit log for `tenant_retry_policy` in both regions, with the stored retry policy for each enabled tenant.** It shows when the flag went on in eu-west and at what percentage, which would explain the five minutes between deploy and onset. It also shows whether the failing jobs belonged only to flag-enabled tenants with an empty policy, which is the test hypothesis A most needs.
2. **Complete worker logs and database connection state for 09:00–09:50**: per-worker pool statistics and a per-client view of database sessions, especially `worker-22` before 09:07:01 and `worker-51` from 09:31 to 09:43. It shows what stalled workers were waiting on and who held the 300 connections, which is the weakest link in the analysis.

## Notes for whoever sends the customer update

- It is 171 words by `wc -w`, counting the title and markdown markers (160 without the title), under the 180 limit.
- The incident date is not in the source material, so the update gives times only. Add the date before sending.
- It commits to contacting customers whose jobs were affected. That depends on the job reconciliation in `ACTIONS.md` (C4) being carried out.
