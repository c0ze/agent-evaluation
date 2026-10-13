# Incident analysis — eu-west queue stall, 2026-09-23 (UTC)

## Summary

Between about 09:07 and 10:18 UTC, job processing in eu-west stalled,
checkout-related alerts fired, and a backlog accumulated and was then cleared.
The evidence most strongly associates the stall with the newly deployed
tenant-specific retry policy while its feature flag was enabled, and in
particular with an empty retry policy (`policy=""`) producing zero-delay
retries. The exact mechanism by which that behaviour saturated the database
and stalled workers is **inferred, not observed**, and remains the main gap.

This document separates **observed facts** (directly in `TIMELINE.md` /
`LOGS.txt`) from **inference**. Correlation in time is treated as supporting
evidence, not proof.

## Impact (observed)

- **Region / function:** eu-west job queue; alerts for job age and checkout
  latency fired at 09:11. Checkout impact is evidenced only by that latency
  alert — no counts of failed checkouts, orders, or customers are in the
  supplied data.
- **Duration:** queue depth began rising at 09:07; backlog was cleared at
  10:18 (~71 minutes). New job creation normalised earlier, after the 09:24
  API rollback, while the existing backlog remained stuck until recovery
  began within two minutes of the 09:43 flag disable.
- **Worker behaviour:** worker CPU fell from 65% to 18% at 09:07, i.e.
  workers became less busy, not busier — consistent with waiting/blocking
  rather than CPU-bound work (mechanism is inference).
- **Database:** database connections reached the configured maximum of 300
  at 09:20.
- **Other region:** the US region on the same release, with the flag enabled
  for only 2% of tenants, had no alert.
- **Not in evidence:** data loss, permanently failed/lost jobs, number of
  affected tenants/customers, revenue effect, or any security impact. None
  should be assumed in either direction.

## Concise timeline (observed facts, UTC)

| Time | Observation |
|---|---|
| 09:02 | API deploy `2026.09.23.1`; adds tenant-specific retry policy. |
| 09:06:58 | `worker-17`: job 81 (tenant `acme`) attempts 1–3 all `result=retry`, `delay_ms=0`, same second; `retry_budget_exhausted policy="" elapsed_ms=41`. |
| 09:07 | Queue depth begins rising in eu-west; worker CPU 65% → 18%. |
| 09:07:01 | `worker-22`: db pool wait exceeded, `wait_ms=5000 active=10 idle=0`. |
| 09:07:03 | `worker-08`: job 92 (tenant `beta`) succeeds in 830 ms. |
| 09:11 | Alerts fire for job age and checkout latency. |
| 09:14 | Workers increased 40 → 90; queue depth rises faster afterwards. |
| 09:19:52 | `api-03`: `db remaining connection slots reserved`. |
| 09:20 | Database connections reach configured maximum of 300. |
| 09:24 | API deploy rolled back; new job creation normalises, backlog still stuck. |
| 09:31 | One worker pool restarted; processes normally ~4 min, then stalls. `worker-51` startup: `config_retry_default="exponential" feature_flag=true`. |
| 09:35:12 | `worker-51`: job 319 `retry_budget_exhausted policy="" elapsed_ms=38`. |
| 09:43:07 | `worker-51`: `config_changed feature_flag=false`. |
| 09:43:09–10 | Job 319: attempt 1 `result=retry delay_ms=1000`, attempt 2 `result=success`. |
| 09:43–09:45 | Recovery begins within two minutes of the flag being disabled. |
| 10:18 | Backlog cleared. |

## Most likely root cause (inference)

**Most likely:** with `tenant_retry_policy` enabled, retry-policy resolution
returned an empty policy (`policy=""`) for at least some tenants/jobs instead
of falling back to the configured default (`config_retry_default="exponential"`,
seen at worker startup). The empty policy was applied as zero-delay retries
(`delay_ms=0`), so retries exhausted their budget in ~40 ms. Through a
mechanism not directly shown in the logs — plausibly rapid retry/requeue
load and/or repeated processing of affected jobs holding or consuming
database connections — database pool capacity was consumed, workers blocked
waiting on the pool (low CPU, pool-wait errors), and the queue stalled.

Confidence in the flag/empty-policy involvement is moderate-to-high (see
`RESPONSE.md`); confidence in the specific database-saturation mechanism is
lower, because no log line directly shows a retry creating a connection,
requeueing a job, or leaking a connection.

## Hypotheses: supporting and weakening evidence

### H1 — Flag-enabled tenant retry policy returns empty policy → zero-delay retries → DB/queue stall (most likely)

Supporting (observed):
- Both `retry_budget_exhausted` events show `policy=""` with `delay_ms=0`
  and elapsed times of only 41 ms and 38 ms (09:06:58, 09:35:12).
- The same job (319) that exhausted its budget under `feature_flag=true`
  retried with `delay_ms=1000` and succeeded on attempt 2 within ~3 seconds
  of `feature_flag=false` (09:43:07–09:43:10) — a same-job, before/after
  contrast.
- Onset 09:07 follows the 09:02 deploy that added the tenant retry policy.
- Recovery begins within two minutes of disabling the flag at 09:43, with
  no database restart recorded.
- US region: same release but flag at only 2% of tenants, no alert — a
  dose/exposure contrast pointing at the flag rather than the release alone.
- Tenant `beta` job succeeds at 09:07 while tenant `acme` job exhausts —
  consistent with a tenant-specific policy lookup failing only for some
  tenants (e.g. tenants with no configured policy).

Weakening / limits:
- Only two jobs are shown with `policy=""`; the tenant of job 319 is not
  logged, and there is no count of affected tenants or jobs.
- No log directly links zero-delay retries to connection consumption;
  that step is inferred from the pool/connection observations.
- Job 319's success after the flag change could partly reflect generally
  improving conditions, though the 2–3 second proximity and changed
  `delay_ms` make coincidence less likely.

### H2 — Database connection leak / pool exhaustion as the primary fault

Supporting (observed):
- Pool wait exceeded at 09:07:01 (`active=10 idle=0`); connections reach
  the 300 maximum at 09:20; `remaining connection slots reserved` at 09:19:52.
- Low worker CPU with a rising queue is consistent with workers blocked
  waiting for connections.
- A restarted worker pool works for ~4 minutes then stalls (09:31–~09:35),
  consistent with fresh capacity being re-consumed.

Weakening:
- Does not explain `policy=""`, `delay_ms=0`, or why disabling the retry
  flag — with no recorded database action — starts recovery within minutes.
- Connection saturation may be a *consequence/amplifier* of H1 rather than
  an independent primary fault. A leak *caused by* the new retry path would
  still sit under H1.

### H3 — Release regression unrelated to the flag

Supporting: onset ~5 minutes after the 09:02 deploy of a release touching
retry behaviour.

Weakening:
- Rolling back the API deploy (09:24) normalised new job creation but left
  the backlog stuck, so the deployed API code alone does not explain the
  continuing stall. (Workers/flag state are separate from the API deploy;
  the rollback observation therefore weakens, but does not eliminate, a
  worker-side code regression.)
- The restarted worker ran with the same startup configuration and stalled
  again while `feature_flag=true`.
- Recovery tracks the flag disable, not the rollback; the US had the same
  release without incident at low flag exposure.

### H4 — Scaling workers 40 → 90 caused the incident

Supporting: queue depth rose faster after 09:14 and connections hit the
maximum at 09:20, consistent with more workers competing for the database.

Weakening as root cause: onset (09:07), pool wait (09:07:01), and alerts
(09:11) all precede the scale-up. Scaling is best treated as an amplifier,
not the origin.

### H5 — A single tenant's poison job / load (e.g. `acme`) caused the stall

Supporting: the `acme` job shows the pathological retry pattern and a
`beta` job succeeds at the same time.

Weakening: a single tenant/job does not by itself explain region-wide queue
stall, 300 connections, or recovery on flag disable; only one `acme` job is
shown, the tenant for job 319 is unknown, and affected-tenant scope is
unmeasured. At most this is a trigger instance of H1, not yet a proven scope.

### H6 — Independent database infrastructure failure

Supporting: pool waits and connection saturation are database-visible.

Weakening: no database error other than capacity/reservation messages is
shown; onset follows the retry-policy deploy; recovery follows the flag
disable without a recorded database intervention. Separate regional
databases mean the unaffected US region does not strongly test this, so it
is weakened but not fully excluded.

## Contributing factors (inference from observed facts)

1. **Empty-policy fallback:** an empty resolved policy was apparently
   accepted and applied as `delay_ms=0` rather than falling back to the
   configured `exponential` default or failing safely.
2. **No effective guardrail on zero-delay retries:** retries ran
   back-to-back within one second and exhausted budget in ~40 ms, so a
   misconfiguration converted directly into rapid repeated work.
3. **Flag state decoupled from deploy/rollback:** rolling back the API
   (09:24) and restarting workers (09:31, still `feature_flag=true`) did
   not clear the condition; only disabling the flag (09:43) did. This
   prolonged the incident by ~19 minutes after rollback.
4. **Scaling into a blocked system:** increasing workers 40 → 90 while
   workers were waiting on the database was followed by faster queue
   growth and connections reaching the 300 maximum — added concurrency
   against a saturated dependency.
5. **Shared, finite DB pool:** pool waits appear within ~1 minute of the
   first pathological retries, indicating little headroom/isolation between
   retry-driven load and normal job processing (capacity details unknown).

## What remains unknown

- The precise mechanism from empty policy / zero-delay retries to database
  saturation: retry requeue rate, connections per attempt, whether any
  connection was leaked or held across retries, and which queries/services
  held the 300 connections.
- Scope: how many tenants and jobs received `policy=""`; whether only
  tenants with no configured policy were affected; the tenant of job 319;
  the full list of tenants with the flag enabled in eu-west vs the US 2%.
- Whether affected jobs were lost, duplicated, or eventually all processed;
  the 10:18 "backlog cleared" does not state per-job outcomes.
- Customer impact magnitude: failed/delayed checkout counts and duration
  per tenant.
- Why the restarted pool processed normally for ~4 minutes: fresh pool,
  in-memory state, or simply time to re-encounter affected jobs.
- Why rollback normalised *new* job creation specifically — e.g. whether
  enqueued jobs carried a policy snapshot that the rollback could not change.
- Whether the empty policy came from missing tenant configuration, a lookup
  bug, or a serialisation/defaulting bug in the new code.
