# Incident Report: Queue Backlog and Checkout Latency (eu-west)

## 1. Impact

- **Affected Region**: `eu-west` (European region). The US region remained healthy with no alerts fired.
- **Affected Services**: Background worker queue processing and user checkout path.
- **Incident Duration**: 
  - Onset: ~09:07 UTC (queue depth began rising, DB pool wait warnings).
  - Customer Alerting: 09:11 UTC (job age and checkout latency alerts fired).
  - Mitigation / Recovery Start: 09:43–09:45 UTC (feature flag disabled, recovery observed within 2 minutes).
  - Full Resolution: 10:18 UTC (backlog completely cleared).
  - Total Duration: ~71 minutes (09:07 to 10:18 UTC).
- **Service Degradation**:
  - Processing backlog accumulated across background jobs.
  - Checkout latency spiked due to database connection exhaustion.
  - Worker CPU dropped from 65% to 18% as worker threads blocked on database connection acquisition.
  - Total database connections reached the configured maximum of 300, exhausting available connection slots for the API.

---

## 2. Concise Timeline (all times UTC)

- **09:02**: Deployed API release `2026.09.23.1` introducing tenant-specific retry policy.
- **09:06:58**: `worker-17` processed `job=81` (`tenant=acme`), executing 3 retries with `delay_ms=0` in 41ms, exhausting retry budget with `policy=""`.
- **09:07**: Queue depth began rising in `eu-west`; worker CPU dropped from 65% to 18%.
- **09:07:01**: `worker-22` logged `WARN db pool wait exceeded wait_ms=5000 active=10 idle=0`.
- **09:11**: Monitoring alerts triggered for job age and checkout latency.
- **09:14**: On-call engineer scaled worker instances from 40 to 90; queue depth rose at an accelerated rate.
- **09:19:52**: `api-03` logged `ERROR db remaining connection slots reserved`.
- **09:20**: Database connection count reached the hard configured ceiling of 300.
- **09:24**: API deployment `2026.09.23.1` rolled back. New job creation normalized, but the existing queue backlog remained stalled.
- **09:31**: One worker pool restarted (`worker-51` started with `feature_flag=true`). Processed jobs normally for 4 minutes before stalling at 09:35:12 on `job=319` with `policy=""` (retries exhausted in 38ms).
- **09:43**: Feature flag `tenant_retry_policy` was disabled. `worker-51` dynamically picked up `feature_flag=false`, applied default exponential backoff (`delay_ms=1000`) to `job=319`, and succeeded on attempt 2.
- **09:45**: Queue processing recovery observed across `eu-west`.
- **10:18**: Backlog cleared completely; all metrics returned to baseline.

---

## 3. Most Likely Root Cause

The most likely root cause is a logic defect in the tenant-specific retry policy implementation, activated by the `tenant_retry_policy` feature flag in `eu-west`:
- When the feature flag was enabled, tenants without an explicitly defined retry policy (e.g., `tenant=acme` with `policy=""`) defaulted to an unthrottled retry delay of zero milliseconds (`delay_ms=0`) rather than falling back to the global default exponential backoff (`config_retry_default="exponential"`).
- When jobs encountered transient errors, workers executed retries immediately in rapid succession (e.g., 3 attempts in 41ms).
- This zero-delay retry loop created a thundering herd against downstream dependencies (particularly the shared relational database).
- Database connection pools quickly saturated (`active=10 idle=0`, wait timeouts of 5000ms), causing worker execution threads to block. Blocked threads caused worker CPU utilization to collapse (65% to 18%) and halted queue processing, which cascaded to API checkout latency when total database connections hit the hard limit of 300.

---

## 4. Contributing Factors

1. **Unsafeguarded Default Fallback**: The tenant retry policy logic failed to enforce a minimum backoff or fall back to exponential delay when a tenant's policy was empty string (`policy=""`).
2. **Broad Feature Flag Exposure in eu-west**: The feature flag was enabled broadly (or 100%) in `eu-west` at deployment, whereas the US region was protected by an incremental 2% rollout where no alerts fired.
3. **Counter-Productive Manual Scaling Under Resource Exhaustion**: On-call scaled workers from 40 to 90 at 09:14 in response to rising queue depth. Because each worker held up to 10 DB connections, scaling increased database connection contention, accelerating exhaustion from 09:14 to 09:20.
4. **Shared Database Connection Pool Between API and Workers**: Workers and customer-facing API servers shared the same database connection limit (300). When workers saturated connections, customer-facing checkout API calls were blocked (`api-03 ERROR db remaining connection slots reserved`).
5. **Decoupled API Rollback vs. Worker Execution**: Rolling back the API deploy at 09:24 did not disable the worker-side feature flag or relieve worker DB contention, leaving the queue backlog stalled until the feature flag itself was toggled at 09:43.

---

## 5. Evaluation of Hypotheses: Evidence & Analysis

### Hypothesis 1: Zero-Delay Retry Policy Bug Under Feature Flag (Primary Hypothesis)
- **Supporting Evidence**:
  - `LOGS.txt` (09:06:58): `worker-17` logged attempts 1, 2, and 3 for `job=81` with `delay_ms=0` and `policy=""`, exhausting the budget in 41ms.
  - `LOGS.txt` (09:35:12): Following worker pool restart, `worker-51` encountered `job=319` with `policy=""` and exhausted retries in 38ms.
  - `LOGS.txt` (09:43:07–09:43:10): Upon setting `feature_flag=false`, the exact same job (`job=319`) received `delay_ms=1000` (exponential backoff) and succeeded on attempt 2.
  - Recovery commenced within two minutes of toggling the feature flag off (09:43), and the queue cleared without further intervention.
  - US region ran identical application code but had the feature flag enabled for only 2% of tenants, generating no alerts.
- **Weakening Evidence**: None. All log entries and timeline markers are consistent with this mechanism.

### Hypothesis 2: API Deployment Binary Defect (Independent of Feature Flag)
- **Supporting Evidence**:
  - Queue depth rise began five minutes after API deploy `2026.09.23.1` (09:02 to 09:07).
  - Rolling back API deploy normalized new job creation rate (09:24).
- **Weakening Evidence**:
  - Rolling back the API at 09:24 did *not* resolve the queue backlog or relieve worker stalls.
  - The US region ran the same binary release without experiencing an outage.
  - Recovery only occurred when `feature_flag` was flipped at 09:43, demonstrating the issue was gated by the feature flag rather than binary-level API code regressions.

### Hypothesis 3: Worker Fleet Capacity Deficit (Under-provisioning)
- **Supporting Evidence**:
  - Queue depth was rising and job age alerts fired at 09:11.
- **Weakening Evidence**:
  - Worker CPU dropped from 65% to 18%, indicating workers were blocked waiting for external resources, not CPU-bound.
  - Increasing worker count from 40 to 90 at 09:14 worsened the incident and accelerated database connection exhaustion.

### Hypothesis 4: Infrastructure-Level Database Outage or Hardware Failure
- **Supporting Evidence**:
  - Workers logged pool wait timeouts (`wait_ms=5000`) and DB connection cap was reached (300).
- **Weakening Evidence**:
  - Non-retrying jobs succeeded during the incident when connection slots were available (e.g., `worker-08` processed `job=92` successfully in 830ms at 09:07:03).
  - Database recovered immediately upon reducing retry pressure via the feature flag without database restarts or hardware remediation.

---

## 6. Separation of Observed Facts vs. Inferences

| Dimension | Observed Facts | Inferences |
| :--- | :--- | :--- |
| **Retry Behavior** | Logs explicitly show `delay_ms=0`, `policy=""`, 3 attempts within 41ms for `job=81`, and 38ms for `job=319`. Disabling flag logged `delay_ms=1000`. | The code path for `tenant_retry_policy=true` lacks default fallback logic when a tenant's policy is undefined or empty string. |
| **Worker CPU Drop** | CPU dropped from 65% to 18% at 09:07; `worker-22` logged DB pool wait timeout (5000ms, active=10, idle=0). | The drop in CPU utilization was directly caused by thread contention and blocking I/O while waiting for database connections. |
| **Scaling Impact** | Scaling from 40 to 90 workers was followed by faster queue depth increase and reaching 300 DB connections at 09:20. | Scaling workers added up to 500 connection demands against a 300-connection limit, turning a worker stall into an API checkout outage. |
| **Regional Variance** | US region ran release `2026.09.23.1` with flag enabled for 2% of tenants; no alert fired. | The 2% sample size in the US was insufficient to trigger a thundering herd on DB connections, whereas `eu-west` had high/total exposure. |

---

## 7. What Remains Unknown

1. **Root Cause of Initial Job Failures**: Why did `job=81` and `job=319` fail their initial attempts? The logs show retry attempts but omit the underlying exception/error payload (e.g., transient DB lock, network timeout, payload validation).
2. **Reason for Missing Tenant Policy**: Why did `tenant=acme` and `job=319` have `policy=""`? Is tenant policy configuration optional, missing from a database migration, or failing to load from a cache/datastore?
3. **Rollout Disparity Between Regions**: Why was `tenant_retry_policy` enabled at 2% in the US but broadly/fully in `eu-west`? Was this an operational oversight, lack of automated rollout controls, or intentional configuration?
4. **Worker Configuration Architecture**: How do workers consume feature flags vs. API deployments? (Workers dynamically refreshed feature flag state at 09:43:07 without a process restart, yet retained flag state across the 09:24 API rollback).
5. **Customer Transaction Impact**: The exact count of dropped or delayed customer checkout transactions during the 09:11–09:45 window has not yet been quantified.
