# Corrective and Preventative Action Plan

## 1. Immediate Containment

1. **Feature Flag Freeze**: Keep `tenant_retry_policy` feature flag strictly **disabled** (`false`) across all environments (including US and `eu-west`).
2. **Worker Pool Normalization**: Ensure worker replica count in `eu-west` is restored to baseline (40 instances) to eliminate database connection pool saturation.
3. **Database Health Monitoring**: Maintain active monitoring on database connection utilization (alert threshold at >75% of 300 max connections) and worker pool wait duration (`wait_ms`).

---

## 2. Prioritized Corrective Actions

### Action Item 1: Fix Retry Policy Default Fallback & Sanitize Delays (P0)
- **Description**: Update the retry policy engine to strictly enforce safe fallbacks. If a tenant's retry policy is unset, empty (`policy=""`), invalid, or missing, the system must immediately fall back to the global default exponential backoff (`config_retry_default="exponential"`, minimum initial delay >= 1000ms with jitter). Prohibit `delay_ms=0` for retries across the codebase.
- **Owner (Role)**: Core Backend Engineering Lead
- **Verification Signals**:
  - Unit and integration tests demonstrating that jobs with `policy=""` or unknown tenants default to exponential backoff with >0ms delay and jitter.
  - Staging environment load test under simulated job failures showing workers do not execute tight-loop retries.
  - Worker logs showing `delay_ms >= 1000` when retries occur.
- **Rollback Considerations**:
  - Changes are guarded by existing build and deployment pipelines; if tests fail or unexpected regressions appear in staging, revert commit prior to production release.

---

### Action Item 2: Isolate Database Connection Pools & Implement Proxied Pooling (P0)
- **Description**: Decouple customer-facing checkout API connection limits from asynchronous worker connection limits. Deploy a connection pooler (e.g., PgBouncer / RDS Proxy) with dedicated quotas: reserve guaranteed slots for API checkout traffic (e.g., minimum 100 slots) and restrict total worker pool connections so workers cannot exhaust database slots under any scaling event.
- **Owner (Role)**: Database Administrator / Infrastructure Lead
- **Verification Signals**:
  - Connection pool metrics showing distinct pools for API and background workers.
  - Chaos test where background workers are scaled to 150 instances while API checkout response times and connection availability remain unaffected.
  - Zero `db remaining connection slots reserved` errors in API logs.
- **Rollback Considerations**:
  - Connection proxy configuration can be hot-reloaded to adjust pool partition sizes; in the event of proxy degradation, bypass rules allow direct connection fallback with conservative connection limits per pod.

---

### Action Item 3: Update Incident Runbooks & Worker Autoscaling Safeguards (P1)
- **Description**: Update the on-call runbook for queue depth alerts: explicitly prohibit scaling queue workers when database connection pool wait errors (`db pool wait exceeded`) or DB connection saturations are detected. Implement automated guardrails in autoscaler policies that inhibit scale-up if database connection headroom is below 20%.
- **Owner (Role)**: Site Reliability Engineering (SRE) Lead
- **Verification Signals**:
  - Runbook documentation reviewed and published in knowledge base.
  - Autoscaler dry-run test confirming worker scale-out is throttled when database connection pool metrics exceed safety thresholds.
- **Rollback Considerations**:
  - If autoscaler inhibition prevents scaling during legitimate high-throughput demand, on-call engineers retain manual override capability via cluster config.

---

### Action Item 4: Enforce Phased Regional Progressive Rollouts for Feature Flags (P1)
- **Description**: Align global feature flag management policies to mandate staged canary rollouts across all regions (e.g., 1% -> 5% -> 25% -> 100% with automated metric gates for latency and error rates), eliminating single-step broad rollouts in primary regions such as `eu-west`.
- **Owner (Role)**: Release Engineering Lead
- **Verification Signals**:
  - Feature flag configuration platform requires multi-stage schedule and metric validation checks prior to 100% enablement.
  - Audit logs verify that new flag changes cannot be flipped directly to 100% in any production region.
- **Rollback Considerations**:
  - Emergency fast-kill switch retained to instantly disable any feature flag globally within 30 seconds.

---

### Action Item 5: Structured Logging and Observability for Retry Failures (P2)
- **Description**: Enrich worker retry log events to include explicit failure causes (e.g., exception class, message, upstream dependency) alongside `job`, `tenant`, `attempt`, `delay_ms`, and `policy`. Add alert rules for elevated frequency of `retry_budget_exhausted` and `delay_ms == 0`.
- **Owner (Role)**: Observability / Platform Engineering Lead
- **Verification Signals**:
  - Worker logs capture the underlying error cause for retry events.
  - Alert fires in test environment when zero-delay or high-frequency retry bursts are emitted.
- **Rollback Considerations**:
  - Logging format changes are backwards-compatible; log level can be adjusted via dynamic logger configuration without application restarts.
