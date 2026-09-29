# Incident report: eu-west queue backlog and checkout latency (2026-09-23, UTC)

Sources: `TIMELINE.md` (operator timeline) and `LOGS.txt` (12 log lines, apparently
a filtered excerpt). Throughout this document, **Observed** means the statement is
taken directly from one of those two sources; **Inferred** means it is our
interpretation and could be wrong. Correlation in time is noted as such and is not
treated as proof of causation.

## 1. Summary

Shortly after the 09:02 deploy of api `2026.09.23.1` (which adds a tenant-specific
retry policy behind the feature flag `tenant_retry_policy`), eu-west workers stopped
draining the job queue. Symptoms lasted from 09:07 until the backlog cleared at
10:18 (about 71 minutes). Scaling workers up and rolling back the API deploy did not
restore processing; disabling the feature flag at 09:43 did, with recovery starting
within two minutes. The most likely trigger is that, with the flag on, the retry
policy resolved to an empty policy (`policy=""`) for some tenants, producing
zero-delay retries that exhausted the retry budget within tens of milliseconds and
left workers stalled. The exact mechanism by which exhausted retries stalled
workers, and why the policy was empty, are not established by the available data.

## 2. Impact

### Observed
- Region: eu-west. The US region ran the same release with the flag enabled for
  only 2% of tenants and raised no alert.
- Queue depth rose from 09:07; the backlog was cleared at 10:18 (~71 minutes of
  degraded or absent job processing).
- Alerts for job age and checkout latency fired at 09:11. Recovery began within two
  minutes of the 09:43 flag disable (~09:45), so alert-level customer impact lasted
  at least ~34 minutes, with a tail until 10:18.
- Database connections hit the configured maximum of 300 at 09:20; `api-03` logged
  `db remaining connection slots reserved` at 09:19:52, so the API tier was unable to
  obtain database connections for at least part of the window.
- New job creation was abnormal until the API rollback at 09:24 (the timeline says
  it "normalizes" then; whether it had been failing or elevated is not stated).
- Worker CPU dropped from 65% to 18% at 09:07 while queue depth rose.

### Inferred / not yet quantified
- Customer-visible effect: slower checkouts from at least 09:11 to ~09:45, and
  possibly checkout errors while the API had no database connections (around
  09:20-09:24, duration unknown).
- Jobs that hit `retry_budget_exhausted` during the window may have been
  dead-lettered, delayed, or lost; their final disposition is unknown. Job 319 is
  known to have succeeded at 09:43:10. Job 81's outcome is not in the logs.
- Number of affected tenants and jobs: unknown. The only tenant seen with the empty
  policy is `acme`; tenant `beta` processed successfully at 09:07:03.
- If the API tier also applied zero-delay retries when creating jobs, duplicate jobs
  are possible. No evidence either way.

## 3. Concise timeline (UTC)

| Time | Event | Source | Status |
|---|---|---|---|
| 09:02 | Deploy api `2026.09.23.1`; adds tenant-specific retry policy | TIMELINE | Observed |
| 09:06:58 | worker-17, job 81, tenant acme: attempts 1-3 all `result=retry delay_ms=0` within the same second; then `WARN retry_budget_exhausted policy="" elapsed_ms=41` | LOGS | Observed |
| 09:07:01 | worker-22: `db pool wait exceeded wait_ms=5000 active=10 idle=0` | LOGS | Observed |
| 09:07 | eu-west queue depth starts rising; worker CPU 65% -> 18% | TIMELINE | Observed |
| 09:07:03 | worker-08, job 92, tenant beta: success in 830 ms | LOGS | Observed |
| 09:11 | Alerts fire: job age, checkout latency | TIMELINE | Observed |
| 09:14 | On-call scales workers 40 -> 90; queue depth rises faster | TIMELINE | Observed |
| 09:19:52 | api-03: `ERROR db remaining connection slots reserved` | LOGS | Observed |
| 09:20 | DB connections at configured max (300) | TIMELINE | Observed |
| 09:24 | API deploy rolled back; new job creation normalizes; backlog still stuck | TIMELINE | Observed |
| 09:31:10 | Restarted pool: worker-51 startup with `config_retry_default="exponential" feature_flag=true` | LOGS | Observed |
| 09:31-09:35 | Restarted pool processes jobs normally for ~4 minutes | TIMELINE | Observed |
| 09:35:12 | worker-51, job 319: `retry_budget_exhausted policy="" elapsed_ms=38`; the pool stalls at about this time | LOGS + TIMELINE | Both observed; that one caused the other is inferred |
| 09:43:07 | worker-51: `config_changed feature_flag=false` | LOGS | Observed |
| 09:43:09-10 | worker-51, job 319: attempt 1 `result=retry delay_ms=1000`; attempt 2 success in 190 ms | LOGS | Observed |
| ~09:45 | Recovery begins | TIMELINE | Observed |
| 10:18 | Backlog cleared | TIMELINE | Observed |

Derived intervals (arithmetic on observed times): first diagnostic log line to
symptom-based alert, 4 minutes; first symptom to flag disable, 36 minutes; API
rollback to flag disable, 19 minutes; job 319 was associated with worker-51 for
about 8 minutes (09:35:12 to 09:43:09) before being reset to attempt 1.

## 4. Most likely root cause

**Inferred.** With `tenant_retry_policy` enabled, the retry-policy lookup returned
an empty policy (`policy=""`) for at least some tenants instead of falling back to
the configured default (`config_retry_default="exponential"`). An empty policy
produced retries with `delay_ms=0`, so the retry budget was consumed in roughly
40 ms (three attempts for job 81), before whatever transient condition caused the
first failure could clear. Jobs for affected tenants therefore failed outright
instead of succeeding on a backed-off retry. The contrast is visible in the logs:
with the flag off, job 319 got a 1000 ms delay on attempt 1 and succeeded on
attempt 2.

Something in the exhausted-budget path then left workers stalled rather than merely
failing the job: worker CPU fell to 18% (workers were waiting, not busy-looping),
per-worker DB pools were fully in use (`active=10 idle=0` with 5 s waits), and job
319 stayed attached to worker-51 for ~8 minutes. The stall mechanism (a held
connection, an unreleased job lease, a blocking requeue, or something else) is not
identifiable from the data.

Why we call this the trigger rather than the defect: the flag disable resolved the
incident, but the underlying defect could be any of (a) tenants missing a policy
entry in config, (b) a resolver bug that returns an empty policy, or (c) a config
propagation problem specific to eu-west. Which one is unknown.

## 5. Hypotheses and evidence

### H1 (primary): flag-gated retry policy resolves empty -> zero-delay retries -> instant budget exhaustion -> worker stall
Supporting (observed):
- First `delay_ms=0` / `policy=""` line at 09:06:58, five minutes after deploy and
  seconds before queue depth began rising at 09:07.
- The restarted pool worked normally until its first `policy=""` event at 09:35:12,
  about four minutes after startup, matching the timeline's "four minutes, then
  stalls".
- Disabling the flag at 09:43:07 was followed within two seconds by the same job
  (319) retrying with `delay_ms=1000` and succeeding, and by region-wide recovery
  within two minutes. No other change was made at that time.
- The US region, same release, 2% flag exposure, had no alert.
- worker-51's own startup line shows the default policy was `exponential`, so the
  zero-delay behaviour came from the tenant-specific path, not the default.
Weakening / caveats:
- The stall mechanism is not shown. Zero-delay retries alone should make a job fail
  fast, not block a worker with low CPU.
- Only two affected jobs (81, 319) and one affected tenant (acme) appear in the
  excerpt; the fraction of tenants with an empty policy is unknown.
- "Four minutes then stalls" and the 09:35:12 event is a single coincidence on a
  single worker.
- We do not know the eu-west flag rollout percentage; the US comparison assumes it
  was substantially higher than 2%.

### H2: database connection exhaustion was the primary cause
Supporting (observed): pool-wait warning at 09:07:01; API `remaining connection
slots reserved` at 09:19:52; DB at max at 09:20; checkout latency alert.
Weakening (observed): the pool-wait warning came 3 seconds *after* the first
zero-delay retry storm; DB reached its maximum only after workers were scaled to
90 at 09:14; the API rollback restored job creation but not the backlog; the flag
disable, which changed nothing about the database, triggered recovery. DB
exhaustion is better explained as a consequence and amplifier than as the origin.
Unknown: whether the exhausted-retry path leaks or holds connections, which would
link H1 and H2 directly.

### H3: the worker scale-up (40 -> 90) caused the incident
Weakening (observed): queue depth was already rising at 09:07, seven minutes before
the scale-up. Supporting as an amplifier (observed): queue depth rose faster after
09:14, DB hit 300 connections six minutes later, and the API lost DB access at
09:19:52. Inferred: with per-worker pools of 10 (from `active=10 idle=0`), 90
workers can demand 900 connections against a cap of 300, so more workers meant more
contention for the same database the API depends on.

### H4: the API code change itself (independent of the flag) caused the incident
Supporting (observed): new job creation normalized after the API rollback at 09:24.
Weakening (observed): the backlog stayed stuck after rollback; US ran the same
release without alerting; the flag disable, not the rollback, produced recovery.
Open question: "normalizes" could mean job creation had been failing (starved of DB
connections) or had been elevated (e.g. API-side zero-delay retries creating
duplicates). Either reading is consistent with the evidence.

### H5: pre-existing transient failures are the real problem
Supporting (observed): even with the flag off, job 319's attempt 1 returned `retry`,
so the underlying operation needs retries in normal operation. Assessment: this is a
latent condition that the retry policy normally absorbs, not the cause of the
outage; it does mean retry behaviour is on the critical path and any regression in
it is high-impact.

## 6. Contributing factors

1. **No safe fallback for an empty policy** (inferred). The default policy was
   `exponential`, but an empty tenant policy was applied as-is, yielding
   `delay_ms=0`.
2. **Worker scale-up under DB contention** (observed effect, inferred mechanism).
   Increasing workers to 90 at 09:14 made queue depth rise faster and coincided
   with the DB reaching its 300-connection cap and the API losing DB access.
3. **Shared database with no connection reserve for the API tier** (inferred from
   the api-03 error). Worker-side saturation spilled over into checkout latency.
4. **Rollback scope mismatch** (observed timing, inferred lesson). Rolling back the
   API at 09:24 did not change worker behaviour; workers still evaluated
   `feature_flag=true` at 09:31. The flag was not disabled until 09:43, 19 minutes
   later. Whether workers were part of the rollback is unknown.
5. **Uneven flag rollout** (partly observed). US was at 2%; eu-west's percentage is
   unknown but evidently high enough for region-wide impact, with no staged ramp
   visible in the timeline.
6. **Detection gap** (observed). The diagnostic signal (`policy=""`, `delay_ms=0`,
   `retry_budget_exhausted`) was logged at WARN at 09:06:58; alerts fired on
   downstream symptoms four minutes later, and identifying the flag took a further
   32 minutes.
7. **Retry-dependent workload** (observed). Jobs return `retry` in normal operation,
   so retry policy defects convert transient failures into hard failures.

## 7. What remains unknown

- Why `policy` was empty: missing tenant config entries, resolver bug, or eu-west
  config propagation. Which tenants and what fraction were affected.
- The eu-west flag rollout percentage, and whether the US 2% tenants saw any
  `policy=""` events or sub-threshold degradation.
- The stall mechanism: what a worker does after `retry_budget_exhausted` (ack, nack,
  requeue, hold), whether DB connections are released, and why job 319 stayed on
  worker-51 for ~8 minutes with its attempt counter later reset to 1.
- What the 09:24 rollback actually reverted (API only, or workers too), and whether
  the retry logic lives in a shared library or is driven by config.
- Whether "new job creation normalizes" means creation had been failing or
  elevated, and whether duplicate jobs were created.
- The cause of the underlying transient `retry` results (job 81 failed three times
  in 41 ms, far faster than a 5 s pool wait, so those failures were not pool waits).
- Database connection accounting during the window: connections held by workers
  versus API, and whether any leaked.
- Final disposition of every job that exhausted its retry budget between 09:06 and
  09:45, and the customer-facing error rate (not just latency) on checkout.
- Whether the log excerpt is complete for the workers shown; gaps (e.g. worker-51
  between 09:35:12 and 09:43:07) may be filtering rather than silence.
