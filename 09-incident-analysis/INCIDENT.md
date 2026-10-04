# Incident Analysis — Queue API (eu-west)

## Impact

- **Region affected:** eu-west (primary). US was nominally exposed but the feature
  flag was enabled for only ~2% of tenants there, so no alert fired and no
  customer-visible impact has been confirmed.
- **Customer-visible symptoms:** elevated checkout latency and rising job age
  in eu-west starting ~09:07 UTC. New job creation returned to normal after the
  API rollback at 09:24, but existing backlog continued to stall until ~10:18 UTC.
- **Blast radius:** all eu-west tenants were processed by the new code path
  once the deploy reached steady state; however, the failure manifested as
  per-job retries rather than data loss. Whether any jobs exceeded their retry
  budget and were dropped permanently is **not yet confirmed** (see Unknowns).
- **Duration of customer impact:** approximately 09:07 → 09:43 UTC (queue stalled,
  latency degraded), with full backlog drain at 10:18 UTC. End-to-end ~71 minutes
  of degraded service, ~35 minutes of severe backlog.

## Concise timeline (UTC)

| Time  | Event                                                                                       |
|-------|---------------------------------------------------------------------------------------------|
| 09:02 | Deploy of api `2026.09.23.1` adds tenant-specific retry policy (`tenant_retry_policy` flag).|
| 09:07 | Queue depth begins rising in eu-west; worker CPU falls 65% → 18% (workers stuck waiting).   |
| 09:07 | Logs show `delay_ms=0` retries on the same job inside a single second; `retry_budget_exhausted` logged with `policy=""`. |
| 09:07 | DB pool wait exceeded 5,000 ms; 10 active connections, 0 idle.                              |
| 09:11 | Alerts fire: job age and checkout latency.                                                  |
| 09:14 | On-call scales workers 40 → 90; queue rises faster (negative feedback loop).                |
| 09:19 | DB error: `remaining connection slots reserved` (pool saturated at 300).                     |
| 09:24 | API deploy rolled back; new-job creation normalizes, but existing backlog remains stuck.    |
| 09:31 | One worker pool restarted; jobs process normally for ~4 minutes, then stall again.         |
| 09:35 | `retry_budget_exhausted` logged again on the restarted pool (`policy=""`).                  |
| 09:43 | Feature flag `tenant_retry_policy` disabled; recovery begins within ~2 minutes.             |
| 10:18 | Backlog cleared.                                                                            |

## Most likely root cause

A new **tenant-specific retry policy** shipped via the `tenant_retry_policy`
feature flag was wired up such that when the flag was on and the resolved policy
string was empty (`policy=""`), jobs retried **immediately with `delay_ms=0`**
rather than falling back to a safe default. Three retries of job 81 inside a
single second (09:06:58) is the clearest smoking gun. This produced a retry
storm in eu-west that saturated the shared database connection pool (300 max)
and starved legitimate work, manifesting as a stuck queue with low worker CPU
(the classic "blocked on downstream" pattern).

Two pieces of evidence strongly support this being the proximate cause:

1. **Temporal alignment:** the `delay_ms=0` retries and the first
   `retry_budget_exhausted` log (`09:06:58`) precede the queue-depth rise
   (`09:07`) and the DB pool saturation (`09:07:01`).
2. **Differential exposure:** US ran the same release but had the flag enabled
   for ~2% of tenants. No alert fired there. If the deploy itself were the
   problem, both regions should have been affected equally.

## Hypotheses ranked

### H1 — Empty-policy retry storm (MOST LIKELY)

- **Claim:** when `tenant_retry_policy` is on but the resolved policy is `""`,
  the worker falls back to a no-delay, multi-attempt loop.
- **Supporting evidence:**
  - `delay_ms=0` repeats in the same second for the same job (`job=81`,
    three lines, 09:06:58).
  - `retry_budget_exhausted` carries `policy=""` twice (09:06:58, 09:35:12).
  - Worker-51 starts up at 09:31 with `feature_flag=true`,
    `config_retry_default="exponential"`, then stalls within ~4 minutes
    with the same `policy=""` exhaustion signature — and recovers within
    ~2 minutes of the flag being turned off (09:43).
  - Differential blast radius between regions matches the flag's rollout %.
- **Weakening evidence / gaps:**
  - We have not yet read the worker source for the `policy=""` code path,
    so "fallback to no-delay retry" is an inference from log behaviour, not
    a confirmed code-level finding.
  - A worker pool restart at 09:31 looked healthy for ~4 minutes before
    stalling again, which is consistent with the flag being re-applied to
    new jobs that arrived after restart — but it is also consistent with a
    secondary resource (e.g., DB pool) being gradually exhausted. Both
    stories fit the data.

### H2 — DB connection pool exhaustion as primary cause

- **Claim:** something else caused DB pool saturation, and the retry storm is
  merely a downstream symptom.
- **Supporting evidence:** pool saturation (`remaining connection slots
  reserved`) is real and preceded by 5,000 ms waits at 09:07:01.
- **Weakening evidence:**
  - Pool saturation occurs **after** the `delay_ms=0` retry burst, not before.
  - Scaling workers from 40 → 90 (09:14) made the queue worse, not better —
    consistent with each worker amplifying the storm, not with a static DB
    bottleneck being hit by extra connections.
  - US ran the same code and DB tier with the flag at 2% and did not alert.
- **Verdict:** unlikely to be the primary cause; the pool saturation is
  best explained as a **consequence** of H1.

### H3 — Deploy artifact / build issue (less likely)

- **Claim:** the binary itself is broken independent of the flag.
- **Weakening evidence:** US ran the same binary without impact proportional
  to eu-west. The flag toggle at 09:43 produced rapid recovery, which would
  not be expected if the binary itself were faulty.

## Contributing factors

1. **No safe default for an unresolved policy.** `policy=""` should have either
   inherited the existing default backoff or refused to start, instead of
   silently allowing `delay_ms=0` retries.
2. **Flag rollout was not gated by tenant canary in eu-west.** Going to 100%
   of eu-west tenants simultaneously removed the safety net that protected US.
3. **Worker auto-scale without a saturation circuit breaker.** Scaling 40 → 90
   workers amplified the retry storm and accelerated DB pool exhaustion
   instead of relieving it.
4. **Shared DB connection pool across API and worker paths.** A retry storm
   in workers was able to starve API request capacity.
5. **API rollback at 09:24 did not affect workers.** The retry config was
   read at worker startup and re-applied per job, so rolling back the API
   tier only stopped new jobs from being created — it did not change the
   workers' behaviour. This delayed real recovery by ~19 minutes.
6. **No automated rollback trigger.** The feature flag was the correct lever,
   but it was disabled manually ~50 minutes after first impact.

## What remains unknown

- The exact code path that turns `policy=""` into `delay_ms=0`. Logs are
  consistent with a fallback bug but the worker source has not been read.
- Whether the "4 minutes healthy, then stalls" pattern on the restarted pool
  is purely a function of new jobs arriving and re-triggering the storm, or
  whether there is a secondary slow-burn effect (e.g., a queue/cache).
- Total number of jobs that exceeded their retry budget and were dropped vs
  retried successfully once the flag was disabled.
- Customer-visible failure modes beyond latency (e.g., failed checkouts,
  abandoned carts, notification delays).
- Whether US saw any impact at all on the ~2% of tenants with the flag on,
  even though no alert fired.
- Why US and eu-west had such different flag rollout percentages (intentional
  canary or configuration drift).