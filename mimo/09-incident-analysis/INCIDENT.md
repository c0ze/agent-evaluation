# Incident analysis — queue backlog, eu-west, 2026-09-23

## Impact (observed)
- Queue depth rose in eu-west starting 09:07 UTC; job-age and checkout-latency alerts fired at 09:11.
- Checkout latency degraded for customers whose jobs entered the queue during the window.
- Database reached its configured maximum of 300 connections at 09:20 (API error: `db remaining connection slots reserved`).
- Backlog did not clear until 10:18 UTC. Approximate customer-facing duration: ~71 minutes of degraded checkout processing (09:07–10:18), worst between 09:11 and 09:45.
- US region: same release, `tenant_retry_policy` enabled for only 2% of tenants; no alert fired (no observed impact there).

## Concise timeline (observed, UTC)
| Time | Event |
|------|--------|
| 09:02 | Deploy api `2026.09.23.1` (adds tenant-specific retry policy) |
| 09:06:58 | Logs: job=81 (tenant=acme) retried 3× with `delay_ms=0`; `retry_budget_exhausted policy=""` in 41 ms |
| 09:07 | Queue depth rises in eu-west; worker CPU falls 65% → 18% |
| 09:07:01 | Logs: worker-22 DB pool wait >5 s (`active=10 idle=0`) |
| 09:11 | Job-age and checkout-latency alerts fire |
| 09:14 | Workers scaled 40 → 90; queue depth then rises faster |
| 09:19:52 | Logs: api-03 DB connection slots exhausted |
| 09:20 | DB connections at max (300) |
| 09:24 | API deploy rolled back; new job creation normalizes; backlog remains stuck |
| 09:31 | One worker pool restarted; processes normally ~4 min, then stalls |
| 09:35:12 | Logs: worker-51 (started with `feature_flag=true`) hits `retry_budget_exhausted policy=""` |
| 09:43 | Feature flag `tenant_retry_policy` disabled; recovery begins within ~2 min |
| 09:43:09–10 | Logs: job=319 retries with `delay_ms=1000`, then succeeds |
| 10:18 | Backlog cleared |

## Most likely root cause (inference)
The tenant-specific retry policy path behind `tenant_retry_policy` fails to resolve a policy for some tenants and falls back to **zero-delay retries with an empty policy** (`policy=""`, `delay_ms=0`). This burns the retry budget in tens of milliseconds and re-enters jobs in a tight loop, stalling workers (CPU drops) while flooding the DB pool — which then exhausts the 300-connection ceiling and blocks checkout processing.

This is an inference from the correlation of deploy/flag state with symptoms plus the direct log evidence of the zero-delay retry pattern; it is not proven by a root-cause code review.

## Hypotheses and evidence

### H1: Tenant retry policy resolves empty → zero-delay retry loop (most likely)
Supporting (observed):
- Deploy 09:02 introduced the policy; symptoms begin 09:07.
- Logs show attempts with `delay_ms=0` and `retry_budget_exhausted policy=""` within ~40 ms.
- After the flag is off, the same job type retries with `delay_ms=1000` (the configured default `exponential`) and succeeds.
- Flag off at 09:43 → recovery within 2 minutes.
- US: same binary, flag at 2% exposure → no alert (exposure tracks with impact).
- Worker CPU *fell* while queue grew — consistent with workers blocked in rapid retry/DB-wait loops, not doing useful work.

Weakening:
- We have not seen the policy-resolution code path; `policy=""` could be a logging defect rather than an empty policy.
- EU exposure percentage is not stated (inferred from US being 2% and unaffected).
- No direct proof that zero-delay retries (vs. another flag-gated behavior) caused the stall.

### H2: Worker capacity shortage
Supporting:
- Queue depth grew, and scale-up was attempted.
Weakening (stronger):
- Scaling 40→90 made queue depth rise *faster* and coincided with DB exhaustion — more workers amplified load rather than draining it.
- Worker CPU dropped to 18%; workers were not CPU-bound.

### H3: Database as root cause
Supporting:
- DB hit max connections at 09:20; API errors show slot exhaustion.
Weakening (stronger):
- DB pool waits appear at 09:07:01, *before* the 09:20 ceiling and concurrent with the first retry-loop logs — DB saturation is a downstream consequence of retry thrash plus scale-out, not the first symptom.

### H4: API deploy binary alone is broken
Supporting:
- Rollback at 09:24 normalized new job creation.
Weakening:
- After rollback the backlog stayed stuck, and a worker pool restarted at 09:31 with `feature_flag=true` stalled again at 09:35 — the flag-gated path kept failing independently of the API deploy.
- US ran the same release with low flag exposure and stayed healthy.

## Contributing factors (observed or strongly inferred)
1. No backoff when policy is empty (`delay_ms=0`); retry budget exhausted in ~40 ms.
2. Silent policy-resolution failure (`policy=""`) with only a WARN.
3. Scale-out at 09:14 increased concurrent DB demand and retry traffic during the fault.
4. DB connection ceiling (300) turned worker/API stalls into a broader outage.
5. Broad `tenant_retry_policy` exposure in eu-west (vs 2% in US) concentrated impact.
6. Deploy rollback alone did not disable the flag, prolonging the stuck backlog.

## What remains unknown
- Why policy resolution produced `policy=""` for tenant=acme (missing override, bug, or fallback design).
- Exact EU flag exposure percentage at 09:02–09:43.
- Whether exhausted-budget jobs were dropped, dead-lettered, or re-queued (job=81 fate unknown).
- Why the 09:31 worker pool worked ~4 minutes before stalling (trigger for the 09:35 failure).
- Why rollback at 09:24 did not clear the backlog (stuck jobs, workers still on new code, or requeue loops).
- Whether impact extended beyond checkout (other job types) or beyond eu-west at low level.
- Whether `policy=""` is also present in healthy US traffic (would weaken H1).
