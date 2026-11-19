# Response — confidence and next data requests

## Confidence level

**Moderate-to-high (~70-80%) in the leading explanation, low in the detailed
mechanism.** I am fairly confident that enabling `tenant_retry_policy` triggered
the incident and that disabling it fixed it, because the evidence converges from
several directions: a clean before/after on the same job (job 319 fails in 38 ms
with `delay_ms=0` and `policy=""`, then succeeds with `delay_ms=1000` seconds
after `feature_flag=false`); recovery within two minutes of the flag disable; a
dose-response pattern (near-full eu-west exposure produced an incident, 2% US
exposure produced none on the identical binary); and two "negative" experiments
— the code rollback (F10) and the worker restart (F11, F12) — that did not fix
it while the flag remained on.

My confidence is *not* higher because the central link is **correlational, not
proven**:

- The flag-disable -> recovery relationship is a temporal correlation; no
  controlled reproduction exists, and I cannot rule out a coincident config
  change at 09:43.
- The chain "zero-delay retries -> DB connection exhaustion -> low CPU -> queue
  backlog" is inferred. No log attributes the 300-connection saturation to
  per-attempt connections; the DB pool wait appeared at 09:07:01, after the
  retry anomaly but before the ceiling was hit, which fits but does not prove
  causation.
- `policy=""` is a log field, not an inspected code path; it could be a logging
  artifact, a failed tenant lookup, or a separate defect.
- At least one job (job 92, tenant `beta`) succeeded normally during the window,
  so the trigger condition (which tenants, which failures) is not established.
- The ~4 minutes of normal processing after the 09:31 restart is unexplained,
  as is the CPU drop mechanism (I/O wait vs idle).

I deliberately ranked alternatives rather than assuming the first story:
DB-pool exhaustion, the deploy binary, and worker-scaling are, on the evidence,
better explained as **mediator**, **enabler**, and **aggravating factor**
respectively, not the initiating root cause. See `INCIDENT.md` for the full
fact/inference split, per-hypothesis supporting and weakening evidence, and the
list of unknowns.

## Next two pieces of data I would request

1. **Config/flag change audit log for 09:00-10:00 UTC across all regions** —
   every transition of `tenant_retry_policy` (and any other flag/config change)
   with timestamps, regions, values, and who/what applied it. This directly tests
   whether the 09:43 disable was the *sole* change at that moment (ruling out a
   confounder in the recovery correlation) and reconstructs the eu-west vs US
   exposure percentages that the dose-response argument rests on. It is the
   single highest-value check on the main inference.

2. **DB connection metrics and the retry code path for the incident window** —
   specifically, per-worker/per-query connection acquisition counts and
   active-vs-idle connections from 09:05-09:45 correlated with
   `retry_budget_exhausted` / `delay_ms=0` event rates, plus the actual
   policy-resolution code (or a staging reproduction) showing why
   `feature_flag=true` produced `policy=""` / `delay_ms=0` instead of falling
   back to `config_retry_default="exponential"`. This verifies the inferred
   causal chain from empty-policy retries to pool saturation and turns the
   "most likely root cause" from a correlation into a confirmed mechanism.

If I could ask a third, it would be the **job-outcome reconciliation**: what
happened to jobs that exhausted their retry budget (81, 319, and any others) —
dropped, dead-lettered, or replayed — with affected-tenant counts and any
duplicate checkout side effects. That closes the largest customer-impact unknown
and determines whether any customer data remediation is needed.
