# Incident analysis: eu-west queue stall (release `2026.09.23.1`)

Sources: `TIMELINE.md` (cited as T) and `LOGS.txt` (cited as L plus line number).
Convention: **[F]** = observed fact, stated in a source. **[I]** = inference, my reasoning on top of the facts. Nothing tagged [I] should be read as established.

Status at time of writing: service recovered (backlog cleared 10:18 UTC). Root cause is **probable, not proven**.

## 1. Impact

Observed [F]
- Region: eu-west. Alerts fired for job age and checkout latency at 09:11 (T).
- Queue depth rose from 09:07 and worker CPU fell from 65% to 18% (T).
- The database reached its configured maximum of 300 connections at 09:20 (T). At 09:19:52 `api-03` logged that no connection slots were available (L7).
- New job creation was degraded until the API rollback at 09:24, after which it "normalizes" (T).
- Backlog stayed stuck after the rollback and cleared at 10:18 (T).
- US region: same release, flag enabled for 2% of tenants, no alert fired (T).

Derived durations [F, arithmetic on T]
- Onset to alert: about 4 min (09:07 to 09:11). The first log evidence of the problem is 09:06:58 (L1).
- Alert to mitigation that worked (flag off): 32 min (09:11 to 09:43). Onset to flag off: 36 min.
- Onset to backlog cleared: about 71 min (09:07 to 10:18). Flag off to backlog cleared: 35 min.

Not known
- Number of tenants and customers affected, number of checkouts that failed or timed out (versus merely slowed), and whether any jobs were dropped, dead-lettered, or executed more than once.
- Whether the US 2% cohort was silently affected (no alert is not the same as no impact).
- The incident date. The release tag suggests 2026-09-23 but T does not state a date.

## 2. Concise timeline (UTC)

| Time | Event | Source | Type |
|---|---|---|---|
| 09:02 | API deploy `2026.09.23.1`, adds tenant-specific retry policy | T | F |
| ? | `tenant_retry_policy` flag enabled in eu-west (**time and % of tenants not recorded**) | none | gap |
| 09:06:58 | job 81 (tenant acme) retries 3x with `delay_ms=0`, then `retry_budget_exhausted policy=""` after 41 ms | L1-L4 | F |
| 09:07 | Queue depth begins rising; worker CPU 65% to 18% | T | F |
| 09:07:01 | worker-22: DB pool wait exceeded 5000 ms, `active=10 idle=0` | L5 | F |
| 09:07:03 | worker-08: job 92 (tenant beta) succeeds first attempt, 830 ms | L6 | F |
| 09:11 | Alerts: job age, checkout latency | T | F |
| 09:14 | Workers scaled 40 to 90; queue depth then rises faster | T | F |
| 09:19:52 / 09:20 | api-03 out of DB connection slots; DB at 300 max connections | L7, T | F |
| 09:24 | API rolled back; job creation normalizes; backlog stays stuck | T | F |
| 09:31:10 | worker-51 restarted: `config_retry_default="exponential" feature_flag=true` | L8 | F |
| 09:31-09:35 | Restarted pool processes normally for about 4 min, then stalls | T | F |
| 09:35:12 | worker-51: job 319 `retry_budget_exhausted policy=""` after 38 ms | L9 | F |
| 09:43 | Flag `tenant_retry_policy` disabled; recovery begins within 2 min | T | F |
| 09:43:07-10 | worker-51 sees `feature_flag=false`; job 319 retries with `delay_ms=1000`, succeeds on attempt 2 in 190 ms | L10-L12 | F |
| 10:18 | Backlog cleared | T | F |

## 3. Observed facts versus inference

Observed [F]
1. In both `retry_budget_exhausted` log lines (L4, L9) the policy is an empty string, and the budget was spent in 38-41 ms.
2. In the only job with per-attempt detail while the flag was on (job 81), every retry had `delay_ms=0` (L1-L3).
3. The worker start-up config shows a default retry policy of `exponential` (L8), yet the exhausted jobs report `policy=""`.
4. After the flag was turned off, job 319, which had exhausted its budget at 09:35 (L9), retried with a 1000 ms delay and succeeded (L11-L12).
5. Rolling back the API fixed job creation but not the backlog (T).
6. Restarting a worker pool with the flag on gave about 4 minutes of normal processing, then a stall, and the first exhaustion line after restart appears 4 min 2 s after start-up (T, L8, L9).
7. Scaling workers 40 to 90 was followed by faster queue growth, and DB connections hit 300 six minutes later (T).
8. Worker CPU fell rather than rose during the stall (T), and a worker was waiting 5 s on its DB pool at the start (L5).

Inferred [I]
- **I1.** With the flag on, the policy lookup returns an empty value for at least some tenants or jobs and the code does not fall back to the `exponential` default. (Supported by facts 1-4; the reason for the empty value, such as tenant config with no policy or a bug in the new code, is not shown.)
- **I2.** An empty policy means zero backoff, so failing jobs are retried instantly, burn their budget in tens of milliseconds and are put back in the queue. (Facts 2 and 4 support this; that job 319 was picked up again later suggests exhausted jobs are re-queued rather than dropped, but the logs do not say.)
- **I3.** This churn saturated the shared DB connection limit, which is what starved workers (low CPU, 5 s pool waits) and later the API. **This link is the weakest part of the chain.** No log ties retries to connection usage.
- **I4.** Scaling to 90 workers made it worse by adding more consumers competing for a fixed 300 connections (fact 7). Correlation only; queue depth could also have risen faster simply because more workers produced more exhausted retries.
- **I5.** The stall after restart (fact 6) is consistent with the restarted workers reaching jobs that need a retry, or with DB saturation returning. The data cannot separate these.

## 4. Most likely root cause

**Enabling the `tenant_retry_policy` code path (shipped in `2026.09.23.1`) produced an empty retry policy that removed retry backoff. Jobs that hit a transient failure were retried immediately and exhausted their budget, creating a sustained retry loop that, together with the worker scale-up, exhausted the database connection limit and stalled workers and the API.**

Confidence: moderate that the flag-enabled path was necessary for the sustained outage; low to moderate on the exact mechanism between retries and connection exhaustion (I3).

Why this hypothesis ranks first: it is the only one that explains the empty-policy log lines, the zero delays, the lack of recovery after the API rollback, the relapse after the worker restart, the same-job before/after change at the flag flip, and recovery within two minutes of the flag flip.

What it does not explain: what caused the *first* failed attempts. `attempt=1 result=retry` means something failed before any retry. If that something was DB pool contention (L5 shows a 5 s wait starting at about 09:06:56, which is not clearly after L1-L4), then missing backoff **amplified** an existing problem instead of creating it, and the original trigger is still unidentified.

## 5. Contributing factors

Each is supported by evidence but is a contributor, not proven cause.
1. **No fallback or validation for an empty policy** (I1; facts 1 and 3).
2. **Shared DB connection ceiling (300) with no isolation between API and workers**, so worker trouble also hurt job creation and checkout (L7, T). A pool showing `active=10` while the DB max is 300 suggests pool sizes multiply quickly with worker count: 40 workers x 10 would already be 400 if pools are per worker. [I, unverified: pool scope is not stated.]
3. **Containment made things worse**: scaling workers 40 to 90 accelerated queue growth. This was a reasonable step given the alerts, but no signal told responders that the database, not worker capacity, was the constraint. [I; process gap, not individual fault]
4. **Detection covered symptoms only**: alerts came from job age and checkout latency, 4 min after onset. The DB pool warning at 09:07:01 and the retry exhaustion did not alert (nothing in T says they did).
5. **Flag change not correlated with the incident timeline**: it took 32 min from alert to flag off, and the flag is not mentioned until 09:43. The timeline does not say when it was enabled. [I]
6. **Two changes in one window** (code deploy and flag exposure), and rollback of the API did not remove the flag-controlled behaviour on workers, which delayed diagnosis. [I]
7. **Worker restart is not a useful remedy** when the cause is configuration, and it appeared to work for 4 min (fact 6), which may have encouraged further restart attempts. [I]

## 6. Hypotheses, with evidence for and against

| # | Hypothesis | Evidence for | Evidence against or weakening | Assessment |
|---|---|---|---|---|
| H1 | Flag-enabled empty policy causes zero-backoff retry churn, which saturates the DB | L1-L4, L9 (empty policy, delay 0, 38-41 ms); L11-L12 (same job gets 1000 ms delay and succeeds after flag off); recovery within 2 min of flag off (T); restart relapse with flag on (L8-L9); US 2% exposure with no alert (T) | Only one worker and one job show the before/after change (n=1, sampled logs, no control); no log links retries to DB connections; CPU fell instead of rising; first-failure cause unknown; the US comparison is confounded by traffic, scale and tenant mix | **Most likely** |
| H2 | The API release, independent of the flag, exhausted DB connections (leak, bigger pool, extra queries) | Onset 5 min after deploy; API rollback normalized job creation; api-03 out of slots (L7) | Backlog persisted after rollback; recovery followed a flag change, not a code change; retry logs are worker-side. The rollback may also just have restarted pods and freed connections | **Partly retained** for the API-side impact only; cannot be excluded |
| H3 | Scale-up to 90 workers was itself the cause of exhaustion | Depth rose faster after 09:14; 300 reached at 09:20 | Onset (09:07) and pool wait (09:07:01) precede scale-up by 7 min | **Aggravator, not origin** |
| H4 | Independent eu-west infrastructure fault (DB, network, noisy neighbour) | DB pool waits and connection ceiling are infrastructure-flavoured; US quiet | Recovery followed the flag flip without infrastructure action; same-job change at flag flip. No infra event data supplied | **Not excluded, lower likelihood** |
| H5 | Stuck or degraded worker processes | Backlog stuck after rollback | Restart gave only 4 min of normal work, then relapse (T, L8-L9) | **Unlikely** |
| H6 | Recovery at 09:43 was coincidental or a delayed effect of the 09:24 rollback | Flag flip came 19 min after rollback; traffic could have changed | Worker-51 stalled at 09:35, after the rollback; recovery began within 2 min of flag off; job 319 changed behaviour within 3 s of the config change | **Weakened, not eliminated** (no control group) |

Correlation cautions
- The flag flip and recovery are closely timed, which is strong temporal evidence, but there was no controlled test, and several changes happened in the same hour (deploy, scale-up, rollback, restart, flag off).
- "US had the flag on for only 2% and no alert" supports a dose-response story but does not prove it, because alert thresholds may simply not have been reached.
- Job 319 succeeding on attempt 2 after the flag change may also reflect the underlying transient error clearing (for example DB pressure easing). The 1000 ms delay proves the policy changed; it does not prove the policy was the only thing that changed.

## 7. What remains unknown

1. When the flag was enabled in eu-west and for what share of tenants (T is silent; deploy was 09:02, symptoms 09:07).
2. Why the policy was empty (tenant with no policy configured, blank default in new code, config parse failure) and how many tenants were affected.
3. What the first-attempt failures were (error type) and whether they were caused by DB pool waits.
4. Who held the 300 connections (API, workers, which pools, idle-in-transaction, lock waits), and whether retries acquire a connection per attempt.
5. What happens to a job after `retry_budget_exhausted`: re-queued, dead-lettered, or failed; and whether any side effects (charges, emails) ran more than once.
6. Whether workers run `2026.09.23.1` or only share the flag, and whether the release contained schema or data changes that affect rollback.
7. Whether the worker count is still at 90, and why the pool stalled 4 min after restart rather than immediately.
8. Whether the US 2% cohort experienced the same behaviour.
9. Whether the CPU drop reflects workers blocked on the DB (my reading) or something else.

## 8. Data-quality limits

- `LOGS.txt` has 12 lines from 4 hosts. It is clearly a sample, so absence of a pattern in it means nothing, and selection bias is possible.
- Both exhausted-retry lines have empty policy, but there is no exhausted-retry line with a non-empty policy to contrast against.
- Timeline entries have minute resolution; log entries have second resolution. Ordering within the same minute (for example L1-L5 versus the 09:07 queue-depth event) cannot be resolved from this data.
