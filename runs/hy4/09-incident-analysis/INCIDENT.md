# Incident analysis — eu-west queue backlog, 2026-09-23

All times UTC. Sources: `TIMELINE.md` (T) and `LOGS.txt` (L).
Throughout, **[OBSERVED]** = stated in a source file; **[INFERENCE]** = an
interpretation. Correlation is explicitly flagged and is not treated as proof.

## 1. Impact

**[OBSERVED]**
- Queue depth rose in eu-west from 09:07; alerts fired at 09:11 for job age and
  checkout latency (T).
- Worker CPU fell from 65% to 18% (T); DB connections reached the configured
  maximum of 300 at 09:20 (T); `api-03` logged `db remaining connection slots
  reserved` at 09:19:52 (L).
- Job `81` (tenant `acme`) exhausted its retry budget (L). Job `319` also hit
  `retry_budget_exhausted` (L). Some jobs still succeeded during the window —
  job `92` (tenant `beta`) succeeded on its first attempt at 09:07:03 (L) — so
  impact was not universal.
- API deploy rollback at 09:24 normalized **new job creation** but the backlog
  remained stuck (T); full recovery only began after the 09:43 flag disable (T);
  backlog cleared at 10:18 (T).
- US region ran the same release with the flag enabled for only 2% of tenants;
  no alert fired there (T).

**[INFERENCE]**
- Approximate duration: onset ~09:07 to full drain 10:18 (~71 min); detection
  09:11; effective mitigation 09:43 (~36 min from onset to mitigation).
- Customer-facing impact was likely delayed/slow processing and elevated
  checkout latency or timeouts for a subset of eu-west requests.

**[OBSERVED — not quantified]** No counts of failed, dropped, dead-lettered, or
duplicated jobs; no affected-tenant list; no error-rate or latency magnitudes;
no revenue figure. These are unknown (Section 7).

## 2. Observed facts (verbatim grounding)

| # | Time | Fact | Source |
|---|------|------|--------|
| F1 | 09:02 | Deploy api `2026.09.23.1`; change adds tenant-specific retry policy | T |
| F2 | 09:06:58 | worker-17, job=81 tenant=acme: attempts 1/2/3 all `result=retry delay_ms=0`, then `retry_budget_exhausted policy="" elapsed_ms=41` | L |
| F3 | 09:07 | Queue depth begins rising in eu-west; worker CPU 65% -> 18% | T |
| F4 | 09:07:01 | worker-22 `WARN db pool wait exceeded wait_ms=5000 active=10 idle=0` | L |
| F5 | 09:07:03 | worker-08, job=92 tenant=beta attempt=1 `result=success elapsed_ms=830` | L |
| F6 | 09:11 | Alerts fire for job age and checkout latency | T |
| F7 | 09:14 | On-call increases workers 40 -> 90; queue depth rises **faster** | T |
| F8 | 09:19:52 | api-03 `ERROR db remaining connection slots reserved` | L |
| F9 | 09:20 | DB connections reach configured maximum of 300 | T |
| F10 | 09:24 | API deploy rolled back; new job creation normalizes; backlog still stuck | T |
| F11 | 09:31 | One worker pool restarted; processes normally for four minutes, then stalls | T |
| F12 | 09:31:10 | worker-51 `startup config_retry_default="exponential" feature_flag=true` | L |
| F13 | 09:35:12 | worker-51 `WARN job=319 retry_budget_exhausted policy="" elapsed_ms=38` | L |
| F14 | 09:43 | Flag `tenant_retry_policy` disabled; recovery begins within two minutes | T |
| F15 | 09:43:07 | worker-51 `config_changed feature_flag=false` | L |
| F16 | 09:43:09 | worker-51 job=319 attempt=1 `result=retry delay_ms=1000` | L |
| F17 | 09:43:10 | worker-51 job=319 attempt=2 `result=success elapsed_ms=190` | L |
| F18 | 10:18 | Backlog cleared | T |
| F19 | — | US uses same release, flag enabled for only 2% of tenants; no alert | T |

## 3. Concise timeline

- **09:02** Deploy adds tenant-specific retry policy (F1).
- **09:06:58** First visible symptom in logs: zero-delay retries and
  `retry_budget_exhausted policy=""` for job 81 (F2).
- **09:07** Queue depth rises, CPU collapses; DB pool wait exceeded (F3, F4).
  One job still succeeds (F5).
- **09:11** Alerts fire (F6).
- **09:14** Workers scaled 40 -> 90; queue rises faster (F7).
- **09:19-09:20** DB connection ceiling hit; API sees reserved-slot errors (F8, F9).
- **09:24** API rolled back: new job creation recovers, backlog does not (F10).
- **09:31** Worker pool restart: ~4 min of normal processing, then stalls (F11,
  F12, F13).
- **09:43** Flag disabled; worker-51 immediately switches to `delay_ms=1000`
  backoff and job 319 succeeds; recovery starts (F14-F17).
- **10:18** Backlog cleared (F18).

## 4. Hypotheses and evidence

### H1 (most likely) — Flag-driven empty retry policy with zero backoff causes the incident
**[INFERENCE]** With `tenant_retry_policy` enabled, workers resolve an empty
policy (`policy=""`) for affected tenants and apply `delay_ms=0`, so transient
failures retry in a tight loop and exhaust the retry budget in tens of
milliseconds. The resulting retry/concurrency load saturates the shared 300-slot
DB connection pool; workers block on DB I/O (low CPU), and the queue backs up.

**Supporting (observed):**
- F2/F13: `policy=""`, `delay_ms=0`, `retry_budget_exhausted` at 41 ms / 38 ms.
- F16/F17: the *same* job 319, immediately after `feature_flag=false`, gets
  `delay_ms=1000` then succeeds — a clean before/after contrast on one job.
- F14: recovery begins within two minutes of disabling the flag.
- F12: a `config_retry_default="exponential"` exists but was not applied while
  the flag was on — consistent with a missing safe fallback.
- F19: dose-response — ~100% exposure (eu-west) produced an incident, 2%
  exposure (US) produced none, on the identical binary.
- F10 + F11 + F12: rollback did not clear the backlog, and a restarted worker
  re-read `feature_flag=true` and stalled again — pointing to live config, not
  the deployed binary or stale in-memory state.

**Weakening / caveats:**
- The flag-disable -> recovery link is a **temporal correlation**, not a
  controlled experiment; the earlier rollback and worker-scaling changes were
  also in flight (though neither produced recovery).
- No source file shows the actual code path; `policy=""` is a log field and
  could be a logging artifact, a missing tenant lookup, or a separate defect.
- The link from zero-delay retries to DB connection exhaustion is **inferred**,
  not traced (no per-attempt connection attribution).
- F5 shows at least one job succeeded normally during the window, so the
  mechanism was selective, not a total outage — the trigger condition is not
  fully established.

### H2 — DB connection-pool exhaustion is the primary root cause
**Supporting (observed):** F4, F8, F9 (pool wait, reserved slots, 300-connection
cap), and F3 (CPU fall consistent with I/O wait).
**Weakening:** Exhaustion appears **downstream** — retry anomalies appear at
09:06:58 (F2), before the 09:07 pool wait and well before the 09:20 cap. It also
does not explain why disabling a *feature flag* produced recovery within two
minutes, nor why the 2%-exposure US region was unaffected. **Verdict: likely a
mediator/amplifier, not the initiating cause.**

### H3 — The API deploy binary is the root cause
**Supporting (observed):** onset shortly after F1 (09:02).
**Weakening:** F10 — rolling the deploy back did **not** clear the backlog (only
new job creation normalized); recovery followed F14 instead. F19 — the US ran
the same release without an alert. **Verdict:** the deploy is probably a
*necessary enabler* (it introduced the flagged code path) but not the *sufficient
trigger*.

### H4 — Scaling workers 40 -> 90 caused/worsened the incident
**Supporting (observed):** F7 — queue depth "rises faster" right after scaling.
**Weakening:** scaling began at 09:14, after onset at 09:07, so it cannot be the
initiator. **Verdict: a contributing/aggravating factor**, consistent with more
workers contending for a fixed, exhausted DB connection pool — i.e. treating a
DB bottleneck as a worker-count problem.

### H5 — Stale worker configuration requiring a restart
**Supporting:** a worker pool restart briefly helped (F11).
**Weakening:** F11 (stalls again after ~4 min), F12 (startup re-read
`feature_flag=true`), F13 (stall recurs on that restarted worker). **Verdict:
largely ruled out** — the bad behavior came from live config, so restart was not
a fix. The ~4-minute normal window remains unexplained.

## 5. Most likely root cause (stated as inference)

**[INFERENCE — moderate-to-high confidence]** Enabling `tenant_retry_policy`
caused workers, for tenants with no resolvable tenant-specific policy, to use an
**empty policy with zero backoff** instead of the existing
`config_retry_default="exponential"`. Failing jobs then retried instantly,
burned their retry budget in ~40 ms, and generated retry/connection load that
saturated the 300-slot shared DB pool. Workers blocked on DB I/O (CPU 65% ->
18%), and the eu-west queue backed up. The 09:02 deploy introduced the path; the
flag — rolled out to essentially all eu-west tenants versus 2% in the US — was
the trigger. Disabling the flag restored exponential backoff and processing.

**This is a coherent inference, not a proven code path.** No controlled
reproduction exists yet, and the retry -> DB-exhaustion link is correlational.

## 6. Contributing factors

1. **No safe fallback** — a valid `config_retry_default="exponential"` existed
   but was not applied when the flag was on and the tenant policy was empty
   (F12, F2).
2. **Unsafe retry semantics** — `delay_ms=0` plus a budget exhausted in ~40 ms
   gave no resilience and amplified load; no visible dead-letter path (F2, F13).
3. **Rollout breadth / inconsistency** — near-100% eu-west exposure vs 2% US on
   the same binary (F19); a staged rollout would have limited blast radius.
4. **Shared DB connection ceiling without isolation or backpressure** — 300-slot
   cap (F9); scaling workers to 90 increased contention and made the queue rise
   faster (F7).
5. **Mitigation aimed at the wrong layer** — code rollback (F10) and worker
   restart (F11, F12) targeted the binary/in-memory state, while the control
   plane was live config; the correct mitigation (flag disable) came ~19 min
   after the rollback.
6. **Detection gap** — alerts were on job age / checkout latency (F6), i.e.
   symptoms; no alert on `retry_budget_exhausted` rate, `delay_ms=0`, or empty
   policy, which would have pointed at the cause sooner.

## 7. What remains unknown

- The exact code path: why `feature_flag=true` yields `policy=""` /
  `delay_ms=0`, and why `config_retry_default` was bypassed.
- Whether the DB storm is caused directly by per-attempt connection acquisition
  or by another query pattern; no per-connection/per-query attribution exists.
- Which tenants lacked a policy, and whether `acme`/`beta`/job 319 are
  representative (F5 shows beta succeeded on attempt 1).
- Why worker CPU fell (I/O wait vs idle vs blocked threads) — not measured.
- Why the 09:31 restart gave ~4 minutes of normal processing then stalled
  (config refresh TTL? pool warm-up? delayed contention?).
- Whether jobs hitting `retry_budget_exhausted` (81, 319) were dropped,
  dead-lettered, or later reprocessed; any duplicate side effects (checkout
  idempotency); total lost/failed job count.
- Whether the 2%-exposure US tenants had silent impact (no alert is not proof
  of no impact).
- Magnitude of customer-facing impact: checkout error/latency figures, number
  of affected tenants and requests, any financial impact.
- Whether any other config or deploy change coincided with 09:43 (to rule out a
  confounder in the flag-disable/recovery correlation).
