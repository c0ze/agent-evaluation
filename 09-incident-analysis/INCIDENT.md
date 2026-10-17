# Incident analysis — eu-west queue backlog (2026-09-23)

Sources: `TIMELINE.md` and `LOGS.txt` only. All times UTC.
Observed facts and inference are kept separate below. Correlation is treated
as supporting evidence, not proof.

## Impact

**Observed:**

- From 09:07 the eu-west job queue depth rose and did not clear until 10:18,
  an affected window of about 71 minutes.
- Alerts fired at 09:11 for job age and checkout latency, so the backlog had
  user-visible effect on checkout in eu-west.
- Database connections reached the configured maximum of 300 at 09:20, and an
  API instance logged "db remaining connection slots reserved" at 09:19:52,
  so database access was saturated during the incident.
- No alert fired in the US region.

**Not quantified in the sources:** number of affected jobs, tenants,
customers, or checkouts; whether any jobs were lost, duplicated, or only
delayed; whether the US region had minor impact below alert thresholds. No
claim about data loss can be made from the available evidence.

## Concise timeline (observed)

| Time | Event |
| --- | --- |
| 09:02 | API `2026.09.23.1` deployed; change adds tenant-specific retry policy. |
| 09:06:58 | worker-17: job 81 (tenant acme) retries 3 times with `delay_ms=0` in 41 ms, then `retry_budget_exhausted` with `policy=""`. |
| 09:07 | Queue depth begins rising in eu-west; worker CPU falls from 65% to 18%. worker-22 logs DB pool wait over 5 s (`active=10 idle=0`). A job for tenant beta still succeeds at 09:07:03. |
| 09:11 | Alerts fire for job age and checkout latency. |
| 09:14 | Workers scaled from 40 to 90; queue depth then rises faster. |
| 09:20 | Database connections reach the maximum of 300. |
| 09:24 | API deploy rolled back; new job creation normalizes, backlog stays stuck. |
| 09:31 | One worker pool restarted (startup log: `config_retry_default="exponential"`, `feature_flag=true`); it processes normally for about four minutes, then stalls. At 09:35:12 it logs `retry_budget_exhausted` with `policy=""` for job 319. |
| 09:43 | Feature flag `tenant_retry_policy` disabled; recovery begins within two minutes. At 09:43:09–10 the same worker retries job 319 with `delay_ms=1000` and it succeeds. |
| 10:18 | Backlog cleared. |
| — | US region ran the same release with the flag enabled for only 2% of tenants; no alert fired there. |

## Most likely root cause (inference)

The flag-gated tenant-specific retry policy most likely resolved to an empty
policy (`policy=""`) for at least some tenants, and that empty value was
treated as zero-delay retries. Affected jobs burned their retry budget in
under 50 ms instead of backing off, and the resulting behaviour — by a
mechanism not yet confirmed (see "What remains unknown") — left workers
blocked and the backlog stuck while database connections were saturated.

The strongest single piece of evidence is the within-job comparison for job
319 on worker-51: with `feature_flag=true` it exhausted its retry budget with
`policy=""` (09:35:12); minutes after the flag was disabled, the same job on
the same worker retried with `delay_ms=1000` and succeeded (09:43:09–10).
This is still a single-job log sample, so it supports but does not by itself
prove the region-wide cause.

## Contributing factors (inference unless noted)

- **Worker scale-up amplified contention (observed sequence):** scaling from
  40 to 90 workers at 09:14 was followed by faster queue growth, and DB
  connections hit the 300 maximum at 09:20. If workers were blocked waiting
  for database connections (supported by the pool-wait log and falling CPU),
  adding workers adds waiters, not throughput.
- **No fail-safe on policy resolution:** an empty policy string appears to
  have been accepted and mapped to `delay_ms=0` rather than falling back to
  the configured `exponential` default or being rejected. The default exists
  in startup config (`config_retry_default="exponential"`) yet was not what
  job 319 used while the flag was on.
- **Mitigation path was indirect:** rolling back the API binary at 09:24
  normalized new job creation but did not unstick the backlog; recovery only
  began after the feature flag was disabled at 09:43. Whatever executed the
  retry policy for queued jobs was evidently not controlled by the API
  rollback alone.
- **Exposure differed by region:** the US had the flag on only 2% of tenants
  and did not alert, consistent with (not proof of) a flag-dose effect. The
  eu-west exposure percentage is not stated in the sources.
- **Bounded database capacity:** a fixed maximum of 300 connections meant
  contention, once started, could saturate database access for both workers
  and the API.

## Hypotheses: evidence for and against

### H1 — Faulty tenant retry policy under the feature flag (most likely)

- Supporting: deploy introducing the policy at 09:02 precedes queue rise at
  09:07; `policy=""` with `delay_ms=0` and budget exhausted in ~40 ms at
  09:06:58, just before the rise; the same `policy=""` failure recurs on a
  freshly restarted worker with `feature_flag=true` (09:35:12); disabling the
  flag is followed within two minutes by recovery, and job 319 then succeeds
  with a 1000 ms delay; US at 2% exposure did not alert; a beta-tenant job
  succeeded during the incident, consistent with a tenant-specific effect.
- Weakening / limits: log evidence is a small sample (two affected jobs);
  region comparison is confounded by other regional differences; the exact
  mechanism linking zero-delay retries to stuck workers and DB saturation is
  not shown in the logs.

### H2 — Independent database capacity failure or connection leak

- Supporting: DB pool wait exceeded 5 s as early as 09:07:01; connections
  reached the 300 maximum; falling worker CPU with a rising queue is the
  signature of workers blocked on a downstream resource.
- Weakening: the onset follows the retry-policy deploy by five minutes and
  the `policy=""` retries precede/coincide with the first pool wait;
  disabling the retry-policy flag — with no recorded database change —
  started recovery within two minutes; a restarted pool worked for four
  minutes then stalled again, which is less consistent with a fixed database
  outage. DB saturation is better explained as a contributing/amplifying
  factor than as the independent trigger, but a leak triggered by the new
  retry path cannot yet be separated from H1.

### H3 — The worker scale-up caused the incident

- Supporting: queue depth rose faster after the 09:14 scale-up, and DB
  connections maxed out six minutes later.
- Weakening: queue depth and DB pool waits began at 09:07, seven minutes
  before the scale-up. Scaling plausibly worsened contention but cannot
  explain the onset.

### H4 — The API binary change itself, independent of the flag

- Supporting: the incident follows the 09:02 deploy, and rollback normalized
  new job creation, showing the release did affect job creation.
- Weakening: after rollback the backlog remained stuck for a further 19
  minutes, while disabling the flag started recovery within two minutes; the
  same release in the US at 2% flag exposure did not alert. This favours the
  flag-gated path over the binary alone, though the sources do not state how
  the flag and the worker code version interact.

### H5 — Single poison job/tenant or an unrelated eu-west infrastructure fault

- Supporting: the clearest failure logs involve few jobs; tenant-specific
  behaviour is visible (acme failing while beta succeeds at 09:07).
- Weakening: impact was region-wide (queue depth, checkout latency, DB
  saturation) and began right after a related deploy; a restarted pool
  stalled again within minutes, implying a recurring condition rather than
  one stuck worker; recovery tracked the flag change. A broader set of
  affected tenants under H1 fits better, but the tenant count is unknown.

## What remains unknown

- The mechanism: how zero-delay, budget-exhausted retries translate into
  workers stalling and 300 database connections being held (e.g. connections
  held across retries, immediate requeue loops, or jobs parked while holding
  resources). This is the main gap between correlation and proven causation.
- Why `policy=""` occurs: which tenants lack a policy, what the resolution
  code does with an empty/missing value, and why the `exponential` default
  was not applied.
- Scale: flag exposure percentage in eu-west, counts of affected tenants and
  jobs, `retry_budget_exhausted` rates before/during/after, and checkout
  impact (failed vs delayed checkouts).
- Job outcomes: whether budget-exhausted jobs were dead-lettered, dropped, or
  later replayed, and whether any job was executed more than once.
- Why new job creation normalized on API rollback while queued jobs stayed
  stuck — i.e. which component evaluates the policy for already-queued jobs.
- Whether the four healthy minutes after the pool restart reflect drained
  connections, not yet encountering an affected job, or something else.
