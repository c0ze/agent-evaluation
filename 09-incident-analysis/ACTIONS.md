# Containment and Corrective Actions

## 1. Immediate Containment

1. **Keep `tenant_retry_policy` Disabled Globally:**
   - Ensure `tenant_retry_policy` (`feature_flag=false`) is disabled not only in `eu-west` but also in the US region (where it was active for 2% of tenants) so low-volume tenants do not silently hit `policy=""` retry exhaustion.
2. **Keep API `2026.09.23.1` Rolled Back:**
   - Block re-deployment of `2026.09.23.1` until the empty retry policy (`policy=""`) fallback and worker stall defects are fixed and verified in staging.
3. **Right-Size Worker Fleet to Protect Database Connections:**
   - Scale the `eu-west` worker count back down from the emergency level of 90 toward the baseline of 40 (as backlog permits) so aggregate worker connection pools (`active=10` per worker) cannot consume all 300 database connections and starve `api-*` nodes.
4. **Audit Jobs Processed Between 09:02 and 10:18 UTC:**
   - Reconcile all jobs that logged `retry_budget_exhausted` (such as `job=81` for `tenant=acme`) to confirm whether they eventually succeeded (like `job=319`) or require manual replay.

---

## 2. Prioritized Corrective Actions

### P0 — Fix Empty Retry Policy Fallback and Worker Stall on `retry_budget_exhausted`
- **Owner (Role):** Backend / Queue Systems Engineer
- **Action:**
  1. Update worker and API retry policy resolution so that a missing, null, or empty policy string (`policy=""`) strictly falls back to `config_retry_default` (`"exponential"`) with a non-zero minimum backoff (`delay_ms` greater than or equal to 1000 ms).
  2. Inspect and fix the worker lifecycle when `retry_budget_exhausted` occurs under `tenant_retry_policy` to ensure database connections/transactions are always released (`finally` block / scoped context) and worker threads do not block or spin.
- **Verification Signals:**
  - Unit and integration tests passing for tenants with unset, null, or `""` retry policies under `feature_flag=true`, confirming `delay_ms` uses exponential backoff (`delay_ms=1000` on `attempt=1`).
  - Zero occurrences of `WARN ... retry_budget_exhausted policy=""` or `delay_ms=0` in staging and canary logs when `feature_flag=true`.
  - Worker DB pool metrics (`active`, `idle`, `wait_ms`) remain stable during induced job failures.
- **Rollback Considerations:**
  - Gate the code change behind the existing dynamic `tenant_retry_policy` feature flag (`feature_flag=false` reverts workers immediately to `config_retry_default="exponential"`, as demonstrated at 09:43:07 UTC) and maintain a clean one-click API/worker image rollback.

### P1 — Enforce Database Connection Budgeting and Pool Limits Across API and Workers
- **Owner (Role):** Database Reliability Engineer (DBRE) / Infrastructure Engineer
- **Action:**
  1. Deploy connection pooling middleware (e.g., PgBouncer) or configure strict per-role database connection limits (`ALTER ROLE`) so background workers cannot exhaust connection slots needed by `api-*` services against the 300-connection ceiling.
  2. Cap maximum worker autoscaling/manual scaling limits (`max_replicas`) in `eu-west` and `us` so `(max_workers * worker_db_pool_size) + (max_api_nodes * api_db_pool_size)` stays safely below the 300 database connection limit.
- **Verification Signals:**
  - Load test scaling workers to maximum allowed capacity confirms total DB connections remain below 80% of max capacity (less than 240 of 300 connections) and zero `db remaining connection slots reserved` errors occur on `api-*` instances.
- **Rollback Considerations:**
  - Apply connection limits and pooler routing incrementally per service tier (workers first, then API). If pooler routing introduces latency or connection errors, revert worker connection strings to direct DB endpoints via configuration management and revert `ALTER ROLE` connection limits with a single SQL command.

### P1 — Update On-Call Runbooks and Alerts for Low-CPU / DB-Starved Queue Backlogs
- **Owner (Role):** Site Reliability Engineer (SRE) / On-Call Lead
- **Action:**
  1. Update the queue backlog runbook to prohibit blind horizontal worker scaling when worker CPU has dropped (e.g., 65% to 18%) and `db pool wait exceeded` warnings are present, instructing responders to inspect feature flags and DB connection saturation first.
  2. Add coupled runbook steps requiring any rollback of an API feature release to verify whether associated dynamic feature flags (`tenant_retry_policy`) also need to be disabled on workers.
- **Verification Signals:**
  - Runbook changes reviewed and signed off in post-incident review; new alert triggers on `db pool wait exceeded` (`wait_ms` greater than 1000 ms) and DB connection utilization exceeding 80% (240 connections).
- **Rollback Considerations:**
  - Alert threshold adjustments can be tuned or reverted via monitoring-as-code if they produce false-positive pages during normal traffic spikes.

### P2 — Add Pre-Deploy Schema Validation and Canary Parity Checks for Feature Flags
- **Owner (Role):** Release Engineering Lead
- **Action:**
  1. Add schema validation at job enqueue time in the API so jobs cannot be written with `policy=""` (must either be a valid registered policy enum or omitted to use default).
  2. Standardize progressive feature flag rollouts so a release cannot run at high tenant exposure in one region (`eu-west`) while still at 2% canary exposure in another (`us`) without automated error-budget gates on `retry_budget_exhausted` rate.
- **Verification Signals:**
  - API rejects or defaults invalid retry policy payloads in CI tests; feature flag deployment pipeline enforces automated rollback if `retry_budget_exhausted` warnings spike above baseline within 5 minutes of flag changes.
- **Rollback Considerations:**
  - If strict API payload validation rejects legitimate legacy job producers, toggle validation to log-only mode while normalizing the field to `null`/default before enqueueing.
