# Incident report — queue backlog and checkout latency (eu-west)

**Status:** Mitigated (backlog cleared 10:18 UTC)
**Incident window:** 09:07–10:18 UTC (≈1 h 11 m); alert window 09:11–10:18 UTC (≈1 h 7 m)
**Primary region:** eu-west. US region raised no alerts.
**Sources:** `TIMELINE.md`, `LOGS.txt`. Nothing outside these two files is treated as fact.

## 1. Impact

**Observed (from timeline/logs):**
- Rising queue depth in eu-west from 09:07; worker CPU fell from 65% to 18%.
- Alerts fired at 09:11 for **job age** and **checkout latency**.
- Database connections hit the configured maximum of 300 at 09:20.
- An API worker reported `db remaining connection slots reserved` at 09:19:52.
- Backlog was not cleared until 10:18, i.e. 33 minutes after the effective mitigation at 09:43.
- New job creation normalized only after the API deploy was rolled back at 09:24.
- US region: same release, flag enabled for ~2% of tenants, **no alert fired**.

**Inference (not directly measured in the provided data):**
- Because latency and job age are user-visible signals, customer-facing impact most likely includes delayed checkout/job completion during the alert window; the exact number of affected jobs, tenants, and orders is **not** in the provided data.
- Zero-delay retries of jobs that fail (or time out) create a risk of **duplicate side effects** for non-idempotent jobs. No evidence in the provided data confirms or excludes this.

## 2. Timeline (concise, UTC)

| Time | Event |
|---|---|
| 09:02 | Deploy `api 2026.09.23.1`. Change adds a tenant-specific retry policy. |
| 09:06:58 | worker-17: job 81 (tenant acme) retries 3× with `delay_ms=0`, ends `retry_budget_exhausted policy=""`. |
| 09:07:01 | worker-22: db pool wait 5000 ms exceeded, `active=10 idle=0`. |
| 09:07 | Queue depth begins rising in eu-west; worker CPU 65% → 18%. |
| 09:11 | Alerts fire for job age and checkout latency. |
| 09:14 | On-call scales workers 40 → 90; **queue depth rises faster**. |
| 09:20 | DB connections reach configured maximum (300). |
| 09:24 | API deploy rolled back; new job creation normalizes, **backlog still stuck**. |
| 09:31 | One worker pool restarted; `config_retry_default="exponential" feature_flag=true`. |
| 09:31–09:35 | Pool processes normally for ~4 minutes, then stalls again (09:35:12 `retry_budget_exhausted policy=""`). |
| 09:43 | Feature flag `tenant_retry_policy` disabled. Recovery begins within 2 minutes. |
| 09:43:09–10 | Retries now show `delay_ms=1000`; job 319 succeeds (`elapsed_ms=190`). |
| 10:18 | Backlog cleared. |

## 3. Most likely root cause

A **defect in the flag-gated tenant-specific retry policy path** caused retries to be issued with **zero backoff** instead of falling back to the default exponential policy. Tight retry loops multiplied per-job demand until the shared database connection pool (max 300) was saturated; job processing then starved (workers blocked on pool acquisition rather than consuming CPU), producing the rising queue depth and the checkout-latency alerts.

**Why the logs point here:**
- Before recovery, retries carried `delay_ms=0` and the resolved policy was empty (`policy=""`).
- Five minutes after the effective mitigation (09:43:09–10), the same job type shows `delay_ms=1000` and a fast success. That is a natural experiment: the code was present before, during and after; the **flag state** is the variable that changed immediately before recovery.
- worker-51 at 09:31:10 started with a healthy default (`config_retry_default="exponential"`) yet still stamped `policy=""` at 09:35:12 while `feature_flag=true`. The empty value came from the tenant-policy resolution path, not from the default config.
- The 41 ms total elapsed for three retries of job 81 shows the retries failed fast; amplification came from retry *volume*, not from long-held connections.

## 4. Hypotheses and evidence

| # | Hypothesis | Supporting evidence | Weakening / absent evidence | Assessment |
|---|---|---|---|---|
| H1 | Tenant retry policy resolved to an **empty policy** → zero-delay retry storm → DB pool exhaustion → backlog | `delay_ms=0` with `policy=""` twice, before and after a restart; retries switch to `delay_ms=1000` within 2 min of the flag being disabled; same release in US with 2% tenant exposure produced no alert | Root-cause log line is `policy=""` (empty), not an error — the data does not show *why* the policy resolved empty (missing config vs. lookup failure vs. merge bug) | **Most likely.** Strong causal mechanism, but the specific defect site is not proven |
| H2 | The deploy `2026.09.23.1` itself was broken | Deploy at 09:02 precedes symptoms; first bad retries at 09:06:58 | Behaviour tracked the **flag**, not the binary: the API was rolled back at 09:24 and the backlog stayed stuck, while disabling the flag at 09:43 recovered within 2 min | **Contributing trigger, not the root cause.** Same code ran faultless with the flag off |
| H3 | Database connection pool too small / leaking | Pool saturation at 09:20 and `active=10 idle=0`, 5000 ms waits; `remaining connection slots reserved` for the API | Recovery followed a config change, not any capacity or pool change; no evidence of leaked connections or long hold times in the provided logs | **Likely amplifier / secondary weakness.** Cannot be excluded, but not supported as the primary cause |
| H4 | Traffic / organic workload surge | Retries are numerous | No traffic volume metric anywhere in the provided data; US saw no alert on the same release; retry pattern is a config signature, not a load signature | **Weak.** Needs traffic data to exclude (see RESPONSE.md) |
| H5 | Worker hosts saturated / infra fault (CPU 65% → 18%) | CPU fell as the queue rose | Low CPU with high queue depth is the opposite of saturation — it indicates workers blocked on I/O (waiting on the DB pool), which is consistent with H1. No host-level or noisy-neighbour evidence is present | **Rejected as primary** (it is a *symptom* of blocking) |
| H6 | The 09:14 scale-up (40 → 90 workers) caused the saturation | Queue depth rose faster immediately after | Queue depth was already rising from 09:07 and pool waits exceeded at 09:07:01, ~7 minutes **before** the scale-up | **Rejected as cause; accepted as a contributing aggravator** that deepened contention before the pool hit its cap |

## 5. Contributing factors

1. **No safe fallback for a missing/empty policy.** The default `exponential` config was healthy, but the flag path did not fall back to it — a missing value silently became "retry immediately". This is the highest-leverage fix.
2. **Retry storms amplified demand with no brake.** Empty policy plus retries produced bursty DB demand that the pool had no headroom to absorb.
3. **Scale-up under pool contention.** Adding workers while the pool was already tight increased contention and made the queue look worse; this likely brought the 09:20 saturation forward.
4. **Flag blast radius.** The flag was on for effectively all eu-west tenants, versus ~2% in US. Gradual rollout, not an all-tenant switch, is what kept the US quiet.
5. **Rollback was not a mitigation.** The API deploy rollback at 09:24 did not disable the flag, so ~19 minutes were spent on an action with no effect on the stuck backlog.
6. **Restart was not a mitigation.** Restarting a worker pool at 09:31 read the flag as still `true`, so the failure returned after ~4 minutes. Nothing in the provided data explains that 4-minute delay (config cache TTL? load ramp?).
7. **Detection gap.** Nothing alerted on the actual failure signal (`delay_ms=0` / empty policy / `retry_budget_exhausted`); the first alerts were downstream symptoms at 09:11, and the effective fix came at 09:43 — 32 minutes later.

## 6. What remains unknown

1. **Why the tenant policy resolved to empty** — missing config entry for eu-west tenants, a failed lookup, a merge/override bug, or a partially-written config rollout. No config-store or policy-resolution log is in the provided data.
2. **What produced the ~4-minute healthy window** after the 09:31 restart before the same stall returned.
3. **Whether the DB pool also leaked** (long-held connections or slow queries), independent of the retry volume.
4. **Whether jobs ran more than once** during the zero-delay retry storm (duplicate side effects, e.g. duplicate charges, emails, or writes).
5. **Blast radius in user terms** — affected tenant count, failed/delayed job count, and any checkout orders that were abandoned or failed. No traffic or business-impact metric is provided.
6. **Which tenants/policies existed in eu-west versus the ~2% US exposure**, and whether those 2% showed sub-threshold degradation that no alert captured.
7. **Whether the 09:14 scale-up caused avoidable additional harm** beyond deepening contention (e.g. earlier saturation, connection churn, or queue-ordering effects).
