# Incident Analysis — eu-west queue/checkout degradation (2026-09-23)

## Impact

- **Customer-facing:** elevated checkout latency in the eu-west region starting ~09:07 UTC; job-age and checkout-latency alerts fired at 09:11 UTC. Recovery began ~09:45 UTC; backlog cleared 10:18 UTC (~70 minutes of degraded service).
- **Internal:** job processing backlog in eu-west; database connections saturated (max 300); workers stalled at ~18% CPU.
- **Blast radius:** eu-west only. US ran the same release with `tenant_retry_policy` enabled for 2% of tenants and had no alerts (observed).
- **Unknown:** whether any jobs were lost vs. only delayed (see "What remains unknown").

## Concise timeline (UTC)

| Time | Event (observed) |
|------|------------------|
| 09:02 | API release `2026.09.23.1` deployed; adds tenant-specific retry policy |
| 09:06:58 | worker-17: job=81 (tenant=acme) retries 3x with `delay_ms=0`, then `retry_budget_exhausted policy=""` after 41 ms |
| 09:07 | eu-west queue depth rises; worker CPU falls 65% → 18% |
| 09:07:01 | worker-22: db pool wait 5000 ms (`active=10 idle=0`) |
| 09:07:03 | worker-08: job=92 (tenant=beta) succeeds — not all tenants affected |
| 09:11 | Alerts fire: job age, checkout latency |
| 09:14 | Workers scaled 40 → 90; queue depth rises **faster** |
| 09:19:52 | api-03: `db remaining connection slots reserved` |
| 09:20 | DB connections reach configured max of 300 |
| 09:24 | API rolled back; new job creation normalizes; backlog still stuck |
| 09:31 | One worker pool restarted; processes normally ~4 min, then stalls |
| 09:35:12 | worker-51: `retry_budget_exhausted policy=""` — same signature post-restart |
| 09:43 | Flag `tenant_retry_policy` disabled; recovery begins within 2 min |
| 09:43:09–10 | worker-51: job=319 now retries with `delay_ms=1000`, succeeds on attempt 2 |
| 10:18 | Backlog cleared |

## Observed facts vs. inference

**Observed (from TIMELINE.md / LOGS.txt):** every timeline row above; `policy=""` on exhausted retries; `delay_ms=0` retries before the flag disable and `delay_ms=1000` after; `feature_flag=true` read at worker-51 startup (09:31:10) and `config_changed feature_flag=false` at 09:43:07.

**Inference (labeled):** everything under "Hypotheses" and "Root cause" below; e.g., "workers were blocked on DB connections" is inferred from low CPU + pool-wait logs, not directly measured.

## Most likely root cause

The `tenant_retry_policy` feature (release `2026.09.23.1`, flag enabled broadly in eu-west) resolved to an **empty policy** (`policy=""`) for some tenants, producing **zero-delay retry loops** that exhausted retry budgets (~40 ms) without job progress and rapidly cycled database work, saturating the 300-connection database cap. Workers then blocked waiting for connections (CPU 65%→18%), so the queue grew while workers idled.

## Hypotheses, with supporting / weakening evidence

**H1 — Empty tenant retry policy → zero-delay retry storm (root cause). High confidence.**
- Supports: `policy=""` appears exactly on budget-exhausted events (09:06:58, 09:35:12); pre-disable retries use `delay_ms=0`, post-disable uses `delay_ms=1000` with success; disabling the flag (09:43), not the API rollback (09:24), started recovery; worker-51 shows `feature_flag=true` at startup — the API rollback could not fix workers; US (2% exposure, same code) had no alerts (dose–response).
- Weakens: recovery timing could coincidentally overlap backlog drain; job=92 (beta) succeeded at 09:07:03, so per-tenant policy data may be a confounder (H3); no direct code-level evidence of the fallback bug is in the logs.

**H2 — Database connection saturation as primary cause. Medium confidence as amplifier only.**
- Supports: pool waits at 09:07:01; "remaining connection slots reserved" (09:19:52); connections hit max 300 (09:20); scaling 40→90 workers made queue depth rise **faster** (more contention for a fixed cap).
- Weakens: a worker-pool restart restored normal processing for ~4 minutes *while the DB was presumably still saturated*, and the DB recovered only after the flag disable, not after DB-side action — so DB saturation appears to be a consequence, not the origin.

**H3 — Tenant-specific bad config (e.g., acme) rather than the flag path itself. Medium-low confidence.**
- Supports: acme's job exhausted its budget; beta's job succeeded during the incident.
- Weakens: disabling the single flag fixed processing for job=319 and region-wide recovery began within 2 minutes; if per-tenant data corruption were the cause, a flag kill shouldn't have resolved it. Cannot be fully excluded that acme's config triggered the same code path.

**H4 — Defect in release `2026.09.23.1` independent of the flag. Low confidence.**
- Supports: deploy at 09:02 precedes onset at 09:07.
- Weakens: same release ran clean in US at 2% flag exposure; the API rollback at 09:24 did not restore backlog processing; recovery required the flag disable.

## Contributing factors

- Zero-delay retries (`delay_ms=0`) instead of the configured default (`config_retry_default="exponential"`) — no fail-safe when policy resolved empty.
- Fixed DB max (300) with no per-service caps or backpressure; scaling workers (09:14) amplified contention.
- Mitigation gap: rolling back the API did not propagate the flag change to workers (flag read at worker startup), delaying recovery by ~19 minutes.
- Detection gap: first alerts (09:11) were downstream symptoms; no alert on the retry-storm signature (`delay_ms=0`, `retry_budget_exhausted`, CPU-drop-with-queue-rise).
- Rollout asymmetry: staged 2% exposure in US vs. broad enablement in eu-west.

## What remains unknown

- Why the policy resolved to `""` — missing tenant config, migration gap, or fallback bug in the new code path.
- The exact mechanism connecting zero-delay retries to DB saturation (do retries hold connections?) and what the 4-minute healthy window after restart represents.
- eu-west flag exposure percentage (broadly enabled is inferred from region-wide impact, not measured).
- Whether `retry_budget_exhausted` jobs were requeued (delayed) or dropped (lost) — job-level integrity unverified.
- Per-service DB connection breakdown; whether api-03's "slots reserved" came from workers or the API.
- Whether any customer checkouts failed outright, versus only being delayed.