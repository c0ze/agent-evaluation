# Response — confidence and next data requests

## Confidence level

**Moderate.**

More precisely: moderate-to-high confidence that the enabled
`tenant_retry_policy` flag and its empty resolved policy (`policy=""`,
applied as `delay_ms=0`) were centrally involved — this rests on the
same-job before/after contrast at 09:43 (job 319), the two
`retry_budget_exhausted policy=""` samples, onset after the 09:02 deploy,
recovery within minutes of the flag disable, and the US region's lack of
alerts at 2% flag exposure. Confidence is only low-to-moderate in the
specific mechanism by which zero-delay retries saturated the database and
stalled workers, because no supplied log line shows retries consuming or
holding connections, requeueing jobs, or the volume of affected jobs. That
unproven mechanism, the two-job log sample, and the unknown affected-tenant
scope keep overall confidence at moderate rather than high.

## Next two pieces of data to request

1. **Complete retry/job logs and tenant policy configuration for eu-west,
   09:00–09:45 UTC:** every retry and `retry_budget_exhausted` event with
   tenant, resolved policy, delay, attempt, and requeue/final outcome, plus
   the stored retry-policy value (including missing/empty) for each tenant
   with the flag enabled. This tests whether empty policy was confined to
   tenants with no configured policy, how many tenants/jobs were affected,
   and whether affected jobs were lost, duplicated, or eventually completed.

2. **Database and queue telemetry for eu-west, 09:00–09:50 UTC:** active
   connections and pool wait by service and query over time, top connection
   holders, connection acquire/release behaviour on the retry path, and
   queue metrics (jobs created, retried, and requeued per minute). This
   tests whether zero-delay retries actually drove connection saturation —
   and by what mechanism (retry volume, held/leaked connections, or an
   unrelated database fault) — rather than merely coinciding with it.
