# Response note

## Confidence: medium-high (not certain)

I judge the flag-gated empty retry policy (`policy=""` → `delay_ms=0`) causing retry-driven database saturation to be the most likely cause, but correlation is not proof. The timing (onset after deploy, recovery within ~2 minutes of flag disable), the same job switching from zero-delay exhaustion to 1,000 ms backoff plus success across the flag flip, the restart-then-restall pattern while the flag stayed on, and the US region running the same release at 2% flag exposure with no alert all point the same way. Against certainty: the log sample is tiny, `policy=""` is unexplained without code/config, aggregate retry and tenant distributions are missing, and DB topology is unknown, so an independent DB-side contribution cannot be fully excluded.

## Next two pieces of data I would request

1. Full worker retry telemetry plus the policy-resolution code and configuration: aggregate `delay_ms`, `retry_budget_exhausted`, and success/failure counts by tenant and time (09:00–10:30, eu-west vs. US), with the code path that maps a tenant to `policy=""` and then to `delay_ms=0`, and the flag's rollout history per region/tenant. This would confirm or refute the empty-policy mechanism and show whether one tenant or all tenants drove the storm.
2. Database and queue resource time series with topology: DB connections, pool waits, active/idle time, queries and slow queries by source (API vs. workers) overlaid with queue depth, worker count, and worker CPU, plus whether eu-west and US share a database and the per-service connection budgets. This would establish whether DB saturation was the mediating bottleneck and why scaling workers made the queue rise faster.
