# Incident: eu-west queue stall — 2026-09-23

## Impact
- Observed: queue depth rose from ~09:07; job-age and checkout-latency alerts from 09:11; backlog stuck until 10:18 (~71 min degraded, ~35 min after recovery began).
- US region: same release, flag at 2% of tenants, no alert fired.
- Unknown: exact count of failed/delayed checkouts, any duplicate side effects from rapid retries, SLA breach scope. Not stated in inputs; do not assume.

## Concise timeline (UTC, observed facts)
- 09:02 — Deploy api `2026.09.23.1` (adds tenant-specific retry policy).
- 09:07 — Queue depth rises (eu-west); worker CPU 65% → 18%.
- 09:11 — Alerts: job age, checkout latency.
- 09:14 — Workers scaled 40 → 90; queue depth rises faster.
- 09:20 — DB connections at configured max (300).
- 09:24 — API rollback; new job creation normalizes, backlog still stuck.
- 09:31 — One worker pool restarted; processes normally ~4 min, then stalls.
- 09:43 — Flag `tenant_retry_policy` disabled; recovery begins within 2 min.
- 10:18 — Backlog cleared.

## Most likely root cause (inference)
Flag-enabled tenant-specific retry policy resolved to an empty/missing policy for affected jobs, producing a zero-delay tight retry loop that churned through the retry budget in milliseconds and saturated shared resources (DB connections / worker threads), stalling the queue.

## Contributing factors (inference)
- No guard against empty policy / `delay_ms=0`.
- Scaling workers amplified the storm instead of relieving it.
- DB connection ceiling (300) with no backpressure/rate-limit on retries.
- Rollback covered the API deploy but not the flag/worker config, so the bad path persisted.
- Detection lag (~4–9 min from onset to alert/action).

## Evidence

Supporting H1 (empty-policy retry storm):
- `09:06:58 job=81 attempt=1,2,3 result=retry delay_ms=0` in the same second, then `retry_budget_exhausted policy="" elapsed_ms=41` — three attempts in ~40 ms with no delay and an empty policy string.
- Same signature reappears post-restart: `09:35:12 job=319 retry_budget_exhausted policy="" elapsed_ms=38` while `feature_flag=true`.
- Flag-off immediately changes behavior: `09:43:07 config_changed feature_flag=false` → `job=319 attempt=1 retry delay_ms=1000`, `attempt=2 success` — normal backoff resumes.
- Recovery tracks flag disable (09:43 → recovery in 2 min), not API rollback (09:24 → backlog still stuck).
- Restart helped only 4 min, consistent with re-poisoning by the same policy path, not a one-time poison message.
- Scale-up (40 → 90) made queue growth faster, consistent with more actors in a tight loop; CPU falling to 18% fits workers blocked waiting (DB), not CPU-bound work — corroborated by `09:07:01 db pool wait exceeded` and `09:19:52 db remaining connection slots reserved`.
- US region (same binary, 2% flag exposure) unaffected — points at flag-gated path, not the release as a whole.

Weakening / alternative hypotheses:
- H2 — DB failure as primary cause: weakened because DB pressure follows the retry storm in time, and DB saturation alone does not explain `policy=""` / `delay_ms=0` or the flag-gated recovery.
- H3 — Single bad deploy / poison job: weakened because API rollback did not unstick the backlog and a restart gave only transient relief.
- Correlation ≠ proof: logs show a small sample (jobs 81, 319; one success job=92 tenant=beta). `job=92 success elapsed_ms=830` shows not all jobs failed, but with n=1 it does not prove tenant scoping — could be timing luck.

## What remains unknown
- Why the policy resolved to `""` (missing tenant config? parse error? default not applied under flag?) — code/config diff needed.
- Full affected-tenant list and failure counts; whether rapid retries caused duplicate charges, orders, or notifications.
- DB state during the stall (deadlock vs. pool exhaustion vs. connection leak) and whether worker config and API flag were independently versioned.
- Why `config_retry_default="exponential"` did not apply when the flag was on.
