# Response notes

## Confidence

**Medium-high, about 7/10,** that the defect to fix is the `tenant_retry_policy` path: with the flag on, job 81 and job 319 exhausted their retry budgets in 41ms and 38ms under `policy=""` and, for job 81, `delay_ms=0`. With the flag off on the same worker, job 319 used `delay_ms=1000`, failed once, and succeeded. The API rollback did not clear the backlog, and a worker restarted after that rollback was still on the flag and hit the same pattern. The US copy of the release at 2% exposure did not alert.

**Medium-low, about 4/10,** that this path is also a full explanation of the CPU drop (65% to 18%) and of database connections hitting 300. Those facts are real, they start after the first bad retry line, and the queue grew faster after workers went from 40 to 90. The log excerpt has two exhausted jobs, no connection time series, and no count of how common `policy=""` was. A concurrent database problem can still sit underneath H2 in `INCIDENT.md`. I am not treating the 09:43 recovery correlation as proof that nothing else changed at that minute.

Overall confidence in the working theory (flag-gated zero-delay retries as the trigger, connection saturation as a later amplifier, scale-up as a contributing factor): **medium-high**. Enough to hold the flag off and to write P1 against the empty-policy path. Not enough to call the database chapter closed.

## Next two pieces of data

1. **eu-west worker retry outcomes from 09:00 to 10:30 UTC, at attempt grain or rolled up by minute, tenant, and worker.** Fields: `result`, `delay_ms`, `policy`, `elapsed_ms`, error reason, and final disposition (completed, requeued, dead-lettered, or dropped). This shows whether empty policy and zero delay dominated the backlog or only the two jobs in the excerpt, why attempts were retrying, and whether work was lost. Job 319 was not lost; the rest are unknown. If almost no other job has `policy=""` or `delay_ms=0`, H1 stops being a regional root cause and becomes a rare bad path that needs a different explanation for the queue.

2. **Database connections per minute from 09:00 to 10:30 UTC, split by workers, API, and other, plus the eu-west time and tenant percentage for `tenant_retry_policy`.** This is the check on the amplifier. If worker connections climb only after 09:06 and jump again after the 09:14 scale-up, the retry path and the scale-up earn the connection chapter. If connections were already near 300 before 09:06, H2 moves up and the retry logs are no longer the start of the story. The flag percentage is the other half of the US contrast: the "2% did not alert" observation only supports a dose effect if eu-west exposure was actually much higher, and the sources do not say that it was.
