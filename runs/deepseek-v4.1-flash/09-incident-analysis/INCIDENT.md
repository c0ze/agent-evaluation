# Incident Report — eu-west job queue backlog (2026-09-23)

**Status:** Draft for review
**Scope of evidence:** `TIMELINE.md`, `LOGS.txt` only. No metrics, configs, diffs, or customer data were available.

**Labeling convention:** statements marked **(observed)** come directly from the supplied files. Statements marked **(inferred)** are my interpretation and are not proven by the evidence.

---

## 1. Summary

Between approximately 09:07 and 10:18 UTC, the eu-west region suffered a job-processing collapse: queue depth rose continuously, checkout latency alerts fired, worker CPU dropped sharply, and the database hit its 300-connection limit. New job creation returned to normal after the 09:24 API rollback, but the existing backlog did not drain. Disabling the `tenant_retry_policy` feature flag at 09:43 was followed by recovery within about two minutes, and the backlog cleared at 10:18.

The most likely root cause is a defect in how the tenant-specific retry policy is resolved: for at least one tenant the resolved policy is an empty string (`policy=""`), and the worker then retries with **zero delay** instead of the configured exponential default. That creates a tight retry loop which, directly or through a feedback loop, saturates database connections and stalls the worker fleet. This is an inference; the supplied logs do not contain the code, the policy configuration, or the underlying job error.

---

## 2. Impact

**Observed**
- Job queue depth rose from 09:07 and did not begin recovering until ~09:45; backlog cleared 10:18 (≈71 minutes of elevated backlog).
- Alerts fired for job age and checkout latency at 09:11 (customer-visible checkout degradation in eu-west).
- Database connections reached the configured maximum of 300 at 09:20; `api-03` logged `remaining connection slots reserved` at 09:19:52.
- Worker CPU fell from 65% to 18% at 09:07, indicating workers were not doing useful work.
- A worker pool restart at 09:31 restored normal processing for only ~4 minutes.

**Inferred**
- Customer impact was concentrated in eu-west checkout and asynchronous job completion. The number of affected tenants, jobs, orders, and the SLO/error-budget burn are unknown.
- No evidence of data loss or data corruption appears in the supplied files. Absence of evidence is not proof of absence.

---

## 3. Timeline (observed facts only)

| Time (UTC) | Event |
|---|---|
| 09:02 | API deploy `2026.09.23.1`; change adds tenant-specific retry policy. |
| 09:06:58 | `worker-17`, `job=81`, `tenant=acme`: attempts 1–3 all return `retry` with `delay_ms=0`; then `retry_budget_exhausted` with `policy=""`, total elapsed 41 ms. |
| 09:07:01 | `worker-22`: `db pool wait exceeded wait_ms=5000 active=10 idle=0`. |
| 09:07:03 | `worker-08`, `job=92`, `tenant=beta`: `success`, 830 ms. |
| 09:07 | Queue depth begins rising in eu-west; worker CPU falls 65% → 18%. |
| 09:11 | Alerts fire for job age and checkout latency. |
| 09:14 | On-call scales workers 40 → 90; queue depth rises faster. |
| 09:19:52 | `api-03`: `db remaining connection slots reserved`. |
| 09:20 | DB connections reach configured maximum of 300. |
| 09:24 | API deploy rolled back; new job creation normalizes, backlog still stuck. |
| 09:31:10 | `worker-51` restarts; startup config `config_retry_default="exponential"`, `feature_flag=true`. |
| 09:31 | Restarted worker pool processes jobs normally for four minutes, then stalls. |
| 09:35:12 | `worker-51`: `retry_budget_exhausted policy="" elapsed_ms=38` — same failure mode after restart. |
| 09:43:07 | Feature flag `tenant_retry_policy` disabled (`config_changed feature_flag=false`). |
| 09:43:09 | `worker-51`, `job=319`, attempt 1: `retry delay_ms=1000` (non-zero backoff now applied). |
| 09:43:10 | Same job, attempt 2: `success`, 190 ms. |
| ~09:45 | Recovery begins (within two minutes of flag disable). |
| 10:18 | Backlog cleared. |

---

## 4. Most likely root cause

**Defect in tenant retry-policy resolution, activated by the `tenant_retry_policy` flag.**

The worker is configured with a sane default (`config_retry_default="exponential"`, observed at 09:31:10), yet when the feature flag is on, retries are logged with `delay_ms=0` and the policy resolves to an empty string. With the flag off, the same job (`job=319`) retries with `delay_ms=1000` and then succeeds. This is the cleanest observed contrast in the dataset.

**Inferred failure mechanism**

1. The tenant-specific policy lookup returns an empty/missing policy for some tenants.
2. Instead of falling back to the exponential default, the worker treats the empty policy as "no delay", producing immediate retries (three attempts inside 41 ms).
3. Each retried job contends for a database connection while the retry loop runs. Pool waits hit the 5 s timeout, and `active=10 idle=0` shows the per-worker pool fully occupied.
4. As pool waits and failures increase, more jobs enter the retry path, adding further connection pressure — a reinforcing feedback loop.
5. Fleet throughput collapses, so queue depth grows even though job creation is normal. CPU falls because workers are blocked on I/O (pool waits), not computing.
6. Adding workers increases aggregate connection demand against a fixed 300-connection ceiling, which explains why scaling made the queue grow faster.
7. A restart clears in-process pool/retry state, so the pool works for a few minutes until its own retry load re-saturates it (09:31–09:35).

**Confidence: moderate-to-high (~75%).** The flag disable/success sequence is strong; the exact code path and the DB-as-amplifier link are inferred, not directly observed.

---

## 5. Hypotheses and evidence

### H1 — Empty tenant retry policy causes zero-delay retries (primary)
**Supporting (observed)**
- `policy=""` at 09:06:58 and 09:35:12, both accompanied by `delay_ms=0` and `retry_budget_exhausted` in <50 ms.
- `config_retry_default="exponential"` is present at startup, so a safe default exists but is not being applied.
- At 09:43:09, after flag disable, the same job gets `delay_ms=1000` and succeeds on the next attempt.
- US region, same release, only 2% flag coverage: no alert. A dose–response pattern is consistent with a flag-gated defect.

**Weakening / limits**
- No line shows the policy lookup code or the tenant config record, so "empty policy → zero delay" is an inference from correlation.
- Only one tenant (`acme`) is directly shown with `policy=""`; breadth across tenants is unknown.
- US having no alert could also be explained by lower traffic, different tenant mix, or more DB headroom.
- The logs do not show *why* jobs were retried in the first place; a genuine downstream failure could be the initial trigger (see H5).

### H2 — The 09:02 API deploy is the root cause
**Supporting (observed)**
- Symptoms begin ~5 minutes after the deploy, and the deploy "adds tenant-specific retry policy".
- Rollback at 09:24 normalizes new job creation.

**Weakening (observed)**
- After the 09:24 rollback, the backlog remained stuck for 19 more minutes.
- The decisive recovery followed the **flag** disable, not the code rollback.
- US runs the same release without incident.

**Assessment:** the deploy most likely introduced the defective code path, but the *trigger* was the flag being active. Calling the deploy alone the root cause is not supported; the rollback was necessary but insufficient. Whether the flag was enabled as part of the deploy is unknown.

### H3 — Insufficient worker capacity
**Weakening (observed)**
- Scaling 40 → 90 workers made queue depth rise **faster**.
- Worker CPU fell to 18%, the opposite of a CPU-bound capacity shortage.
- A single restarted pool processed jobs normally at first, showing workers were functional.

**Assessment:** effectively ruled out as a primary cause; worker count is at most an amplifier.

### H4 — Database capacity/configuration is the primary cause
**Supporting (observed)**
- Connections hit the 300 maximum at 09:20; `active=10 idle=0`; 5 s pool waits.
- `api-03` reported reserved connection slots.

**Weakening (observed)**
- No DB configuration changed between 09:43 and recovery, yet service recovered.
- DB saturation appears after queue growth and retry storms begin, i.e. downstream of the trigger.

**Assessment:** DB limits are a contributing/amplifying constraint, not the origin. However, a pre-existing low headroom (300 total vs 90 workers × pool size) made the system fragile.

### H5 — A downstream dependency failed, and retries amplified it
**Supporting (observed)**
- `job=81` and `job=319` were retried, implying some failure condition.
- `tenant=beta` succeeded at 09:07:03, so failures were not universal.

**Weakening (observed)**
- No downstream error, timeout, or dependency log appears.
- Recovery coincided exactly with the flag disable, not with any dependency recovery.
- With the flag off, `job=319` succeeded in 190 ms on attempt 2, suggesting the job itself was processable.

**Assessment:** cannot be excluded as the initial trigger of retries, but it does not explain why retries had zero delay or why disabling the flag fixed processing.

---

## 6. Contributing factors (inferred unless noted)

1. **No validation of resolved policy.** An empty string is accepted as a valid policy rather than rejected or defaulted.
2. **No minimum backoff floor or jitter.** Zero delay allows hot retry loops; a floor of even a few hundred ms plus jitter would have limited the blast radius.
3. **No per-tenant or global retry circuit breaker.** A single tenant's retry budget exhausted in 41 ms, but nothing stopped the tenant from immediately submitting more work.
4. **Connection budget not reconciled with fleet size.** 90 workers against a 300-connection cap leaves little headroom; manual scaling multiplied contention. (Observed: 300 max, 40 → 90 workers; per-worker pool size unknown.)
5. **Rollback was incomplete.** The API was rolled back but the feature flag and worker-side configuration were not, extending impact by ~19 minutes. (Observed: 09:24 rollback, 09:43 flag disable.)
6. **Observability gap.** The flag enablement time, rollout percentage, and resolved policy per job are not logged, which delayed diagnosis and prevents precise tenant scoping.
7. **Restart-based mitigation masked the problem.** Restarting a pool gave a 4-minute false signal of recovery, because the underlying configuration defect persisted.

---

## 7. What remains unknown

- When and how `tenant_retry_policy` was enabled, at what percentage, and for which tenants/regions.
- Why the policy resolves to `""` — missing tenant record, bad default, serialization bug, or config propagation failure.
- Which tenants were affected in eu-west and what fraction of traffic they represent.
- The actual error that caused `job=81` and `job=319` to retry (downstream failure vs. pool-wait failure vs. spurious retry).
- Whether retries were duplicating side effects (e.g., double charges, duplicate emails) and whether any idempotency guarantees held.
- Exact SLO burn: checkout p99 values, error rates, number of failed/late jobs, customer count.
- Whether the US 2% cohort shows the same `policy=""` behavior at low volume but stayed below alert thresholds.
- Whether the 09:24 rollback removed the code that reads the flag, and why the flag remained effective afterward.
- Per-worker connection pool size and how 90 workers were expected to fit within 300 connections.

---

## 8. Confidence statement

- **Flag involvement:** high confidence (~90%). The temporal sequence and the `delay_ms` change are direct observations.
- **Empty policy as the defect:** moderate-to-high (~75%). Directly logged, but the code path is inferred.
- **DB connection exhaustion as the amplification mechanism:** moderate (~65%). Strong indirect evidence, no DB-side metrics.
- **Customer impact magnitude and tenant count:** low. Not quantifiable from the supplied files.
- **Overall root-cause confidence:** moderate-to-high (~75%). Correlation is clear; causation is plausible and consistent with every observed data point, but the code diff and configuration records are missing.
