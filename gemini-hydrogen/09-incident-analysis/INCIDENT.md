# Incident Analysis: EU Queue Stall & Checkout Latency

## 1. Impact

### Observed Facts
- **Affected region:** `eu-west`. The US region ran the same release with the `tenant_retry_policy` feature flag enabled for `2%` of tenants and fired no alerts.
- **Incident window (UTC):**
  - `09:07` — Queue depth began rising in `eu-west` and worker CPU dropped from `65%` to `18%`.
  - `09:11` — Alerts fired for job age and checkout latency.
  - `09:20` — Database connections reached the configured maximum of `300` (after `api-03` logged `db remaining connection slots reserved` at `09:19:52`).
  - `09:24` — New job creation normalized following the API rollback, while the existing queue backlog remained stuck.
  - `09:43` — Recovery began within two minutes of disabling `tenant_retry_policy`.
  - `10:18` — Queue backlog cleared (`~36 minutes` of active stall from `09:07` to `~09:43–09:45`; `~71 minutes` total until full backlog drain at `10:18`).
- **Job-level impact observed in logs:**
  - `job=81` (`tenant=acme`) exhausted its retry budget in `41ms` across 3 zero-delay retries (`09:06:58`).
  - `job=319` exhausted its retry budget in `38ms` (`09:35:12`), then later retried with `delay_ms=1000` and succeeded after the flag was disabled (`09:43:09–09:43:10`).
  - `job=92` (`tenant=beta`) succeeded on attempt 1 in `830ms` at `09:07:03`, showing not all jobs/tenants failed uniformly at onset.

### Inferences & Unknowns on Impact
- *Inference:* Checkout latency alerts at `09:11` and `api-03` reserved-connection errors at `09:19:52` indicate customer-facing checkout requests in `eu-west` were slowed or errored due to shared database connection starvation and/or queued checkout work stalling.
- *Unknown:* Exact count/percentage of affected checkouts and tenants, percentage of `eu-west` tenants with `tenant_retry_policy` enabled, and whether any `retry_budget_exhausted` jobs were permanently dropped, dead-lettered, or duplicated.

---

## 2. Concise Timeline (UTC)

| Time | Source | Observed Event |
| :--- | :--- | :--- |
| `09:02` | Timeline | API `2026.09.23.1` deployed, adding tenant-specific retry policy. |
| `09:06:58` | Logs | `worker-17` retries `job=81` (`tenant=acme`) 3 times (`delay_ms=0`), then logs `retry_budget_exhausted policy="" elapsed_ms=41`. |
| `09:07:01` | Logs | `worker-22` logs `db pool wait exceeded wait_ms=5000 active=10 idle=0` (indicating wait began `~09:06:56`). |
| `09:07:03` | Logs | `worker-08` completes `job=92` (`tenant=beta`) on attempt 1 (`elapsed_ms=830`). |
| `09:07` | Timeline | Queue depth begins rising in `eu-west`; worker CPU falls from `65%` to `18%`. |
| `09:11` | Timeline | Alerts fire for job age and checkout latency. |
| `09:14` | Timeline | On-call increases workers from `40` to `90`; queue depth rises faster. |
| `09:19:52` | Logs | `api-03` logs `ERROR db remaining connection slots reserved`. |
| `09:20` | Timeline | Database connections reach configured maximum of `300`. |
| `09:24` | Timeline | API deploy rolled back; new job creation normalizes, backlog remains stuck. |
| `09:31:10` | Logs / Timeline | One worker pool restarted; `worker-51` starts with `config_retry_default="exponential" feature_flag=true`. Pool processes jobs normally for ~4 minutes. |
| `09:35:12` | Logs | `worker-51` logs `job=319 retry_budget_exhausted policy="" elapsed_ms=38`; restarted worker pool stalls. |
| `09:43:07` | Logs / Timeline | `tenant_retry_policy` feature flag disabled (`worker-51` logs `config_changed feature_flag=false`). |
| `09:43:09–10` | Logs | `worker-51` retries `job=319` (`attempt=1 result=retry delay_ms=1000`), then succeeds (`attempt=2 result=success elapsed_ms=190`). |
| `~09:45` | Timeline | Recovery begins within two minutes of `09:43` flag disable. |
| `10:18` | Timeline | Queue backlog cleared. |

---

## 3. Most Likely Root Cause

Separating **observed facts** from **inference**:

- **Observed facts:**
  1. When `feature_flag=true`, affected jobs evaluated with `policy=""` and executed immediate retries with `delay_ms=0`, exhausting retry budgets in `38–41ms` (`job=81`, `job=319`).
  2. When `feature_flag` changed to `false` at `09:43:07`, `worker-51` immediately retried `job=319` with `delay_ms=1000` (consistent with `config_retry_default="exponential"`) and succeeded on attempt 2 (`190ms`), initiating queue recovery within two minutes.
  3. Rolling back API `2026.09.23.1` at `09:24` normalized new job creation but did **not** unstick the backlog or prevent a restarted worker pool (`09:31`) from stalling after four minutes right when `job=319` hit `policy=""` (`09:35:12`).
  4. Workers exhibited DB connection pool saturation (`worker-22`: `active=10 idle=0`, `wait_ms=5000`), DB connections hit `300/300`, and worker CPU fell (`65%` to `18%`).

- **Inferred root cause:**
  Enabling the `tenant_retry_policy` feature flag introduced or exposed a **missing-policy fallback bug** where jobs/tenants without a configured policy resolved to `policy=""` and defaulted to `delay_ms=0` instead of `config_retry_default="exponential"`. Combined with transient initial failures (reason unconfirmed), zero-delay retries rapidly exhausted retry budgets and—most plausibly via DB connection holding/leaking on the `policy=""` / exhaustion path or tight-loop re-queue/DB amplification—saturated worker DB pools (`active=10 idle=0`) and the shared DB (`300` connections), causing workers to block on DB connections (CPU dropping `65% -> 18%`) rather than process the queue.

---

## 4. Contributing Factors

1. **Broad `eu-west` feature-flag exposure (Fact vs. Inference):**
   - *Observed:* US used the same release with the flag on for `2%` of tenants and saw no alerts; `eu-west` suffered a regional stall.
   - *Inferred:* A much higher percentage of `eu-west` tenants (including `tenant=acme` or tenants lacking a policy) had `tenant_retry_policy` enabled, expanding blast radius beyond the threshold that DB pools could absorb.
2. **Worker scale-up from `40` to `90` during DB saturation (Fact + Inference):**
   - *Observed:* Scaling workers at `09:14` caused queue depth to rise faster, followed by `api-03` reserved-slot errors (`09:19:52`) and hitting the `300` DB connection cap (`09:20`). `worker-22` logged `active=10 idle=0`.
   - *Inferred:* If `10` is the per-worker DB pool maximum across workers, `40` workers (`400` max connections) already overcommitted the `300`-connection DB cap alongside API instances, and scaling to `90` (`900` max worker connections) drove total DB connection starvation and worsened contention.
3. **Decoupled API rollback vs. worker flag state (Fact + Inference):**
   - *Observed:* API rollback (`09:24`) normalized new job creation, while workers remained on `feature_flag=true` and stalled until `09:43`.
   - *Inferred:* Either the API pre-09:24 wrote `policy=""` into backlog payloads that workers continued honoring while `feature_flag=true`, or workers independently evaluated `tenant_retry_policy` using shared/worker-side code unaffected by the API rollback. Either way, rolling back only the API left the worker failure mode active for 19 additional minutes.
4. **Shared database connection budget between API and workers (Fact + Inference):**
   - *Observed:* Both `worker-22` (`db pool wait exceeded`) and `api-03` (`db remaining connection slots reserved`) hit DB connection limits (`300` max).
   - *Inferred:* Lack of DB pool isolation/quotas allowed worker retry contention to starve API checkout traffic (`09:11` checkout latency alert).

---

## 5. Hypotheses Evaluated: Supporting & Weakening Evidence

### Hypothesis 1: `tenant_retry_policy` missing fallback (`policy=""` -> `delay_ms=0`) causing retry storms / DB exhaustion
- **Supporting evidence:**
  - Direct log link between `policy=""` and `delay_ms=0` (`job=81` at `09:06:58`; `job=319` at `09:35:12`).
  - Controlled within-worker counterfactual on `job=319`: `feature_flag=true` failed in `38ms` (`policy=""`), whereas `feature_flag=false` two seconds before retry restored `delay_ms=1000` and succeeded (`190ms`).
  - Queue recovery began within 2 minutes of disabling `tenant_retry_policy` at `09:43`.
  - US region ran the same release at `2%` flag rollout with no alerts.
- **Weakening evidence / gaps:**
  - Does not by itself explain what caused `attempt=1` of `job=81` and `job=319` to fail initially (`worker-22` started waiting 5s at `~09:06:56`, 2 seconds *before* `job=81` was logged at `09:06:58`).
  - Alone (without connection holding/leaking or immediate re-queue amplification), `38–41ms` retry exhaustion would not obviously stall a freshly restarted worker pool (`worker-51`) after 4 minutes while dropping CPU to `18%`.

### Hypothesis 2: DB connection leak or unclosed/blocked connections on the `policy=""` / `retry_budget_exhausted` path
- **Supporting evidence:**
  - `worker-22` logged `active=10 idle=0` (`wait_ms=5000`), and DB hit `300/300` connections.
  - Worker CPU fell (`65% -> 18%`), matching I/O/connection-wait blocking rather than CPU-bound spinning.
  - Both the initial rollout (`09:02 -> 09:07`, `~5m`) and the restarted worker pool (`09:31:10 -> 09:35:12`, `~4m`) operated briefly before stalling right as `job=319` hit `retry_budget_exhausted policy=""`.
- **Weakening evidence / gaps:**
  - Only one `db pool wait exceeded` line appears in the log excerpt (none logged for `worker-51` in the snippet).
  - Disabling `feature_flag=false` at `09:43` enabled recovery within 2 minutes without a full fleet restart; an irreversible in-process connection leak would keep leaked slots wedged unless connections timed out/closed or were transiently blocked by DB lock/retry contention rather than permanently leaked.

### Hypothesis 3: API deploy `2026.09.23.1` alone was the root cause
- **Supporting evidence:**
  - `09:02` API deploy closely preceded `09:07` degradation (temporal correlation).
  - `09:24` API rollback normalized new job creation.
- **Weakening evidence / gaps:**
  - Temporal correlation is not proof: rolling back `2026.09.23.1` at `09:24` left the backlog stuck, and a restarted worker pool (`09:31`) still ran `feature_flag=true`, hit `policy=""` at `09:35:12`, and stalled.
  - US had the same release without alerts.
  - Recovery followed disabling `tenant_retry_policy` (`09:43`), not the API rollback (`09:24`). (At most, `2026.09.23.1` may have created pre-09:24 backlog payloads with `policy=""` or added API DB pressure, while the worker flag logic remained active.)

### Hypothesis 4: Scaling workers from `40` to `90` (`09:14`) caused the incident
- **Supporting evidence:**
  - Immediately caused queue depth to rise faster (`09:14`) and preceded `api-03` reserved-slot errors (`09:19:52`) and DB `300` max connections (`09:20`).
- **Weakening evidence / gaps:**
  - `job=81` (`delay_ms=0`, `policy=""` at `09:06:58`), `worker-22` DB pool exhaustion (`09:07:01`), worker CPU drop (`09:07`), and job-age/checkout-latency alerts (`09:11`) all occurred `3–7 minutes` *before* the `09:14` scale-up. Scaling was an aggravating factor, not the primary cause.

### Hypothesis 5: Unrelated primary DB or downstream outage
- **Supporting evidence:**
  - Initial `attempt=1` failures had to come from somewhere (`job=81`, `job=319`), `worker-22`'s 5s DB wait began around `09:06:56`, and `job=92` (`tenant=beta`) took `830ms` on attempt 1 (`09:07:03`).
- **Weakening evidence / gaps:**
  - No independent DB remediation or failover occurred; US had no alerts; disabling `tenant_retry_policy` (`09:43`) directly restored `delay_ms=1000` on `job=319` (`190ms` success) and cleared the backlog. (A small baseline rate of transient DB/downstream errors—or a brief hiccup around `09:06`—could explain why `attempt=1` failed initially, which `delay_ms=0` then amplified.)

---

## 6. What Remains Unknown

1. **Exact mechanism of the 4-minute stall (`09:31:10 -> 09:35:12`):** Whether `worker-51` stalled due to a gradual DB connection leak/hold on the `policy=""` path, accumulation of re-queued failing jobs saturating its 10-connection pool, or delayed encounter with flagged-tenant/backlog jobs (`feature_flag=true` was already active at `09:31:10` startup, ruling out delayed flag activation).
2. **API vs. worker boundary & `09:24` rollback effect:** Whether `2026.09.23.1` deployed to API only or workers too; whether `policy=""` was stored on job payloads by the API or computed dynamically by workers; why rolling back the API normalized new job creation; and whether `job=319` was created before or after `09:24`.
3. **Origin of `attempt=1` failures & pre-`09:06:58` wait:** Why `job=81` and `job=319` failed on attempt 1, and why `worker-22` began waiting on its DB pool at `~09:06:56` (2 seconds before `worker-17` logged `job=81`).
4. **Post-exhaustion queue semantics:** Why `job=319` logged `retry_budget_exhausted` at `09:35:12` yet re-executed `attempt=1` at `09:43:09` (e.g., automatic re-queue vs. visibility-timeout redelivery after stall).
5. **Code path for `policy=""` -> `delay_ms=0`:** How a missing/empty tenant policy bypassed `config_retry_default="exponential"` and resolved to zero delay.
6. **Exact blast radius & configuration baselines:** Percentage of `eu-west` tenants with the flag enabled, baseline job `elapsed_ms` and DB connection usage prior to `09:02`, whether all workers share `pool_max=10`, number of API instances sharing the `300`-connection DB cap, and whether any customer data/orders were lost or duplicated.
