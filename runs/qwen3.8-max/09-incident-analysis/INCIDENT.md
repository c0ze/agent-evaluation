# Incident analysis — eu-west queue stall and checkout latency

Sources: `TIMELINE.md`, `LOGS.txt` (only evidence available).
Date: not stated in sources; release identifier `2026.09.23.1` suggests 2026-09-23 [inferred].
Convention: **[observed]** = stated directly in the sources; **[inferred]** = interpretation, may be revised with more data.

## 1. Impact

- **[observed]** eu-west job processing degraded from ~09:07; recovery began ~09:45 (within two minutes of the 09:43 flag change); backlog fully cleared 10:18. Degradation ≈ 38 minutes; backlog residence up to ≈ 71 minutes.
- **[observed]** Alerts fired 09:11 for job age and **checkout latency** → customer-facing checkout delays in eu-west. **[inferred]** Customers in eu-west experienced slow or delayed checkouts for most of that window.
- **[observed]** API hosts hit "db remaining connection slots reserved" errors (09:19:52); new job creation only normalized after the 09:24 rollback → job intake was impaired for part of the window.
- **[observed]** DB connections reached the configured maximum (300) at 09:20; worker CPU fell 65% → 18% (workers blocked/idle, not busy).
- **[observed]** US region: same release, flag enabled for only 2% of tenants, no alerts. **[inferred]** Minimal or no US customer impact.
- **Unknown:** whether any jobs that hit `retry_budget_exhausted` between 09:07 and 09:43 were permanently dropped (silent work loss) vs. requeued; the full set of affected tenants; quantified checkout failure/abandonment counts. Job 319 exhausted at 09:35 and later succeeded at 09:43 **[observed]**, which suggests exhausted jobs were not necessarily lost — but disposition of all such jobs (e.g., job 81) is unverified.

## 2. Concise timeline (UTC)

| Time | Event | Source |
|---|---|---|
| 09:02 | API deploy `2026.09.23.1`; adds tenant-specific retry policy | timeline [observed] |
| 09:06:58 | worker-17: job 81 (tenant `acme`) retries 3× in the same second, all `delay_ms=0`; `retry_budget_exhausted policy="" elapsed_ms=41` | logs [observed] |
| 09:07 | eu-west queue depth begins rising; worker CPU falls 65% → 18% | timeline [observed] |
| 09:07:01 | worker-22: DB pool wait exceeded 5000 ms, `active=10 idle=0` | logs [observed] |
| 09:07:03 | job 92 (tenant `beta`) succeeds on attempt 1 (830 ms) — not all tenants affected | logs [observed] |
| 09:11 | Alerts: job age, checkout latency | timeline [observed] |
| 09:14 | On-call scales workers 40 → 90; queue depth rises **faster** | timeline [observed] |
| 09:19:52 | api-03: "db remaining connection slots reserved" | logs [observed] |
| 09:20 | DB connections reach configured max (300) | timeline [observed] |
| 09:24 | API deploy rolled back; new job creation normalizes; **backlog still stuck** | timeline [observed] |
| 09:31 | One worker pool restarted; worker-51 starts with `config_retry_default="exponential" feature_flag=true`; pool processes normally ~4 min | timeline+logs [observed] |
| 09:35:12 | worker-51: job 319 `retry_budget_exhausted policy="" elapsed_ms=38`; pool stalls (~4 min after 09:31:10 startup — timing matches) | timeline+logs [observed] |
| 09:43:07 | Flag `tenant_retry_policy` disabled (`config_changed feature_flag=false`) | logs [observed] |
| 09:43:09–10 | job 319 retries with `delay_ms=1000`, succeeds on attempt 2 (190 ms); recovery begins within 2 min | logs+timeline [observed] |
| 10:18 | Backlog cleared | timeline [observed] |
| context | US: same release, flag at 2% of tenants, no alerts | timeline [observed] |

## 3. Most likely root cause

**[inferred, high confidence in trigger; medium confidence in full mechanism]**

The flag-gated **tenant-specific retry policy (`tenant_retry_policy`) resolved to an empty policy (`policy=""`) for affected tenants**, causing workers to retry with **zero delay** (`delay_ms=0` observed), exhausting jobs' retry budgets in tens of milliseconds (41 ms, 38 ms observed) and cycling failing work at a very high rate. This retry storm **saturated the shared DB connection pool** (max 300 reached; pool waits > 5 s; API slots reserved), starving workers (CPU 65% → 18% — blocked, not busy) and stalling the eu-west queue. Disabling the flag at 09:43 restored the default exponential backoff (`delay_ms=1000` observed, consistent with `config_retry_default="exponential"` logged at startup) and processing recovered within two minutes.

Why the flag, not the deploy code itself, is the operative trigger **[inferred]**:

1. Symptoms persisted 19 minutes **after** the API rollback (09:24) and cleared only after flag-off (09:43) [observed timing].
2. The restarted worker pool came up with `feature_flag=true` (rollback did not change flag state) and stalled again after ~4 minutes, with the same `policy=""` exhaustion signature [observed].
3. US ran the **same release** with the flag at 2% of tenants and had no alerts — a natural control group [observed; correlation, strong but not proof].
4. After flag-off, the previously failing job 319 immediately retried with a 1000 ms delay and succeeded [observed].

**Why the policy resolved to "" is unknown** (missing tenant config, lookup bug, or bad data written by the deploy — see §6).

## 4. Contributing factors

1. **[observed action / inferred effect]** Worker scale-out 40 → 90 at 09:14 increased contention for the capped DB connections; queue depth rose **faster** afterward. With per-worker pools of ~10 connections (`active=10` observed), 40+ workers can exceed the global 300 cap on demand alone — scaling made saturation worse, not better.
2. **[observed gap]** No safe fallback when the tenant policy resolved empty: a default existed (`config_retry_default="exponential"`) yet the effective policy was `""` with `delay_ms=0`. No validation or alert on `policy=""`.
3. **[observed]** Deploy rollback did not disable the feature flag; flag lifecycle is decoupled from release rollback, and the restart runbook brought workers back up with the flag still on. Diagnosis cost ~19 extra minutes (09:24 → 09:43).
4. **[observed]** A single shared DB connection cap (300) for workers and API with no isolation/admission control; the API was starved ("slots reserved") by worker-side contention.
5. **[inferred]** Retry-budget-exhausted jobs appear to re-enter the queue (job 319 reprocessed at 09:43), amplifying churn while the misbehavior persisted. Exact disposition path unknown.
6. **[observed contrast / inferred process gap]** Flag rollout scoping was inconsistent: broad in eu-west vs 2% in US. A staged canary in eu-west would have limited blast radius.

## 5. Hypotheses and evidence

### H1 — Flag-gated tenant retry policy resolved empty → zero-delay retry storm → DB pool saturation (leading hypothesis)
- **Supports:** `policy=""` with `delay_ms=0` and budget exhaustion in ~40 ms [observed]; flag-off → `delay_ms=1000` and immediate success of the same failing job [observed]; restarted pool with flag=true stalled again with the same signature [observed]; recovery began within 2 min of flag-off [observed]; US control (same release, 2% flag scope, no alerts) [observed]; healthy tenant `beta` at 09:07:03 is consistent with tenant-scoped misbehavior [observed].
- **Weakens:** no query-level DB metrics directly attributing connection consumption to retry loops [absent data]; the reason for the empty resolution is not logged [absent data]; visible sample is tiny (2 tenants, 2 failing jobs) — affected-tenant scope unverified.

### H2 — Non-flag code defect in release `2026.09.23.1`
- **Supports:** onset ~5 min after deploy [observed]; API rollback normalized new job creation [observed].
- **Weakens:** backlog symptoms persisted 19 min after rollback and ended only at flag-off [observed]; restarted pool with the rolled-back API still stalled [observed]; US unaffected on the same release [observed]. The deploy may still have **written persistent config/data** that made policies resolve empty — unverified.

### H3 — DB capacity/connection-limit problem as primary cause
- **Supports:** pool waits > 5 s, cap of 300 reached, API slot-reservation errors [observed].
- **Weakens:** saturation began **after** the retry misbehavior (09:06:58–09:07:01) [observed ordering]; worker CPU **fell** (workers blocked, not overloaded with legitimate work) [observed]; recovery occurred with no DB change, purely flag-off [observed]. DB saturation is best explained as downstream of H1.

### H4 — Worker scale-out (40 → 90) caused the stall
- **Supports:** queue depth rose faster after 09:14; cap hit at 09:20 [observed].
- **Weakens:** degradation began 09:07, **before** the scale-out [observed ordering]; scale-out was a response, not a trigger; recovery followed flag-off with no reported scale-down [observed]. It is an accelerator/contributor, not the cause.

### H5 — eu-west regional infrastructure fault (DB instance, network)
- **Supports:** only eu-west alerted [observed].
- **Weakens:** the regions differ in **flag scope** (2% in US) [observed], which explains the difference without infrastructure; no infra errors in logs [absent data]; an application config change (flag-off) produced recovery within 2 minutes [observed].

**Note on correlation:** the deploy→onset and US-contrast observations are correlations; the strongest causal evidence is the flag-off → recovery sequence with matching log signatures before and after.

## 6. What remains unknown

1. **Why** policy resolution returned `""` for affected tenants: missing tenant entries, lookup/validation bug, stale cache, or bad data written by the deploy that the rollback did not undo. Needs the config store contents and resolution code path.
2. **Which tenants** were affected: flag targeting in eu-west (assume broad vs US 2%, but unverified); `acme` failing and `beta` healthy is a sample of two.
3. **Fate of retry-budget-exhausted jobs** during 09:07–09:43 (dropped, DLQ, requeued): possible silent work loss or duplicated side effects; job 319's later success hints at requeue, but job 81 and the full population are unaccounted for.
4. **Quantified customer impact:** checkout latency distributions, failed/abandoned checkouts, per-tenant effects, revenue impact.
5. **Flag governance:** why the rollback did not disable the flag (process gap vs. tooling limitation), and why eu-west enablement scope differed from US.
6. **Restarted-pool mechanics:** why the 09:31 restart processed normally for exactly ~4 minutes (fresh connections? cache warm-up? job mix?) before stalling.
7. **Whether the flag was ever also serving a needed function** — i.e., cost of leaving it off (assumed low; US ran at 2% without alerts, but unverified).
8. Exact incident **date** (release name suggests 2026-09-23; not stated).
