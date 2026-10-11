# Actions: eu-west job backlog and checkout latency

**Status note.** The timeline records the backlog as cleared at 10:18 UTC. The
containment items below confirm and hold the mitigations in place. The corrective
actions prevent recurrence. Owners are roles, not individuals. Each item has a
verification signal and a rollback consideration.

## Immediate containment

**C1. Keep `tenant_retry_policy` off in every region and on every worker pool.**
- Owner: on-call SRE (incident lead)
- Verify: flag readback is `false` on all pools. Over the next 60 minutes there are no
  `policy=""` lines, no `delay_ms=0` retries, and no `config_changed feature_flag=true`
  events. The timeline records no re-enable, but it does not rule one out.
- Rollback: none needed for containment. Re-enabling waits for P1 items A1 to A4.

**C2. Keep API `2026.09.23.1` rolled back. Block re-deployment until A1 is in place.**
- Owner: release manager
- Verify: running version is the rolled-back build. Newly created jobs carry a
  non-empty policy.
- Rollback: none. Re-deploy only with the A1 fix and the flag off.

**C3. Check worker count against the database connection ceiling.** If the fleet is
still at 90 workers, or at a count the limit does not allow, reduce it to a level with
headroom.
- Owner: DB reliability engineer, with platform on-call
- Verify: peak connection use stays below about 80% of the 300 limit. No
  connection-slot errors appear in API logs.
- Rollback: scale back up in steps once connection use stays under the threshold.
  Scaling down slows the drain of any remaining backlog, so watch job age while it
  is applied.

**C4. Find jobs with an empty retry policy** that were created or queued between 09:02
and 10:18, and any still queued.
- Owner: queue platform team lead
- Verify: the count of empty-policy records is zero. Sampled jobs show a non-zero
  backoff delay.
- Rollback: snapshot records before any change. Backfill only with a logged change
  set so each row can be reversed. Restore from the snapshot if the backfill is wrong.

**C5. Do not restart worker pools until the flag is confirmed off for that pool.**
- Owner: on-call SRE
- Verify: the pool's startup log shows `feature_flag=false` before it takes jobs.
- Rollback: none needed.

## Corrective actions (prioritized)

### P1: required before the flag is turned on again

**A1. Fall back to the default retry policy when a tenant policy is missing or empty.**
Reject empty values at write time in the API. Log and count each fallback.
- Owner: API service owner, with queue platform team
- Verify: unit tests cover missing, empty, and whitespace-only policies. Replaying the
  09:02 to 09:43 job mix in staging produces no `delay_ms=0` retries. In production,
  retries with `delay_ms=0` stay at zero unless a zero policy is explicitly configured.
- Rollback: revert the commit. Keep the flag off in the meantime. The fix must work
  without the flag being on.

**A2. Add retry guardrails in the worker:** a minimum backoff floor, jitter, a
time-bounded retry budget, and a cap on retries per job per window.
- Owner: queue platform team lead
- Verify: a load test with forced failures keeps the retry rate bounded and database
  connection use flat. No job exceeds the per-window retry cap.
- Rollback: the floor and cap are configuration values. Removing them restores the
  storm risk, so do not roll back without the A1 fix in place. Tune them instead.

**A3. Enforce a connection budget.** The sum of pool maximums across the worker fleet
must fit under the database limit minus a reserve. Add a pooler or per-pool caps.
Make the scale-up path check the budget.
- Owner: DB reliability engineer and platform lead
- Verify: the budget is documented per region. The scale-up path warns or blocks when
  the sum exceeds the budget. A test at 90 workers stays within the cap.
- Rollback: caps can be raised temporarily after a database capacity review. Stage any
  pooler change in a non-production environment first.

**A4. Stage risky flags and add a kill switch with automatic holds.** Use exposure steps
(for example 1%, 5%, 25%, 100%). Hold automatically when job age, retry rate, or
database connection use crosses a threshold.
- Owner: release engineering lead, with the flag's feature owner
- Verify: a staging drill with injected faults stops the rollout at a hold. The flag
  change log records exposure per region. The flag change reaches all pools within an
  agreed time.
- Rollback: the flag is the rollback. Confirm it takes effect on every pool.

### P2: detection and response

**B1. Add alerts for retry rate, zero-delay retries, empty-policy count, and database
connection utilization** (warn at about 80%). Apply the same signals to every region, so
a region with low exposure still alerts.
- Owner: observability owner (SRE)
- Verify: synthetic fault injection in staging fires each alert. A replay of this
  incident fires them before the connection limit is reached.
- Rollback: thresholds can be tuned. Do not disable alerts to reduce noise without a
  review.

**B2. Update the queue backlog runbook.** Check feature flags and retry configuration
first. Do not restart pools until flags are confirmed. Add a scaling checklist that
includes the connection budget.
- Owner: on-call lead
- Verify: a tabletop exercise walks through this incident's sequence against the new
  runbook.
- Rollback: documentation only. The previous version remains in history.

**B3. Record flag changes and scaling events with timestamp and region.**
- Owner: platform lead
- Verify: the next drill or incident has flag and scale timestamps in the audit log.
- Rollback: none needed.

### P3: verify the analysis

**V1. Review the US region for 09:00 to 10:20:** queue age, retry counts, and database
connections. Confirm whether the 2% exposure caused any hidden backlog.
- Owner: SRE for the US region
- Verify: a documented result, using the same metrics as eu-west.

**V2. Pull per-job traces and database connection attribution** (see `RESPONSE.md`) to
confirm or reject H1 and H2 in `INCIDENT.md`.
- Owner: incident analyst, with queue platform team
- Verify: the findings are recorded as an update to `INCIDENT.md`.

**V3. Quantify customer impact:** delayed and failed jobs, affected tenants, and failed
or slowed checkouts.
- Owner: support operations lead, with data analytics
- Verify: impact counts reconcile with queue and checkout data.

**V4. Explain the four-minute stall on the restarted pool and the attempt reset on job
319** (requeue or reused ID).
- Owner: queue platform team
- Verify: explained from queue record history.
