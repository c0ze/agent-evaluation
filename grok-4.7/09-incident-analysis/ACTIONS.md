# Actions

The backlog was clear at 10:18 UTC and the flag was already off. Containment below is what keeps that mitigation in place. Corrective items are ordered by how directly they close the failure mode in the logs. Owners are roles.

Each item has a verification signal and a rollback. "Rollback" of containment does not mean re-enabling the flag. Re-enabling `tenant_retry_policy` is what recreates the condition that preceded the stall.

## Immediate containment

### C1. Leave `tenant_retry_policy` off in every region

**Owner:** feature-flag owner, confirmed by the incident commander.

eu-west recovery followed the disable. The US was on the same release at 2% and did not alert; that is not a reason to keep a 2% canary on an empty-policy path. Hold the US at off as well until P1 is verified.

**Verify:** flag evaluations are off for a sample of tenants in eu-west and the US; workers log `feature_flag=false`; no new `retry_budget_exhausted` line with `policy=""` and `elapsed_ms` under 100; queue depth and oldest job age stay at the pre-09:02 baseline for 60 minutes.

**Rollback:** do not turn the flag back on as a rollback. If a named tenant had an explicit non-default retry contract, keep serving `config_retry_default` (`exponential`) for that tenant until P1 ships. Record the tenant with customer communications. Turning the flag on again is a new ramp (see P3), not an undo.

### C2. Do not add workers while database connections are near the cap

**Owner:** SRE on-call.

The 09:14 move from 40 to 90 workers was followed by faster queue growth, then by the 300-connection ceiling at 09:20. CPU had already fallen, so the queue was not waiting on idle CPU.

**Verify:** worker count is not raised while connections are at or near 300; `remaining connection slots reserved` stays at zero on API logs; pool-wait warnings (`wait_ms` at the 5000ms ceiling, `idle=0`) are not climbing.

**Rollback:** if oldest job age grows and connections have clear headroom (well under 300, API errors absent), add a small worker step and recheck connections before the next step. If connections climb or queue growth accelerates, return to the previous worker count. That scale-down is the rollback.

### C3. Confirm the backlog drained and look for silent loss

**Owner:** queue engineering.

Job 319 survived inner-budget exhaustion and later succeeded. Other jobs may not have.

**Verify:** queue depth at baseline, oldest job age within the usual bound, and dead-letter or drop counts compared with the hour before 09:02. A higher dead-letter count is residual customer impact to list by tenant.

**Rollback:** this check is read-only. If a replay is started and queue age or connections move the wrong way, stop the replay. Replay is not part of containment.

## Prioritized corrective actions

### P1. Empty or missing tenant policy must use the exponential default

**Owner:** worker/queue engineering.

`worker-51` loaded `config_retry_default="exponential"` with the flag on, then exhausted job 319 in 38ms under `policy=""`. After the flag went off, the same job used `delay_ms=1000` and succeeded on the next attempt. The safe behavior is the one observed with the flag off: a non-zero backoff, and the configured default when the tenant policy is empty. Also reject a computed delay of 0 when retry budget remains, unless a policy explicitly allows zero delay and that case is tested.

**Verify:** automated cases for flag on + empty policy, flag on + a real tenant policy, and flag off. In staging, a tenant with no policy logs a non-zero delay consistent with exponential backoff and completes. Canary one tenant that has a validated policy; compare `retry_budget_exhausted` rate and job age with a control tenant. Ship this behind the same flag, still defaulting off, and enable only after these checks.

**Rollback:** turn `tenant_retry_policy` off. That path is the one that recovered job 319. Keep the previous worker build deployable until the canary window passes. A bad custom policy for a pilot tenant is rolled back by removing that tenant from the flag, not by raising the regional worker count.

### P1. One containment control for this change: the worker flag

**Owner:** release management, with worker engineering.

At 09:24 the API rollback normalized new job creation and left the backlog stuck. At 09:31:10 a new worker still had `feature_flag=true`. The runbook for `2026.09.23.1` and any retry-policy change should name a single first containment step: disable `tenant_retry_policy`, then confirm `config_changed feature_flag=false` on workers. API version rollback is a separate step and did not drain the queue.

**Verify:** a staging drill that rolls back the API build and shows the worker flag is unchanged until someone disables it. The on-call checklist lists the flag first. The drill record is attached to the release.

**Rollback:** runbook and checklist only. If a later design moves policy fully into the API artifact, update the runbook in the same change. Until then, the flag remains the proven switch.

### P2. Alert and halt on the signature that showed up at 09:06:58

**Owner:** SRE, with worker engineering.

Job-age and checkout-latency alerts fired at 09:11, about four minutes after the first empty-policy exhaustion. Add a signal for `retry_budget_exhausted` where `elapsed_ms` is under 100 or `policy` is empty, and a signal for database connections approaching 300. A flag ramp halts when either fires.

**Verify:** in staging, force an empty policy and confirm the signal trips inside one evaluation interval and that a ramp would stop. Production dashboards show the new series. The ramp doc lists both halt conditions.

**Rollback:** if the halt blocks a legitimate rollout, disable the auto-halt and keep the page. Tune the threshold if it flaps on healthy exponential retries. Do not delete the signal to unblock a ramp.

### P2. Cap worker database connections below the server maximum

**Owner:** database platform, with SRE.

The server maximum is 300 and it was reached. One worker already reported `active=10` `idle=0` and a 5s wait. API processes also need connections (`api-03` could not get one). Set a fleet budget so worker pools plus API pools plus an admin reserve stay under the server maximum. Prefer a smaller per-worker pool or a shared worker cap over raising `max_connections`. Raising the ceiling without a budget repeats this failure at a higher number and puts more memory pressure on the database.

**Verify:** documented sum of pool ceilings is under 300, or a measured peak during a staging retry storm stays under the cap while an API job-create still acquires a connection. On the next ramp, connections remain under the cap and the reserved-slot error stays at zero.

**Rollback:** restore the previous pool sizes by config if database wait time regresses and the cap is clearly idle. Scale the cap one step at a time. A full return to uncapped pools is the rollback if the new cap blocks ordinary throughput with connections still well under 300.

### P3. Log the retry reason, tenant, policy, and delay on every attempt

**Owner:** worker/queue engineering.

Attempt lines for jobs 81 and 319 say `result=retry` and do not say why. The policy field appears only on the exhaustion warning. Add reason, tenant, policy, and `delay_ms` to every retry and exhaustion line so the next incident can tell a missing policy from a downstream error.

**Verify:** a forced failure in staging emits all four fields. A query can group exhaustions by reason and tenant.

**Rollback:** logging only. If a metric label with tenant or reason cardinality is too expensive, drop that label from metrics and keep the fields in logs.

### P3. Ramp by tenant percentage only after policies are non-empty

**Owner:** release management.

The US at 2% did not alert; eu-west with the flag on (percentage unstated) did. Next enablement steps through tenants that have a validated, non-empty policy, one region at a time, with the P2 halt conditions armed. Start at or below the US exposure that stayed quiet, and only after P1 is in the build.

**Verify:** the rollout plan lists steps, halt signals, and the policy pre-check. A drill shows the ramp stopping when the empty-policy signal fires. The first production step is a single-tenant canary with a known policy.

**Rollback:** set the percentage to zero (flag off). That is the containment already observed at 09:43. Partial rollback is "remove the last tenant step," then confirm exhaustion rate and job age.

### P3. Change the scale-up rule when CPU falls and the queue rises

**Owner:** SRE.

At 09:07 CPU fell from 65% to 18% as the queue rose. Adding workers at 09:14 coincided with faster queue growth. The runbook should send that pattern to database pool waits and to the retry-exhaustion signal before any scale-up. An autoscaler, if one exists, should refuse to add workers when connections are near 300 or when CPU is falling while queue age is rising.

**Verify:** runbook updated and reviewed by on-call. If automation is changed, a staging case with a full connection cap does not add workers, and a case with high CPU plus queue growth still does.

**Rollback:** manual override so an operator can add workers when connections have headroom and the refusal is wrong. The override expires at the end of the incident. Restoring the old scaler is the rollback if the new guard blocks a known-good scale-up.

## Suggested order

Hold C1–C3 now. Then P1 (fallback, and the runbook that points at the flag). Then P2 (detect the signature, and cap connections) before any new ramp. P3 (richer logs, canary plan, scale-up rule) can proceed in parallel once P1's test cases exist. Do not re-enable the flag to "confirm the theory" in production; use the staging cases in P1 and the two data pulls in `RESPONSE.md`.
