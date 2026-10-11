# Incident Analysis: eu-west Queue Stall (2026-09-23)

## Impact
- **Duration**: ~76 minutes (09:02–10:18 UTC)
- **Region**: eu-west (US unaffected — flag enabled for only 2% of tenants)
- **Symptoms**: Queue depth grew unbounded; worker CPU collapsed from 65% → 18%; DB connections saturated at 300; checkout latency and job-age alerts fired
- **Resolution**: Disabling feature flag `tenant_retry_policy` at 09:43 restored processing; backlog cleared by 10:18

## Concise Timeline (observed facts)
| Time (UTC) | Event |
|------------|-------|
| 09:02 | API deploy `2026.09.23.1` (adds tenant-specific retry policy behind flag `tenant_retry_policy`) |
| 09:06:58 | Worker logs: job 81 (tenant=acme) retries 3× with **0 ms delay**, then `retry_budget_exhausted policy=""` |
| 09:07 | Queue depth rises; worker CPU drops 65% → 18% |
| 09:07:01 | DB pool wait exceeded (5 s); active=10, idle=0 |
| 09:11 | Alerts: job age, checkout latency |
| 09:14 | Workers scaled 40 → 90; queue depth accelerates |
| 09:19:52 | API error: "db remaining connection slots reserved" |
| 09:20 | DB connections hit configured max (300) |
| 09:24 | API deploy rolled back; **new job creation normalizes, backlog persists** |
| 09:31 | One worker pool restarted; processes normally ~4 min, then stalls |
| 09:31:10 | Restarted worker starts with `config_retry_default="exponential" feature_flag=true` |
| 09:35:12 | Same worker: `retry_budget_exhausted policy="" elapsed_ms=38` |
| 09:43 | Feature flag `tenant_retry_policy` **disabled** |
| 09:43:07 | Worker logs `config_changed feature_flag=false` |
| 09:43:09–10 | Job 319 succeeds: attempt 1 retry delay_ms=1000, attempt 2 success |
| 10:18 | Backlog cleared |

## Root Cause Hypotheses

### H1 (Strongest): Buggy retry policy activated by feature flag
- **Evidence supporting**:
  - Logs show `policy=""` and 0 ms delay → immediate retries exhaust budget in ~40 ms
  - Disabling flag at 09:43 caused immediate recovery; jobs then used exponential backoff (1000 ms delay) and succeeded
  - US region had flag for only 2% of tenants → no alert
  - Rollback at 09:24 did **not** resolve backlog (flag still on), confirming flag—not deploy artifact—was the trigger
- **Evidence weakening**: None directly; rollback not fixing it is consistent with flag-driven behavior
- **Unknown**: Why `policy=""` (empty string) — config default missing? Tenant-specific config absent?

### H2: DB connection exhaustion as primary cause
- **Evidence supporting**: Connections hit 300; pool waits; "slots reserved" error
- **Evidence weakening**: CPU dropped *before* connection saturation (09:07 vs 09:20); restarting one worker pool worked briefly *while* DB was saturated → workers stalled due to retry loops, not DB unavailability alone
- **Assessment**: DB exhaustion is a **consequence** of retry storms, not root cause

### H3: Worker scaling worsened contention
- **Evidence supporting**: Scaling 40→90 at 09:14 accelerated queue growth
- **Evidence weakening**: Scaling was a response, not initiator; queue already rising at 09:07
- **Assessment**: Contributing factor (amplifier), not root cause

## Contributing Factors
1. Feature flag enabled for broad tenant cohort in eu-west (vs 2% in US)
2. No circuit breaker / retry budget enforcement at worker level
3. DB connection limit (300) too low for retry storm volume
4. Rollback procedure didn't include feature flag disable
5. On-call scaling action lacked visibility into retry behavior

## What Remains Unknown
- Exact code path producing `policy=""` and 0 ms delay (config default? tenant override?)
- Whether tenant `acme`/`beta` had custom retry config or fell back to broken default
- Why restarted worker processed normally for ~4 min before stalling (cache warm-up? connection pool hysteresis?)
- Whether any data loss / duplicate processing occurred during retry storms