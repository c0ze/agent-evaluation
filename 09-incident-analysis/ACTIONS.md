# Containment and Corrective Action Plan

## Immediate Containment (0–24 Hours)

### C1. Keep `tenant_retry_policy` Disabled Across All Regions (Including US 2%)
- **Owner:** Incident Commander / On-Call SRE
- **Action:** Maintain `tenant_retry_policy=false` in `eu-west` and disable it for the remaining 2% of tenants in US until the `policy=""` -> `delay_ms=0` defect and DB pool behavior are confirmed and fixed.
- **Verification Signals:**
  - All workers across `eu-west` and US log `feature_flag=false` (or config telemetry confirms 0% active flag state).
  - Zero new log occurrences of `retry_budget_exhausted policy=""` or `delay_ms=0`.
- **Rollback Considerations:** Do not re-enable the flag as a rollback; if a specific US tenant contractually depends on a custom retry policy, verify their non-empty policy record and monitor their job retries individually before considering any exception, or apply a static safe default (`exponential`).

### C2. Normalize Worker Pool Count and Verify Database Connection Headroom
- **Owner:** On-Call SRE
- **Action:** Scale `eu-west` workers down from the incident-time 90 instances back to the normal operating baseline (40, or lower if needed to keep aggregate pool size below DB capacity) now that the backlog is cleared.
- **Verification Signals:**
  - Total DB connections remain comfortably below 300 (target <60% utilization) with zero `remaining connection slots reserved` or `db pool wait exceeded` errors.
  - Queue depth remains flat/near-zero, job age stays within SLO, and worker CPU stabilizes near normal operating range (~65% under steady load).
- **Rollback Considerations:** Scale down gradually (e.g., 90 -> 65 -> 40) while watching queue depth and job age; if queue depth begins climbing *with high worker CPU (>80%) and low DB pool wait*, pause scale-down and hold at the last stable replica count.

### C3. Audit and Reconcile Exhausted Jobs (`09:02–10:18 UTC`)
- **Owner:** Queue / Backend Engineering Lead (with Support Operations for customer outreach if needed)
- **Action:** Query queue dead-letter queues (DLQs), job status tables, and worker logs (`retry_budget_exhausted`) in `eu-west` (and US for the 2% cohort) to verify whether jobs like `job=81` were re-queued and completed or require safe, idempotent replay.
- **Verification Signals:**
  - Complete inventory of jobs hitting `retry_budget_exhausted` during the window, with confirmed terminal state (`succeeded`, `dlq`, or `replayed`).
  - Zero stuck or orphaned jobs remaining from `09:02–10:18 UTC`.
- **Rollback Considerations:** Before replaying any DLQ/failed job, verify idempotency keys and downstream side effects (e.g., duplicate charges or duplicate checkout notifications). Replay in small rate-limited batches with an immediate pause trigger if error rates or DB connections spike.

### C4. Freeze Further Rollouts of `2026.09.23.1` Retry Changes
- **Owner:** Release Engineering Lead
- **Action:** Block promotion/re-deployment of the `tenant_retry_policy` change in CI/CD until P0 fixes and root-cause verification are complete.
- **Verification Signals:**
  - Deployment pipeline lock/hold active; release tracking ticket linked to P0 blockers.
- **Rollback Considerations:** If unrelated urgent fixes must ship on the API branch, cherry-pick onto the rolled-back baseline release rather than re-deploying the unpatched retry-policy commit.

---

## Prioritized Corrective Actions

### Priority P0 — Mandatory Before Re-Enabling `tenant_retry_policy`

#### A1. Fix Empty/Invalid Tenant Policy Handling and Enforce Backoff Floor + Jitter
- **Owner:** Queue / Backend Engineering Team
- **Action:**
  - Treat missing, null, or empty (`""`) tenant retry policies as a strict fallback to `config_retry_default="exponential"` rather than `delay_ms=0`.
  - Enforce a hard minimum retry delay floor (e.g., `delay_ms >= 100` ms) plus randomized jitter in the worker retry engine, and validate policy schemas on write (API/config store) and read (worker).
  - Add automated tests covering `policy=""`, malformed policy strings, dynamic flag toggles (`true` -> `false` -> `true`), and fallback behavior.
- **Verification Signals:**
  - Unit/integration tests pass for `policy=""` and invalid policies, asserting exponential backoff with jitter and non-zero `delay_ms`.
  - Staging fault-injection test (forcing attempt-1 failures with `feature_flag=true` and missing tenant policy) shows `delay_ms >= 1000` (or configured exponential base) and stable DB connection counts.
- **Rollback Considerations:** Keep the fix behind `tenant_retry_policy`; if unexpected retry delays or regressions appear during staged canary re-enablement, disable `tenant_retry_policy` immediately (verified <2-minute recovery path) without requiring a full binary rollback.

#### A2. Audit and Harden Worker DB Connection Lifecycle on Retry/Exhaustion Paths
- **Owner:** Queue / Backend Engineering Team + Database Engineering (DBA)
- **Action:**
  - Inspect worker transaction and connection-pool checkout/release code around retries and `retry_budget_exhausted` to confirm whether connections can be held across retries or leaked on error paths; ensure connections are released *before* backoff/sleep or error logging.
  - Configure defensive timeouts on DB and worker pools (`idle_in_transaction_session_timeout`, `statement_timeout`, and connection max lifetime).
- **Verification Signals:**
  - Code audit sign-off and load test with induced retry storms showing flat `active` DB connections per worker and zero `idle in transaction` growth over 30+ minutes.
  - Simulated restart-and-load test confirms restarted workers do not stall after sustained retry traffic.
- **Rollback Considerations:** Overly aggressive `statement_timeout` or `idle_in_transaction_session_timeout` could abort legitimate long-running batch jobs; roll out timeout settings in log-only/permissive mode first, measure p99.9 query durations, and retain a fast config toggle to widen timeouts if false-positive cancellations occur.

---

### Priority P1 — Short-Term Resilience (1–2 Sprints)

#### A3. Enforce Database Connection Budgeting, Pooling, and API/Worker Isolation
- **Owner:** Database Engineering (DBA) + Platform / SRE Team
- **Action:**
  - Deploy or tune a connection pooler (e.g., PgBouncer in transaction pooling mode) or separate DB roles/pools with explicit per-service connection caps so background workers cannot starve synchronous API/checkout traffic.
  - Enforce a hard deployment check ensuring `max_worker_replicas × worker_db_pool_size` never exceeds the worker DB connection budget (e.g., <=50% of total DB `max_connections`).
- **Verification Signals:**
  - Synthetic worker saturation test in staging confirms worker pool caps out at its allocated budget while API checkout requests experience zero `remaining connection slots reserved` errors.
  - CI/infrastructure policy check blocks worker scaling or pool-size config changes that violate the DB connection budget.
- **Rollback Considerations:** Switching to transaction pooling can break session-level DB features (prepared statements, advisory locks, `SET` session variables). Validate compatibility in staging first and migrate workers before API, with connection-string config switchover ready to revert to direct/session pooling if protocol errors occur.

#### A4. Add Retry-Storm Circuit Breakers and Downstream-Aware Scaling Guardrails
- **Owner:** Queue Engineering Team + On-Call / SRE Team
- **Action:**
  - Implement per-tenant and global retry rate limits / circuit breakers so high retry rates shed or defer retry traffic into delayed queues instead of hammering the DB.
  - Update autoscaling policies and on-call runbooks to prohibit scaling up workers when worker CPU is depressed (e.g., <30%) alongside elevated `db pool wait exceeded` or high DB connection utilization (>75%).
- **Verification Signals:**
  - Fault-injection test triggers circuit breaker/deferral before DB connections exceed 75% utilization.
  - Updated runbook reviewed in incident postmortem and exercised in a game day; autoscaler dry-run confirms scale-up is suppressed during simulated DB wait saturation.
- **Rollback Considerations:** Misconfigured circuit breakers could delay healthy retries during brief transient blips; ship with configurable thresholds and a bypass/shadow-mode flag so SRE can relax thresholds without a code deploy.

#### A5. Align Rollback Procedures for Coupled API/Worker Releases and Feature Flags
- **Owner:** Release Engineering Team + SRE Team
- **Action:**
  - Document and automate flag-first kill-switch procedures in deployment manifests so any release introducing a worker-evaluated feature flag explicitly links its kill-switch and service rollback dependencies.
  - Ensure deployment tooling flags cross-service schema/payload coupling (API enqueue format vs. worker consumption).
- **Verification Signals:**
  - Release templates require linked kill-switch metadata before deploy approval.
  - Tabletop or staging rollback drill demonstrates flag disablement + coordinated rollback within <5 minutes.
- **Rollback Considerations:** Added release-gate checks could slow emergency hotfixes; include a documented, audited break-glass override for security/P0 patches.

---

### Priority P2 — Observability & Rollout Governance (1 Quarter)

#### A6. Standardize Progressive Regional Flag Rollouts and Targeted Saturation Alerts
- **Owner:** Release Engineering Team + SRE Team
- **Action:**
  - Enforce progressive rollout gates (e.g., 1% -> 5% -> 25% -> 100% with bake windows and automatic rollback triggers) consistently across all regions rather than allowing one region to run significantly ahead of another.
  - Add dedicated alerts for: `retry_budget_exhausted` rate spikes, any `delay_ms=0` retry occurrences, `db pool wait exceeded` frequency, and DB connection utilization >70% (with API vs. worker breakdown).
- **Verification Signals:**
  - Dashboards display per-region flag rollout percentage, retry rate by `policy` value, worker DB pool saturation, and DB connections by service.
  - Synthetic alert tests fire within 1–2 minutes of simulated DB pool wait or `retry_budget_exhausted` bursts.
- **Rollback Considerations:** Overly sensitive alerts can cause alert fatigue; tune thresholds against 30-day historical baselines and start non-critical alerts as warning-level before promoting to paging.

#### A7. Enrich Worker Retry Logging and Job Disposition Telemetry
- **Owner:** Queue / Backend Engineering Team
- **Action:**
  - Include the underlying attempt-1 failure class/error code, resolved policy source (tenant override vs. default), and terminal job disposition (`requeued`, `dlq`, `dropped`) in structured retry logs and metrics.
- **Verification Signals:**
  - Sampled staging/prod retry logs contain `error_type`, `policy_source`, `delay_ms`, and `disposition` fields without PII leakage.
- **Rollback Considerations:** Higher log verbosity during retry storms can increase log volume/cost; emit structured metrics for every retry and sample verbose debug payloads under high retry rates, controlled by a dynamic log-level config.
