# Actions — eu-west queue stall incident

Owners are **roles**, not individuals. Priorities: containment first, then P1 (this week), then P2 (1–2 weeks).

## Immediate containment (0–24 h)

### C1. Verify and freeze `tenant_retry_policy` OFF in all regions/environments
- **Action:** Confirm flag state is 0% everywhere (eu-west, US, staging); place a change freeze on re-enabling it until fixes A1–A2 ship and are verified.
- **Owner:** On-call SRE, with the queue-service owner.
- **Verification:** Flag console shows 0% globally; zero new `retry_budget_exhausted policy=""` log lines; queue depth, job age, and checkout latency at baseline for 24 h.
- **Rollback considerations:** This *is* the rollback of the feature. Any future re-enable must go through a staged canary (A5) — never a broad flip — and must have a documented one-command kill switch.

### C2. Reconcile and reprocess jobs that exhausted their retry budget (09:07–09:43)
- **Action:** Count all `retry_budget_exhausted` events in the window (e.g., jobs 81, 319); match against completed/DLQ/requeued records; identify any dropped or duplicated work; reprocess what is missing.
- **Owner:** Queue-service engineering.
- **Verification:** Reconciliation report with zero unaccounted jobs; reprocessing completes with ~100% success; duplicate-side-effect checks pass (no double charges/shipments).
- **Rollback considerations:** Bulk replay must be idempotent and deduplicated; be ready to pause replay immediately on signs of double processing.

### C3. Quantify customer impact and notify affected tenants
- **Action:** Pull eu-west checkout success/failure/latency per tenant for 09:07–10:18; build the affected-tenant list; send the customer update (`CUSTOMER_UPDATE.md`) and follow up individually where jobs failed or were delayed.
- **Owner:** Incident commander with the support/comms lead.
- **Verification:** Impact numbers reconciled against alerting/metrics; notifications sent to all affected tenants; support ticket volume for the window triaged.
- **Rollback considerations:** None technical; if impact numbers change after deeper audit (C2), issue a prompt correction rather than leaving the first estimate standing.

### C4. Elevated monitoring for 48 h
- **Action:** Watch DB pool utilization, queue depth/age, worker CPU, retry rate and `delay_ms` distribution; add a temporary alert on any `policy=""` warning and on DB pool > 80% of cap.
- **Owner:** On-call SRE.
- **Verification:** Dashboards and thresholds live; no recurrence alerts in 48 h.
- **Rollback considerations:** None; remove temporary alerts after the review to avoid noise.

## Corrective actions — P1 (this week)

### A1. Safe default when tenant retry policy resolution is empty/invalid
- **Action:** In the policy resolution path, fall back to `config_retry_default` (exponential backoff with jitter) whenever a tenant policy is missing/empty/invalid; enforce a minimum retry delay (never 0 ms); emit a warning log + metric on every fallback.
- **Owner:** Worker/API service development lead.
- **Verification:** Unit/integration tests cover missing, empty, and malformed policies; a staging drill with a deliberately empty policy shows backoff behavior and no pool stress; `policy=""` warnings impossible in prod without an accompanying fallback metric.
- **Rollback considerations:** Ship as a normal deploy with a quick rollback path; behavior for *valid* policies must be unchanged — verify via tests/shadow traffic before rollout.

### A2. Retry-storm guardrails
- **Action:** Rate-limit retries per job and per tenant; add a circuit breaker on the `retry_budget_exhausted` rate (stop-and-alert instead of churning); cap requeue frequency for exhausted jobs.
- **Owner:** Queue-service engineering lead.
- **Verification:** Fault-injection load test (simulate empty policy): DB pool stays < 80%, queue keeps draining healthy tenants, breaker alert fires within ~1 minute.
- **Rollback considerations:** Guardrails behind their own flag; if a guardrail misfires and suppresses legitimate retries, disable that guardrail first — ensure defaults are fail-safe (fall back to prior behavior, not to zero delay).

### A3. Couple feature-flag state to release rollback
- **Action:** Tooling + runbook change: rolling back a release automatically disables (or explicitly prompts about) flags introduced or broadened by that release; incident rollback checklists must include flag kill switches.
- **Owner:** Release engineering lead.
- **Verification:** Rollback drill shows flag state reverted/prompted; updated runbook reviewed in the postmortem; measured diagnosis-to-recovery time improves in the next drill.
- **Rollback considerations:** Provide a logged override for cases where the flag is genuinely unrelated to the defect, so auto-revert cannot itself cause a second incident.

### A4. DB connection governance
- **Action:** Per-component connection budgets (worker pools vs reserved API slots) with admission control; alert at 80% of the 300 cap; bound worker autoscaling by available connection headroom; reassess whether 300 matches the DB server's real capacity.
- **Owner:** Platform database lead with SRE.
- **Verification:** Staging drill: worker spike no longer starves the API; alert fires before the cap; documented max worker count × pool size ≤ cap with margin.
- **Rollback considerations:** Raising the cap risks shifting saturation to the DB server — stage any change and watch DB CPU/latency; be prepared to revert the cap quickly.

## Corrective actions — P2 (1–2 weeks)

### A5. Consistent staged flag rollouts in every region
- **Action:** Enforce ramp policies (e.g., 2% → 10% → 50% → 100% with dwell time and alert-gated auto-rollback) for behavior-changing flags in **all** regions; review why eu-west got broad enablement while US sat at 2%.
- **Owner:** Feature-flag platform owner with the service owner.
- **Verification:** Flag tooling rejects region-skipping ramps for protected flags; eu-west rollout history reviewed and findings in the postmortem.
- **Rollback considerations:** Auto-rollback thresholds must be tuned/tested to avoid flapping; keep a manual override with audit logging.

### A6. Scaling runbook fix
- **Action:** Document the 09:14 lesson: do **not** scale workers out while DB pool waits are elevated or connections are near cap; check connection headroom first; prefer fixing throughput blockers over adding consumers.
- **Owner:** SRE lead.
- **Verification:** Runbook published; walked through in a game-day/tabletop exercise.
- **Rollback considerations:** None.

### A7. Observability for effective retry behavior
- **Action:** Sampled per-job logging of the *effective* policy (tenant, policy id, delay), dashboards for retry rate / `delay_ms` distribution / budget-exhaustion rate, alert on `delay_ms=0` patterns.
- **Owner:** Service owning team.
- **Verification:** Staging drill: an injected zero-delay retry pattern is visible on the dashboard and alerts within ~1 minute.
- **Rollback considerations:** Keep logging sampled to avoid cost/performance regression; sampling rate adjustable without deploy.

### A8. Blameless postmortem and action tracking
- **Action:** Run the postmortem within 5 business days; resolve the open questions listed in `INCIDENT.md` §6 (esp. why the policy resolved empty, and disposition of exhausted jobs); track every action here with owner and due date.
- **Owner:** Incident commander / engineering manager.
- **Verification:** Postmortem published and reviewed; action tracker populated; no action without an owner role and a verification signal.
- **Rollback considerations:** None.
