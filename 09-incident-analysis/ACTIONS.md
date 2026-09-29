# Actions: eu-west queue stall

Owners are roles, not people. Actions follow from the working hypothesis in `INCIDENT.md` (empty retry policy under `tenant_retry_policy` removed backoff and, with the scale-up, saturated the DB). That hypothesis is probable but unproven, so several actions below are written to confirm it as well as to fix it.

Priority key: **C** = containment, do now. **P0** = before the flag is enabled anywhere again. **P1** = within about two weeks. **P2** = within the quarter.

## 1. Immediate containment

Flag disablement at 09:43 in eu-west and the API rollback at 09:24 are already done (per timeline). The items below close the remaining exposure.

### C1. Verify the flag is really off everywhere it matters in eu-west
- Owner: On-call SRE (with Feature-flag platform owner).
- Do: check the flag at every level (global, region, per-tenant overrides, cached snapshots). Restart or redeploy one worker canary and confirm it starts with `feature_flag=false`. The 09:31 restart came up with `feature_flag=true`, so start-up-time flag reads are a known trap.
- Verification signals: worker start-up log shows `feature_flag=false`; zero `retry_budget_exhausted policy=""` lines and no `delay_ms=0` retries across a full hour of normal load; retries show non-zero `delay_ms`.
- Rollback: re-enabling the flag is the rollback, and it should not be done until P0 items are complete.

### C2. Turn the flag off in US as well (or confirm the exposed 2% are unaffected first, without delaying the switch-off)
- Owner: On-call SRE (executes), Release manager (approves).
- Do: same code, flag on for 2% of tenants, so the same defect may be silently present. In parallel, search US logs for `policy=""`, `delay_ms=0`, and `retry_budget_exhausted` since the release, by tenant.
- Verification signals: US logs show no empty-policy exhaustion after the switch-off; if any existed before, list the affected tenants for C5.
- Rollback and side effects: turning it off reverts those tenants to default exponential retry (their pre-release behaviour). Ask the Product owner whether any of the 2% cohort was enabled deliberately for a customer commitment, and inform them if so.

### C3. Freeze: keep the API rollback in place and block re-release of `2026.09.23.1` and any flag change for `tenant_retry_policy`
- Owner: Release manager.
- Verification signals: pipeline gate or flag lock is active; change calendar shows the freeze.
- Rollback considerations: confirm the rolled-back API version can read any data the new version wrote (for example tenant policy rows or config); the timeline does not say whether the release had schema or data changes. If it did, get the Database owner to confirm compatibility before any further rollback or roll-forward. Lift the freeze only when P0 is verified.

### C4. Return worker count to its pre-incident level in controlled steps, if still at 90
- Owner: On-call SRE (with Capacity owner).
- Do: check DB connection use first. Reduce in steps (for example 90 to 70 to 50 to 40) while watching job age.
- Verification signals: DB connections stay well under 300 (target under about 70% at peak); job age and queue depth stay flat through each step; no pool-wait warnings.
- Rollback: if job age rises after a step, go back up one step. Do not scale above the connection budget: scale-up during the incident coincided with the queue growing faster (correlation, but enough reason for caution).

### C5. Find and reconcile jobs affected by the incident window
- Owner: Backend engineering lead (with Support lead for customer-facing follow-up).
- Do: for eu-west 09:00-10:30 UTC (and US per C2), list every job that logged `retry_budget_exhausted`, its final state, and whether it touched a non-idempotent side effect (payment capture, email, webhooks). Check for duplicates and for jobs left in a non-terminal state.
- Verification signals: reconciliation report shows created jobs equal terminal-state jobs; zero unexplained non-terminal jobs; zero duplicate side effects, or a list of them.
- Rollback considerations: replays cannot be undone. Replay only with idempotency keys, run a dry-run first, and rate-limit replays so that they do not re-saturate the DB.

## 2. Corrective actions (prioritized)

### P0-1. Reproduce and confirm the mechanism
- Owner: Performance/reliability engineer with the Queue service engineer.
- Do: in a staging environment with production-like DB connection limits, enable the flag with a tenant that has a missing, empty, and invalid policy. Inject transient job failures. Record retry delay, exhaustion rate, and DB connection use. Also test whether retries acquire a connection per attempt.
- Verification signals: repro shows `policy=""`, `delay_ms=0`, exhaustion in tens of ms, and connection growth (confirms H1 and I3). If connection growth does not appear, the working hypothesis is wrong or incomplete, and the RCA must be reopened (see H2 and H4 in `INCIDENT.md`).
- Rollback: staging only. No production impact.

### P0-2. Fix policy resolution: never resolve to an empty policy
- Owner: Queue service engineering lead.
- Do: fall back to the configured default (`exponential`) when a tenant policy is missing, blank, or invalid. Validate tenant policies at load time and alert on invalid ones. Add tests for each config shape.
- Verification signals: tests pass; the P0-1 repro no longer shows empty policy or zero delay; staging run with the flag at 100% shows only non-zero delays.
- Rollback: ship the fix with the flag still off. If the fix itself misbehaves, revert the change; the flag stays off, so there is nothing else to unwind. Note that tenants who genuinely had a blank policy will now get the default; confirm none intended "no retry".

### P0-3. Add a retry floor and storm guard
- Owner: Queue service engineering lead.
- Do: enforce a minimum delay and jitter regardless of policy; when a job's budget is exhausted, requeue with backoff or dead-letter it instead of making it immediately available again; cap retry attempts per second per tenant.
- Verification signals: fault-injection test shows bounded retry rate and stable DB connections; production metric of exhausted-budget jobs per minute stays near zero.
- Rollback: make the floor and cap configuration values. If they delay legitimate work, tune the numbers rather than removing the guard.

### P0-4. Staged re-enablement plan with health gates
- Owner: Release manager with the Feature-flag platform owner.
- Do: re-enable only after P0-1 to P0-3 are verified. Sequence: internal tenants, then 2%, 10%, 50%, 100%, one region at a time (US first). Halt automatically on retry exhaustion, DB pool wait, or job-age thresholds.
- Verification signals: each stage has a soak period with clean metrics; the auto-halt has been tested with a synthetic bad flag.
- Rollback: a documented one-step kill switch for the flag, tested before stage one.

### P1-1. DB connection budget and isolation
- Owner: Database/platform reliability lead.
- Do: compute worst-case connections (pool size x workers x replicas, for API and workers) against the 300 limit at maximum autoscale; introduce per-client caps or a connection pooler; reserve headroom for the API so that worker trouble cannot starve job creation and checkout.
- Verification signals: worst-case calculation stays under about 80% of the limit; a load test at 90 workers keeps API connection acquisition healthy.
- Rollback: introduce the pooler or caps region by region (US first), keep the direct path available, and change pool sizes one pool at a time.

### P1-2. Detection: alert on causes as well as symptoms
- Owner: Observability lead.
- Do: alerts for DB connection use above 80%, `db pool wait exceeded`, `retry_budget_exhausted` rate, and "backlog growing while worker CPU falls". Annotate dashboards with flag and deploy events.
- Verification signals: replaying the incident's metrics (game-day or backfill) fires a cause-level alert within about 2 min of onset (the actual first alert took about 4 min and was symptom-only); the alert links to recent flag changes.
- Rollback: alerts can be muted or re-thresholded. Track noise for two weeks and tune.

### P1-3. Runbook and autoscaler guard for backlog incidents
- Owner: On-call lead / Incident process owner.
- Do: add to the queue-backlog runbook: check recent flag and config changes first; check DB connections and pool waits before scaling; if scale-up makes the queue worse, stop and revert the scale. Bound the autoscaler by the DB connection budget.
- Verification signals: tabletop exercise walks the incident and reaches the flag within 10 min; attempts to scale beyond the cap are refused or warned.
- Rollback: the cap is configuration and can be raised with an approval step.

### P1-4. Blameless post-incident review
- Owner: Engineering manager (facilitator), with representatives from Queue, SRE, Release, and Database.
- Do: reconcile the timeline (especially flag enable time), review decision points and the information responders had, and track actions to closure.
- Verification signals: review published, actions ticketed with owners and dates, and the P0/P1 items above are closed or scheduled.
- Rollback: not applicable.

### P2-1. Improve log content for retry and DB behaviour
- Owner: Queue service engineer.
- Do: include region, build version, flag state, resolved policy and its source (tenant versus default), the error that caused the first failure, DB pool acquire time, and job state after budget exhaustion in the retry logs.
- Verification signals: a game-day exercise can answer the "unknown" questions in `INCIDENT.md` section 7 from logs alone.
- Rollback: if log volume is a concern, sample at INFO but keep WARN and ERROR.

### P2-2. Separate risky behaviour changes from deploys
- Owner: Release engineering lead.
- Do: avoid enabling a flag for a large share of a region in the same window as its code deploy; require a recorded flag-enable step (time, scope, approver role) in the change log so the timeline can always answer "when was it turned on".
- Verification signals: change log contains flag events for the next release; incident reviews no longer list "flag enable time unknown".
- Rollback: process change only; revert by policy decision.
