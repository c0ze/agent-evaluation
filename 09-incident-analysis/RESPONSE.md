# Response Summary

## Confidence Level
**High (90%)** on root cause: the `tenant_retry_policy` feature flag enabled a retry policy with 0 ms delay and empty policy name, causing immediate retry exhaustion and DB connection starvation. Evidence: (1) logs show `policy=""` and `delay_ms=0` at 09:06:58; (2) disabling flag at 09:43 produced immediate recovery with exponential backoff (1000 ms delay); (3) rollback at 09:24 did not resolve backlog while flag remained on; (4) US region with 2% flag exposure had no alert.

**Medium (65%)** on *why* the policy was empty — could be missing tenant config, broken default fallback, or code defect in policy resolution. Need code/config inspection.

## Next Two Pieces of Data to Request

1. **Worker retry policy resolution code path** — the function that reads tenant config, applies defaults, and produces the effective `policy` string and `delay_ms`. Specifically need to see how an empty string is produced and whether a default fallback exists.

2. **Tenant retry configuration for `acme` and `beta`** (the two tenants visible in logs) — to determine whether they had explicit retry config or were relying on a broken default. Also need the global default config applied when tenant config is absent.