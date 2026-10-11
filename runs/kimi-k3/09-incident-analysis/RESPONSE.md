# Response — confidence and next data requests

## Confidence level

**Moderate-to-high (~75%)** that the flag-scoped, empty retry policy with
`delay_ms=0` is the root cause. The evidence is strong: the failure signature
(`policy=""`, `delay_ms=0`, budget exhausted in ~40 ms) appears only while the
flag is enabled, an unflagged tenant succeeded during the incident, the US
region at 2% flag exposure was unaffected, and disabling the flag produced
recovery within two minutes with the same stuck job immediately succeeding at
`delay_ms=1000`. Confidence is held below certainty because the logs do not
record per-tenant flag state or the policy-resolution path, the DB-pool
exhaustion mechanism is inferred rather than traced, and the partial effect of
the 09:24 API rollback (new job creation normalized while the backlog stayed
stuck) is not fully explained by the flag alone.

## Next two pieces of data to request

1. **The tenant retry-policy configuration store and the flag's per-tenant
   evaluation records** (e.g., flag evaluation logs for tenants acme and beta,
   and the actual policy rows/config the new code resolved). This would confirm
   whether flagged tenants had missing/malformed policy entries and whether
   resolution fell back to an empty policy instead of the documented
   `exponential` default — directly testing the root-cause hypothesis.

2. **Per-connection DB telemetry with worker/job attribution for 09:00–10:30**
   (connection open/hold time, wait-queue depth, and which worker/job IDs held
   connections). This would establish the causal chain — or refute it — between
   zero-delay retry loops and the pool saturation that stalled workers and
   starved the API, and explain why scaling workers made the backlog grow faster.
