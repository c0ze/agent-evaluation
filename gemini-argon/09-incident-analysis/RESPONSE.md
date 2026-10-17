# Incident Assessment Confidence and Next Data Requests

## Confidence Level: Medium-High (80%)

### What We Are High-Confidence On (Backed Directly by Logs and Timeline)
- **Trigger and Recovery Path (High Confidence):** The interaction between API release `2026.09.23.1` (09:02 UTC) and the `tenant_retry_policy` feature flag (`feature_flag=true`) caused jobs with an empty policy (`policy=""`) to retry with `delay_ms=0` and exhaust their retry budget in ~40 ms (`job=81` at 09:06:58 UTC; `job=319` at 09:35:12 UTC). Disabling `tenant_retry_policy` (`feature_flag=false`) at 09:43:07 UTC directly restored the 1000 ms retry delay (`delay_ms=1000`) on `job=319` two seconds later and resolved the backlog.
- **Cascading Amplifier (High Confidence):** Scaling workers from 40 to 90 at 09:14 UTC when worker DB pools were already experiencing 5000 ms waits (`active=10 idle=0` at 09:07:01 UTC) drove total database connections to the 300-connection maximum at 09:20 UTC and starved API nodes (`api-03 ERROR db remaining connection slots reserved` at 09:19:52 UTC).

### Why Confidence Is Not 100%
- **Missing Internal Mechanism Between `retry_budget_exhausted` and Worker Stalls:** The logs show `worker-51` stalling at 09:35:12 UTC right when `job=319` hit `retry_budget_exhausted policy=""`, and then immediately resuming `job=319` at 09:43:09 UTC after `config_changed feature_flag=false`—without a worker restart. Without application code or DB session diagnostics, it remains an inference how `policy=""` or `retry_budget_exhausted` blocks the worker and holds its 10 DB pool connections until the feature flag changes.
- **Unlogged Underlying Retry Cause:** The logs show `result=retry` on `attempt=1` for `job=81` and `job=319` (even at 09:43:09 UTC after disabling the flag), but do not record the underlying exception or dependency failure that caused `attempt=1` to fail.

---

## Next Two Pieces of Data Requested

1. **The `2026.09.23.1` Code Diff and Worker Retry/DB Pool Handling Code (`tenant_retry_policy` Path):**
   - *Specifically:* The code governing how `policy=""` is set and evaluated when `feature_flag=true`, what happens when `retry_budget_exhausted` is reached (how the job remains leased to `worker-51` from 09:35:12 to 09:43:09 UTC and how DB connections/transactions are scoped during that state), and why `config_changed feature_flag=false` immediately unblocks the worker thread.
2. **Database Connection/Activity Views (`pg_stat_activity` / DB Logs) and Worker Error/Debug Logs from 09:05 to 09:45 UTC:**
   - *Specifically:* (a) Database session states (`idle in transaction`, lock waits, or active queries) and connection counts broken down by `api-*` vs. `worker-*` roles between 09:06 and 09:45 UTC to confirm what held the `active=10` worker pool connections; and (b) the detailed worker exception/error logs showing why `attempt=1` of `job=81` (09:06:58) and `job=319` (09:35:12 and 09:43:09) returned `result=retry`.
