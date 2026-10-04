# INCIDENT.md — Queue processing degradation, eu-west

Analysis of `TIMELINE.md` and `LOGS.txt` only. No other data sources were consulted.
Throughout, **FACT** marks something stated directly in the inputs and **INFERENCE**
marks my interpretation of it. Hypotheses are stated with the evidence that would
confirm or weaken them; no correlation below is treated as proof on its own.

---

## 1. Impact

| Dimension | Assessment | Basis |
|---|---|---|
| Customer-visible duration | ~71 minutes (09:07 → 10:18 UTC) | FACT (timeline) |
| Window with confirmed customer symptoms | ~09:11 → 10:18 (alerts on job age + checkout latency) | FACT |
| Time to first alert after first anomaly | 4 min (09:06:58 → 09:11) | FACT |
| Geographic blast radius | eu-west only; us-east used the same release with the flag on for 2% of tenants | FACT |
| Tenant-level blast radius | Not stated. Inferred to be "all tenants in eu-west" because the flag-off at 09:43 stopped the storm and eu-west saw full impact, vs 2% in us-east | INFERENCE |
| Symptoms | Growing queue depth, rising job age, elevated checkout latency, DB connection exhaustion | FACT |
| Throughput | Worker CPU fell 65% → 18% while queue depth rose | FACT |
| Data loss / duplication / double-charge | **Unknown.** No log line shows a job permanently failed, dead-lettered, or duplicated | — |
| Financial / customer-count impact | **Unknown.** No volume, tenant count, or order value in the inputs | — |

**Honest scoping of impact:** the inputs let me state duration, region, and symptom
type with confidence. They do **not** let me state how many customers or orders were
affected, or whether any job was lost. `retry_budget_exhausted` (09:06:58, 09:35:12)
means the retry budget was consumed; the inputs contain no evidence of what the system
did with the job afterwards (dead-letter? drop? hold in queue?). That is the single
largest customer-facing unknown and it drives the first corrective action in
`ACTIONS.md`.

---

## 2. Concise timeline (UTC)

| Time | Event | Type | Source |
|---|---|---|---|
| 09:02 | Deploy api `2026.09.23.1`; change adds tenant-specific retry policy | FACT | timeline |
| 09:06:58 | worker-17: job 81 (tenant `acme`) attempt 1, 2 and 3 all `result=retry`, all `delay_ms=0`, within the same second. `retry_budget_exhausted policy="" elapsed_ms=41` | FACT | logs |
| 09:07 | Queue depth begins rising in eu-west; worker CPU falls 65% → 18% | FACT | timeline |
| 09:07:01 | worker-22: `db pool wait exceeded wait_ms=5000 active=10 idle=0` | FACT | logs |
| 09:07:03 | worker-08: job 92 (tenant `beta`) succeeds, `elapsed_ms=830` | FACT | logs |
| 09:11 | Alerts fire for job age and checkout latency | FACT | timeline |
| 09:14 | On-call increases workers 40 → 90; queue depth rises faster | FACT | timeline |
| 09:19:52 | api-03: `db remaining connection slots reserved` | FACT | logs |
| 09:20 | DB connections reach configured maximum of 300 | FACT | timeline |
| 09:24 | API deploy rolled back; **new job creation normalizes, backlog still stuck** | FACT | timeline |
| 09:31:10 | A worker pool is restarted; worker-51 starts with `config_retry_default="exponential" feature_flag=true` | FACT | logs |
| ~09:35:12 | worker-51 (4 min after restart): job 319 `retry_budget_exhausted policy="" elapsed_ms=38` | FACT | logs |
| 09:43:07 | worker-51: `config_changed feature_flag=false` | FACT | logs |
| 09:43:09 | job 319 attempt 1 `result=retry` — now with **`delay_ms=1000`** | FACT | logs |
| 09:43:10 | job 319 attempt 2 `result=success elapsed_ms=190` | FACT | logs |
| 09:43 | Flag `tenant_retry_policy` disabled; recovery begins within 2 minutes | FACT | timeline |
| 10:18 | Backlog cleared | FACT | timeline |
| — | us-east: same release, flag on for 2% of tenants, no alert fired | FACT | timeline |

Two ordering details carry most of the analytical weight:

1. **09:06:58 precedes 09:07.** The first logged failure is *before* the timeline's
   first symptom. The retry storm started first; the queue merely grew afterwards.
2. **09:24 rollback did not clear the backlog** while **09:43 flag-off did.** These
   are two attempts to remove the change, one of which failed. That asymmetry is the
   most informative single fact in the dataset.

---

## 3. Most likely root cause

> **Confidence: high for the causal chain, low for the specific defect.**

A defect in the tenant-specific retry-policy path introduced by `2026.09.23.1`
resolved to an **empty policy** (`policy=""`) for the affected tenants. An empty
policy produced **zero backoff** (`delay_ms=0`), so every failed attempt was
retried immediately, in a tight loop. Those retries consumed shared database
connections faster than the pool could release them, starving workers of
connections (`pool wait exceeded wait_ms=5000`), which throttled job throughput
and let the queue grow. Disabling the feature flag at 09:43 restored the working
`exponential` default backoff, retries became paced, and the queue drained.

**The chain, step by step — each link and its support:**

1. *Tenant retry policy resolves to an empty string.* FACT that `policy=""` is
   logged at 09:06:58 and 09:35:12. INFERENCE that this is the new code path
   misbehaving, because `policy=""` appears only in the window where the flag is
   on, and disappears after the flag is off.
2. *Empty policy means no backoff.* FACT that all three attempts of job 81 carry
   `delay_ms=0` at 09:06:58, and that the whole budget burned in `elapsed_ms=41`.
   INFERENCE that `delay_ms` is sourced from the resolved policy, so an empty
   policy yields zero. The 1000 ms delay at 09:43:09 (same worker, same job,
   flag off) is the positive control.
3. *Immediate retries generate connection pressure.* INFERENCE, and it is the
   weakest link in the chain. It assumes each attempt acquires a DB connection
   and holds it through the failure path. The inputs do not show connection
   lifecycle. What the inputs *do* show is the downstream consequence — pool
   waits and the 300-connection cap — and CPU *falling* to 18%, which is the
   signature of threads blocked on I/O rather than spinning. This is a plausible
   mechanism, not a proven one.
4. *Connection starvation throttled throughput.* FACT (pool waits, reserved-slot
   error, cap reached, queue growth, CPU drop). This link is strong.
5. *Removing the flag removed the storm.* FACT, with a near-controlled comparison:
   same worker (51), same job (319), four minutes apart, behaviour flips from
   `retry_budget_exhausted policy=""` to `delay_ms=1000` → success, two seconds
   after `config_changed feature_flag=false`.

**What the root cause is *not*:** not the API binary alone (its 09:24 rollback
failed to recover the backlog while a flag flip succeeded), and not corrupted
worker state (the 09:31 restart worked cleanly for four minutes, then reproduced
the same `policy=""` failure). The defect lives in the flag-gated retry
configuration path, which the API rollback did not revert.

---

## 4. Contributing factors

Ordered by how much they amplified impact. These are separate from the root cause:
fixing the retry-policy defect would end the incident, but these are what made it
large, slow to detect, and slow to fix.

1. **No backoff on unresolved configuration (FACT).** `delay_ms=0` for every
   attempt. A configuration that resolves to "nothing" degraded into the *most*
   aggressive retry behaviour instead of falling back to the safe default that
   was demonstrably present (`config_retry_default="exponential"`, logged at
   09:31:10). Failing open into a thundering herd is the core design failure.
2. **Retries continued past `retry_budget_exhausted` (FACT, INFERENCE on meaning).**
   A retry budget was reached in 41 ms and the job kept cycling. A budget that
   does not stop the retry loop provides no protection.
3. **Unbounded blast radius from flag configuration (FACT).** 100% exposure in
   eu-west vs 2% in us-east on the identical binary. The severity of this incident
   was decided by configuration, not by code quality — the same release was
   survivable in us-east only because few tenants had the flag on. "No alert fired
   in us-east" is **not** evidence of "no impact in us-east": at 2% exposure the
   signal may simply have been below the alert threshold.
4. **Scaling workers against a shared bottleneck (FACT + INFERENCE).** 40 → 90
   workers at 09:14 while the bottleneck was a shared, capped resource. The queue
   rose faster afterwards. INFERENCE: because more workers were blocked on the same
   constrained pool, the extra workers added connection demand without adding
   service capacity. Note the confounder: queue depth is (arrival rate − service
   rate), so faster growth could also reflect rising arrival rate rather than the
   scaling itself. Moderate confidence that this amplified the incident; it did not
   cause it, since degradation began 7 minutes earlier.
5. **Incomplete rollback surface (FACT).** The API rollback at 09:24 left the
   system in the incident state for another 19 minutes. A deploy rollback that
   does not revert flag-gated worker configuration gives a misleading "we have
   reverted" signal. The team lost ~19 minutes on a mitigation that could not work.
6. **Restart as an ineffective mitigation (FACT).** The 09:31 restart produced 4
   good minutes and then reproduced the defect. It also created a false signal
   that the problem was transient. Useful as a falsification of the
   corrupted-worker-state hypothesis; wasted as a mitigation.
7. **Detection was symptom-based (FACT).** The first observable was queue depth at
   09:07; the first alert at 09:11. The directly causal signal — a resolved
   policy that is empty, and retry rate per tenant — was never reported, at any
   point, by any system or person. It is present in the log data the whole time.
8. **An unexplained 5-minute latency between deploy and first failure (FACT
   about the gap).** 09:02 → 09:06:58. INFERENCE: the trigger is a recurring
   workload pattern rather than a deploy-time event, since a freshly booted
   worker also took ~4 minutes to reproduce (09:31:10 → 09:35:12). Unresolved:
   what the trigger condition actually is.

---

## 5. Hypotheses, with evidence for and against

### H1 — Retry storm from unresolved tenant retry policy exhausted DB connections *(accepted, high confidence in the chain)*

**Supporting**
- `policy=""` at 09:06:58 and 09:35:12 — the signal is present in the data twice.
- `delay_ms=0` on all three attempts of job 81 within one second, budget exhausted in 41 ms.
- Flag off at 09:43 → `delay_ms=1000` on the same job and worker within 2 s → success. This is the closest thing to a controlled experiment in the dataset.
- CPU *dropped* 65% → 18%: workers were blocked, not spinning.
- 09:24 API rollback failed to recover; 09:43 flag-off did. The change that mattered was flag-gated, not binary-gated.
- A fresh worker (09:31) reproduced the failure with `feature_flag=true` and a *correct* `config_retry_default` — so the default was healthy and the tenant-specific override path was not.

**Weakening / limits**
- No connection-lifecycle data. The link "zero-delay retries consume connections" is inferred from downstream symptoms, not observed.
- The `delay_ms` → resolved-policy dependency is inferred from one before/after pair (job 319), not a documented config schema.
- Job 319 still needed *two* attempts after the flag was off. Backoff fixed the *pacing*, not an underlying per-job error. Some real failure condition remains unexplained; only the amplification was removed.
- Single-tenant evidence (`acme` failed at 09:06:58; `beta` succeeded at 09:07:03). Tenant attribution is thin.

### H2 — Pure database capacity shortfall *(rejected as root cause; contributory)*

**Weakening**
- The 300-connection cap was not reached until 09:20, but degradation started at 09:07 — 13 minutes earlier.
- worker-22 at 09:07:01 reports pool wait exceeded with only `active=10 idle=0`, i.e. saturation while total usage was nowhere near 300. The binding constraint was already worker-local or hold-time driven, not global capacity.
- A pure capacity problem would not be resolved by disabling a retry-policy flag within 2 minutes.
- A pure capacity problem does not explain `policy=""`.

**Retained as contributory:** low connection headroom plus worker scaling at 09:14 is why the situation escalated to a hard, system-wide failure instead of a slow degradation. Capacity was the victim, not the culprit.

### H3 — Worker scaling (40 → 90) as root cause *(rejected as root cause; contributory)*

**Weakening**
- Onset at 09:07 precedes the 09:14 scale-up by 7 minutes.
- The flag-off at 09:43 restored throughput without reducing worker count.
- `policy=""` is unexplained by scaling.

**Retained as contributory:** see CF4 above, with the arrival-rate confounder stated.

### H4 — Poison jobs / corrupt stuck backlog *(mostly rejected, not fully excluded)*

**Weakening**
- A restarted pool processed jobs normally for four minutes — inconsistent with a permanently wedged head-of-line job.
- The 09:24 rollback left the backlog stuck while *new* creation normalized, which fits workers continuing to churn existing jobs under the old flag, not a data defect.
- Recovery at 09:43 was immediate and complete, not gradual. A corrupt job would typically be skipped, not heal.
- The 09:43 success took one retried attempt, so the failure is not fully explained away.

**Not excluded because:** the inputs never show the final disposition of job 81, and no log line shows a dead-letter or drop path. A subset of jobs could have been individually poisoned while the bulk incident was H1. This is why the job-outcome audit in `ACTIONS.md` is P1 rather than P2.

### H5 — Bad configuration value versus code defect in policy resolution *(unresolved; both inside H1)*

**Supporting code-defect reading:** `config_retry_default="exponential"` was present and correct at 09:31:10 (FACT) yet `policy=""` was still produced (FACT). A bad *default* therefore does not explain it; the tenant-specific lookup or the flag-gated code path did not resolve.
**Supporting config reading:** a missing or malformed entry in the per-tenant policy map would produce an empty string without any code error, and would naturally be tenant-scoped — which would also explain why `beta` (09:07:03) behaved differently from `acme`.
**Status:** the two readings predict the same evidence so far. I cannot distinguish them from these inputs, and I am explicitly not claiming the code is at fault rather than the config. This is why data request #1 in `RESPONSE.md` targets the resolver diff plus the live policy map.

### H6 — Runaway CPU loop in the new retry path *(rejected)*

**Weakening:** worker CPU fell to 18%. A hot loop would raise CPU. The observed profile is blocking, not spinning.

---

## 6. What remains unknown

Ordered by how much it changes the conclusions above.

1. **What the policy resolver actually did.** Why did it return `""` — missing map entry, tenant-key mismatch, parse failure, or an error swallowed into an empty string? Determines whether the fix is code, config, or both. *(H5, data request #1.)*
2. **The connection lifecycle under retry.** Are connections held through the failure path, leaked, or simply requested at excessive rate? Determines whether the fix must include connection budgeting, not just backoff. *(H1 link 3, data request #2.)*
3. **Job dispositions, 09:07–10:18.** How many jobs failed permanently, were dead-lettered, dropped, duplicated, or double-executed? **This is the customer-facing unknown with the largest consequences and it is completely absent from the inputs.**
4. **The true exposure and customer impact.** Tenant and order counts, affected checkout volume, whether us-east's 2% cohort had any impact that stayed below the alert threshold, and SLO/error-budget consumption.
5. **Why the API rollback did not revert the behaviour.** Was the flag independently managed, or did the rollback path omit worker config? Without this, future rollbacks carry the same 19-minute trap.
6. **The 5-minute trigger delay** (09:02 → 09:06:58, and 09:31:10 → 09:35:12). What workload condition provokes the first failure? Relevant to how quickly a fix can be validated.
7. **Why `policy=""` and `retry_budget_exhausted` never alerted.** Were these metrics unmonitored, monitored without thresholds, or simply invisible? Distinguishes "no telemetry" from "telemetry nobody read".
8. **Whether workers were the first or second victim.** 09:07:01 shows worker-22 pool-waiting 13 minutes before the API hit reserved-slot errors at 09:19:52 — workers failed first, but the inputs do not show why the API was spared for so long.
