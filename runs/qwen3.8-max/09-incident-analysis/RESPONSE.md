# Response — confidence and next data requests

## Confidence level

**Overall: high confidence in the trigger, medium in the exact mechanism, low on blast-radius details.**

- **High (~90%): the `tenant_retry_policy` flag-gated tenant retry policy was the trigger.** Direct log evidence: `policy=""` with `delay_ms=0` and retry budgets exhausted in ~40 ms; the same failing job (319) retried at `delay_ms=1000` and succeeded within seconds of flag-off; recovery began within 2 minutes of the flag change; the restarted pool came up with the flag still true and stalled again with the same signature; the API rollback alone did not clear the backlog. The US contrast (same release, 2% flag scope, no alerts) corroborates but is correlation, not proof.
- **Medium (~70–75%): zero-delay retry churn → DB connection saturation (cap 300) → worker starvation is the stall mechanism.** Timing and pool-wait logs (`wait_ms=5000`, CPU 65%→18%, API "slots reserved") are consistent, and worker scale-out (40→90) worsening the queue fits contention — but there are no query-level DB metrics attributing connections to retry loops, and the worker scale-out effect is confounded with the underlying storm.
- **Medium (~65%): the flag persisted because rollback does not cover flag state.** Strongly suggested by the timeline (rollback 09:24; `feature_flag=true` at 09:31:10; exhaustion at 09:35:12), but whether the deploy also wrote persistent policy data that the rollback left behind is unverified.
- **Low/unknown:** why the policy resolved to an empty string; which tenants were affected (sample: `acme` failing, `beta` healthy); the fate of retry-budget-exhausted jobs (possible silent loss — job 319's later success hints at requeue, job 81 is unaccounted for); total customer impact.

I treated the deploy→onset and US-region contrasts as supporting correlation only; the load-bearing evidence is the flag-off → recovery sequence with matching log signatures on both sides of the change.

## Next two pieces of data I would request

1. **Tenant retry-policy configuration and resolution path for the incident window:** the config store contents (per-tenant policies for eu-west, e.g., `acme` vs `beta`), the flag targeting rules (what % of eu-west tenants were enabled), and the worker/API code path that resolves the policy — to determine *why* lookups returned `""` (missing entries, lookup bug, cache, or data written by the deploy that rollback did not undo). This closes the root-cause mechanism.
2. **Job disposition and completion reconciliation for all `retry_budget_exhausted` jobs between 09:07 and 09:43** (plus DLQ/requeue records and per-tenant checkout success/failure/latency metrics): to determine whether any work was silently dropped or duplicated and to quantify real customer impact. This closes the largest open risk.

(If a third were allowed: DB server query/connection-level metrics for 09:05–09:45, to directly confirm the saturation mechanism.)
