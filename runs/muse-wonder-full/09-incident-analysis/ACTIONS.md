# Actions — eu-west queue backlog

Owners are roles, not individuals. "Verification" is the signal that shows
the action worked; "Rollback" is how to undo the action if it makes things
worse.

## Immediate containment

1. **Keep `tenant_retry_policy` disabled in all regions** until the fix in P0
   is verified. Freeze any re-enablement, including the US 2% cohort.
   - Owner: Incident Commander, with Release Manager.
   - Verification: flag state confirmed off in config and in worker logs
     (`feature_flag=false`); queue depth and job age stay at baseline;
     `retry_budget_exhausted` with `policy=""` no longer appears.
   - Rollback: none needed to stay off; re-enabling is the risky direction
     and must go through the P1 staged rollout below.

2. **Hold worker count steady; do not scale up in response to queue depth
   alone** while database connections are near the 300 maximum. Scale back
   toward the pre-incident 40 workers once the backlog is confirmed clear.
   - Owner: SRE On-Call.
   - Verification: DB active connections comfortably below 300; DB pool wait
     near zero; worker CPU back near the pre-incident ~65% under load.
   - Rollback: if job age rises after scaling back, restore workers in small
     steps while watching DB pool wait; stop if pool wait reappears.

3. **Account for every affected job before replaying any.** Identify jobs
   that hit `retry_budget_exhausted` between 09:02 and 10:18 UTC, classify
   each as completed, safely replayable, or needing manual review, and check
   idempotency before replay. Do not bulk-replay unclassified jobs.
   - Owner: Worker/Queue Service Owner, with Support Lead for tenant impact.
   - Verification: counts reconcile (created = completed + replayed +
     dead-lettered with reason); no duplicate side effects reported;
     dead-letter queue reviewed to zero or an agreed remainder.
   - Rollback: pause replay immediately if duplicates or errors appear;
     replays must be individually traceable so a batch can be halted.

4. **Preserve evidence and confirm customer impact.** Snapshot worker and API
   logs, flag-change history, queue metrics, and DB connection metrics for
   09:00–10:30 UTC before retention expires; quantify delayed/failed
   checkouts per tenant.
   - Owner: Incident Commander, with Support Lead.
   - Verification: evidence bundle stored and linked from the incident
     record; per-tenant impact list produced (or explicitly marked unknown).
   - Rollback: not applicable (read-only).

## Prioritized corrective actions

### P0 — Fail safe on missing or empty tenant retry policy

Treat an empty/missing policy as a configuration error: fall back to the
`exponential` default, enforce a non-zero minimum retry delay, log and alert
on fallback, and add tests for empty, missing, and unknown policy values.

- Owner: API Service Owner and Worker/Queue Service Owner (whichever
  components resolve the policy); QA Owner for test coverage.
- Verification: in staging, a tenant with an empty policy retries with
  exponential delay (never `delay_ms=0`); new tests pass; in production
  after release, zero occurrences of `policy=""` reaching the retry path and
  no rise in `retry_budget_exhausted`.
- Rollback: the fix ships with `tenant_retry_policy` still off, so rollback
  is a normal release rollback with no customer-facing behaviour change;
  the flag stays off until verification passes.

### P0 — Bound worker database usage so scaling cannot saturate the database

Set an explicit global budget: workers × per-worker pool size must stay
below the database maximum with headroom for the API, enforced in deployment
configuration; add pool-wait and connection-saturation alerts.

- Owner: Database Owner, with SRE On-Call.
- Verification: config check fails a deployment that would exceed the
  budget; load test at maximum worker count keeps DB connections below the
  agreed ceiling and pool wait near zero.
- Rollback: revert the configuration change if it starves legitimate
  throughput (job age rises with idle DB capacity); keep the alerts either
  way.

### P1 — Re-enable `tenant_retry_policy` only as a staged, monitored rollout

After P0 verification: enable for one internal/low-risk tenant, then small
percentages per region, with automatic halt on `retry_budget_exhausted`
rate, `delay_ms=0` occurrences, queue age, or DB pool wait.

- Owner: Release Manager, with API Service Owner.
- Verification: dashboards per cohort show retry delays matching each
  tenant's configured policy; no change in queue depth, job age, or DB
  connections at each step.
- Rollback: single flag disable per region (the mitigation that worked at
  09:43); rehearse it in staging and keep the disable path independent of a
  deploy.

### P1 — Add detection for this failure shape

Alert on: retries with `delay_ms=0`, retry budget exhausted within a short
elapsed time, `policy=""` in logs, and the combined signal of rising queue
depth with falling worker CPU (workers blocked, not busy).

- Owner: SRE On-Call, with Worker/Queue Service Owner.
- Verification: alerts fire in a staging fault-injection test (empty policy)
  before queue age alerts would; thresholds tuned against baseline noise.
- Rollback: adjust or disable noisy alerts; detection changes are
  read-only with respect to production behaviour.

### P1 — Clarify and document which component owns retry policy for queued jobs

Establish why the API rollback normalized new job creation but left the
backlog stuck, and document the flag/code ownership so future mitigation
goes straight to the controlling switch.

- Owner: API Service Owner, with Worker/Queue Service Owner.
- Verification: runbook updated with the flag as the first mitigation for
  retry-policy incidents; a game-day or tabletop confirms responders can
  disable the flag within minutes.
- Rollback: not applicable (documentation); correct it if the game-day
  contradicts it.

### P2 — Pre-deploy validation of tenant policy configuration

Validate tenant retry-policy configuration at write/deploy time (reject
empty values), and add a periodic audit listing tenants with missing
policies.

- Owner: API Service Owner, with QA Owner.
- Verification: attempting to save an empty policy is rejected in staging
  and production; audit report shows zero tenants with invalid policies.
- Rollback: if validation blocks a legitimate configuration path, relax to
  warn-and-fallback (P0 behaviour) while keeping the audit.

### P2 — Review scale-up playbook for blocked-worker incidents

Update the runbook: when queue depth rises while worker CPU falls and DB
pool wait is present, treat workers as blocked downstream and do not scale
up until the blocking resource is identified.

- Owner: SRE On-Call (runbook owner), with Incident Commander.
- Verification: runbook merged and exercised in the next incident review or
  game-day.
- Rollback: not applicable (documentation).
