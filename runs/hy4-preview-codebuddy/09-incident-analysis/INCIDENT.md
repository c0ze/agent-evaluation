# Incident analysis — eu-west queue backlog, 2026-09-23

Sources: `TIMELINE.md`, `LOGS.txt` (both provided; no other data available).
Dates/times are UTC. Everything below is labelled **observed** (present in the
sources) or **inferred** (our interpretation).

## 1. Summary

A release that introduced a tenant-specific retry policy was deployed at 09:02.
Within five minutes, affected tenants' jobs began retrying with a zero delay and
exhausting their retry budget in ~40 ms. Queue depth in eu-west rose from 09:07
and worker CPU *fell* (65% → 18%), i.e. workers stopped making progress rather
than being overloaded. Database connections saturated (300/300 by 09:20).
Rolling back the API deploy at 09:24 restored new job creation but did **not**
clear the backlog, because the behaviour was gated by the feature flag
`tenant_retry_policy`, not by the deployed code. Disabling that flag at 09:43
restored correct backoff within seconds; the backlog cleared by 10:18.

## 2. Impact (observed unless marked otherwise)

- **Region:** eu-west. US ran the same release but with the flag enabled for
  only 2% of tenants; no alert fired there (observed).
- **Window:** first degradation 09:07 → backlog cleared 10:18 (~71 min).
  Mitigation took effect 09:43, so ~36 min of degraded processing after the
  first remediation attempt and ~4 min from the effective fix to the start of
  recovery.
- **Customer-visible symptoms:** job age SLO breach and checkout latency alerts
  (observed, 09:11). Processing of queued jobs stalled; new job creation was
  also affected until 09:24 (observed: "new job creation normalizes" after the
  rollback).
- **Blast radius:** unknown. The number of jobs delayed, the number of tenants
  affected, and the worst-case job age are **not** in the evidence.
- **Job outcomes:** logs show `retry_budget_exhausted` for job=81 and job=319.
  Whether those jobs were dropped, dead-lettered, or re-queued is **unknown** —
  so we cannot yet state whether any customer work was lost. No evidence of
  data corruption is present in the logs.
- **Severity framing (inferred):** a full regional processing stall lasting a
  little over an hour, with customer-visible checkout latency.

## 3. Timeline (observed)

| Time (UTC) | Observation | Source |
| --- | --- | --- |
| 09:02 | Deploy of api `2026.09.23.1`; change adds tenant-specific retry policy. | TIMELINE |
| 09:06:58 | worker-17: job=81 tenant=acme, attempts 1–3 all `result=retry delay_ms=0`, then `retry_budget_exhausted policy="" elapsed_ms=41`. | LOGS |
| 09:07:01 | worker-22: `db pool wait exceeded wait_ms=5000 active=10 idle=0`. | LOGS |
| 09:07:03 | worker-08: job=92 tenant=beta, attempt=1 `result=success elapsed_ms=830` (a different tenant succeeds). | LOGS |
| 09:07 | Queue depth begins rising in eu-west; worker CPU falls 65% → 18%. | TIMELINE |
| 09:11 | Alerts fire for job age and checkout latency. | TIMELINE |
| 09:14 | On-call scales workers 40 → 90; queue depth rises faster. | TIMELINE |
| 09:19:52 | api-03: `db remaining connection slots reserved`. | LOGS |
| 09:20 | Database connections reach the configured maximum of 300. | TIMELINE |
| 09:24 | API deploy rolled back; new job creation normalizes; backlog still stuck. | TIMELINE |
| 09:31:10 | worker-51 startup: `config_retry_default="exponential" feature_flag=true`. | LOGS |
| 09:31 | One worker pool restarted; processes jobs normally for four minutes, then stalls. | TIMELINE |
| 09:35:12 | worker-51: job=319 `retry_budget_exhausted policy="" elapsed_ms=38` — same failure mode as 09:06, i.e. still present after rollback. | LOGS |
| 09:43:07 | worker-51: `config_changed feature_flag=false`. | LOGS |
| 09:43:09 | worker-51: job=319 attempt=1 `result=retry delay_ms=1000` (backoff restored). | LOGS |
| 09:43:10 | worker-51: job=319 attempt=2 `result=success elapsed_ms=190`. | LOGS |
| ~09:45 | Recovery begins (within two minutes of flag disable). | TIMELINE |
| 10:18 | Backlog cleared. | TIMELINE |

## 4. Observed facts vs. inference

**Observed**
1. Retries for tenant `acme` executed with `delay_ms=0` on all three attempts.
2. Both exhaustion warnings carry `policy=""` — the resolved policy was an
   empty string.
3. Total elapsed time to exhaust the budget was ~40 ms (41 ms, 38 ms).
4. Worker CPU *dropped* while queue depth rose.
5. DB pool wait exceeded 5 s as early as 09:07:01, before any scaling.
6. DB connections hit the 300 maximum at 09:20; api-03 reported reserved slots
   at 09:19:52.
7. Scaling 40 → 90 workers made queue depth rise faster.
8. Code rollback at 09:24 fixed job creation but not the backlog.
9. A restarted pool recovered for ~4 minutes, then stalled.
10. Disabling `tenant_retry_policy` restored `delay_ms=1000` backoff and
    successes within ~3 seconds; recovery followed within ~2 minutes.
11. US had the same release, 2% flag exposure, no alert.

**Inferred**
1. The empty policy meant "no backoff" rather than "use the default" — with the
   flag on, `config_retry_default="exponential"` was not applied (worker-51
   logged that default at startup, yet still hit `policy=""`).
2. Zero-delay retries multiplied work per job (tight retry loop and/or rapid
   re-enqueue), increasing DB work and connection hold time per job.
3. That drove connection-pool saturation, which left workers blocked waiting for
   connections — the most consistent explanation for rising queue with falling
   CPU, and for more workers making things worse.
4. The four-minute post-restart stall reflects a resource that re-accumulates
   (connections/locks), not a fixed code path that fails immediately.
5. Recovery at flag-disable is strong but not conclusive causal evidence: the
   flag change and the recovery are tightly coupled in time, and the US
   dose-response (2% exposure → no alert) is consistent with a causal role.

## 5. Most likely root cause

The tenant-specific retry policy shipped in `2026.09.23.1` resolved to an empty
policy (`policy=""`) for affected tenants and was then treated as "retry
immediately with no backoff" instead of falling back to the configured default
(`config_retry_default="exponential"`). Affected jobs burned their entire retry
budget in ~40 ms, producing a retry/re-enqueue storm that saturated the shared
database connection pool (300/300 by 09:20). Workers then blocked on connection
acquisition — hence rising queue depth with falling CPU — and the incident
persisted until the flag was disabled and backoff (`delay_ms=1000`) returned.

**Why this ranks first:** it is the only hypothesis that explains (a) the
zero-delay retries and `policy=""` in the logs, (b) the failure persisting
through a code rollback, (c) the near-instant recovery at flag-disable, and
(d) the US region showing no alert at 2% exposure.

**Confidence:** moderate-to-high that the flag-gated retry policy triggered the
incident; **moderate** that DB connection saturation is the specific mechanism
that stalled the workers (see H2 and the unknowns).

## 6. Hypotheses, with evidence for and against

| # | Hypothesis | Evidence supporting | Evidence weakening / contra |
| --- | --- | --- | --- |
| H1 | Empty tenant retry policy → zero-delay retry storm → downstream saturation (**most likely**) | `delay_ms=0` x3 then `retry_budget_exhausted policy=""` (09:06:58, 09:35:12); recovery within seconds of `feature_flag=false` (09:43:07–09:43:10); failure persisted through code rollback; US 2% exposure → no alert | No log line shows increased DB *work per job* directly; the causal chain from zero-delay retries to pool saturation is inferred, not measured |
| H2 | DB connection-pool exhaustion / connection leak as an independent primary cause | `db pool wait exceeded wait_ms=5000 active=10 idle=0` at 09:07:01; 300/300 at 09:20; api-03 reserved slots at 09:19:52; adding workers made it worse; restart gave ~4 min of relief | Doesn't explain why disabling a *retry-policy* flag resolved it within ~2 min, nor the `policy=""`/`delay_ms=0` pattern; a pure leak in long-lived code would not clear that fast |
| H3 | Insufficient worker capacity | On-call's initial read; queue depth rising | **Weak:** CPU fell to 18% (workers idle, not saturated), and increasing workers 40 → 90 made the queue grow faster |
| H4 | Faulty API-side change in job creation only | Deploy at 09:02 preceded degradation at 09:07 | **Weak:** after rollback at 09:24 job creation normalized but the backlog stayed stuck, so the consumption path was also affected |
| H5 | Rollback was incomplete (config/flag not reverted) | Backlog stuck after rollback; worker-51 started at 09:31:10 with `feature_flag=true` and reproduced `policy=""` at 09:35 | This is a **contributing factor**, not a root cause: it explains why remediation #1 failed, not why the fault started |
| H6 | Lock contention / slow queries from an unrelated source (e.g. migration, batch job) | Would also explain falling CPU with idle workers | No such evidence anywhere in the provided material; timing lines up with the deploy, but this cannot be excluded without DB telemetry |
| H7 | Tenant-specific config lookup miss (only some tenants have a policy defined) | `acme` failed, `beta` succeeded at 09:07:03; policy resolved to `""` | Consistent with H1 rather than competing — it is the likely mechanism *inside* H1, but which tenants lacked a policy is unknown |

**Correlation caution:** the deploy, the flag, and the DB saturation all
co-occur. The tightest causal signal is the flag-disable → recovery pair, and
even that could in principle be coincidence or reflect a concurrently decaying
backlog. We treat H1 as most likely, not proven.

## 7. Contributing factors

1. **Behaviour gated by a feature flag, not by the deploy.** The rollback at
   09:24 reverted code while the flag stayed on, so the first remediation did
   not work and ~19 minutes of additional impact accrued.
2. **Empty/incomplete configuration accepted as valid.** `policy=""` was not
   rejected and did not fall back to the configured `exponential` default;
   `delay_ms=0` was accepted as a retry delay.
3. **No guardrail against zero/immediate retry.** Nothing bounded retry rate at
   the worker or tenant level.
4. **Shared, un-isolated database connection pool.** One pool served all
   tenants, so retry amplification in a subset of tenants starved everyone; no
   per-tenant quota is evident.
5. **Capacity response amplified the fault.** Scaling 40 → 90 workers added
   connection demand onto an already saturated shared resource.
6. **Staged flag exposure did not produce an early signal.** US ran the same
   release at 2% exposure and stayed below alert thresholds — insufficient
   exposure (or insufficiently sensitive metrics) to catch the fault pre-scale.
7. **Detection and diagnosis lag.** Alerts fired ~4 min after queue depth began
   rising; the effective fix came ~36 min after first degradation.

## 8. What remains unknown

- The resolved retry-policy value per tenant, and which tenants were affected
  (only `acme` failing and `beta` succeeding is observed — a sample of two).
- Whether `policy=""` came from a missing tenant config, a serialization/lookup
  bug, or a bad default — and why the `exponential` default did not apply.
- DB-side truth: connection counts by state and holder, lock waits, slow
  queries, whether connections were leaked or merely busy.
- Why worker CPU fell: whether workers blocked on connection acquisition, on
  locks, or on something else. No stack samples or wait-event data available.
- Job-level outcomes: how many jobs were delayed; whether any
  `retry_budget_exhausted` jobs were dropped, dead-lettered, or re-queued; peak
  job age; SLA credits implications.
- Whether the 09:31 pool restart helped because of fresh connections (favouring
  H2) or because of a transient config/cache state (favouring H1).
- Whether US was genuinely unaffected or merely below alerting thresholds.
- Whether the same failure mode can recur for a tenant whose policy is unset,
  independent of the flag.
