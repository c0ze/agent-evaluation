# Incident Analysis: EU-West Queue Backlog and Database Connection Exhaustion

## Summary

On the date of release `2026.09.23.1`, `eu-west` experienced a ~71-minute queue processing degradation (`09:07–10:18 UTC`) accompanied by job age alerts, checkout latency alerts, worker DB pool timeouts, and full database connection exhaustion (`300/300`). Rolling back the API deploy at `09:24 UTC` normalized new job creation but did not clear the stuck backlog. Disabling the `tenant_retry_policy` feature flag at `09:43 UTC` initiated recovery within two minutes, and the backlog cleared by `10:18 UTC`.

This report separates **observed facts** (directly recorded in `TIMELINE.md` and `LOGS.txt`) from **inferences** (hypotheses drawn from those facts).

---

## Impact

### Observed Impact
- **Region & Duration:** `eu-west` queue depth rose from `09:07 UTC` until the backlog cleared at `10:18 UTC` (71 minutes total; 67 minutes from `09:11 UTC` alerts to `10:18 UTC` clearance).
- **Customer-Facing & Processing Alerts:** Alerts fired at `09:11 UTC` for **job age** and **checkout latency**.
- **Database & API Saturation:** Database connections hit the configured maximum of `300` at `09:20 UTC`; at `09:19:52 UTC`, `api-03` logged `ERROR db remaining connection slots reserved`. New job creation normalized after the `09:24 UTC` API rollback, while existing backlog processing remained stalled until `09:43–09:45 UTC`.
- **Job Failures Observed in Logs:** `job=81` (`tenant=acme`) hit `retry_budget_exhausted` at `09:06:58 UTC`; `job=319` hit `retry_budget_exhausted` at `09:35:12 UTC` before later succeeding on retry at `09:43:10 UTC`.
- **US Region Comparison:** The US region ran the same release (`2026.09.23.1`) with `tenant_retry_policy` enabled for 2% of tenants; no alert fired there.

### Inferred / Unquantified Impact
- Checkout latency alerts and `api-03` DB slot exhaustion errors strongly suggest degraded or failed checkout requests for `eu-west` users, particularly around `09:11–09:24 UTC`, though exact checkout error rates and affected customer counts are not present in the data.
- Whether `job=81` or other jobs hitting `retry_budget_exhausted` were re-queued, dead-lettered, or permanently lost is not confirmed.
- The absence of alerts in US does not prove zero job-level impact for the 2% of US tenants with the flag enabled.

---

## Concise Timeline (Observed Facts, UTC)

| Time (UTC) | Source | Observed Event |
| --- | --- | --- |
| `09:02` | Timeline | API release `2026.09.23.1` deployed; change adds tenant-specific retry policy. |
| `09:06:58` | Logs | `worker-17` retries `job=81` (`tenant=acme`) 3 times with `delay_ms=0` and logs `retry_budget_exhausted policy="" elapsed_ms=41`. |
| `09:07` | Timeline | Queue depth begins rising in `eu-west`; worker CPU falls from 65% to 18%. |
| `09:07:01` | Logs | `worker-22` logs `WARN db pool wait exceeded wait_ms=5000 active=10 idle=0`. |
| `09:07:03` | Logs | `worker-08` processes `job=92` (`tenant=beta`) successfully on attempt 1 (`elapsed_ms=830`). |
| `09:11` | Timeline | Alerts fire for job age and checkout latency. |
| `09:14` | Timeline | On-call scales workers from 40 to 90; queue depth rises faster. |
| `09:19:52` | Logs | `api-03` logs `ERROR db remaining connection slots reserved`. |
| `09:20` | Timeline | Database connections reach configured maximum of 300. |
| `09:24` | Timeline | API deploy rolled back; new job creation normalizes, backlog remains stuck. |
| `09:31` | Timeline | One worker pool restarted; processes jobs normally for 4 minutes, then stalls. |
| `09:31:10` | Logs | `worker-51` starts with `config_retry_default="exponential" feature_flag=true`. |
| `09:35:12` | Logs | `worker-51` logs `WARN job=319 retry_budget_exhausted policy="" elapsed_ms=38`. |
| `09:43` | Timeline | Feature flag `tenant_retry_policy` disabled; recovery begins within 2 minutes. |
| `09:43:07` | Logs | `worker-51` logs `config_changed feature_flag=false`. |
| `09:43:09–10` | Logs | `worker-51` retries `job=319` with `delay_ms=1000` (attempt 1) and succeeds on attempt 2 (`elapsed_ms=190`). |
| `10:18` | Timeline | Queue backlog cleared. |

---

## Most Likely Root Cause (Inference)

**Inference:** When `tenant_retry_policy` (`feature_flag=true`) is active and a job or tenant has an empty/unset policy (`policy=""`), workers execute immediate zero-delay retries (`delay_ms=0`) instead of falling back to `config_retry_default="exponential"`. This defect likely drove rapid, unthrottled retry amplification (and possibly unreleased/long-held DB connections along the same error path), exhausting worker DB pools (`active=10 idle=0`, `wait_ms=5000`) and ultimately saturating the shared database's 300-connection ceiling.

### Mechanistic Chain (Inferred from Observations)
1. **Trigger:** After the `09:02` API deployment (`2026.09.23.1`), jobs with `policy=""` began encountering the `tenant_retry_policy` code path while `feature_flag=true` was enabled on workers in `eu-west`.
2. **Zero-Delay Retry Loop:** When a job needed retry (such as `job=81` at `09:06:58` and `job=319` at `09:35:12`), `policy=""` resolved to `delay_ms=0`, exhausting 3 attempts in ~38–41 ms instead of backing off. Without backoff, transient failures could not clear (demonstrated when `job=319` later succeeded on attempt 2 once `delay_ms=1000` was restored at `09:43:09`).
3. **Database Saturation & Worker Stall:** Intense retry concurrency and/or connection holding on the error path filled per-worker DB pools (`active=10 idle=0`), leaving workers blocked waiting for connections (`wait_ms=5000`). Because workers were I/O-wait blocked rather than executing work, worker CPU **dropped** from 65% to 18% while queue depth climbed.
4. **Why API Rollback Alone Did Not Clear the Backlog:** Rolling back only the API service at `09:24` normalized new job creation (likely stopping new malformed/empty-policy jobs or removing API-side DB overhead), but workers continued running with `feature_flag=true` (`09:31:10`) and continued retrying backlog items with `policy=""` (`09:35:12`). Only disabling `tenant_retry_policy` at `09:43` restored exponential backoff (`delay_ms=1000`) on workers and ended the saturation loop.

*Important caveat:* While the causal link between `tenant_retry_policy` + `policy=""` -> `delay_ms=0` is directly visible in `worker-51` logs (`09:35:12` vs. `09:43:07–10`), the exact low-level mechanism linking those retries to DB connection exhaustion (pure query/lock contention vs. a connection leak on the retry/exhaustion path) remains inferred rather than proven.

---

## Contributing Factors

1. **Aggregate Worker Connection Pool Exceeded Database Limit (Observed math + Inference):**
   - `worker-22` showed `active=10 idle=0` (at least 10 DB connections per worker) against a database `max_connections` of `300`.
   - Even at the baseline of 40 workers, `40 × 10 = 400` potential worker connections already exceeded the 300-connection DB ceiling before accounting for API instances.
2. **Scaling Workers Under Downstream Saturation (Observed):**
   - Increasing workers from 40 to 90 at `09:14` while worker CPU was *falling* (65% -> 18%) and DB pool waits were already occurring (`09:07:01`) raised potential worker DB demand to ~900 connections and increased retry concurrency. Queue depth rose faster and DB connections hit `300/300` six minutes later (`09:20`).
3. **Shared Database Connection Pool Between API and Workers (Observed):**
   - `api-03` hit `db remaining connection slots reserved` (`09:19:52`) when DB connections reached `300`, indicating checkout/API traffic was not isolated from background worker connection exhaustion.
4. **Unsafe Fallback for Empty Policy (`policy=""`) (Observed in logs, Inferred in code):**
   - Instead of rejecting `policy=""` or falling back to `config_retry_default="exponential"`, the retry logic defaulted to `delay_ms=0` with no minimum backoff floor or jitter.
5. **Incomplete Rollback Scope & Regional Rollout Asymmetry (Observed + Inference):**
   - Rolling back the API deployment at `09:24` did not disable the worker-evaluated `tenant_retry_policy` flag. Meanwhile, `eu-west` experienced a region-wide incident while US ran the same release at 2% flag enablement without alerting, suggesting broader flag exposure in `eu-west` (though `eu-west`'s exact rollout percentage is unverified).

---

## Hypothesis Evaluation

### Hypothesis 1 (Most Likely): Missing/empty `policy=""` under `tenant_retry_policy` caused zero-delay retry amplification (`delay_ms=0`), saturating DB connections
- **Supporting Evidence (Observed):**
  - `job=81` (`09:06:58`) and `job=319` (`09:35:12`) both logged `retry_budget_exhausted policy=""` in 38–41 ms, with `job=81` showing 3 retries at `delay_ms=0`.
  - At `09:43:07`, `worker-51` logged `config_changed feature_flag=false`; 2 seconds later, the exact same `job=319` retried with `delay_ms=1000` and succeeded on attempt 2 (`elapsed_ms=190`).
  - Disabling `tenant_retry_policy` at `09:43` began fleet recovery within 2 minutes, whereas rolling back the API at `09:24` left the backlog stuck.
  - Worker CPU dropped (65% -> 18%) and `worker-22` hit `db pool wait exceeded wait_ms=5000 active=10 idle=0`, consistent with DB-wait blocking rather than CPU starvation.
  - Scaling workers 40 -> 90 made queue depth rise faster and preceded `300/300` DB connections.
  - US region ran the same release at 2% flag enablement without alerting.
- **Weakening Evidence / Gaps:**
  - Logs do not show the underlying failure reason on attempt 1 that initially triggered retries.
  - Logs do not prove *how* 38–41 ms retry bursts filled all 10 local pool connections for >5000 ms (e.g., whether jobs were immediately re-queued after `retry_budget_exhausted`, or DB lock contention piled up queries).
  - Does not by itself cleanly explain why the restarted worker pool at `09:31` worked normally for 4 minutes before stalling if the DB was already at `300/300` since `09:20` (unless the restart briefly released connections and re-accumulation took ~4 minutes).

### Hypothesis 2 (Plausible Co-Factor / Sub-Mechanism): DB connection leak or unreleased transaction in the `policy=""` / `retry_budget_exhausted` path
- **Supporting Evidence (Observed):**
  - `09:31` worker pool restart processed jobs normally for 4 minutes and then stalled right around `09:35:12`, when `worker-51` logged `job=319 retry_budget_exhausted policy=""`. Progressive per-worker pool leakage (filling 10 slots over ~4 minutes) fits a "clean after restart, then stall" signature closely.
  - `worker-22` showed `active=10 idle=0` with `wait_ms=5000` and worker CPU fell to 18%, both consistent with exhausted local pools.
  - Scaling workers 40 -> 90 multiplied total connections held across workers, hitting DB max `300` at `09:20`.
- **Weakening Evidence / Gaps:**
  - At `09:43:07`, flipping `feature_flag=false` allowed `worker-51` to execute `job=319` within 2 seconds and began fleet recovery within 2 minutes *without* a recorded fleet-wide worker restart. A permanent connection leak usually persists until process restart (unless an idle/transaction timeout reaped leaked connections once new leaks stopped).
  - No DB session-state telemetry (`idle in transaction`, connection age, or pool leak metrics) is present to verify leaked vs. actively contended connections.

### Hypothesis 3 (Partial Contributor, Weakened as Standalone Cause): API `2026.09.23.1` deployment defect independent of worker retry-policy flag
- **Supporting Evidence (Observed):**
  - Incident started 5 minutes after `09:02` API deploy `2026.09.23.1`.
  - `09:19:52`: `api-03` logged `db remaining connection slots reserved`.
  - `09:24`: Rolling back the API deploy normalized new job creation.
- **Weakening Evidence / Gaps:**
  - Rolling back the API at `09:24` failed to unstick the backlog; `worker-51` still hit `retry_budget_exhausted policy=""` 11 minutes later (`09:35:12`).
  - Recovery only began after disabling `tenant_retry_policy` at `09:43`.
  - US region ran the same API release (`2026.09.23.1`) without alerts.
  - *Note:* API `2026.09.23.1` likely played an upstream role (e.g., stamping `policy=""` on enqueued jobs or adding DB load during job creation), which explains why the `09:24` rollback normalized new job creation while leaving workers stuck on already-queued jobs / worker-side flag evaluation.

### Hypothesis 4 (Weakened as Primary Cause; Possible Initial Spark): Unrelated regional DB slowdown or traffic spike in `eu-west`
- **Supporting Evidence (Observed):**
  - Attempt 1 of `job=81` and `job=319` failed and required retries; `job=92` (`tenant=beta`) took `830ms` at `09:07:03` compared to `190ms` for `job=319` at `09:43:10` (note: different jobs/tenants, so not directly comparable).
  - Only `eu-west` alerted; US did not.
- **Weakening Evidence / Gaps:**
  - Recovery began within 2 minutes of toggling `tenant_retry_policy` off at `09:43`, and `job=319` succeeded immediately once `delay_ms=1000` applied. An unrelated external DB outage would not reliably clear in lockstep with a client feature flag change.
  - Temporal correlation alone is not proof, however; a minor transient DB blip or ordinary baseline retry rate may have provided the initial attempt-1 failures that entered the faulty retry path.

---

## What Remains Unknown

1. **Origin of `policy=""` and exact retry code path:** Did API `2026.09.23.1` write `policy=""` into job payloads, or did workers read missing tenant rows as `""`? Why did `policy=""` map to `delay_ms=0` instead of `config_retry_default="exponential"`?
2. **Worker deployment state:** Were workers also deployed as part of `2026.09.23.1`, or did workers already run `tenant_retry_policy` code prior to `09:02`?
3. **Initial attempt-1 failure reason:** What error caused `job=81` (`09:06:58`) and `job=319` (`09:35:12`, `09:43:09`) to retry on attempt 1?
4. **Database internals during saturation (`09:06–09:45 UTC`):** Connection breakdown by service (`api` vs. `worker`), session states (`active` vs. `idle in transaction`), lock waits, and query latencies needed to distinguish retry-driven lock/query contention from a connection leak—and to explain the exact 4-minute stall cycle after the `09:31` worker pool restart.
5. **Exact rollout & blast radius:** What percentage of `eu-west` tenants had `tenant_retry_policy` enabled (vs. 2% in US)? Did the 2% of enabled US tenants experience silent `retry_budget_exhausted` errors? How many checkouts and tenants were impacted?
6. **Disposition of exhausted jobs:** `job=319` appeared at both `09:35:12` (`retry_budget_exhausted`) and `09:43:09` (retrying again), indicating at least some exhausted jobs were re-queued; we do not know whether `job=81` or other exhausted jobs were re-queued, dead-lettered, or dropped.
7. **Exact effect of the `09:24` API rollback:** Why did new job creation normalize immediately—did the rollback stop emitting `policy=""` payloads, remove an extra DB lookup on job creation, or reduce API DB connection usage?
