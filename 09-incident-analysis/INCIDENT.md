# Incident Analysis Report: Queue Processing Stall and DB Connection Exhaustion

## Executive Summary
On 2026-09-23 between 09:07 UTC and 10:18 UTC, the `eu-west` region experienced a major service degradation characterized by a queue processing stall, job backlog accumulation, and degraded customer checkout latency. The incident was triggered following deployment of API release `2026.09.23.1` with feature flag `tenant_retry_policy` enabled. A defect in the retry policy logic caused failing jobs for certain tenants to retry with zero delay (`delay_ms=0`), inducing a tight-loop retry storm that exhausted database connection pools and caused worker threads to block on I/O. An operational scale-up of workers from 40 to 90 exacerbated the database connection exhaustion to the global limit of 300, impacting the API tier. Full recovery occurred after disabling the feature flag `tenant_retry_policy`, restoring the default exponential backoff.

---

## 1. Impact
* **Geographic Scope**: Isolated to `eu-west`. The `US` region, which had the same release but only 2% flag enablement, experienced no alerts or degradation.
* **Duration**:
  * **Degradation Start**: 09:07 UTC (queue depth began rising, worker CPU dropped).
  * **Mitigation Time**: 09:43 UTC (feature flag disabled; recovery evident by 09:45 UTC).
  * **Backlog Cleared**: 10:18 UTC (total incident duration: ~71 minutes).
* **User & Business Impact**:
  * Asynchronous job processing stalled in `eu-west`, triggering `job age` alerts.
  * Customer checkout latency spiked, triggering automated alerts at 09:11 UTC.
  * API checkout requests experienced database connection reservation failures (`db remaining connection slots reserved`) as DB connections hit the hard ceiling of 300 at 09:20 UTC.
* **System Telemetry Impact**:
  * Worker CPU utilization dropped precipitously from 65% to 18% as threads became blocked waiting for database connections (`wait_ms=5000`).
  * Database connections reached the configured maximum of 300.

---

## 2. Concise Timeline (UTC)

* **09:02**: API release `2026.09.23.1` deployed, introducing tenant-specific retry policy logic.
* **09:06:58**: `worker-17` processes `job=81` for `tenant=acme`; attempts 1, 2, and 3 fail and retry immediately with `delay_ms=0`. Retry budget is exhausted in 41ms with `policy=""`.
* **09:07:00**: Queue depth begins rising in `eu-west`; worker CPU falls from 65% to 18%.
* **09:07:01**: `worker-22` logs `WARN db pool wait exceeded wait_ms=5000 active=10 idle=0`.
* **09:07:03**: `worker-08` completes `job=92` for `tenant=beta` successfully (`elapsed_ms=830`), showing non-retrying jobs can still run if connections exist.
* **09:11**: Automated alerts fire for `job age` and `checkout latency`.
* **09:14**: On-call engineer scales worker pool from 40 to 90 instances; queue depth rises faster.
* **09:19:52**: `api-03` logs `ERROR db remaining connection slots reserved`.
* **09:20**: Database connections reach configured ceiling of 300.
* **09:24**: API release `2026.09.23.1` rolled back to prior version; new job creation normalizes, but worker backlog remains stuck.
* **09:31**: On-call restarts one worker pool; startup log (`worker-51`) shows `config_retry_default="exponential"` but `feature_flag=true`. Pool processes jobs normally for 4 minutes.
* **09:35:12**: `worker-51` encounters `job=319`, exhausting retries in 38ms with `policy=""`; worker pool stalls again.
* **09:43:07**: Feature flag `tenant_retry_policy` disabled (`feature_flag=false`).
* **09:43:09**: `worker-51` retries `job=319` with fallback default policy, applying `delay_ms=1000`; attempt 2 succeeds in 190ms at 09:43:10.
* **09:45**: Backlog recovery begins across `eu-west` within two minutes of flag change.
* **10:18**: Queue backlog is completely cleared; metrics return to baseline.

---

## 3. Most Likely Root Cause

### Separation of Observed Facts vs. Inference
* **Observed Facts**:
  1. The API deploy introduced tenant-specific retry policies under feature flag `tenant_retry_policy`.
  2. In `LOGS.txt`, jobs failing under `feature_flag=true` (`job=81` and `job=319`) logged `policy=""` and `delay_ms=0`, burning 3 attempts in ~40ms.
  3. Under `feature_flag=false`, `job=319` logged `delay_ms=1000` (exponential backoff) and succeeded on attempt 2.
  4. Worker CPU fell to 18% while DB pool wait timeouts (`wait_ms=5000`) occurred.
  5. Scaling workers from 40 to 90 pushed database connections to 300 and triggered API database connection reservation errors.
  6. Rolling back the API did not clear the stall, but turning off the feature flag immediately resolved it.
  7. The US region (2% rollout) experienced no alerts.

* **Inference (Root Cause Mechanism)**:
  * **Defective Fallback / Missing Policy Evaluation**: In API release `2026.09.23.1`, when the `tenant_retry_policy` feature flag was active, the retry engine attempted to evaluate a tenant-specific retry policy. For tenants without a configured policy (or due to a lookup/parsing bug), the policy resolved to an empty string (`policy=""`).
  * **Zero-Delay Retry Storm**: Instead of falling back to the configured default (`config_retry_default="exponential"`), the empty policy was interpreted as an unthrottled immediate retry (`delay_ms=0`).
  * **Connection Starvation and Thread Blocking**: When transient failures occurred, jobs executed retries instantaneously in tight loops. Each retry attempt held or requested database connections from the worker's pool. Because worker threads spent their time waiting for database pool slots (`wait_ms=5000`), worker CPU utilization plummeted (from 65% to 18%), and worker capacity to consume the queue dropped to zero.
  * **Cascading Contention**: Scaling workers to 90 multiplied active connection pools, maxing out the database (300 connections) and starving the API tier, which directly impacted checkout latency.

---

## 4. Contributing Factors
1. **Unsafe Default Value in Retry Engine**: When a specific policy was missing or blank (`policy=""`), the system defaulted to `delay_ms=0` rather than applying the global exponential backoff default or enforcing a non-zero minimum backoff floor.
2. **Counterproductive Autoscaling Intervention**: Scaling workers from 40 to 90 without verifying DB connection headroom turned an asynchronous queue backup into a database connection saturation incident, spilling over into the checkout API.
3. **Shared Database Connection Ceiling**: Both asynchronous background workers and latency-critical API checkout services competed for the same database connection allocation (300 max connections) without pool partitioning.
4. **Decoupled Deployment and Feature Flag Configuration**: Rolling back the API release did not disable the feature flag in the runtime environment. Worker nodes retained `feature_flag=true` until the flag was explicitly toggled at 09:43 UTC.
5. **Canarying Discrepancy**: While the US region was safely limited to a 2% tenant canary, `eu-west` had the feature flag enabled broadly (likely 100%), exposing the entire region to immediate failure upon deployment.

---

## 5. Evaluation of Hypotheses

| Hypothesis | Supporting Evidence | Weakening Evidence | Conclusion |
| :--- | :--- | :--- | :--- |
| **1. Zero-delay retry policy bug causing DB pool exhaustion (Most Likely)** | • Direct log evidence: `delay_ms=0` and `policy=""` in 09:06:58 and 09:35:12.<br>• Immediate recovery upon `feature_flag=false` with `delay_ms=1000`.<br>• US region with 2% flag showed zero alerts. | • Some non-failing jobs (`job=92` for `tenant=beta`) completed successfully at 09:07:03, confirming the issue required a job failure/retry to trigger the storm. | **Confirmed as Root Cause.** Explains all observed symptoms, log entries, and the exact recovery timing. |
| **2. Primary Database capacity exhaustion / hardware degradation** | • DB connections hit 300 at 09:20.<br>• Worker CPU drop (18%) matches DB I/O blocking. | • DB saturation occurred *after* zero-delay retries started and after worker scale-up (09:14).<br>• API rollback did not resolve it, but changing retry logic did without modifying DB hardware. | **Rejected as Root Cause.** DB saturation was a downstream symptom of the retry storm and worker scale-up. |
| **3. Permanent "Poison Pill" job payload locking the queue** | • Backlog remained stuck after API rollback.<br>• Restarted worker pool stalled again after 4 minutes upon encountering `job=319`. | • When `feature_flag=false` was applied, `job=319` succeeded on attempt 2 in 190ms.<br>• The job was not intrinsically unprocessable; it only failed due to zero-delay retry exhaustion under transient contention. | **Rejected.** Jobs were transiently failing and recoverable once backoff delays were honored. |
| **4. Worker code crash / memory leak** | • Worker pool had to be restarted by on-call at 09:31. | • Worker CPU was low (18%), not high.<br>• Logs showed active logging (`INFO`, `WARN`), not unhandled process crashes or OOM terminations. | **Rejected.** Workers were blocked on connection pool waits, not crashed. |

---

## 6. What Remains Unknown
1. **Root Cause of the Initial Transient Failure**: Why did `job=81` and `job=319` fail on attempt 1? Was it an external API dependency timeout, transient database lock contention, or application error?
2. **Implementation Flaw in `2026.09.23.1`**: Did the empty policy (`policy=""`) occur because tenant `acme` had no policy row in the database, because a configuration parser returned an empty string, or because the feature flag failed to bind tenant metadata?
3. **Feature Flag Architecture**: How are feature flags propagated to worker pools? Why was the feature flag enabled broadly in `eu-west` while restricted to 2% in `US`?
4. **Worker DB Pool Allocation**: What is the configured pool size per worker (e.g., active=10 in logs suggests 10 per worker; 40 workers = 400 potential connections, and 90 workers = 900 potential connections against a 300 DB limit)?
