# Response: confidence and next data requests

## Confidence

- **Trigger (flag-gated tenant retry policy resolving to an empty policy, producing
  zero-delay retries that exhaust the retry budget in milliseconds): moderate-high,
  roughly 75-80%.** Four independent observations point the same way: the first
  `policy="" delay_ms=0` line lands seconds before queue depth starts rising; the
  restarted pool stalls at its first `policy=""` event; the flag disable is followed
  within two seconds by the same job succeeding with a 1000 ms backoff and within
  two minutes by region-wide recovery; and the US region on the same release at 2%
  exposure had no alert. What holds this below "high": the log excerpt shows only
  two affected jobs and one affected tenant, the eu-west rollout percentage is not
  stated, and the "four minutes then stalls" match is a single coincidence on a
  single worker.
- **Stall mechanism (why an exhausted retry budget left workers idle with saturated
  DB pools rather than simply failing the job): low, roughly 40-50%.** Low CPU and
  `active=10 idle=0` say the workers were blocked, and job 319 sat on worker-51 for
  ~8 minutes, but nothing in the data shows what they were blocked on.
- **Role of the worker scale-up and DB connection cap as amplifiers rather than
  causes: moderate, roughly 65%.** Queue depth was rising seven minutes before the
  scale-up, and the flag disable (not any DB change) produced recovery, but the
  arithmetic linking 90 workers x 10-connection pools to the 300 cap is inferred
  from a single `active=10` log line.
- **Underlying defect (why the policy was empty): unknown.** Missing tenant config,
  a resolver bug, and eu-west-specific config propagation are all consistent with
  the evidence.

## Next two pieces of data I would request

1. **Complete worker logs for both regions, 08:55-10:30, joined with the flag
   rollout state and the tenant retry-policy configuration.** Specifically: every
   `retry_budget_exhausted`, `policy=""`, `delay_ms=0` and `db pool wait exceeded`
   line with tenant and worker, plus the per-region flag percentage and the stored
   policy for each tenant that appears. This confirms or refutes the trigger at
   scale rather than from two jobs, reveals whether the empty policy came from
   missing config or a resolver defect, tells us whether the US 2% cohort had
   sub-threshold impact, and gives the list of jobs that need reconciliation.
2. **Worker-51 diagnostics and DB connection accounting for 09:35-09:43.** A
   thread or goroutine dump (or equivalent in-flight job state) from worker-51
   during the stall, and DB connection counts broken down by client (each worker
   pool versus the API) across 09:05-09:45. This is the data that separates "the
   exhausted-retry path holds a connection or job lease" from "the pool was
   starved by other workers", explains why adding workers made the queue grow
   faster, and tells us whether a per-job timeout or a connection fix is the right
   corrective action.

If a third were allowed it would be the diff for the retry-policy resolver in
`2026.09.23.1`, which would likely answer the "why empty" question directly.
