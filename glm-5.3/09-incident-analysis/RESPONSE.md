# Response — confidence and next data requests

**Confidence: high (~85%)** that the root cause is the `tenant_retry_policy` path resolving an empty policy (`policy=""`), producing zero-delay retry loops that exhausted budgets without progress and saturated the 300-connection database cap, with DB saturation as amplifier rather than origin. Supporting: `delay_ms=0` before flag disable vs. `delay_ms=1000` after; recovery followed the flag disable (09:43) rather than the API rollback (09:24); workers read `feature_flag=true` at startup, so the rollback couldn't fix them; US, at 2% exposure on the same code, had no alerts (dose–response). Residual uncertainty keeps this below ~90%: the empty-policy mechanism is inferred from logs, not read from code, and per-tenant config differences (acme exhausted, beta succeeded) are unexplained.

**Next two pieces of data I would request:**

1. **The retry-policy resolver code path and the tenant policy records** (e.g., for tenant `acme`) as of 09:02–09:43 UTC, plus worker-side flag-evaluation logs across all worker pools — to confirm why `policy` resolved to `""`, and whether workers ran the new code path after the API rollback (worker-51's startup `feature_flag=true` suggests yes, but this is inferred, not verified).

2. **Database connection-pool time series per service, and per-job outcome records** (requeued vs. dropped) for 09:00–10:30 UTC — to confirm the amplification mechanism (which service consumed the 300 connections) and to rule out silent job loss, which determines whether affected customers need direct follow-up.