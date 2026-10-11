# RESPONSE.md

## Confidence level

**Medium-high (about 70–75%)** that the tenant retry flag producing zero-delay
retries and exhausting database connections is the root cause.

The confidence rests on: a directly observed zero-delay retry loop (09:06:58),
a directly observed DB-pool wait (09:07:01), pool exhaustion at the configured
max (09:20), the flag-disable → ~2-minute recovery correlation (09:43), and the
US region's 2% rollout not alerting. It is not higher because only one tenant
(`acme`) is observed with `delay_ms=0`, the connection-consumption mechanism is
inferred rather than logged, and correlation with the flag disable is not
proof of causation.

## Next two pieces of data to request

1. **Retry and connection telemetry during 09:07–09:43:** per-tenant counts of
   `retry_budget_exhausted` (especially `policy=""`) and the number of DB
   connections held/opened per worker over time. This would confirm whether the
   zero-delay loop was widespread and whether retries opened or held
   connections at a rate sufficient to exhaust 300 connections.

2. **Tenant retry-policy configuration snapshot at deploy time:** the resolved
   policy for all affected tenants (and the code path/default that produced
   `policy=""` and `delay_ms=0`). This would distinguish a per-tenant
   misconfiguration from a code bug in policy resolution and explain the empty
   policy string.
