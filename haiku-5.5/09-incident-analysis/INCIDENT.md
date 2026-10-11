# Incident analysis: eu-west job backlog and checkout latency

**Inputs:** `TIMELINE.md` (summary, UTC) and `LOGS.txt` (an 11-line excerpt).
Statements marked **observed** come directly from those files. Statements marked
**inferred** are my reasoning from them and are not proven.

## Summary

For about 70 minutes, background jobs in eu-west queued up, checkout latency rose,
and the database reached its configured connection limit. The most likely driver is
the tenant-specific retry policy behind the `tenant_retry_policy` flag. Jobs with an
empty retry policy appear to be retried with no delay and to exhaust their retry
budget almost at once, which keeps database connections busy. Recovery followed the
flag being turned off at 09:43 UTC, not the API rollback at 09:24 UTC. Confidence is
moderate. The trigger that started the retries is not established.

## Impact

**Observed**
- eu-west job processing was degraded from about 09:07 until the backlog cleared at
  10:18 UTC (about 71 minutes).
- Job-age and checkout-latency alerts fired at 09:11. When checkout latency returned
  to normal is not recorded.
- The database reached its 300-connection limit at about 09:20. An API host logged a
  connection-slot error at 09:19:52, so the API tier was affected, not only workers.
- The US region ran the same release with the flag enabled for 2% of tenants. No
  alert fired there.

**Not known:** the number of delayed, failed, or dead-lettered jobs; the number of
affected tenants; the number of failed or slowed checkouts; whether any job was lost
permanently; and the incident date. The release version `2026.09.23.1` suggests
2026-09-23, but the files do not state the date, so I have not assumed it.

## Timeline (UTC)

| Time | Event | Source |
|---|---|---|
| 09:02 | API `2026.09.23.1` deployed; adds tenant-specific retry policy | TIMELINE |
| 09:06:58 | worker-17, job 81 (tenant acme): attempts 1–3 with `delay_ms=0`, then budget exhausted with `policy=""` after 41 ms | LOGS |
| 09:07 | eu-west queue depth starts rising; worker CPU falls from 65% to 18% | TIMELINE |
| 09:07:01 | worker-22: DB pool wait exceeds 5 s (`active=10 idle=0`) | LOGS |
| 09:07:03 | worker-08, job 92 (tenant beta): succeeds on attempt 1 | LOGS |
| 09:11 | Alerts fire: job age, checkout latency | TIMELINE |
| 09:14 | Workers raised from 40 to 90; queue depth rises faster | TIMELINE |
| 09:19:52 | api-03: "remaining connection slots reserved" error | LOGS |
| ~09:20 | Database connections reach configured maximum (300) | TIMELINE |
| 09:24 | API rolled back; new job creation normalizes; backlog stays stuck | TIMELINE |
| 09:31:10 | worker-51 pool restarted; startup shows `config_retry_default="exponential"`, `feature_flag=true` | LOGS, TIMELINE |
| ~09:35 | Restarted pool processes normally for about four minutes, then stalls. 09:35:12: job 319 exhausts budget with `policy=""` after 38 ms | TIMELINE, LOGS |
| 09:43:07 | `tenant_retry_policy` set to `false` | LOGS |
| 09:43:09–10 | job 319 retries with `delay_ms=1000`, then succeeds in 190 ms | LOGS |
| ~09:45 | Recovery begins (within two minutes of the flag change) | TIMELINE |
| 10:18 | Backlog cleared | TIMELINE |

Intervals: deploy to rollback 22 min; deploy to first alert 9 min; first alert to
flag off 32 min; flag off to backlog cleared 35 min.

## Most likely root cause (moderate confidence)

The tenant-specific retry policy path, active when `tenant_retry_policy` is on, can
resolve to an empty retry policy. Workers then appear to apply no backoff. Failed
jobs retry back-to-back, exhaust their budget within tens of milliseconds, and hold
database connections. That load drove the database to its connection limit, and the
increase from 40 to 90 workers added more demand. Turning the flag off restored
backoff, and the backlog began to drain within minutes.

**Evidence supporting it**
- **Observed:** two exhaustion events carry `policy=""` (job 81 at 09:06:58; job 319
  at 09:35:12). Job 81's retries show `delay_ms=0`.
- **Inferred:** the empty policy is what produces the zero delay. The retry lines do
  not print the policy, so this link rests on same-job, same-second timing.
- **Observed:** the worker's startup config has a default (`exponential`), yet job 319
  exhausted with an empty policy while the flag was on.
  **Inferred:** the empty value is not replaced by the default.
- **Observed:** after the flag was turned off, job 319 (same ID) retried with
  `delay_ms=1000` and succeeded. **Inferred:** the flag changes how an empty policy is
  handled. This is not a controlled test; the job's state changed between the lines.
- **Observed:** the pool restarted with the flag still on stalled about four minutes
  later. The failure returned while the flag was still on.
- **Observed:** recovery began within two minutes of the flag change, and the API
  rollback at 09:24 had not restored throughput. The flag matches the recovery; the
  API version alone does not.
- **Observed:** CPU fell as the backlog built, and the pool showed `idle=0`.
  **Inferred:** workers were waiting on database connections, not computing.

**Evidence that weakens or complicates it**
- **The trigger is unknown.** The retry lines have no error reason. Some other failure
  (for example, a database pool timeout) may have started the retries, with the
  empty-policy path amplifying them. Amplification is better supported than initiation.
- **The source of the empty value is unknown.** It could be the API write, a
  worker-side lookup miss, or stale queued records. The API rollback normalized new
  job creation, but the backlog stayed stuck. That suggests queued jobs still carry
  the empty value, or that workers keep failing lookups. The materials cannot separate
  these.
- **The flag's enable time is not recorded.** The first logged storm event is at
  09:06:58, about five minutes after the deploy. Whether the deploy or a later flag
  change started the problem depends on when the flag was enabled, which is not in the
  files.
- **The four-minute delay before the restarted pool stalled is unexplained.** It could
  be queue ordering (the pool reached affected jobs after four minutes), a time-based
  lookup failure, or slow accumulation (H2 below).
- **The US comparison is suggestive only.** Two percent exposure with no alert is
  consistent with an exposure-dependent failure, but the regions differ in load,
  tenant mix, and alert coverage. Lower exposure may also mean less load, not safety.
- **Job 319 changes state across the timeline.** It is exhausted at 09:35 and shows
  `attempt=1` at 09:43. The reset suggests a requeue or a reused job ID. Comparisons
  across that boundary are weaker.
- **Beta's success at 09:07:03 says nothing about beta's risk.** It succeeded on its
  first attempt, so the retry path was not exercised.
- **The excerpt is small.** Eleven log lines cannot show how often the empty value
  occurred.

## Alternative hypotheses

| # | Hypothesis | Supporting evidence | Weakening evidence | Status |
|---|---|---|---|---|
| H1 | Flag-gated empty-policy retry storm holds database connections (above) | Recovery after flag-off; `policy=""` at both exhaustions; `delay_ms` 0 vs 1000 | Trigger and origin of the empty value unknown | Leading |
| H2 | Connections leak or stay held in the new code path, accumulating per worker | Pool at `idle=0`; stall about four minutes after restart; saturation about five minutes after deploy | Recovery within two minutes of flag-off with no restart. Inferred: a leak would normally keep connections held until the process restarts, depending on pool reclaim behavior | Not excluded; needs per-connection attribution |
| H3 | Connection capacity alone: the 40 to 90 scale-up exceeds the database limit, and retries are incidental | Limit reached about six minutes after the scale-up; queue grew faster after it | Recovery at 09:43 with no recorded scale-down. If workers stayed at 90, capacity alone does not explain recovery | Contributing factor; not sufficient alone |
| H4 | Database-side or traffic-side cause (slow queries, locks, traffic spike) | None in the materials | No database latency, lock, or traffic data | Not evaluated |

## Contributing factors

1. **No default fallback for an empty retry policy.** A default exists
   (`config_retry_default=exponential`), but an empty value appears to bypass it
   (inferred).
2. **Retry budget counts attempts, with no minimum delay or jitter.** Exhaustion took
   38 to 41 ms in both logged cases.
3. **Worker scale-up without a visible connection-budget check.** Queue depth grew
   faster after the change to 90 workers (observed), and the database reached its
   limit about six minutes later. Inferred and unverified: if each worker can hold up to
   10 connections, as the `active=10` warning suggests, about 30 busy workers would
   reach 300. The fleet had run at 40 before the incident, so normal use probably stayed
   under the limit. The materials do not record pool sizing or pre-incident connection
   counts.
4. **Flag exposure and rollout controls.** eu-west exposure is not stated. The US's 2%
   exposure produced no alert. The materials give no evidence of staged exposure or
   automatic holds.
5. **Detection coverage.** The only alerts named are job age and checkout latency. No
   retry-rate, zero-delay, empty-policy, or database-connection alert is mentioned. The
   connection limit was reached nine minutes after the first alert.
6. **Mitigation sequence.** The API rollback at 09:24 did not restore service. The
   pool restart at 09:31 ran with the flag still on, and the stall recurred. The flag
   was turned off at 09:43, 32 minutes after the first alert. The files do not show
   when the flag was first considered or whether the runbook lists it as a first check.
   This is a process gap, not an individual error.

## Unknowns and what would resolve them

- **What caused the first retries** (error on job 81's first attempt, original failure
  of job 319): per-job error logs.
- **Where the empty policy originates** (API write, worker lookup, or stale records):
  policy values at enqueue time and at read time.
- **When the flag was enabled in each region, and at what exposure:** flag change audit
  log.
- **Whether the retry storm held connections (H1) or leaked them (H2):** database
  connections attributed by pool, worker, and state over time.
- **What explains the four-minute stall:** worker-51's job sequence and policy values
  after 09:31.
- **Whether job 319's attempt reset is a requeue or a reused ID:** queue record history.
- **Whether workers were scaled back after 09:43:** scaling event log.
- **Whether the US region had a hidden backlog:** US queue age, retry, and connection
  metrics for 09:00 to 10:20.
- **Customer impact counts and the incident date:** queue, checkout, and deploy records.
