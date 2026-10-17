# Incident Analysis: EU-West Queue Backlog and Checkout Latency

## 1. Impact

### Observed Facts
- **Duration:** 09:07 UTC (when queue growth and CPU drop began in `eu-west`) to 10:18 UTC (when the backlog cleared), totaling 71 minutes of active degradation (76 minutes from the 09:02 UTC deploy).
- **Affected Region:** `eu-west` experienced alerting and backlog accumulation. The US region ran the same release with `tenant_retry_policy` enabled for only 2% of tenants and triggered no alerts.
- **User and System Symptoms:**
  - Job queue depth rose continuously from 09:07 UTC until ~09:45 UTC.
  - Alerts fired at 09:11 UTC for elevated **job age** and **checkout latency**.
  - Worker CPU in `eu-west` dropped from 65% to 18% starting at 09:07 UTC, and restarted worker pools stalled after ~4 minutes of normal processing (09:31–09:35 UTC).
  - Database connections hit the configured maximum of 300 at 09:20 UTC, causing API errors (`api-03 ERROR db remaining connection slots reserved` at 09:19:52 UTC).
  - Specific jobs (`job=81` for `tenant=acme`, `job=319`) exhausted their retry budgets in ~38–41 ms (`retry_budget_exhausted policy=""`).

### Inferences
- Checkout flows either depend synchronously on the shared database (which ran out of connection slots around 09:20 UTC) or depend on asynchronous worker jobs that were delayed in the `eu-west` queue.
- Not all tenants were initially broken: at 09:07:03 UTC, `job=92` (`tenant=beta`) succeeded on `attempt=1` in 830 ms, indicating the impact initially concentrated on tenants or jobs routed through the `tenant_retry_policy` code path with an empty policy (`policy=""`) before cascading into shared database connection exhaustion.

---

## 2. Concise Timeline (UTC)

| Time (UTC) | Observed Fact | Source |
| :--- | :--- | :--- |
| **09:02** | API release `2026.09.23.1` deployed, adding tenant-specific retry policy support. | `TIMELINE.md` |
| **09:06:58** | `worker-17` runs `job=81` (`tenant=acme`) attempts 1, 2, and 3 with `delay_ms=0`, logging `WARN job=81 retry_budget_exhausted policy="" elapsed_ms=41`. | `LOGS.txt` |
| **09:07** | Queue depth begins rising in `eu-west`; worker CPU drops from 65% to 18%. | `TIMELINE.md` |
| **09:07:01** | `worker-22` logs `WARN db pool wait exceeded wait_ms=5000 active=10 idle=0`. | `LOGS.txt` |
| **09:07:03** | `worker-08` completes `job=92` (`tenant=beta`) with `attempt=1 result=success elapsed_ms=830`. | `LOGS.txt` |
| **09:11** | Alerts fire for job age and checkout latency. | `TIMELINE.md` |
| **09:14** | On-call scales workers from 40 to 90; queue depth rises faster. | `TIMELINE.md` |
| **09:19:52** | `api-03` logs `ERROR db remaining connection slots reserved`. | `LOGS.txt` |
| **09:20** | Database connections reach the configured maximum of 300. | `TIMELINE.md` |
| **09:24** | API deploy `2026.09.23.1` is rolled back; new job creation normalizes, but the existing backlog remains stuck. | `TIMELINE.md` |
| **09:31:10** | One worker pool is restarted (`worker-51` logs `startup config_retry_default="exponential" feature_flag=true`); it processes jobs normally for 4 minutes. | `TIMELINE.md`, `LOGS.txt` |
| **09:35:12** | `worker-51` logs `WARN job=319 retry_budget_exhausted policy="" elapsed_ms=38`; the restarted worker pool stalls. | `TIMELINE.md`, `LOGS.txt` |
| **09:43** | Feature flag `tenant_retry_policy` is disabled (`09:43:07 worker-51 INFO config_changed feature_flag=false`); recovery begins within two minutes. | `TIMELINE.md`, `LOGS.txt` |
| **09:43:09–10** | `worker-51` retries `job=319` (`attempt=1 result=retry delay_ms=1000` at 09:43:09; `attempt=2 result=success elapsed_ms=190` at 09:43:10). | `LOGS.txt` |
| **10:18** | Queue backlog is fully cleared. | `TIMELINE.md` |

---

## 3. Most Likely Root Cause

### Observed Facts
1. When `feature_flag=true` (`tenant_retry_policy` enabled), workers encountering a job with an empty retry policy (`policy=""`) executed all retry attempts immediately with zero backoff (`delay_ms=0`), exhausting the retry budget in ~38–41 ms (`job=81` at 09:06:58 UTC; `job=319` at 09:35:12 UTC).
2. Despite `worker-51` starting with `config_retry_default="exponential"`, it still used `policy=""` while `feature_flag=true`.
3. Rolling back the API at 09:24 UTC normalized new job creation but did not unstick the backlog or prevent restarted workers (`worker-51` at 09:35:12 UTC) from stalling on `policy=""` jobs.
4. Disabling `tenant_retry_policy` (`feature_flag=false`) at 09:43:07 UTC immediately changed `worker-51`'s behavior on the exact same job (`job=319`), applying a 1000 ms backoff (`delay_ms=1000`) on `attempt=1` at 09:43:09 UTC and succeeding on `attempt=2` at 09:43:10 UTC.

### Inference (Most Likely Root Cause)
A defect in the `tenant_retry_policy` feature (introduced or activated alongside API release `2026.09.23.1`) caused jobs without an explicit tenant retry configuration to resolve to an empty policy string (`policy=""`) instead of falling back to `config_retry_default="exponential"`. Under `feature_flag=true`, workers interpreted `policy=""` as a zero-delay retry policy (`delay_ms=0`) and mishandled `retry_budget_exhausted` events in a way that left jobs uncompleted in the queue while pinning or starving worker database connections (`active=10 idle=0`, `wait_ms=5000`) and stalling worker execution (CPU dropping from 65% to 18%).

---

## 4. Contributing Factors

1. **Unbounded Worker Scaling Exceeding Database Connection Capacity:**
   - *Observed Fact:* Scaling workers from 40 to 90 at 09:14 UTC caused queue depth to rise faster, followed by `api-03 ERROR db remaining connection slots reserved` at 09:19:52 UTC and total DB connections reaching the max limit of 300 at 09:20 UTC. `worker-22` showed an active pool of 10 connections (`active=10 idle=0`).
   - *Inference:* If each worker can open up to 10 DB connections, 40 workers alone can consume 400 connections (or with 90 workers, up to 900 connections) against a hard database limit of 300. Scaling to 90 workers without a connection proxy/ouncer or per-role connection budget exhausted all 300 DB slots, starving API nodes and increasing transient DB failures for workers.
2. **Incomplete Decoupling Between API Rollback and Worker Feature Flag State:**
   - *Observed Fact:* Rolling back the API at 09:24 UTC normalized new job creation, but the backlog remained stuck until `tenant_retry_policy` was disabled at 09:43 UTC.
   - *Inference:* Either jobs enqueued between 09:02 and 09:24 UTC persisted `policy=""` in their payload, or workers independently evaluated `tenant_retry_policy` (`feature_flag=true`) when processing queued jobs. Rolling back the API deployment without simultaneously disabling the feature flag delayed recovery by 19 minutes.
3. **High Regional Exposure in `eu-west` vs. `us`:**
   - *Observed Fact:* The US region ran the same release with the flag enabled for only 2% of tenants and had no alerts, whereas `eu-west` experienced severe degradation.
   - *Inference:* `eu-west` had `tenant_retry_policy` enabled for a much higher percentage of tenants (or high-volume tenants such as `acme`), pushing failure concurrency past the tipping point for worker pool stalling.

---

## 5. Hypotheses and Evidence Evaluation

### Hypothesis 1: `tenant_retry_policy` (`feature_flag=true`) mishandled empty `policy=""`, causing zero-delay retries (`delay_ms=0`) and stalling workers/connections upon `retry_budget_exhausted`
- **Supporting Evidence:**
  - `job=81` (09:06:58) and `job=319` (09:35:12) both logged `delay_ms=0` and `retry_budget_exhausted policy=""` in ~40 ms while `feature_flag=true`.
  - Restarting a worker pool at 09:31 restored processing for 4 minutes until `09:35:12`, when `worker-51` logged `retry_budget_exhausted policy=""` on `job=319` and the pool stalled.
  - Turning off `feature_flag` at `09:43:07` immediately unstuck `worker-51`, which processed `job=319` two seconds later (`09:43:09`) with `delay_ms=1000` and succeeded at `09:43:10`.
  - US region with only 2% flag enablement did not alert on the same release.
- **Weakening / Limiting Evidence:**
  - The logs do not explicitly show *what* caused `attempt=1` of `job=81` or `job=319` to fail initially, nor do they show the internal stack trace or connection state transition inside `worker-51` between `09:35:12` and `09:43:07`.

### Hypothesis 2: API deploy `2026.09.23.1` alone caused the incident via malformed job creation
- **Supporting Evidence:**
  - The deploy occurred at 09:02 UTC, 5 minutes before the `eu-west` queue spike at 09:07 UTC.
  - Rolling back the API at 09:24 UTC caused "new job creation" to normalize.
- **Weakening Evidence (Why correlation is not complete proof):**
  - Rolling back the API at 09:24 UTC **did not** clear the backlog or stop `worker-51` (restarted at 09:31 UTC) from stalling at 09:35 UTC.
  - The US region ran the exact same API release without alerts.
  - Recovery only began after `tenant_retry_policy` was disabled at 09:43 UTC, proving that worker-side flag evaluation (and/or persistent job metadata governed by the flag) was required to sustain the outage.

### Hypothesis 3: Database saturation was the primary root cause rather than a symptom/amplifier
- **Supporting Evidence:**
  - `worker-22` logged `db pool wait exceeded wait_ms=5000 active=10 idle=0` at 09:07:01 UTC, and total DB connections reached the 300 maximum at 09:20 UTC.
  - Worker CPU dropped from 65% to 18% at 09:07 UTC, consistent with threads blocked waiting on database I/O or connection pools.
- **Weakening Evidence:**
  - `job=81` failed 3 times and exhausted its retry budget at `09:06:58` UTC—*before* `worker-22` logged the DB pool wait at `09:07:01` UTC and 13 minutes before the database hit its 300-connection limit (after workers were scaled from 40 to 90 at 09:14 UTC).
  - Disabling `tenant_retry_policy` at 09:43 UTC triggered recovery within two minutes without any database restart or schema/query change. Thus, DB connection exhaustion was a secondary cascading effect and amplifier, not the initial trigger.

---

## 6. What Remains Unknown

1. **Exact Worker Stall and Connection-Pinning Mechanism:** Why did workers stall (CPU 65% to 18%, `active=10 idle=0`) after hitting `retry_budget_exhausted policy=""`, and how did `config_changed feature_flag=false` at 09:43:07 UTC unstick `worker-51` within 2 seconds without a process restart? (e.g., whether workers hold open a DB transaction/connection while polling config or blocking on an unacknowledged job when `policy=""`).
2. **Initial Failure Reason for `attempt=1`:** The `INFO` logs record `result=retry` for `job=81` and `job=319` (`attempt=1`), including at 09:43:09 UTC after recovery started, but do not log the underlying error or exception that triggered the retry.
3. **Regional Feature Flag Configuration:** What exact percentage or set of tenants had `tenant_retry_policy` enabled in `eu-west`, and whether the flag was modified around 09:02 UTC or simply began being exercised by API `2026.09.23.1`.
4. **Fate of Exhausted Jobs (`job=81` vs. `job=319`):** `job=319` logged `retry_budget_exhausted` at 09:35:12 UTC yet was retried again at 09:43:09 UTC. It is unknown whether `retry_budget_exhausted` leaves jobs in the queue for re-delivery or if any jobs (such as `job=81`) were permanently dropped or duplicated.
