# Incident report — eu-west job queue stall — 2026-09-23

> Convention in this file: **Observed** = directly stated in `TIMELINE.md` / `LOGS.txt`. **Inference** = interpretation; labeled as such.

## Impact (observed + bounds)

Observed:

- Region affected: eu-west. US region had no alert (same release, flag at 2% of tenants).
- Queue depth began rising ~09:07 UTC; backlog cleared 10:18 UTC (~71 minutes of degraded queueing).
- Alerts fired 09:11 for job age and checkout latency — checkout path was user-impacted.
- Worker CPU fell 65% → 18% while queue rose: workers were stalled/blocked, not keeping up.
- Database connections reached configured maximum (300) at 09:20; API logged `remaining connection slots reserved` at 09:19:52; workers logged DB pool waits (5,000 ms, 0 idle).
- Some jobs still succeeded during the incident (e.g., job 92, tenant beta, 09:07:03, 830 ms), so impact was partial, not a full stop — exact success/failure split is unknown.

Unknown (not in evidence): number of delayed/failed jobs, delay distribution, number of affected tenants/customers, checkout latency magnitude or failed checkouts, whether exhausted jobs were lost or later succeeded, any data-integrity effects.

## Concise timeline (observed, UTC)

- 09:02 — API `2026.09.23.1` deployed; change adds tenant-specific retry policy.
- 09:06:58 — worker-17 logs job 81 (tenant acme): 3 retry attempts with `delay_ms=0` in the same second, then `retry_budget_exhausted policy="" elapsed_ms=41`.
- 09:07 — Queue depth rises (eu-west); worker CPU 65% → 18%.
- 09:07:01 — worker-22: DB pool wait exceeded (5 s, active=10, idle=0).
- 09:11 — Alerts: job age, checkout latency.
- 09:14 — Workers scaled 40 → 90 (inference: manual mitigation); queue then rises faster.
- 09:19–09:20 — DB contention: API connection-slot error; DB connections at max 300.
- 09:24 — API deploy rolled back; new job creation normalizes, backlog stays stuck.
- 09:31 — One worker pool restarted; processes normally ~4 minutes, then stalls. Restarted worker shows `config_retry_default="exponential" feature_flag=true`.
- 09:35:12 — Same restarted worker logs `retry_budget_exhausted policy=""` again.
- 09:43:07 — Feature flag `tenant_retry_policy` disabled; worker logs `config_changed feature_flag=false`.
- 09:43:09–09:43:10 — Same job 319: retry with `delay_ms=1000`, then success (190 ms). Recovery begins within ~2 minutes.
- 10:18 — Backlog cleared.
- US: same release, flag at 2% of tenants, no alert.

## Most likely root cause (inference, medium-high confidence)

Enabling `tenant_retry_policy` caused affected workers to resolve an empty retry policy (`policy=""`) with zero backoff (`delay_ms=0`), producing rapid retries that exhausted the per-job retry budget in ~40 ms. The resulting retry amplification plausibly saturated the database connection pool (300 max), causing workers to block on pool waits (CPU drop, queue growth). Scaling workers increased DB demand and worsened the stall. Disabling the flag restored the default exponential backoff (1,000 ms delay observed) and recovery followed within minutes.

This is the best-fit inference, not proven causation: timing is correlational, the log sample is small, and the code path resolving `policy=""` was not examined. See hypotheses and unknowns below.

## Contributing factors (inference grounded in observations)

1. Unsafe fallback: empty/missing tenant policy appears to yield zero delay instead of the configured `exponential` default.
2. No retry floor: `delay_ms=0` retries with no minimum backoff or jitter allowed a tight retry burst.
3. Shared, capped downstream: DB max 300 connections became the bottleneck; API and workers contend for the same slots (both logged saturation).
4. Scale-up without backpressure: adding workers (40 → 90) during pool-wait/connection saturation increased contention; queue rose faster afterward.
5. Flag scoping: eu-west appears broadly exposed while US was at 2% — no progressive rollout or auto-halt on queue/CPU/DB signals is evident.
6. Split mitigation surface: API rollback (09:24) did not change worker/flag behavior, so the backlog stayed stuck; worker restart helped only transiently (~4 min).

## Hypotheses — evidence for and against

### H1 — Flag-gated empty retry policy → retry storm → DB exhaustion → worker stall (favored)

Supporting (observed):

- `delay_ms=0` × 3 + `retry_budget_exhausted policy=""` in <1 s, twice (09:06:58, 09:35:12), both while flag was on.
- After `feature_flag=false`, same job shows `delay_ms=1000` then success — behavior change coincides with flag change on the same worker.
- Recovery begins within ~2 min of flag disable; backlog clears by 10:18.
- Worker restart with `feature_flag=true` stalls again after ~4 min — consistent with a flag-dependent load trigger, not a one-time poisoned state.
- US on same release with 2% flag exposure had no alert — weakens "release alone" and is consistent with "flag exposure dose matters."
- CPU fall + pool waits + connection max + worse-after-scale-up match downstream-saturation mechanics.

Weakening / missing:

- Small log sample (a handful of jobs); no aggregate retry-rate or per-tenant failure distribution.
- No code/config showing how `policy=""` arises or that zero-delay retries issue DB load per attempt.
- CPU drop is consistent with blocking but does not by itself prove DB was the first bottleneck.

### H2 — The API release itself (bad job creation / poison jobs), independent of the flag

Supporting:

- Onset ~5 min after deploy (09:02 → 09:07) — temporal correlation.

Weakening:

- API rollback (09:24) normalized new job creation but did not unstick the backlog; recovery tracked flag disable (09:43), not rollback.
- US ran the same release with no alert.
- Retried-then-succeeded behavior on the same job across the flag flip points to worker retry handling, not permanently poisoned job payloads.

### H3 — Independent database failure or capacity regression (not caused by retries)

Supporting:

- DB saturation is directly observed (pool waits, slot errors, 300/300).

Weakening:

- No DB change is in the timeline; saturation onset tracks the deploy/flag window, and recovery tracks flag disable with no recorded DB intervention.
- Restart-then-restall and US-no-alert patterns are unexplained by a purely DB-side fault unless DBs are regionally isolated (unknown — see below).

### H4 — Worker leak / resource exhaustion unrelated to retry logic

Supporting:

- Restart produced ~4 min of normal processing — consistent with clearing leaked/accumulated state.

Weakening:

- Re-stall in 4 min is fast for a classic slow leak and matches re-saturation under continued bad retry load; permanent recovery required flag disable, not repeated restarts.

### H5 — Single-tenant poison (e.g., only acme)

Supporting:

- The earliest failing job is tenant acme while tenant beta succeeds once at 09:07:03.

Weakening:

- Broad queue/DB/checkout impact and a second exhausted job (319) are inconsistent with one tenant unless acme dominates load (tenant mix unknown). `policy=""` on multiple jobs suggests a systemic fallback, not one bad tenant row.

## What remains unknown

- What `policy=""` means (missing tenant row? parse failure? unmigrated default?) and the exact code path from policy to `delay_ms=0`.
- Aggregate blast radius: jobs delayed/failed vs. succeeded, per-tenant distribution, checkout latency/error counts, customer count.
- Final disposition of budget-exhausted jobs: dropped, dead-lettered, or retried to success after 09:43.
- DB topology: shared vs. regional; per-service connection split (API vs. workers); queries per retry attempt; what held connections (idle-in-transaction? slow queries?).
- Worker topology: pools, threads, and pool sizing (log shows active=10/worker — 40–90 workers × 10 would oversubscribe 300 even before retries).
- Flag rollout history: when and to whom `tenant_retry_policy` was enabled in eu-west vs. US; who/what set it to 2% in US.
- Why new job creation normalized after API rollback while backlog stayed stuck (separate API vs. worker flag reads? cached policy?).
- Whether 09:24–09:43 backlog processing was zero or merely slow; queue-depth numbers over time.
