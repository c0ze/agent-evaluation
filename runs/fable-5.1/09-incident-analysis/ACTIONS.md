# Actions: eu-west queue backlog (2026-09-23)

Owners are roles, not people. "Verification signal" is what we watch to know the
action worked. "Rollback consideration" is what could go wrong with the action
itself and how to undo it. Items are prioritized within each section.

## A. Immediate containment (now, before anything else)

| # | Action | Owner (role) | Verification signal | Rollback consideration |
|---|---|---|---|---|
| C1 | Keep `tenant_retry_policy` **disabled in every region**, including the US 2% cohort, until A1-A3 ship. | Incident commander (on-call SRE) | Zero `retry_budget_exhausted policy=""` and zero `result=retry delay_ms=0` lines in worker logs, both regions, for 24 h; eu-west queue depth, job age and worker CPU at pre-09:00 baseline. | Disabling in the US changes behaviour for the 2% tenants. Confirm they fall back to `config_retry_default="exponential"` (as worker-51 did at 09:43:09) and that no tenant was relying on the new policy. If one is, address it with an explicit per-tenant config review, not by re-enabling the flag. |
| C2 | Put the flag under change control: no re-enable without an approved change ticket referencing this incident. | Release manager | Flag audit log shows no state changes; ticket link recorded. | None; this only adds friction to re-enabling. |
| C3 | Return worker count from 90 to the pre-incident 40 (or whatever the DB can support with API headroom, see A5). | On-call SRE | DB connections stay below ~70% of the 300 cap at peak; no `db pool wait exceeded` warnings for 24 h; queue depth stable. | If the backlog re-forms, scale up in steps of 10 and only while DB connections have >20% headroom. Scaling up blindly made things worse at 09:14. |
| C4 | Reconcile every job that logged `retry_budget_exhausted` between 09:06 and 09:45 in eu-west: determine whether each was requeued, dead-lettered, or dropped; replay idempotent ones; hand non-idempotent ones to manual review; list affected tenants for Support. | Queue platform engineer, with Support lead | Dead-letter count back to baseline; replayed-job success rate; reconciled list attached to the incident; no duplicate side-effect reports from tenants after 48 h. | Replay only jobs known to be idempotent. Keep the list of replayed job IDs so effects can be reversed if duplicates surface. If job creation was elevated 09:07-09:24 (unknown), also check for duplicate jobs before replaying. |
| C5 | Preserve evidence before log retention rolls: full worker and API logs 08:55-10:30 in both regions, DB connection metrics by client, flag audit history, and any worker-51 diagnostics (thread dumps, in-flight job state). | SRE (incident scribe) | Artifacts attached to the incident record; checksums noted. | None. |
| C6 | Query the US region for `policy=""` events and for job-age p99 among the 2% flagged tenants during 09:00-10:30 to confirm "no alert" also meant "no impact". | On-call SRE (US) | Query results documented in the incident record. | None. |
| C7 | Establish exactly what the 09:24 rollback reverted (API only? workers?) and which build every worker pool is running now. | Release manager | Build IDs per pool documented; workers confirmed on a build whose retry path is either pre-change or fixed. | If workers are still on `2026.09.23.1` with the flag off, that is acceptable short-term only because the flag gates the path; do not treat it as fully rolled back. |

## B. Corrective actions

### Priority 1: required before the flag is re-enabled anywhere

| # | Action | Owner (role) | Verification signal | Rollback consideration |
|---|---|---|---|---|
| A1 | Fix retry-policy resolution: an empty, null or malformed tenant policy must fall back to `config_retry_default`; enforce a minimum retry delay floor (never `delay_ms=0`); treat an empty policy as a configuration error that is logged and alerted, not applied. | Worker platform tech lead | Unit tests covering empty/null/malformed policies resolve to the default; staging canary with a tenant that has no policy entry shows exponential delays; metric `retry.delay_ms == 0` count is zero over a full staging soak. | Standard deploy rollback. Because the flag stays off during rollout, reverting this change has no tenant-facing effect. |
| A2 | Identify and fix the stall mechanism: why a job whose retry budget was exhausted left worker-51 stalled for ~8 minutes with low CPU and a saturated DB pool. Ensure the exhausted-budget path acks/nacks the job, returns DB connections, and is bounded by a per-job timeout. | Worker platform engineer | Fault-injection test (jobs that always return `retry`): throughput on healthy jobs stays >= 95% of baseline; per-worker pool `idle > 0` throughout; no job held longer than the per-job timeout. | Code-level change; deploy rollback. If the per-job timeout is set too low it will abort legitimate long jobs, so start at 2x the observed p99 job duration and tighten later. |
| A3 | Validate tenant retry-policy configuration: schema validation at load time and in CI; refuse to enable `tenant_retry_policy` if any tenant resolves to an empty policy; log `policies_validated=N` at worker startup. | Config / platform engineer | CI fails on a synthetic empty policy; worker startup line shows the validated count; enabling the flag with a known-bad config is rejected in staging. | Validation can be switched to warn-only if it blocks legitimate deploys, but not before A1 ships. |
| A4 | Update the incident runbook: for any flag-gated change, disable the flag first, then consider a deploy rollback; document which services evaluate each flag (this one is evaluated by workers, not just the API, so an API rollback did not revert it). | SRE lead | Runbook reviewed in the postmortem; a game-day exercise reaches flag-off in under 10 minutes from first alert. | None. |

### Priority 2: within two weeks

| # | Action | Owner (role) | Verification signal | Rollback consideration |
|---|---|---|---|---|
| A5 | Database connection budgeting: (worker replicas x pool size) + API pools must fit under the 300 cap with a reserve for the API tier; add a connection reserve or a pooler in front of the database; cap worker autoscaling at the DB-safe maximum. | Database platform lead | Load test at the maximum worker count produces zero `remaining connection slots reserved` errors on the API and no change in checkout p99; the cap is enforced in the autoscaler config. | Pool-size and reserve changes are config and reversible. Watch for worker throughput regression if per-worker pools shrink; if it appears, raise the DB cap rather than the pool size. |
| A6 | Scaling guardrail: runbook step and autoscaler rule that blocks adding workers while `db pool wait` warnings are firing or DB connections exceed 80%; scale in steps with a settle period. | SRE lead | Autoscaler dry-run logs show blocked scale-ups under simulated saturation; runbook step present. | The rule can be disabled if it blocks legitimate scaling; keep a documented manual override. |
| A7 | Alert on cause signals, not only symptoms: `retry_budget_exhausted` rate, `delay_ms=0` retries, `policy=""`, `db pool wait exceeded`, and the signature "queue depth rising while worker CPU falls". | Observability engineer | Replaying the 09:06-09:08 log lines into staging triggers an alert within 2 minutes; alert noise reviewed after one week in production. | Thresholds can be tuned or individual alerts muted if noisy; do not remove the `policy=""` alert until A3 is in place. |

### Priority 3: before re-enabling the flag / within 30 days

| # | Action | Owner (role) | Verification signal | Rollback consideration |
|---|---|---|---|---|
| A8 | Staged re-enable plan for `tenant_retry_policy`: 1% -> 10% -> 50% -> 100% per region, each stage held 24 h with automatic halt on job-age or checkout SLO burn; begin in the region with the most DB headroom. | Product / platform release manager | Each stage completes with zero cause-signal alerts (A7) and no `policy=""` events; job success-on-retry rate unchanged or better. | Flag off at any stage. Workers pick up the flag at runtime (`config_changed` at 09:43:07), so the effect should be near-immediate; confirm this at the 1% stage before proceeding. |
| A9 | Run the postmortem with the unknowns in `INCIDENT.md` section 7 as explicit questions to close; track every action here to completion. | Incident commander | Each action has a ticket, owner and due date; unknowns are either answered or accepted as residual risk. | None. |
| A10 | Investigate the underlying transient failures that make jobs return `retry` in normal operation (job 319 needed a retry even with the flag off), and reduce reliance on retries where possible. | Worker platform engineer | Baseline attempt>1 rate measured; a reduction target set and tracked. | None; this is investigative. |

## C. Notes on ordering

- C1-C3 are the immediate stabilizers and are already partly in effect; C4 is the
  customer-facing cleanup and should start today.
- A1 and A2 are the actual fixes and both must ship before A8; A3 and A4 prevent a
  repeat by a different route (bad config, wrong rollback target).
- A5-A7 reduce blast radius and shorten detection for the next incident of any
  cause, so they are worth doing even if A1/A2 fully explain this one.
