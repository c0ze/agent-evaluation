# Response

## Confidence level

**Moderate-high** that the flag-gated tenant-specific retry policy was
involved in triggering the incident: the deploy–onset sequence, repeated
`policy=""` logs with zero-delay retries, the same job (319) failing under
`feature_flag=true` and succeeding minutes after `feature_flag=false`, and
recovery beginning within two minutes of disabling the flag all point the
same way.

**Lower (moderate-low)** on the exact mechanism — how zero-delay,
budget-exhausted retries left workers stalled and database connections
saturated at the 300 maximum. The available logs show these events
coinciding but do not show the connecting step, and the log sample covers
only a few jobs, so treating the correlation as a proven causal chain would
overstate the evidence.

## Next two pieces of data I would request

1. **Aggregated retry-policy telemetry by tenant for 08:30–10:30 UTC, plus
   flag exposure per region:** counts of resolved policy values (including
   how often `policy=""`), `delay_ms` distribution, and
   `retry_budget_exhausted` rates per tenant, alongside the percentage of
   eu-west tenants with the flag enabled. This would confirm whether the
   empty-policy behaviour was widespread enough to explain a region-wide
   backlog or was confined to a few tenants/jobs, and would test the
   regional dose–response pattern properly.

2. **Database and worker blocking evidence for 09:07–09:43 UTC:** which
   components held the 300 connections and for how long (active sessions by
   application/query/state), per-worker pool wait metrics, and worker thread
   states during a stall. This would confirm or refute the inferred link —
   that workers were blocked holding/waiting for database connections —
   and separate "retry path held connections" from an independent database
   problem.
