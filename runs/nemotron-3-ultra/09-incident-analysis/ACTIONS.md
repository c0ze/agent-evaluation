# Corrective Actions: eu-west Queue Stall (2026-09-23)

## Immediate Containment (Completed)
| Action | Owner | Status | Verification Signal |
|--------|-------|--------|---------------------|
| Disable feature flag `tenant_retry_policy` globally | Platform Engineer | ✅ Done 09:43 | Queue drain rate >0; worker CPU recovers to >50%; job success rate >99% |
| Freeze deployments to API/worker fleet | Release Manager | ✅ Done | No new deploys until root cause fix validated |

---

## Prioritized Corrective Actions

### P0 — Fix retry policy implementation (blocks re-enable)
| Action | Owner | Verification Signal | Rollback Consideration |
|--------|-------|---------------------|------------------------|
| Audit `tenant_retry_policy` code: ensure default policy is never empty; enforce minimum backoff (e.g., 100 ms) and max attempts | Backend Engineer (Queue Team) | Unit tests pass: empty policy → falls back to exponential; integration test: 0 ms delay rejected | Feature flag remains OFF; deploy fix behind same flag; canary 1% → 100% over 24h |
| Add validation at worker startup: log effective retry config per tenant; fail fast if `policy==""` | Backend Engineer (Queue Team) | Startup logs show non-empty policy for all tenants; CI gate on config schema | No rollback needed — additive safety check |

### P1 — Harden infrastructure against retry storms
| Action | Owner | Verification Signal | Rollback Consideration |
|--------|-------|---------------------|------------------------|
| Implement per-tenant retry budget + circuit breaker at worker level (independent of policy config) | Backend Engineer (Platform) | Chaos test: injected retry loop throttled after N attempts; DB connections stay <200 | Deploy behind flag `retry_circuit_breaker`; instant disable if false positives |
| Raise DB `max_connections` from 300 → 500 with connection pooling tuning | DBA / Platform Engineer | Load test: 90 workers × peak retry rate stays <400 connections | Revert config if memory pressure observed; blue/green PG upgrade |
| Add queue-depth-based autoscaling *ceiling* (max workers) with backoff-aware scaling policy | Platform Engineer / SRE | Scale-up pauses when retry rate > threshold; no more "scale makes it worse" | Config change only; instant revert via config map |

### P2 — Operational guardrails
| Action | Owner | Verification Signal | Rollback Consideration |
|--------|-------|---------------------|------------------------|
| Update runbook: "queue depth rising + CPU falling" → **disable feature flag first**, then scale | SRE / On-call Lead | Next drill: on-call disables flag within 5 min of alert | Documentation only |
| Add feature flag state to deploy/rollback checklist | Release Manager | Checklist includes "verify flag state post-rollback" | Process change only |
| Emit structured metric `retry_policy_active{tenant,policy}` for alerting | Backend Engineer (Observability) | Dashboard shows policy distribution; alert on `policy==""` | Metric addition only |

### P3 — Tenant-specific config hygiene
| Action | Owner | Verification Signal | Rollback Consideration |
|--------|-------|---------------------|------------------------|
| Audit all tenant retry configs; ensure no missing/empty policies | Backend Engineer (Queue Team) | Report: 0 tenants with empty policy; default applied uniformly | Data migration; reversible via config rollback |
| Migrate to typed retry config schema (protobuf/JSON Schema) with required `policy` field | Backend Engineer (Platform) | CI rejects configs missing `policy` | Schema change; backward-compatible default |

---

## Verification Signals Summary (Post-Fix)
| Signal | Target | Measurement |
|--------|--------|-------------|
| Job success rate (eu-west) | >99.9% | 5-min rolling window |
| Worker CPU (steady state) | 50–75% | Datadog / Prometheus |
| DB connection utilization | <60% of max | pg_stat_activity |
| Retry rate per job | <0.1 retries/job | Worker logs → metrics |
| Feature flag rollout safety | Canary 1% → 100% over 24h | Flag dashboard |

---

## Rollback Decision Matrix
| Scenario | Action |
|----------|--------|
| Fix deployed, but retry storms recur at canary % | Disable flag immediately; revert worker deploy |
| DB connections spike despite circuit breaker | Lower worker max; increase PG `max_connections`; disable flag |
| False positive circuit breaker blocks legitimate retries | Disable `retry_circuit_breaker` flag; tune thresholds |
| Tenant config migration causes new failures | Rollback config migration; apply defaults via code |