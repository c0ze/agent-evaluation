# Incident report — eu-west queue stall (2026-09-23 release)

## Impact (observed)
- Region: eu-west. US region ran the same release but with the flag enabled for only 2% of tenants; no alerts fired there (TIMELINE.md:14-15).
- Degradation window: queue depth began rising at 09:07; recovery began within two minutes of the flag being disabled at 09:43; backlog fully cleared at 10:18.
- Roughly 36 minutes of active degradation (09:07–09:43) and ~2h11m until the backlog was fully drained.
- Alerts fired at 09:11 for job age and checkout latency (TIMELINE.md:5), indicating customer-visible checkout impact in eu-west.
- Database connection pool saturated at its configured maximum of 300 at 09:20 (TIMELINE.md:7; LOGS.txt:7).

## Concise timeline (observed, UTC)
- 09:02 — API release `2026.09.23.1` deployed; adds tenant-specific retry policy.
- 09:06:58 — worker-17 retries job 81 (tenant acme) three times in the same second, all `delay_ms=0`; retry budget exhausted with `policy=""` (LOGS.txt:1-4).
- 09:07 — eu-west queue depth rises; worker CPU falls 65% → 18%. worker-22 reports DB pool wait exceeded (5000 ms), `active=10 idle=0` (LOGS.txt:5).
- 09:11 — Alerts fire for job age and checkout latency.
- 09:14 — On-call scales workers 40 → 90; queue depth rises faster.
- 09:19:52 — api-03 ERROR: DB remaining connection slots reserved (LOGS.txt:7).
- 09:20 — DB connections reach configured maximum of 300.
- 09:24 — API deploy rolled back; new job creation normalizes; backlog remains stuck.
- 09:31 — One worker pool restarted; worker-51 starts with `config_retry_default="exponential" feature_flag=true` (LOGS.txt:8). Pool processes jobs normally for four minutes, then stalls.
- 09:35:12 — worker-51 logs `retry_budget_exhausted policy=""` after 38 ms (LOGS.txt:9).
- 09:43 — Feature flag `tenant_retry_policy` disabled; worker-51 sees `feature_flag=false` at 09:43:07 (LOGS.txt:10).
- 09:43:09-10 — job 319 retries with `delay_ms=1000` (the exponential default) and succeeds in 190 ms (LOGS.txt:11-12). Recovery begins within two minutes.
- 10:18 — Backlog cleared.

## Most likely root cause (inference, high confidence)
The tenant-specific retry policy introduced in release `2026.09.23.1` and gated by the `tenant_retry_policy` flag caused workers to retry failing jobs with **zero delay** (`delay_ms=0`) and an **empty policy** (`policy=""`), overriding the safe built-in `exponential` default. The resulting hot retry loop saturated the database connection pool (300/300 at 09:20), so workers blocked waiting for connections (CPU fell to 18%, `db pool wait exceeded`), and job processing stalled queue-wide. Disabling the flag restored the exponential default (`delay_ms=1000`) and processing recovered within two minutes.

This is inference from correlation and dose-response, not from reading the code: the code path that produces `policy=""` and `delay_ms=0` has not been inspected.

## Hypotheses and evidence

### H1 — Tenant retry policy hot loop (empty/zero-delay policy) — SUPPORTED, most likely
Supporting:
- LOGS.txt:1-4: three retries of job 81 within one second, all `delay_ms=0`, `policy=""` — a zero-delay retry loop, immediately before queue rise at 09:07.
- LOGS.txt:8-9: a freshly restarted worker starts with `config_retry_default="exponential"` yet still logs `policy=""` at 09:35 — the tenant policy overrides the exponential default.
- LOGS.txt:10-12: the moment the flag is disabled, the same worker retries with `delay_ms=1000` and succeeds — direct before/after contrast on the same worker and job.
- TIMELINE.md:11-13: flag disable at 09:43 → recovery within two minutes → backlog cleared.
- TIMELINE.md:14-15: US ran the same release with the flag on for only 2% of tenants — no alerts. Dose-response pattern consistent with the flag being the cause.
- TIMELINE.md:4: onset (09:07) follows the 09:02 deploy that introduced the policy.

Weakening / gaps:
- Only a handful of log lines; we have not seen the config that yields `policy=""` (empty tenant policy vs. code default bug).
- Correlation with the deploy is strong but the causal code path is unverified.

### H2 — Database connection pool exhaustion is the root cause — WEAKENED (symptom, not cause)
Supporting: pool hit max 300 at 09:20 (TIMELINE.md:7); workers reported pool waits (LOGS.txt:5) and the API errored on reserved slots (LOGS.txt:7).
Weakening:
- Pool exhaustion occurred at 09:20, ~13 minutes after the queue began rising (09:07) and after the zero-delay retry loop was already logged (09:06:58). The pool saturation is downstream of the retry storm.
- Disabling the retry flag — not adding DB capacity — is what restored processing.
- Worker CPU *fell* to 18%, consistent with workers blocked on the pool rather than the pool failing on its own.

### H3 — The API deploy itself / API-side regression — WEAKENED
Supporting: deploy at 09:02 preceded onset.
Weakening: TIMELINE.md:8 — after the API rollback at 09:24, new job creation normalized but the backlog stayed stuck. The stall is in worker processing, not the API. Recovery required the flag change, which the API rollback did not include.

### H4 — A single bad job or tenant (acme) caused the stall — WEAKENED
Supporting: job 81 / tenant acme is the first logged instance of the retry loop.
Weakening: the impact was queue-wide (job age alerts, checkout latency, DB pool saturation across workers 17, 22, 51 and api-03). A single job cannot exhaust a 300-connection pool. Recovery came from a global flag change, not from removing acme's job.

### H5 — Worker pool / worker host fault — WEAKENED
Supporting: one pool was restarted at 09:31 during diagnosis.
Weakening: the restarted pool worked for four minutes and then stalled again with the same `policy=""` signature (LOGS.txt:8-9), and the issue resolved via flag change, not worker replacement. Multiple independent workers show the same behavior.

### H6 — Underlying database outage — WEAKENED
Supporting: none direct.
Weakening: jobs succeeded before 09:07 (LOGS.txt:6, success in 830 ms) and immediately after the flag disable (LOGS.txt:12, success in 190 ms) with no DB remediation. Only pool saturation was observed, which the retry storm explains.

## Contributing factors (inference)
- The tenant-specific policy **overrides** the safe `exponential` default rather than falling back to it; an empty/missing tenant policy yields `policy=""` and `delay_ms=0` (LOGS.txt:8-9).
- No effective backoff, jitter, or per-worker cap on concurrent retries, so a zero-delay loop multiplies DB load.
- Scaling workers 40 → 90 at 09:14 amplified the problem: more workers generating zero-delay retries against an already-saturating connection pool, and queue depth rose faster (TIMELINE.md:6).
- The retry loop appears to re-queue jobs after `retry_budget_exhausted` (job 319 reappears at 09:43 as `attempt=1`), sustaining the storm.
- Detection gap: ~4-5 minutes between onset (09:07) and alerts (09:11); no alert on retry rate or `delay_ms=0` directly.
- Flag rollout was 100% of tenants in eu-west vs 2% in the US, which set the blast radius (TIMELINE.md:14-15).

## What remains unknown
- Why the policy string is empty: misconfigured/missing tenant policy entries vs. a code bug in the default path. Requires the release diff and tenant policy config.
- The exact code path that maps tenant policy → retry delay, and whether `delay_ms=0` is a fallback for a missing/parse-failed policy.
- Why worker CPU fell to 18%: blocked on DB pool waits vs. spinning in a tight loop. Needs worker-level profiling/metrics (CPU breakdown, DB wait time).
- Whether `retry_budget_exhausted` jobs are re-queued or dropped — affects whether any jobs were lost vs. only delayed.
- Full blast radius: number of tenants/jobs affected, P99 job age during the window, and whether any jobs permanently failed.
- Whether the US 2% cohort experienced elevated (sub-alert-threshold) latency or retry anomalies.
- Why the restarted pool at 09:31 processed normally for four minutes before stalling (e.g., it took that long for the retry loop to re-saturate the shared pool).
