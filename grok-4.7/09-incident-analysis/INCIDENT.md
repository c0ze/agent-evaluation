# eu-west queue incident

Scope of this note: `TIMELINE.md` and `LOGS.txt` only. Times are UTC. The log file is a short excerpt, so a missing line is weak evidence that an event did not happen.

Labels: **Observed** means the timeline or a log line states it. **Inference** means a reading that goes beyond those lines. Correlation is recorded as correlation.

## Impact

**Observed**

- In eu-west, queue depth started rising at 09:07 and worker CPU fell from 65% to 18%. Alerts for job age and checkout latency fired at 09:11.
- Database connections reached the configured maximum of 300 at 09:20. At 09:19:52, `api-03` logged `db remaining connection slots reserved`.
- The backlog stayed stuck after the 09:24 API rollback and was cleared at 10:18. Processing was degraded for about 71 minutes (09:07–10:18). Recovery is recorded as starting within two minutes of 09:43, so most of the remaining time was drain, not a continued stall.
- Impact was uneven at the start of the excerpt. At 09:06:58, job 81 (`tenant=acme`) exhausted its retry budget in 41ms. At 09:07:03, job 92 (`tenant=beta`) succeeded on attempt 1 in 830ms.
- The same release ran in the US with `tenant_retry_policy` enabled for 2% of tenants. No alert fired there.
- Job 319 exhausted its retry budget at 09:35:12 and the same job id succeeded at 09:43:10. For this job, inner-budget exhaustion left the job available for a later delivery.

**Not established.** No customer counts, error rates, revenue, data-loss totals, or dead-letter totals appear in the sources. The timeline does not define whether "checkout latency" is a customer action or a worker job checkout. Regional queue delay and database connection exhaustion are established; the customer-visible surface is not.

## Timeline

| Time | Observed event | Source |
| --- | --- | --- |
| 09:02 | API deploy `2026.09.23.1`. The change adds a tenant-specific retry policy. | Timeline |
| 09:06:58 | `worker-17`, job 81, `tenant=acme`: attempts 1–3 are `result=retry` with `delay_ms=0`, then `retry_budget_exhausted` with `policy=""` and `elapsed_ms=41`. | Logs |
| 09:07 | eu-west queue depth starts rising. Worker CPU falls from 65% to 18%. | Timeline |
| 09:07:01 | `worker-22`: `db pool wait exceeded` `wait_ms=5000` `active=10` `idle=0`. | Logs |
| 09:07:03 | `worker-08`, job 92, `tenant=beta`: attempt 1 `result=success` `elapsed_ms=830`. | Logs |
| 09:11 | Alerts fire for job age and checkout latency. | Timeline |
| 09:14 | On-call raises workers from 40 to 90. Queue depth rises faster after that. | Timeline |
| 09:19:52 | `api-03`: `db remaining connection slots reserved`. | Logs |
| 09:20 | Database connections reach the configured maximum of 300. | Timeline |
| 09:24 | API deploy rolled back. New job creation normalizes. Backlog still stuck. | Timeline |
| 09:31 | One worker pool restarted. It processes jobs normally for four minutes, then stalls. | Timeline |
| 09:31:10 | `worker-51` startup: `config_retry_default="exponential"` `feature_flag=true`. | Logs |
| 09:35:12 | `worker-51`, job 319: `retry_budget_exhausted` `policy=""` `elapsed_ms=38`. This is 4m02s after that worker's startup line. | Logs |
| 09:43 | Feature flag `tenant_retry_policy` disabled. Recovery begins within two minutes. | Timeline |
| 09:43:07 | `worker-51`: `config_changed` `feature_flag=false`. | Logs |
| 09:43:09 | `worker-51`, job 319: attempt 1 `result=retry` `delay_ms=1000`. | Logs |
| 09:43:10 | `worker-51`, job 319: attempt 2 `result=success` `elapsed_ms=190`. | Logs |
| 10:18 | Backlog cleared. | Timeline |
| (same release) | US flag coverage 2% of tenants. No alert there. | Timeline |

The "four healthy minutes" for the restarted pool are a timeline statement. The excerpt has no successful job line from `worker-51` between 09:31:10 and 09:35:12.

## Most likely root cause

**Inference, working theory.** With `tenant_retry_policy` on, some jobs were retried under an empty policy (`policy=""`) and `delay_ms=0`. Three attempts and budget exhaustion finished in 41ms (job 81) and 38ms (job 319). A retryable failure that clears only after a short wait would burn the whole budget before a later attempt can succeed.

The flag is the control that matches the only before/after behavior change in the logs. On `worker-51`, `feature_flag=true` at startup, then the empty-policy exhaustion at 09:35:12. At 09:43:07 the flag is false. Two seconds later job 319 waits `delay_ms=1000`, still fails once, and succeeds on attempt 2 in 190ms. The startup line shows `config_retry_default="exponential"` was already loaded while the flag was true, so the default existed and was not what those exhausted attempts used.

This is the best fit. It is not proof. The excerpt shows two exhausted jobs, and no line shows a non-empty policy value. The policy field appears only on those two warnings.

**Why this is ahead of the alternatives.** The API rollback at 09:24 normalized new job creation and left the backlog stuck. `worker-51` still started with `feature_flag=true` at 09:31:10, after that rollback, and then hit the same exhaustion pattern. The backlog recovery recorded in the timeline follows the flag change, not the rollback and not the worker restart. The US ran the same release at 2% flag exposure and did not alert, which fits a flag-gated failure better than a release-wide failure. That regional contrast is suggestive only: the eu-west exposure percentage is not in the sources.

## Hypotheses

### H1. Empty tenant policy and zero delay under the flag stalled job progress

**Support (observed).**

- Both budget-exhaustion lines have `policy=""` and sub-50ms elapsed time. The only attempt lines tied to job 81 use `delay_ms=0` and share one timestamp.
- Job 319's post-disable attempts use `delay_ms=1000`, about one second apart, and the second attempt succeeds. The first attempt is still `result=retry`, so the job had a real retryable failure and completed once a non-zero delay was used.
- `worker-51` had the exponential default configured and the flag on, then exhibited the empty-policy exhaustion. After `feature_flag=false` on that same worker, the delay changed.
- The failure appears on two workers (17 and 51), before and after a pool restart, so it is not one crashed process.
- `tenant=acme` hit the fast-fail path; `tenant=beta` succeeded in the same minute. That is consistent with a tenant-specific policy, and it is also consistent with two unrelated outcomes. One success and one failure cannot size the tenant split.

**Weaken.**

- Two jobs are a small sample. They may be the only jobs in this state, or the excerpt may have kept the interesting lines.
- Nothing in the logs says why an attempt's result was `retry`. The zero delay may have amplified a separate fast error (lock, conflict, dependency), or the empty policy may itself be what the retry layer treats as a retry.
- `policy=""` is logged only on the exhaustion warning. A logger that prints an empty field on every exhaustion would look the same. The delay change at the flag flip is the stronger observation; the empty string is the accompanying field.
- The restarted pool is described as healthy for four minutes while the flag was already true. A defect that breaks every flagged job immediately does not explain four healthy minutes. A defect that affects some tenants, or that appears once a particular job is dequeued, does.
- Recovery "within two minutes" of the flag change is a timeline correlation. The sources do not list every change made at 09:43.

**Status.** Leading hypothesis. Fix and containment should assume this path is unsafe until the two data gaps in `RESPONSE.md` are closed.

### H2. The database connection ceiling was the primary fault, and the retry lines are fallout

**Support (observed).**

- `worker-22` blocked for 5000ms with `active=10` `idle=0` at 09:07:01, three seconds after job 81's exhaustion.
- `api-03` reported reserved remaining connection slots at 09:19:52, and connections hit the configured maximum of 300 at 09:20.
- Worker CPU fell while the queue rose, which fits workers blocked on a pool wait better than a CPU-bound spin. Job 81 itself finished in 41ms, so that particular job was not the 5s wait; the wait is a second worker.
- Raising workers from 40 to 90 was followed by faster queue growth, then by the connection ceiling. Adding consumers made the backlog worse, which is what a saturated shared limit tends to do.

**Weaken.**

- Job 92 succeeded at 09:07:03, two seconds after the pool-wait warning, in 830ms. The database was still completing work.
- Job 81's three retries were already `delay_ms=0` with an empty policy before the pool-wait line. A full database does not, by itself, set `policy=""` or `delay_ms=0`.
- The recorded recovery action that lines up with jobs succeeding is the flag change. No database failover, pool resize, or connection kill is in the timeline. Job 319 then completed in 190ms, so the database accepted that work immediately after the flag flip. Connections may have drained because workers stopped the bad path; the sources do not show a connection graph, so that drain is an inference.
- The global ceiling is a late event (09:20), thirteen minutes after the first empty-policy exhaustion and after the scale-up. It explains a widened blast radius better than the first minute of the incident.

**Status.** Real multiplier, weak as the originating cause. Early local pool waits and the later server-wide ceiling belong in the narrative as observed damage and as a reason the scale-up backfired.

### H3. The API deploy broke processing independent of the feature flag

**Support (observed).**

- The queue moved at 09:07, five minutes after API deploy `2026.09.23.1`.
- After the 09:24 rollback, new job creation normalized.

**Weaken.**

- The backlog stayed stuck while `worker-51` was still on `feature_flag=true`.
- The same release in the US at 2% flag exposure did not alert.
- The behavior change in the log follows `config_changed feature_flag=false`, after the rollback had already happened.

**Status.** The deploy is the change that introduced tenant-specific retry. The rollback improved job creation and did not restore the backlog. Treat "roll back the API artifact" and "turn off `tenant_retry_policy`" as different actions. Only the second one lines up with processing recovering.

### H4. Raising workers from 40 to 90 caused the incident

**Support (observed).** Queue depth was already rising at 09:07. After the 09:14 scale-up it rose faster, and connections hit 300 at 09:20.

**Weaken.** The scale-up is a response, six minutes after the queue started rising and after the empty-policy log line. It cannot be the start of the incident.

**Status.** Contributing factor. More workers can hold more database connections. **Inference:** if a busy worker holds on the order of the 10 active connections seen on `worker-22`, a jump from 40 to 90 workers can press a 300-connection server cap even when 40 workers had been under it. The sources do not state the pool maximum, so the arithmetic is conditional.

### H5. One bad tenant (acme) wedged the region

**Support (observed).** The only named tenant on an exhaustion line is `acme`. `beta` succeeded in the same minute.

**Weaken.** Job 319 has the same `policy=""` exhaustion and, in this excerpt, no tenant field. That same job succeeded after the flag flipped, which a permanently bad tenant payload would not do by a flag change alone. Connection limits and a regional queue are broader than one tenant. The US contrast tracks flag exposure, which is a different axis than a single account.

**Status.** Possible that tenants with a missing policy were the ones harmed. Not supported as "acme alone wedged the fleet." How many tenants had an empty policy is unknown.

## Contributing factors

**Observed**

- Worker count went from 40 to 90 while the queue was already growing. Depth then grew faster, and database connections reached 300.
- The API rollback and the worker flag were independent. After the rollback, a restarted worker still logged `feature_flag=true` and later exhausted a retry budget in 38ms.
- The configured database maximum (300) was actually reached, and an API process logged that remaining slots were reserved. Worker trouble and API trouble met at that limit.
- Inner retry budget can be spent in under 50ms when `delay_ms=0`. Job 319 shows the other side: a 1000ms delay was enough for a later attempt to succeed.

**Inference**

- An empty tenant policy did not fall back to `config_retry_default="exponential"`. The default was loaded on the worker that then used `delay_ms=0`.
- Zero delay removes the wait that job 319 needed between a failed attempt and a successful one.
- There was no effective guardrail in the recorded response that stopped the flag while `policy=""` and sub-50ms exhaustions were happening. The successful containment was manual and came at 09:43, about 36 minutes after the first such log line.
- eu-west flag exposure was high enough to stall the region, given that disabling it preceded recovery and that 2% US exposure did not alert. The eu-west percentage itself is not written down.

## Unknown

- eu-west flag percentage, and the time the flag was turned on relative to the 09:02 deploy.
- How many jobs and tenants logged `policy=""` or `delay_ms=0`, and the error reason behind `result=retry`.
- Whether `policy=""` means a missing tenant record, a serialization bug, or a log field that is unpopulated on the exhaustion path.
- Disposition of jobs other than 319: completed later, requeued, dead-lettered, or dropped. Job 319 survived to a later success. That does not generalize.
- What "new job creation normalizes" means for processing. Creation returning to a normal rate can coexist with workers still failing to drain.
- Why the restarted pool was healthy for about four minutes. Tenant mix, queue order, and pool warmup are all open.
- Connection counts split by workers versus API, minute by minute. Without that, H2 stays a plausible amplifier rather than a measured one.
- Whether any database operation (kill, failover, setting change) happened and was left out of the timeline.
- US job-level failure rate. No alert is not the same as no empty-policy retries.
- The customer-facing meaning of the checkout-latency alert, and any SLO or loss numbers.
- Whether another change landed at 09:43 together with the flag.

## Fact and inference, separated

**Safe to treat as fact:** the deploy time and version, the CPU and queue description, the alert time, the worker scale-up and faster queue growth, the 300-connection ceiling, the API slot error, the rollback's failure to unstick the backlog, the flag disable time, recovery starting within two minutes of that disable, backlog clear at 10:18, US 2% exposure with no alert, and every field in the log lines above.

**Working theory, not fact:** empty policy under the flag skipped the exponential default, zero delay exhausted a budget that a 1s backoff could survive, that path was common enough to stall eu-west, and the resulting churn plus the scale-up drove connections to 300. The flag-off success on job 319 is the strongest single piece of evidence, and it is still one job plus a timeline correlation.
