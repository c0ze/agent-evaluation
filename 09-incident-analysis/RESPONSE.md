# Confidence and next evidence

**Overall confidence: moderate** that the enabled tenant retry-policy path was the primary incident trigger and that DB contention amplified the impact. Zero-delay retries and empty-policy budget exhaustion, followed by delayed retry/success and regional recovery after flag disable, support that assessment. API rollback alone did not clear the stall.

**High confidence** in the events explicitly recorded in the supplied timeline/logs, including DB pressure and backlog clearance; these are sparse records, not an independent audit. **Low confidence** in the precise implementation defect, the direction of causality between retries and DB pressure, the reason for the four-minute restart reprieve, and the extent of customer impact. The evidence does not establish a connection leak, an infinite retry loop, data loss, or fully unaffected US traffic.

The next two pieces of data I would request, in order:

1. **A correlated retry/queue/DB trace and metrics window covering 08:55–10:30 UTC on the incident day.** Include original retry errors, effective policy and delay, attempts/budget/requeue decisions, connection acquisition and release, DB session owners/query and lock waits, arrivals/completions, and oldest-job age. Prioritize jobs 81 and 319 and an unaffected comparison such as job 92, with tenant/flag/region context and final outcomes. This would distinguish a DB-first fault from retry-driven pressure, test resource retention, and quantify whether queue recovery represented successful processing. If that historical detail was not retained, state the gap rather than inferring it from aggregate counts.
2. **The retry-policy code/configuration change and effective rollout history.** Include release diffs, tenant policy values and validation/fallback semantics, flag exposure by region, worker/API versions, and effective configuration around the 09:24 rollback, 09:31 restart, and 09:43 flag disable. This would show what `policy=""` means, whether the exponential default was bypassed, whether rollback left workers on the suspect path, and whether regional exposure explains the different signals.

All four requested deliverables are provided: `INCIDENT.md`, `ACTIONS.md`, `CUSTOMER_UPDATE.md`, and `RESPONSE.md`. This analysis proposes operational actions; it does not claim they were executed or that missing evidence was collected.
