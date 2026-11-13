# Analysis Confidence & Next Data Requests

## Confidence Level

- **Overall confidence:** **Medium-High (~75%)**
  - **High confidence (~90%)** that the active `tenant_retry_policy` feature flag interacting with empty policies (`policy=""`) caused zero-delay (`delay_ms=0`) retries and rapid retry-budget exhaustion (`38–41ms`), that disabling `tenant_retry_policy` at `09:43 UTC` restored exponential backoff (`delay_ms=1000`) and triggered recovery, and that scaling workers (`40 -> 90` at `09:14 UTC`) aggravated database connection exhaustion (`300` max connections).
  - **Moderate confidence (~55–60%)** on the exact internal failure chain—specifically what triggered the initial `attempt=1` failures, why rolling back API `2026.09.23.1` at `09:24 UTC` normalized new job creation without unblocking workers, and the precise mechanism causing the restarted worker pool (`worker-51`) to run normally for four minutes (`09:31:10 -> 09:35:12 UTC`) before stalling.

## Next Two Pieces of Data Requested

1. **Code, configuration, and deployment diff for release `2026.09.23.1` and `tenant_retry_policy` (including worker retry-loop and DB-pool lifecycle code)**
   - *Why:* Determines whether `2026.09.23.1` changed API only or workers as well, whether `policy=""` is serialized onto job payloads by the API or resolved dynamically by workers, how `policy=""` mapped to `delay_ms=0` instead of `config_retry_default="exponential"`, whether `retry_budget_exhausted` re-queues jobs or dead-letters them, and whether the retry/exhaustion path leaks or holds DB connections across attempts.

2. **Time-series DB/queue telemetry and unsampled worker/API error logs from `08:55` to `10:25 UTC` (including `job=81` and `job=319` creation timestamps/payloads and initial `attempt=1` failure causes)**
   - *Why:* Reveals what caused the initial `attempt=1` failures and `worker-22`'s pre-`09:06:58` DB pool wait (`~09:06:56`), shows whether `worker-51`'s four-minute delay (`09:31–09:35`) came from steady connection leakage (`active` climbing to `10`) versus backlog/lock contention spikes, confirms whether `job=319` was created before or after the `09:24` API rollback, and quantifies exact customer impact (EU flag rollout %, checkout error rates, and any lost/duplicated jobs).
