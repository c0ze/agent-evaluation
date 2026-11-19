# Response analysis

## Confidence

**Moderate-to-high (~75%)** that the primary root cause is the tenant retry-policy defect: an empty resolved policy (`policy=""`) causes zero-delay retries, which saturate DB connections and stall job processing.

Breakdown:
- **Flag involvement — ~90%.** Directly observed: zero-delay retries while the flag is on; `delay_ms=1000` and success immediately after it is disabled (09:43:09–09:43:10).
- **Empty policy as the specific defect — ~75%.** Logged twice, but the code path and tenant config record were not available.
- **DB saturation as the amplification mechanism — ~65%.** Consistent with pool waits, 300-connection maximum, and worse behaviour after scaling, but no DB-side metrics were provided.
- **Customer impact magnitude — low confidence.** Tenant count, job count, and SLO burn cannot be derived from the supplied files.

Key caveats: the API rollback at 09:24 normalized job creation but did not clear the backlog, so the deploy alone is not a sufficient explanation. The US region's clean result is consistent with lower flag coverage but could also reflect lower traffic or more DB headroom. Correlation between the flag disable and recovery is strong but is not, by itself, proof of the mechanism.

## Next two pieces of data I would request

1. **Feature-flag audit history and tenant policy records.** The full change log for `tenant_retry_policy` (when it was enabled, by what process, at what rollout percentage, and which tenants/regions were in scope), plus the stored retry-policy value and config version for affected tenants such as `acme`. This establishes the trigger timing and shows where the empty value came from — missing record, bad default, or serialization/propagation failure.

2. **One-minute worker and database telemetry for 09:00–09:45, plus the raw job error payloads.** Per-worker DB pool active/idle/wait, total server connections, job outcomes by status (success/retry/fail), retry counts and delays per tenant, and the underlying error returned for `job=81` and `job=319` before each retry. This would confirm whether retries were caused by genuine downstream failures or by pool-wait errors, and whether the connection exhaustion is cause or consequence.
