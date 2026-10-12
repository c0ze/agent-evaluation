# Incident analysis — eu-west queue backlog

**Incident ID:** (unnamed) — eu-west job queue backlog and checkout latency
**Window (UTC):** 2026-09-23 09:07 (first observable degradation) → 10:18 (backlog cleared)
**Sources:** `TIMELINE.md`, `LOGS.txt` (13-line excerpt, not a complete log set)

---

## 1. Impact

Observed:

- Queue depth in **eu-west** rose from 09:07 and did not return to baseline until
  10:18 (~71 minutes).
- Alerts fired at 09:11 for **job age** and **checkout latency** — i.e. the
  backlog was customer-visible, not only internal.
- Worker CPU **fell** from 65% to 18% while the queue grew — workers were
  consuming less compute while more work was waiting, i.e. useful throughput
  collapsed.
- Database connections reached the configured maximum of **300** by 09:20;
  at 09:19:52 the API logged `db remaining connection slots reserved`.
- New job creation did not normalize until the API deploy was rolled back at
  09:24; the existing backlog did not drain until the feature flag was disabled
  at 09:43 (~19 minutes later).

Not established from the available evidence:

- The number of customers or orders affected, the peak queue depth, or how many
  checkouts failed outright versus were merely slow.
- Whether any jobs were **lost or duplicated** rather than delayed. Logs show
  `retry_budget_exhausted` but no terminal job state, so the final disposition of
  jobs such as `job=81` and `job=319` is unknown.
- Whether the 300-connection saturation affected other services sharing that
  database.
- The US region is recorded as having no alert, but it had the flag enabled for
  only 2% of tenants; "no alert fired" is not the same as "no impact".

---

## 2. Timeline (UTC)

| Time | Event | Type |
|---|---|---|
| 09:02 | Deploy of api `2026.09.23.1`; change adds tenant-specific retry policy. | Observed |
| 09:06:58 | `worker-17`: `job=81 tenant=acme` attempts 1–3 all `result=retry delay_ms=0` within one second, then `retry_budget_exhausted policy="" elapsed_ms=41`. | Observed |
| 09:07:01 | `worker-22`: `db pool wait exceeded wait_ms=5000 active=10 idle=0`. | Observed |
| 09:07:03 | `worker-08`: `job=92 tenant=beta` `result=success elapsed_ms=830` — a different tenant processing normally at the same moment. | Observed |
| 09:07 | Queue depth begins rising in eu-west; worker CPU falls 65% → 18%. | Observed |
| 09:11 | Alerts fire for job age and checkout latency. | Observed |
| 09:14 | On-call increases workers 40 → 90; queue depth rises **faster**. | Observed |
| 09:19:52 | `api-03`: `db remaining connection slots reserved`. | Observed |
| 09:20 | Database connections reach configured maximum of 300. | Observed |
| 09:24 | API deploy rolled back; new job creation normalizes; backlog remains stuck. | Observed |
| 09:31 | One worker pool restarted; processes normally for ~4 minutes, then stalls. | Observed |
| 09:31:10 | `worker-51` startup: `config_retry_default="exponential" feature_flag=true`. | Observed |
| 09:35:12 | `worker-51`: `job=319 retry_budget_exhausted policy="" elapsed_ms=38`. | Observed |
| 09:43 | Feature flag `tenant_retry_policy` disabled. | Observed |
| 09:43:07 | `worker-51`: `config_changed feature_flag=false`. | Observed |
| 09:43:09 | `job=319 attempt=1 result=retry delay_ms=1000`. | Observed |
| 09:43:10 | `job=319 attempt=2 result=success elapsed_ms=190`. | Observed |
| 09:45 | Recovery begins (within ~2 minutes of flag disable). | Observed |
| 10:18 | Backlog cleared. | Observed |

Context: the US region ran the same release but with the flag enabled for only
2% of tenants and no alert fired.

---

## 3. Most likely root cause

**The `tenant_retry_policy` rollout resolved to an empty policy string for at
least some eu-west tenants, and the retry code path treated an empty policy as a
zero-millisecond delay instead of falling back to the configured default
(`config_retry_default="exponential"`). Each affected job burned its entire
retry budget in tens of milliseconds and was immediately re-queued, producing a
self-sustaining hot retry loop.**

The loop explains the otherwise contradictory observations:

- **CPU fell while the queue grew.** Retry cycles completed in ~38–41 ms versus
  ~830 ms for a real successful job. Workers were cycling jobs, not completing
  them; time shifted from computation into pool wait (`wait_ms=5000`).
- **Scaling workers 40 → 90 made it worse.** More workers meant more concurrent
  retries and more contention for a fixed 300-connection budget, so the queue
  grew faster.
- **The API rollback alone did not clear the backlog (09:24 → 09:43).** The
  rollback fixed job *creation*; the retry *execution* behaviour was still
  governed by the still-enabled feature flag on the workers.
- **A worker restart helped for only ~4 minutes (09:31 → 09:35).** `worker-51`
  started *with* `feature_flag=true`, so a restart could only clear transient
  in-memory state; the zero-delay behaviour was re-established from config.
- **Disabling the flag produced recovery within two minutes.** Post-disable logs
  show `delay_ms=0` → `delay_ms=1000` and `job=319` succeeding, exactly the
  signature of exponential backoff being restored.

The mechanism is supported by a coherent pre/post comparison on the same job and
worker. It is still an inference: we have one identified affected tenant
(`acme`), one clean tenant (`beta`), and 13 log lines overall.

### Contributing factors

1. **No safe fallback for an empty policy.** The system had a correct default
   (`exponential`) available but did not use it when the tenant-specific lookup
   returned `""`.
2. **Retry budget with no floor on delay.** A budget consumed in 41 ms provides
   no protection; there was no minimum backoff or per-tenant rate limit.
3. **Shared, fixed database connection pool (300).** Retry amplification fed
   directly into pool exhaustion, coupling the queue to the API's ability to get
   connections.
4. **Rollout coupling without independent blast-radius control.** The API deploy
   and the feature flag were separate controls, and the flag's exposure differed
   by region (US 2%), which is why the same release looked healthy in one region.
5. **Scaling was the first response.** Worker count was raised on the assumption
   of insufficient capacity, which amplified rather than relieved the loop.
6. **Alerting lagged the onset by ~4 minutes** (09:07 degradation → 09:11
   alerts), and no alert fired on retry-budget exhaustion itself.

---

## 4. Hypotheses, with supporting and weakening evidence

### H1 — Zero-delay retry loop caused by an empty tenant retry policy. ✅ Most likely

**Supporting**

- `policy=""` appears in both `retry_budget_exhausted` events (09:06:58, 09:35:12).
- Three attempts for `job=81` occurred in the same second with `delay_ms=0`.
- After the flag was disabled, the same job pattern changed to
  `delay_ms=1000` and succeeded (09:43:09–10).
- A non-affected tenant (`beta`) succeeded normally at 09:07:03, while `acme`
  failed — the failure tracks the tenant, not the worker or the database.
- The dose–response signal: US had the flag on for 2% of tenants and did not
  alert.

**Weakening**

- We have **no log showing a job with an empty policy in the US region**, so the
  2%/no-alert datum is suggestive, not a controlled comparison.
- We cannot see the code, so "empty policy ⇒ zero delay" is inferred from
  co-occurrence, not from reading the fallback logic.
- Only two tenants are named; we do not know the true affected population.
- The 4 minutes of normal processing after the 09:31 restart is not fully
  explained by this hypothesis and may point to an additional stateful element.

### H2 — Database connection pool exhaustion was the primary cause. ⚠️ Amplifier, not trigger

**Supporting**

- `db pool wait exceeded wait_ms=5000` at 09:07:01.
- Connections hit the 300 maximum by 09:20; API could not obtain slots.
- Recovery followed the removal of retry pressure.

**Weakening**

- Pool pressure was recorded **after** the retry anomaly (09:06:58) and at the
  same time as the queue rise (09:07), so it is more consistent with a
  consequence than with an origin.
- **No slow-query or database-error entries appear in the logs** — the complaint
  is acquiring a connection, not the database being slow or down.
- At 09:07:01 the pool showed `active=10 idle=0` while waits exceeded 5 s. Ten
  active connections is far below a 300 ceiling, which does **not** fit simple
  saturation and is currently unexplained (see unknowns).
- Recovery to a cleared backlog occurred without any stated change to pool size,
  which argues the pool was not the binding root constraint.

### H3 — Insufficient worker capacity. ❌ Weak

**Supporting**

- Queue depth was rising, which is what under-capacity looks like.

**Weakening**

- Worker CPU **fell** from 65% to 18% — under-capacity presents with high CPU.
- Increasing workers 40 → 90 made the queue rise faster. This directly
  contradicts the capacity hypothesis and is strong evidence against it.
- One restarted pool processed normally for four minutes at the old behaviour
  set, showing headroom existed.

### H4 — An underlying database or upstream dependency failure caused the retries. ⚠️ Possible, poorly supported

**Supporting**

- Retries and pool waits are both consistent with a dependency problem.
- A job can be retried for reasons unrelated to the retry policy itself.

**Weakening**

- The observed retries carry `delay_ms=0`, which is a *policy* defect, not a
  dependency symptom. A dependency failure would still use normal backoff.
- Another tenant on the same infrastructure succeeded normally at 09:07:03.
- No database error, timeout, or 5xx entries appear in the logs.
- Behaviour tracked the flag state across a disable, which points at the flag
  rather than at the dependency.

### H5 — The API deploy was the root cause and the rollback resolved it. ⚠️ Partially correct

**Supporting**

- Degradation began ~5 minutes after the 09:02 deploy.
- Rolling back the deploy at 09:24 normalized new job creation.

**Weakening**

- The backlog stayed stuck for a further 19 minutes after rollback and drained
  only after the flag was disabled at 09:43 — so the deploy was the *delivery
  vector*, while the flag governed the ongoing behaviour.
- Workers that started *after* the rollback (09:31:10) still reproduced the
  fault, showing the rollback did not remove the faulty behaviour from the worker
  path.

---

## 5. What remains unknown

1. **Scope of the empty-policy condition.** Which and how many tenants resolved
   to `policy=""`, and whether the US 2% cohort included any of them.
2. **Why the policy was empty.** We have no configuration diff, no flag
   evaluation records, and no visibility into how tenant policies are stored or
   propagated. Misconfiguration, a missing default, and a propagation failure all
   remain open.
3. **The `active=10 idle=0` observation with 5-second waits.** Whether this
   reflects a per-pool sub-limit, leaked or orphaned connections, connections
   held across long operations, or a logging artifact.
4. **Final job disposition.** Whether jobs that exhausted their retry budget
   dead-lettered, were dropped, were duplicated, or were retried externally. The
   logs stop at `retry_budget_exhausted`.
5. **Customer-facing severity.** Count of affected checkouts, peak and
   sustained latency, and failure-versus-slowdown split. Checkout latency alerted
   but no error-rate data is present.
6. **Blast radius beyond the queue.** Whether the 300-connection saturation
   degraded the API, other worker pools, or other services sharing the database.
7. **The four-minute recovery after the 09:31 restart.** What transient state the
   restart cleared, and whether it indicates a second contributing mechanism.
8. **Detection gap.** Why recovery was only achieved at 09:43 when the link
   between the flag and worker retry behaviour was already observable in logs at
   09:06:58.
