# Action Plan: Containment and Corrective Actions

This document outlines immediate containment actions and prioritized corrective measures to prevent recurrence of queue processing stalls and database connection exhaustion.

---

## 1. Immediate Containment Actions

### 1.1 Verify Regional Feature Flag State and Worker Scale
* **Description**: Confirm that feature flag `tenant_retry_policy` is completely disabled (`false`) across all environments (including `eu-west`, `US`, and other regions). Ensure worker instance count in `eu-west` has been safely restored from 90 back to baseline nominal capacity (40 instances) to prevent database connection oversubscription.
* **Owner (Role)**: Incident Commander / Site Reliability Engineer (SRE) On-Call
* **Verification Signals**:
  * Feature flag telemetry confirms `feature_flag=false` globally.
  * Worker pod count in `eu-west` returned to 40.
  * Total database connections stabilized comfortably below 150 (50% of the 300 maximum).
  * Worker CPU utilization sustained at normal operating baseline (55%–70%).
  * Queue depth is 0 and job age latency is at nominal baseline (<1s).
* **Rollback Considerations**:
  * If queue processing starts falling behind at 40 workers under standard non-storm load, scale worker pool incrementally (e.g., to 50) while monitoring active DB connection counts. Do not scale beyond DB connection capacity.

---

## 2. Prioritized Corrective Actions

### Priority 0 (P0) — Critical Defect Remediation & Capacity Protection

#### Action Item 1: Enforce Defensive Default Retry Backoff & Non-Zero Floor
* **Description**: Patch the retry policy engine:
  1. If tenant-specific lookup returns `null`, empty string (`""`), or invalid configuration, explicitly fall back to `config_retry_default` (`"exponential"` with jitter).
  2. Implement an immutable lower-bound delay floor (`min_delay_ms = 500`) across all retry policies. Any policy configured with or evaluating to `delay_ms < min_delay_ms` must be rejected or clamped to prevent zero-delay retry loops.
  3. Validate tenant policy configurations with automated schema validation at deployment time.
* **Owner (Role)**: Backend Core / Queue Infrastructure Software Engineer
* **Verification Signals**:
  * Unit tests verifying that missing, empty (`""`), or corrupt tenant policies default to exponential backoff.
  * Integration tests asserting that simulated transient job failures observe backoff with jitter and `delay_ms >= 500`.
  * Staging load tests verifying that failing tenant jobs do not saturate DB pools or trigger tight retry loops.
* **Rollback Considerations**:
  * Deploy behind a new versioned feature flag. If regression occurs, toggle the flag off to keep the hardcoded system-wide exponential default active.

#### Action Item 2: Database Connection Pool Isolation (Bifurcation of API vs. Workers)
* **Description**: Decouple database connection resources between customer-facing API checkout services and asynchronous queue workers:
  1. Implement connection pooling proxying (e.g., PgBouncer / ProxySQL) or partitioned database user pools.
  2. Allocate strict maximum connection quotas: e.g., max 120 connections reserved for API services, max 120 connections reserved for background workers, and 60 connections reserved for administrative and DBA maintenance.
  3. Enforce that worker autoscaling calculations cannot exceed the worker pool ceiling (`max_instances * pool_per_worker <= worker_quota`).
* **Owner (Role)**: Database Administrator (DBA) / Infrastructure Platform Engineer
* **Verification Signals**:
  * Synthetic saturation tests in pre-production: Artificially saturating worker connection pools must leave API connection headroom unaffected, and checkout API transactions must complete without connection timeout errors.
  * Metric dashboards displaying separate connection utilization for API and Worker pools.
* **Rollback Considerations**:
  * Pool limit adjustments can be reloaded in connection proxy configuration without database restarts. If quotas throttle legitimate peak traffic, pool allocations can be adjusted dynamically.

---

### Priority 1 (P1) — Operational Guardrails & Deployment Safety

#### Action Item 3: Automated Autoscaling Guardrails & Runbook Update
* **Description**:
  1. Update incident response runbooks for queue degradation: explicitly prohibit manual or automated scaling of worker instances when DB connection pool waits or database connection limits are saturated.
  2. Integrate pre-conditions into autoscaling policies: worker scaling should be capped or throttled if database connection utilization exceeds 75% or if worker CPU drops below 30% alongside high queue depth (indicating I/O blockage rather than compute shortage).
* **Owner (Role)**: Site Reliability Engineering (SRE) Lead
* **Verification Signals**:
  * Documented and reviewed runbook in incident management repository.
  * Autoscaler policy simulation confirming that scaling is blocked when DB connection alerts are active.
  * Validation conducted during next operational game-day / chaos drill.
* **Rollback Considerations**:
  * If autoscaler constraints prevent necessary scaling during sudden organic traffic surges, on-call retains manual emergency override capability with mandatory DB headroom verification.

#### Action Item 4: Regionally Consistent Canary Rollout Standards
* **Description**:
  1. Enforce automated phased rollout policies for feature flags across all regions uniformly. Disallow releasing a feature flag broadly in one region (e.g., 100% in `eu-west`) while another region is at 2% canary.
  2. Implement Automated Canary Analysis (ACA) gates: feature flag promotion must automatically halt and roll back if regional metrics (queue age, worker CPU drops, DB connection wait times, error rates) breach standard anomaly thresholds within a 30-minute soak window.
* **Owner (Role)**: Release Engineering / DevOps Lead
* **Verification Signals**:
  * Feature flag management platform configured with mandatory staged progression (e.g., internal -> 2% -> 10% -> 50% -> 100%) with automated health check evaluation.
  * Automated canary pipeline logs verifying automatic halt on synthetic error injection in staging.
* **Rollback Considerations**:
  * Feature flag platform supports instantaneous 1-click global kill switch and automatic rollback on metric breach.

---

### Priority 2 (P2) — Telemetry and Observability Enhancements

#### Action Item 5: Anomaly Alerts for Retry Velocity and Connection Starvation
* **Description**:
  1. Add real-time Prometheus / Datadog alerts for rapid retry exhaustion: trigger high-priority alerts if any tenant or worker logs `delay_ms == 0` or retry budget exhaustion (`retry_budget_exhausted`) within <100ms.
  2. Add proactive alerts for DB connection pool wait durations (`wait_ms > 1000`) and worker CPU-to-queue-depth divergences (high queue depth + low CPU).
* **Owner (Role)**: Observability / Monitoring Lead
* **Verification Signals**:
  * Pre-production test triggering simulated zero-delay retries correctly trips the new alert within 60 seconds.
  * Alert routing validated to page the on-call queue infrastructure engineer.
* **Rollback Considerations**:
  * Alert configurations managed via code repository; can adjust sensitivity thresholds or silence without service interruption.
