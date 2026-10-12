# Response — confidence and next data requests

## Confidence

**Overall: moderate.** We are confident about *what* was observed; we are less
confident about the precise mechanism.

| Claim | Confidence | Basis |
| --- | --- | --- |
| The incident began with, and was driven by, the tenant retry-policy change shipped in `2026.09.23.1` and gated by `tenant_retry_policy` | **Moderate–high** | Zero-delay retries and `policy=""` in the logs; failure persisted through a code rollback; recovery within seconds of the flag being disabled; US region at 2% exposure generated no alert (dose–response) |
| Affected tenants' policies resolved to an empty value and produced no backoff | **High** | `delay_ms=0` on every attempt, `policy=""` in both exhaustion warnings, `config_retry_default="exponential"` not applied |
| Workers were *blocked*, not overloaded | **High** | Queue depth rising while worker CPU fell 65% → 18%; adding workers made the queue grow faster |
| The database connection pool was saturated and was the proximate stall | **Moderate** | Pool wait >5 s at 09:07:01, 300/300 by 09:20, reserved slots at 09:19:52 — but no DB-side data confirming what held the connections |
| The specific causal chain "zero-delay retries → connection saturation → worker starvation" | **Low–moderate** | Plausible and consistent with every observation, but the middle link is inferred; H2 (pool exhaustion as an independent cause) is not excluded |
| No customer data was lost | **Low** | Absence of evidence, not evidence of absence. `retry_budget_exhausted` jobs' final state is unknown |

The strongest evidence — flag-off at 09:43:07 → `delay_ms=1000` at 09:43:09 →
success at 09:43:10 — is temporal coupling, which is suggestive but not proof.
We have deliberately not attributed this to any individual; the observable facts
point at a configuration/fallback defect in a change, not at a person.

## Next two pieces of data I would request

1. **Database-side telemetry for 09:00–09:50 UTC**: connection counts over time
   broken down by state (idle in transaction / active / waiting) and by holding
   client or query, plus lock-wait and top-query/slow-query data. Paired with
   **worker-side wait-event or stack samples** showing what the idle workers
   were blocked on during 09:07–09:43.
   - *Why:* this is the single missing link between the retry change and the
     stall. It discriminates H1 (retry storm saturating the pool) from H2
     (independent pool exhaustion/leak) and explains why a restarted pool
     recovered for exactly four minutes.

2. **The resolved retry-policy configuration per tenant at the time of the
   incident, plus the flag rollout configuration** (which tenants/regions had
   `tenant_retry_policy` enabled, at what percentage) **and the job-level
   outcome records** for every job that hit `retry_budget_exhausted` between
   09:02 and 09:45 (dropped / dead-lettered / re-queued / eventually succeeded).
   - *Why:* this converts the two-tenant sample (`acme` failed, `beta`
     succeeded) into an actual blast radius, confirms whether the US region was
     truly unaffected or merely below alert thresholds, and determines whether
     any customer work was lost — the one impact question we cannot currently
     answer.
