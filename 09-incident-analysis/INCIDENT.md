# Incident: eu-west job queue stall

Sources: `TIMELINE.md` (cited as T) and `LOGS.txt` (cited as L). All times are UTC. The incident date is not stated in either source. The log file is a 12-line excerpt covering five hosts, so anything it does not show may still have happened.

## Summary

Job processing in eu-west stalled from about 09:07 and began recovering about 09:45, within two minutes of the `tenant_retry_policy` feature flag being disabled. The backlog cleared at 10:18.

The most likely root cause is that, with the flag on, workers applied an empty retry policy to some jobs instead of the configured default, so those jobs retried with no delay and exhausted their retry budget in about 40 ms. That the flag-on code path was needed for the stall is well supported. How those failed retries turned into stalled workers and exhausted database connections is not shown by the evidence.

## Impact

Observed:

- **Job processing, eu-west:** queue depth rose from 09:07 and the backlog did not clear until 10:18, 71 minutes later. Recovery began about 36 minutes after onset (T).
- **Checkout:** a checkout latency alert fired at 09:11 (T).
- **API:** `api-03` logged a database connection-slot error at 09:19:52 (L), and database connections reached the configured maximum of 300 at 09:20 (T).
- **US region:** no alert fired (T).

Not known:

- How many tenants, jobs, or checkout requests were affected, and whether checkout requests failed or were only slow.
- Whether any job was lost, dead-lettered, or run more than once.
- Whether the US region had impact below alert thresholds. "No alert" is not the same as "no impact".

## Timeline

| Time | Event | Source |
|---|---|---|
| 09:02 | API release `2026.09.23.1` deployed; it adds a tenant-specific retry policy | T |
| 09:06:58 | `worker-17`: job 81 (tenant `acme`) retries three times in the same second with `delay_ms=0`, then `retry_budget_exhausted policy=""` after 41 ms | L |
| 09:07:01 | `worker-22`: database pool wait exceeds 5000 ms, `active=10 idle=0` | L |
| 09:07:03 | `worker-08`: job 92 (tenant `beta`) succeeds on first attempt in 830 ms | L |
| 09:07 | Queue depth starts rising; worker CPU falls from 65% to 18% | T |
| 09:11 | Alerts fire for job age and checkout latency | T |
| 09:14 | Workers scaled from 40 to 90; queue depth rises faster | T |
| 09:19:52 | `api-03`: `db remaining connection slots reserved` | L |
| 09:20 | Database connections reach the maximum of 300 | T |
| 09:24 | API deploy rolled back; new job creation normalizes; backlog still stuck | T |
| 09:31 | One worker pool restarted; `worker-51` starts with `config_retry_default="exponential" feature_flag=true` | T, L |
| 09:35:12 | `worker-51`: job 319 `retry_budget_exhausted policy=""` after 38 ms. The timeline says the restarted pool stalled after four minutes, which matches this time | L, T |
| 09:43:07 | Flag disabled; `worker-51` logs `config_changed feature_flag=false` | T, L |
| 09:43:09–10 | `worker-51`: job 319 retries with `delay_ms=1000`, then succeeds on attempt 2 | L |
| ~09:45 | Recovery begins | T |
| 10:18 | Backlog cleared | T |

## Most likely root cause

**Inference, not established:** with `tenant_retry_policy` enabled, the worker resolves an empty retry policy for some jobs and does not fall back to its configured default (`exponential`). Retries then run with zero delay and use up the retry budget in tens of milliseconds, so a transient failure has no time to clear and the job does not complete.

Each step and what supports it:

| Step | Status | Basis |
|---|---|---|
| Flag-on jobs retried with zero delay and exhausted their budget in about 40 ms | Observed, for two jobs | Jobs 81 and 319 (L) |
| The policy was empty on those jobs | Observed in the log field | `policy=""` (L). It could also be a field the logger fails to populate |
| The worker had a non-empty default available | Observed | `config_retry_default="exponential"` at `worker-51` startup (L) |
| The default was not applied while the flag was on | Inferred | `delay_ms=0` with the flag on, `delay_ms=1000` on the same job two seconds after the flag went off (L) |
| The flag-on path was needed for the stall | Inferred, well supported | See hypothesis A below |
| Zero-delay retry exhaustion caused workers to stall and connections to run out | Inferred, weakly supported | No log line links the two; see hypothesis A below |

## Hypotheses and evidence

### A. Flag-on retry path is the trigger (most likely)

Supporting:

- Recovery began within two minutes of the flag being disabled, after 19 minutes without recovery following the API rollback (T).
- Job 319 on `worker-51` exhausted its budget with the flag on, then succeeded on the same worker two seconds after the flag went off (L). This is the closest thing to a controlled comparison in the evidence.
- A freshly restarted worker pool, still with the flag on, stalled again after four minutes (T, L). That argues against stale process state as the cause.
- The US region ran the same release with the flag on for 2% of tenants and raised no alert (T).

Weakening:

- The sequence is a single before-and-after observation. The rollback at 09:24 and the restart at 09:31 came first, and a delayed effect from either cannot be excluded on timing alone.
- `worker-22` reported a pool wait of 5000 ms at 09:07:01, so its pool was already full by about 09:06:56. That is two seconds before the first retry exhaustion in the excerpt. Earlier exhaustion events may exist outside the excerpt, or pool exhaustion may have started independently.
- Worker CPU fell rather than rose. Workers were waiting on something, not spinning in a retry loop, and the evidence does not say what. Candidates that have not been tested: the failing path holds or leaks a database connection; exhausted jobs are requeued and block the jobs behind them.
- Only two jobs show the pattern. The tenant of job 319 is not logged.
- The US comparison differs in more than flag exposure (traffic, capacity), and its impact was not measured.

### B. The API release alone is the cause

Supporting:

- Onset was five minutes after the deploy (T).
- Rolling back normalized new job creation (T).

Weakening:

- The backlog stayed stuck for 19 minutes after the rollback, and the restarted worker pool stalled seven minutes after it (T).
- The US region ran the same release without an alert (T).

The release is better read as the vehicle: it introduced the code path that the flag switches on. It is not known whether the empty policy is written onto jobs by the API at enqueue time or resolved by the worker at run time. Either is consistent with the flag-off recovery.

### C. Database connection capacity is the primary cause

Supporting:

- A worker pool was full at 09:07:01, the database hit its 300-connection maximum at 09:20, and the API logged slot errors (T, L).

Weakening:

- The maximum was reached 13 minutes after onset and six minutes after the scale-up, so it follows the stall rather than preceding it.
- Recovery followed a flag change. No database change is recorded.

Connection exhaustion is more likely a consequence and an amplifier than the origin.

### D. The worker scale-up is the cause

Ruled out as the origin, because the stall began seven minutes earlier. It is a probable contributing factor (below).

### E. One tenant's traffic or data

Job 81 belongs to `acme`, and a `beta` job succeeded five seconds later (L). One job per tenant is not enough to say the problem was tenant-specific. The `beta` job succeeded on its first attempt, so it never exercised the retry path.

## Contributing factors

- **Scaling into a stall (probable).** Workers went from 40 to 90 at 09:14; queue depth then rose faster and the database reached its connection limit six minutes later (T). The ordering fits, but causation is not shown.
- **Connection budget (inferred).** If every worker has the pool of 10 seen on `worker-22`, then 40 workers can open 400 connections and 90 can open 900, against a limit of 300. The pool size comes from one log line.
- **Shared database (observed).** The API and the workers draw on the same connection limit, so worker-side exhaustion reached the API (`api-03`, L).
- **Flag exposure (inferred).** The US region had the flag at 2% of tenants. The eu-west percentage is not stated; the contrast in the timeline suggests it was higher.
- **Time to the effective mitigation (observed).** The flag was disabled 32 minutes after the first alert, after a scale-up, a rollback, and a restart.
- **Rollback did not cover the flag (observed).** Rolling back the API left the flag on, and workers kept using it.

## Unknowns

1. When the flag was enabled in eu-west, and for which tenants. Onset came five minutes after the deploy with no recorded flag change in between.
2. What stalled workers were waiting on, and why CPU fell.
3. Why first attempts failed at all. The underlying error is not in the logs, and job 319 also failed its first attempt after the flag went off.
4. Where the empty policy comes from: missing tenant configuration, a lookup bug, or a value written by the API.
5. What happens to a job after `retry_budget_exhausted`. Job 319 reappeared with `attempt=1`, so it was not dropped and its attempt counter was reset. Whether this can run a job's side effects twice is not known.
6. Whether workers were deployed alongside the API at 09:02 and whether they were rolled back at 09:24.
7. Which way job creation was abnormal before the rollback (too many or too few).
8. What caused the checkout latency alert at 09:11, nine minutes before the database connection limit was reached.
9. Whether host clocks in the logs are synchronized closely enough to trust two-second orderings.
