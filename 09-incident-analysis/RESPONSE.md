# Response — confidence and next data

## Confidence

**High** that the `tenant_retry_policy` feature flag combined with an empty
resolved policy (`policy=""`) is the proximate trigger of the retry storm. The
supporting evidence is three-fold:

- Log signature: `delay_ms=0` retries inside a single second, followed by
  `retry_budget_exhausted` with `policy=""`, preceding the queue rise and
  DB pool saturation.
- Differential blast radius: same release, same DB tier, but US (flag at ~2%
  of tenants) showed no alert, while eu-west (flag effectively at 100%)
  degraded.
- Recovery: disabling the flag at 09:43 produced recovery within ~2 minutes
  on a freshly observed worker pool (worker-51), including a job which had
  previously failed and now succeeded on attempt 2 with a proper delay.

**Medium** on the underlying mechanism (e.g., why `policy=""` resolves to
`delay_ms=0` rather than a safe default) — the behaviour is consistent with
the logs but the worker source has not been read in this analysis.

**Medium** on the customer-visible impact envelope. We know latency and job
age regressed and the backlog eventually drained, but we have not yet
quantified: dropped jobs, failed user actions, or the 2% of US tenants that
may have had silent degradation.

## Next two pieces of data I would request

1. **The worker source / config-resolution code path for the retry scheduler.**
   Specifically the branch taken when `policy=""` or `policy=null`. This will
   either confirm the `delay_ms=0` fallback hypothesis directly or surface a
   second mechanism that the logs hint at (the "4 minutes healthy then stalls"
   pattern on the restarted worker pool).
2. **The retry-budget and outcome data for the affected window.** For every
   job processed by eu-west workers between 09:00 and 09:45 UTC, the
   `attempt`, `delay_ms`, `terminal_outcome` (success / exhausted / dropped),
   and `tenant_id`. This will tell us how many jobs exceeded their retry
   budget and were dropped, and whether the 2% of US tenants with the flag
   on saw any silent degradation — both of which are needed to size customer
   impact and to size the safety budget in Action 7.