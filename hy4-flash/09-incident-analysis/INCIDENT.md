# Incident analysis — queue stall (eu-west)

## How to read this document
Labels: **[FACT]** = directly observed in `TIMELINE.md` / `LOGS.txt`. **[INFERENCE]** = interpretation that goes beyond the raw evidence. Correlating in time is not treated as proof of causation.

## Impact (observed and inferred)
- **[FACT]** Queue depth in eu-west began rising at 09:07; alerts fired at 09:11 for job age and checkout latency. Database connections hit the configured ceiling of 300 at 09:20. Full backlog cleared at 10:18.
- **[FACT]** Scaling workers from 40 to 90 at 09:14 was followed by faster queue growth, not recovery.
- **[FACT]** The US region ran the same release with the flag enabled for only 2% of tenants and saw no alert.
- **[INFERENCE]** Customer-facing impact was elevated checkout latency and delayed background jobs in eu-west for roughly 09:11–10:18 (~67 minutes of alert-visible degradation), with the backlog fully drained by 10:18. The exact number of affected tenants/jobs and any duplicate side effects from retries are unknown.

## Concise timeline (UTC)
| Time | Event | Type |
|---|---|---|
| 09:02 | API deploy `2026.09.23.1` adds tenant-specific retry policy | FACT |
| 09:06:58 | job=81 (tenant=acme): 3 retries in the same millisecond, `delay_ms=0`, then `retry_budget_exhausted policy=""` in 41 ms | FACT |
| 09:07 | eu-west queue depth rises; worker CPU falls 65%→18% | FACT |
| 09:07:01 | worker-22: db pool wait exceeded, `wait_ms=5000 active=10 idle=0` | FACT |
| 09:11 | Job-age and checkout-latency alerts fire | FACT |
| 09:14 | Workers scaled 40→90; queue depth rises faster | FACT |
| 09:19:52 | api-03 ERROR: db remaining connection slots reserved | FACT |
| 09:20 | DB connections reach configured max of 300 | FACT |
| 09:24 | API deploy rolled back; new job creation normalizes, backlog still stuck | FACT |
| 09:31 | One worker pool restarted; `config_retry_default="exponential" feature_flag=true`; processes normally ~4 min | FACT |
| 09:35:12 | worker-51: job=319 `retry_budget_exhausted policy=""` in 38 ms — stalls again | FACT |
| 09:43 | Flag `tenant_retry_policy` disabled; recovery begins within ~2 min | FACT |
| 09:43:09–10 | job=319 retries with `delay_ms=1000`, then success in 190 ms | FACT |
| 10:18 | Backlog cleared | FACT |
| — | US: same release, flag at 2% of tenants, no alert | FACT |

## Most likely root cause
**[INFERENCE, moderate confidence]** The new tenant-specific retry policy, when the flag was on, resolved to an empty policy (`policy=""`) for affected tenants. Instead of the intended exponential backoff, retries fired immediately with zero delay and exhausted the retry budget almost instantly (job=81: 3 attempts + exhausted in 41 ms; job=319: exhausted in 38 ms). These tight retry loops kept workers from completing useful work and drove database connection pressure; with the shared connection pool capped at 300, connections were exhausted and the queue stalled, which also raised checkout latency. Disabling the flag restored the default exponential backoff (`delay_ms=1000`) and jobs succeeded, which is the strongest single piece of causal evidence.

## Contributing factors
- **[INFERENCE]** Scaling workers 40→90 at 09:14 likely amplified the problem: more workers meant more concurrent retry loops and more connection demand, consistent with faster queue growth after scaling.
- **[FACT→INFERENCE]** The API rollback at 09:24 stopped new job creation but left the worker-side flag enabled, so the backlog remained stuck until 09:43. Containment was incomplete because the change was only reverted on one component.
- **[INFERENCE]** An empty policy string was accepted without falling back to a safe default — a validation/fail-safe gap in the new configuration path.
- **[INFERENCE]** API and workers shared the DB connection budget, so worker-side exhaustion affected customer-facing checkout (cross-service coupling).
- **[FACT→INFERENCE]** Low flag exposure in US (2%) limited the blast radius there — a dose–response pattern consistent with the flag being the driver.

## Hypotheses: supporting and weakening evidence

### H1 — Empty retry policy causes zero-delay retry storms (most likely)
- Supporting **[FACT]**: `policy=""` alongside `delay_ms=0` and `retry_budget_exhausted` at 09:06:58 and 09:35:12.
- Supporting **[FACT]**: Disabling the flag at 09:43 changed behavior to `delay_ms=1000` and success within ~2 minutes.
- Supporting **[FACT]**: Restart at 09:31 gave only temporary relief; the same `policy=""` signature reappeared at 09:35 — a persistent config problem, not a one-off resource glitch.
- Supporting **[FACT]**: US with 2% flag exposure had no alert.
- Weakening **[FACT]**: worker-51 started with `config_retry_default="exponential"` — the global default was set, so the empty value must come from a tenant-specific override/resolution path, not a missing global default. This narrows the mechanism but does not refute H1.
- Weakening **[FACT]**: job=92 (tenant=beta) succeeded at 09:07:03 (830 ms) during the incident — not every job/tenant failed, so impact was selective rather than universal.

### H2 — Database connection exhaustion is the primary cause of the stall
- Supporting **[FACT]**: `db pool wait exceeded ... active=10 idle=0` at 09:07:01 and "db remaining connection slots reserved" at 09:19:52; max 300 reached at 09:20.
- Supporting **[INFERENCE]**: Connection starvation would stall workers and inflate job age and checkout latency.
- Weakening **[FACT]**: Connection exhaustion appears *after* symptoms began (09:20 vs. 09:07 queue rise), more consistent with it being a downstream amplification than the initiating cause.
- Weakening **[FACT]**: Reverting the API at 09:24 did not clear the backlog; only disabling the flag did — pointing to worker retry behavior rather than DB-side state as the persistent driver.

### H3 — Scaling workers caused the incident
- Weakening **[FACT]**: Queue depth was already rising at 09:07, before the 09:14 scale-up.
- Supporting **[INFERENCE]**: Scaling made it worse (faster rise after 09:14), so it is an amplifier, not the origin.

## What remains unknown
- The exact code path that produces `policy=""` (missing tenant config, bad mapping, or flag interaction) and why the exponential default was not applied for affected tenants.
- Whether retry loops *caused* DB connection exhaustion or merely coincided with it — no per-component connection/retry-rate metrics are available.
- Why worker CPU *fell* (65%→18%) during a supposed retry storm — consistent with blocking on DB waits, but unconfirmed without thread/stack or wait-state data.
- Blast radius in detail: number of tenants/jobs affected, duration of customer-visible impact per tenant, and whether retried jobs caused duplicate side effects (e.g., job=81 attempted 3 times).
- Why the restarted worker pool ran normally for ~4 minutes before stalling, and whether US's 2% cohort ever hit `policy=""`.
- Whether any data was lost or corrupted; the available logs do not cover this.
