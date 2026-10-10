# Incident: eu-west job queue stall and checkout latency (2026-09-23)

Status: mitigated at 09:43 UTC, backlog cleared at 10:18 UTC. Root cause not yet confirmed.

Sources: `TIMELINE.md` (operator timeline) and `LOGS.txt` (12 sampled log lines from 5 hosts). The logs are a small sample. They are not a complete record.

Labels used below:
- **[Fact]**: stated directly in the timeline or logs.
- **[Inference]**: my interpretation. It could be wrong.

## 1. Impact

| Area | What we know | Label |
|---|---|---|
| Region | eu-west. No alert fired in the US, but US impact was not measured. | Fact / Unknown |
| Duration | Queue depth began rising at 09:07. The backlog cleared at 10:18, about 71 minutes later. | Fact |
| Background jobs | Job age alert fired at 09:11. Jobs were delayed until the backlog cleared. | Fact |
| Checkout | A checkout latency alert fired at 09:11. How much latency rose, and for how many users, is unknown. | Fact / Unknown |
| API errors | At 09:19:52, `api-03` logged `remaining connection slots reserved`, which means the API could not get database connections. Some API requests probably failed around 09:20. | Fact / Inference |
| Job creation | New job creation was abnormal until the 09:24 rollback, when it "normalized". | Fact |
| Jobs that gave up | Jobs 81 and 319 logged `retry_budget_exhausted`. We do not know what happens to a job after that: it may be dropped, dead-lettered or retried. There may be permanently failed or duplicated work that has not been found yet. | Fact / Unknown |

Not yet quantified: the number of affected tenants, delayed jobs, failed checkouts and failed API requests, and the peak job age.

## 2. Timeline (UTC)

| Time | Event | Source |
|---|---|---|
| 09:02 | API release `2026.09.23.1` deployed. It adds a tenant-specific retry policy behind flag `tenant_retry_policy`. | Timeline |
| 09:06:58 | `worker-17`, job 81, tenant `acme`: 3 attempts at `delay_ms=0`, then `retry_budget_exhausted policy=""` after 41 ms. | Log |
| 09:07 | Queue depth starts rising. Worker CPU falls from 65% to 18%. | Timeline |
| 09:07:01 | `worker-22`: DB pool wait exceeded 5000 ms, with `active=10 idle=0`. | Log |
| 09:07:03 | `worker-08`, job 92, tenant `beta`: succeeds on the first attempt. | Log |
| 09:11 | Alerts fire for job age and checkout latency. Detection took about 4 minutes. | Timeline |
| 09:14 | On-call raises workers from 40 to 90. Queue depth then rises faster. | Timeline |
| 09:19:52 / 09:20 | The API is refused DB connections. DB connections reach the configured maximum of 300. | Log / Timeline |
| 09:24 | API release rolled back. Job creation normalizes, but the backlog stays stuck. | Timeline |
| 09:31 | One worker pool is restarted. `worker-51` starts with `config_retry_default="exponential" feature_flag=true`. | Timeline / Log |
| 09:35 | That pool stalls after about 4 normal minutes. `worker-51` job 319 logs `retry_budget_exhausted policy=""` after 38 ms. | Timeline / Log |
| 09:43:07 | Flag `tenant_retry_policy` disabled. `worker-51` logs `config_changed feature_flag=false`. | Timeline / Log |
| 09:43:09–10 | Job 319 retries with `delay_ms=1000`, then succeeds. | Log |
| ~09:45 | Recovery begins. | Timeline |
| 10:18 | Backlog cleared. | Timeline |

## 3. Most likely root cause

**Leading hypothesis (H1), medium-high confidence:** the retry-policy code behind `tenant_retry_policy` misbehaves when a tenant has no specific policy.

With the flag on, some tenants resolved to an empty policy (`policy=""`). The code did not fall back to the configured default (`exponential`). Instead it retried immediately (`delay_ms=0`) and used up the retry budget in about 40 ms. This behavior, directly or indirectly, saturated the database connection pools. Workers then blocked while waiting for connections, and the queue stalled. When worker pools grew, the database hit its 300-connection limit, and the shared API was starved of connections. That caused the checkout latency and API errors.

Which parts of H1 are observed and which are inferred:

- **[Fact]** With the flag on, jobs logged `policy=""` and `delay_ms=0` retries.
- **[Fact]** The same worker had `config_retry_default="exponential"` loaded.
- **[Fact]** After the flag was turned off, the same job on the same worker, with no restart, retried at `delay_ms=1000` and succeeded.
- **[Inference]** An empty string is treated as a valid policy instead of "no policy". This fits the logs, but I have not read the code.
- **[Inference, weakest link]** How fast retries turn into connection exhaustion and a worker that stalls with low CPU. See the unknowns in section 6.

## 4. Hypotheses and evidence

### H1: The flag-gated retry-policy path is the trigger (leading)

Supporting evidence:
- The logs show `policy=""` and zero-delay retries while the flag was on. They show a 1000 ms delay and a success right after it was turned off.
- This is the strongest single piece of evidence. It is a before-and-after on one job and one worker, with no restart, and the flag change is the only change we know of. It is still not a controlled experiment: other things may have changed at 09:43.
- Rolling back the API release did not clear the backlog. The flag stayed on, which fits the cause being in behavior the flag controls, not only in API code.
- Restarting a worker with the flag still on helped only briefly. The pool stalled again after a job logged `policy=""`.
- Recovery started within about 2 minutes of turning the flag off. About 19 minutes had passed since the rollback without recovery.
- Job 92 for tenant `beta` succeeded while job 81 for `acme` failed. This fits a problem that affects only some tenants, for example those without their own policy.
- The US had the flag on for only 2% of tenants and no alert fired. This is consistent with an effect that grows with exposure.

Weakening evidence and caveats:
- The link from zero-delay retries to blocked, low-CPU workers is not shown. A tight retry loop would usually *raise* CPU, but CPU fell. Retries exhausting after about 40 ms do not by themselves explain workers staying stuck. Something else must be holding connections or blocking.
- Only 2 affected jobs appear in the logs. We do not know how common `policy=""` was, or which tenants had it.
- The US evidence is confounded. It may have different traffic, capacity or tenants. The 2% cohort may not include any tenants with empty policies. No alert does not mean no impact.
- Other changes around 09:43 have not been ruled out: backlog load falling after the rollback, connections timing out, or other operator actions.
- We do not know whether workers were also running `2026.09.23.1`. The timeline says only "deploy api".

### H2: Non-flag code in API release `2026.09.23.1`

- For: the problem started 5 minutes after the deploy. The rollback normalized job creation, so the release did affect the API's job-intake side.
- Against: the backlog stayed stuck for 19 minutes after the rollback. Recovery followed the flag change, not the rollback.
- Assessment: probably contributed to the intake and API symptoms. Unlikely to be the main cause of the worker stall.

### H3: A database problem unrelated to the change

- For: the pool wait at 09:07:01, the connection limit reached at 09:20, and the API refused connections.
- Against: saturation started within seconds of the first `policy=""` failure. It cleared after a flag change, with no database change. There was no evidence of a database fault.
- Assessment: most likely a *symptom and amplifier*, not the cause. Not fully ruled out, because we have no database-side metrics.

### H4: The worker scale-up (40 to 90) caused the incident

- Against: queue depth was already rising at 09:07, 7 minutes before the scale-up.
- For it as an amplifier: the queue grew faster after the scale-up, and connections hit their maximum 6 minutes later.
- **[Inference]** `active=10 idle=0` suggests each worker's pool holds about 10 connections. If so, 90 workers could ask for up to about 900 connections. That is far above the limit of 300, which the API also shares. Even 40 workers (about 400) could exceed it.
- Assessment: this was a contributing factor that made things worse. It was not the root cause.

### H5: Bad data for one tenant only (for example, `acme`)

- A single bad tenant record is possible, but the flag-off recovery happened across the whole region. More likely, a tenant with no policy exposed the fallback bug in H1. Which tenants were involved is unknown.

## 5. Contributing factors

Each factor is labelled with how solid it is.

1. **Missing fallback and validation (inference).** An empty tenant policy was accepted instead of falling back to the default. There is also no minimum delay for retries.
2. **Flag separate from the deploy (fact).** Rolling back the release did not turn off the new behavior. This delayed mitigation by about 19 minutes, and about 32 minutes passed from the first alert to the flag change.
3. **Scaling made it worse (fact plus inference).** Adding workers added more connection pools against a database limit shared with the API. Nothing stopped workers × pool size from exceeding the database's maximum connections.
4. **API and workers share one connection limit (fact plus inference).** The worker backlog spread to checkout through connection starvation.
5. **Detection was symptom-based (fact).** Alerts fired on job age and latency. No alert covered retry-budget exhaustion, zero-delay retries or pool waits. In the US, no alert fired at all.
6. **Rollout exposure (unknown).** The flag was on for 2% of tenants in the US. The eu-west percentage is not recorded, and neither is whether the rollout had automatic safety checks.

## 6. What remains unknown

- How an exhausted retry leaves a worker stuck with low CPU. Candidates: connections not returned to the pool on the exhaustion path, open transactions or row locks held, or contention on a shared job table. Recovery without a restart argues against a permanent connection leak, but does not rule out leaks that time out.
- Why the restarted pool worked for exactly about 4 minutes. This could be the time needed to fill a 10-connection pool, or the time until it picked up a job with `policy=""`.
- Which tenants resolved to `policy=""`, and the eu-west and US flag percentages.
- Whether workers run code from `2026.09.23.1`. If they do not, how the worker reads the tenant policy.
- Why the API rollback normalized job creation.
- What happens to jobs after `retry_budget_exhausted`, and whether any were lost, sent to a dead-letter queue or duplicated. This matters if checkout jobs are not idempotent.
- Why the attempt counter for job 319 reset to 1 after it had been exhausted.
- Database-side connection breakdown (by client and state) and US metrics for the same window.
- How many customers and requests were affected.
