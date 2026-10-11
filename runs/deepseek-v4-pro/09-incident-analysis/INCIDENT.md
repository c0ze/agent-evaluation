# INCIDENT.md — Queue incident (2026-09-23)

## Impact

- **Region:** `eu-west` primarily; US region affected minimally (flag enabled for
  only 2% of tenants, no alert).
- **Duration:** ~09:07 queue degradation began → 10:18 backlog cleared
  (~1h11m until recovery complete; recovery began ~09:45 after flag disable).
- **User-visible effect:** job processing stalled; job age and checkout latency
  increased. New job creation degraded around 09:19–09:24 while database
  connections were exhausted.
- **Secondary effect:** database connection pool exhausted at configured max of
  300 (09:20), blocking both workers and the API.

## Concise timeline (UTC)

| Time | Event (observed) |
|------|------------------|
| 09:02 | Deploy `api 2026.09.23.1` — adds tenant-specific retry policy. |
| 09:06:58 | `worker-17` retries job=81 (tenant=acme) 3× with `delay_ms=0`, exhausts retry budget in 41 ms. |
| 09:07 | Queue depth begins rising in `eu-west`; worker CPU falls 65% → 18%. |
| 09:07:01 | `worker-22` logs "db pool wait exceeded wait_ms=5000 active=10 idle=0". |
| 09:11 | Alerts fire for job age and checkout latency. |
| 09:14 | On-call scales workers 40 → 90; queue depth rises *faster*. |
| 09:19:52 | `api-03` logs "db remaining connection slots reserved". |
| 09:20 | DB connections reach configured max (300). |
| 09:24 | API deploy rolled back; new job creation normalizes; backlog still stuck. |
| 09:31 | One worker pool restarted; processes normally ~4 min, then stalls. |
| 09:43 | Feature flag `tenant_retry_policy` disabled; recovery within ~2 min. |
| 10:18 | Backlog cleared. |

## Most likely root cause

Enabling the `tenant_retry_policy` flag caused affected tenants' retry policy to
resolve to a zero-delay retry (three attempts at `delay_ms=0`, budget exhausted
in ~41 ms — see LOGS 09:06:58). This tight retry loop consumed database
connections rapidly, exhausting the shared pool (max 300), which blocked
workers (idle/CPU drop) and the API (new-job-creation errors), stalling the
queue. The correlation with flag disable (recovery within ~2 minutes) and the
US region's 2% rollout (no alert) strongly implicate the flag.

## Contributing factors

- Zero-delay retry loop (no backoff floor) for affected tenants.
- Retry path opening/holding DB connections without a bound.
- Flag enabled broadly in `eu-west` (vs 2% canary in US).
- Scaling workers 40→90 increased connection demand and worsened exhaustion.
- API rollback did not change the worker-side retry flag, so the backlog
  remained stuck after rollback.
- No observed circuit breaker or rate limit on DB-connection acquisition.

## Evidence per hypothesis

### H1 — Tenant retry flag produced a zero-delay retry loop that exhausted DB connections (most likely)

**Supporting:**
- 09:06:58 job=81 `attempt=1/2/3` all `delay_ms=0`, `retry_budget_exhausted policy=""` in 41 ms.
- 09:07:01 `db pool wait exceeded wait_ms=5000 active=10 idle=0` — connection contention.
- 09:20 DB connections hit max 300; 09:19:52 API "remaining connection slots reserved".
- Worker CPU fell (consistent with blocking on DB, not busy computation).
- Flag disabled at 09:43 → recovery ~2 min; job=319 then retried at `delay_ms=1000` and succeeded.
- US region (2% tenants, flag on) never alerted.

**Weakening:**
- Only one tenant (`acme`) is directly observed with `delay_ms=0`; no evidence that all tenants hit it.
- The mechanism by which retries consume a *new* DB connection is inferred, not directly logged.
- Worker CPU drop could have other causes (though DB-pool-wait logs corroborate blocking).

### H2 — Independent database connection leak / pool exhaustion unrelated to retry policy

**Supporting:**
- Pool exhaustion (max 300) is directly observed.
- Restart of one worker pool at 09:31 initially processed normally, suggesting some state cleared on restart.

**Weakening:**
- Recovery tracks the flag disable (09:43), not the restart (09:31) — restart alone did not fix it.
- Zero-delay retry loop is directly observed and is a sufficient explanation for rapid connection growth.

## What remains unknown

- How many tenants (and which) were affected by the zero-delay policy.
- Why the policy resolved to an empty string (`policy=""`) and `delay_ms=0` —
  a lookup bug vs. a specific tenant config vs. a default fallback.
- Whether each retry attempt opens a new DB connection, or whether the loop
  holds a connection for its whole duration.
- Why the 09:31 worker-pool restart stalled again after ~4 minutes (presumably
  re-encountering the same flag, but not directly evidenced).
- Exact volume/frequency of `retry_budget_exhausted` events during the peak.

> Note: correlation between the flag and recovery is not proof of causation;
> the above is the hypothesis best supported by the available evidence.
