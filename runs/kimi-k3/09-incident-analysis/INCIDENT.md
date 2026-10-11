# Incident Analysis — eu-west queue backlog (2026-10-11, times UTC)

## Impact (observed)

- eu-west job queue degraded from ~09:07 to 10:18 (~71 minutes).
- Queue depth rose while worker CPU fell from 65% to 18% (workers stalled, not busy).
- Alerts fired for job age and checkout latency (09:11), indicating customer-facing
  checkout slowness.
- DB connections hit the configured maximum of 300 (09:20); API logged
  "db remaining connection slots reserved" (09:19:52), so some API requests likely failed.
- US region (same release, flag at 2% of tenants) showed no alerts.

## Concise timeline (observed)

- 09:02 — API release `2026.09.23.1` deployed; adds tenant-specific retry policy.
- 09:06:58 — worker-17: job 81 (tenant acme) retries 3x with `delay_ms=0`, then
  `retry_budget_exhausted policy=""` in 41 ms.
- 09:07 — queue depth rising; worker CPU drops 65% -> 18%; worker-22 logs DB pool
  wait exceeded 5000 ms. Tenant beta job succeeds normally (830 ms).
- 09:11 — alerts: job age, checkout latency.
- 09:14 — workers scaled 40 -> 90; queue depth rises *faster*.
- 09:19–09:20 — API connection-slot errors; DB connections at max (300).
- 09:24 — API rollback; new job creation normalizes; existing backlog stays stuck.
- 09:31 — worker pool restart; starts with `feature_flag=true`; healthy ~4 min, then
  stalls again (job 319: `retry_budget_exhausted policy=""` at 09:35:12).
- 09:43 — flag `tenant_retry_policy` disabled; job 319 immediately retries with
  `delay_ms=1000` and succeeds in 190 ms; recovery begins within 2 minutes.
- 10:18 — backlog cleared.

## Most likely root cause (inference)

For tenants with `tenant_retry_policy` enabled, the new retry-policy resolution
returns an **empty policy (`policy=""`) with zero retry delay**. Retries fire
instantly, the retry budget is exhausted in ~40 ms, and jobs are
failed/requeued in a tight loop instead of backing off. This retry storm plus
immediate requeues saturated the DB connection pool, which stalled workers
(CPU collapse) and starved the API. Disabling the flag restored the default
exponential policy (`delay_ms=1000`) and jobs succeeded immediately.

## Hypotheses and evidence

### H1 — Flagged tenant retry policy resolves to empty/zero-delay config (root cause)
- **Supports:** `policy=""` and `delay_ms=0` in logs; budget exhausted in ~40 ms;
  recovery within 2 min of flag disable with no other change; same job succeeds
  with `delay_ms=1000` right after flag-off; US (flag at 2%) unaffected; unflagged
  tenant (beta) succeeded while flagged tenant (acme) failed.
- **Weakens:** logs do not record per-tenant flag state, so the acme/beta flag
  split is inferred; we have not seen the policy-resolution code or tenant config.

### H2 — DB connection pool exhaustion is the primary cause
- **Supports:** pool wait exceeded at 09:07:01; connections at max 300 at 09:20;
  scaling workers 40->90 made things worse (more connections demanded).
- **Weakens:** pool warnings appear *after* the first zero-delay retry events and
  after queue depth began rising; disabling the flag fixed everything with no pool
  change. More likely an amplifier/symptom than the trigger.

### H3 — API release broken independent of the flag
- **Supports:** onset ~5 min after deploy; rollback normalized new job creation.
- **Weakens:** same release in US was fine; rollback did NOT clear the stuck
  backlog — the flag disable did. The release is the delivery vehicle for the
  policy, not obviously the fault itself.

## Contributing factors (inference)

- No minimum retry-delay floor or fallback when tenant policy resolves empty.
- `retry_budget_exhausted` jobs appear to requeue/hot-loop instead of being
  dead-lettered (inferred from recurring failures and rising queue depth).
- Asymmetric flag rollout: ~full enablement in eu-west vs 2% in US concentrated
  the blast radius in one region.
- Scaling workers before identifying the bottleneck amplified DB contention.
- DB pool ceiling (300) shared by API and workers allowed queue retries to starve
  customer-facing API traffic.

## What remains unknown

- Why the policy resolves to `""` for flagged tenants: missing tenant config,
  parse failure, or a fallback bug in the release.
- The exact mechanism connecting retry loops to DB pool exhaustion (connection
  per attempt vs. held connections while stalled).
- Why the 09:24 API rollback normalized new job creation but the worker-side flag
  (not the API build) controlled backlog recovery.
- Whether US's 2% cohort was truly unaffected or simply below alert thresholds.
