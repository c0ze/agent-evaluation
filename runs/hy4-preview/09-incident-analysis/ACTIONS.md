# Actions — eu-west queue backlog

Owners are expressed as **roles**, not individuals. Every item states how success
is verified and how it can be backed out. Actions are ordered by priority, not by
team.

---

## A. Immediate containment (do first / already in progress)

### A1. Keep `tenant_retry_policy` disabled in eu-west
- **Owner:** Release / Feature-flag owner, with On-call engineer.
- **Why:** This is the only intervention observed to restore normal retry
  behaviour (`delay_ms=0` → `delay_ms=1000`, job success within 2 minutes).
- **Verification:** Per-tenant retry delay is ≥ the configured backoff floor;
  `retry_budget_exhausted` rate returns to pre-09:07 baseline; queue depth
  monotonically decreasing; worker CPU returning toward 65%.
- **Rollback:** Re-enabling would recreate the fault. If it must be re-enabled for
  a specific tenant, re-enable for a single non-production or consenting tenant
  only, with the delay floor from B2 already shipped.

### A2. Confirm the API rollback is complete and consistent across all api instances
- **Owner:** Release engineer.
- **Why:** Job creation normalized at 09:24, but the backlog persisted; confirm no
  instance was missed so the two control surfaces (deploy, flag) do not diverge.
- **Verification:** All api hosts report `2026.09.23.1` absent; no new jobs
  enqueued with an empty `policy` value.
- **Rollback:** Redeploy the previous release channel. Note that rolling *forward*
  to `2026.09.23.1` without B1/B2 will reintroduce the fault.

### A3. Stop scaling workers as a response to this incident
- **Owner:** On-call engineer.
- **Why:** 40 → 90 made queue depth rise faster by adding connection contention.
- **Verification:** Worker count at or below the pre-incident 40 while the backlog
  drains, then scaled back up only after A1 is confirmed effective and pool
  headroom is verified.
- **Rollback:** Not applicable; this is a "stop doing the harmful thing" action.

### A4. Drain the backlog without amplifying retries
- **Owner:** On-call engineer + Queue service owner.
- **Why:** Backlog jobs already carry the bad retry state; draining them at full
  concurrency risks re-triggering pool exhaustion.
- **Verification:** Backlog depth decreasing with DB connections staying below the
  300 ceiling and pool wait time under the alert threshold.
- **Rollback:** Reduce drain concurrency to zero; the queue is durable, so pausing
  is safe.

### A5. Preserve evidence
- **Owner:** On-call engineer.
- **Why:** Analysis rests on 13 log lines and one timeline. Log rotation may
  destroy the rest.
- **Verification:** Full worker, API, and database pool logs for 08:55–10:30 UTC
  exported to durable storage before rotation.
- **Rollback:** Not applicable.

---

## B. Corrective — P0 (before the flag is ever re-enabled)

### B1. Make an empty or unresolvable tenant policy fall back to the configured default
- **Owner:** Queue service owner (with code reviewer).
- **Why:** `policy=""` produced `delay_ms=0` while
  `config_retry_default="exponential"` was available and unused.
- **Verification:** Unit test asserting that `policy=""`, unknown tenant, and
  missing-config all yield the default exponential schedule; integration test
  reproducing `job=81` (three attempts, empty policy) now shows non-zero
  increasing delays.
- **Rollback:** Feature-flagged code change; revert via standard deploy rollback.
  Note the flag *cannot* be used as the rollback here, since flag-on was the
  faulty path.

### B2. Enforce a minimum retry delay (backoff floor)
- **Owner:** Queue service owner.
- **Why:** A retry budget consumed in 41 ms provides no protection. A floor makes
  the failure mode structurally impossible regardless of policy content.
- **Verification:** No retry with `delay_ms` below the floor is observable in logs
  or metrics; alerting on any observed violation.
- **Rollback:** Config-only change; revert the floor value. Keep the floor in place
  during any subsequent retry-policy rollout.

### B3. Add alerting on retry-budget exhaustion and zero-delay retries
- **Owner:** Observability owner.
- **Why:** The fault was visible in logs at 09:06:58 but alerts only fired at
  09:11 for downstream symptoms, ~4 minutes later, and nothing alerted on the
  mechanism.
- **Verification:** Synthetic injection of an empty-policy job raises the alert
  within one minute and pages the queue service owner.
- **Rollback:** Silence or delete the alert rule; no production behaviour change.

### B4. Validate tenant policy resolution at rollout time
- **Owner:** Release engineer + Config owner.
- **Why:** Whether the empty policy came from misconfiguration, a missing default,
  or a propagation failure is still unknown (see unknowns 1 and 2).
- **Verification:** A pre-rollout check enumerates every tenant and fails closed if
  any resolves to empty or unresolvable.
- **Rollback:** Abort the rollout; the check is a gate, not a mutation.

---

## C. Corrective — P1 (blast radius and amplification)

### C1. Decouple worker concurrency from the shared database connection pool
- **Owner:** Platform / Database owner, with Queue service owner.
- **Why:** Scaling 40 → 90 workers drove connections to the 300 ceiling; pool
  pressure then blocked the API. One component's retry behaviour should not
  exhaust a shared resource.
- **Verification:** Load test at 2× current worker count shows DB connections
  staying within a configured per-pool budget and API connection acquisition
  unaffected.
- **Rollback:** Revert pool allocation config. This change should be staged
  (separate pool or a concurrency limiter) rather than a hard cutover.

### C2. Investigate the `active=10 idle=0` with 5-second wait observation
- **Owner:** Database owner.
- **Why:** Ten active connections alongside 5-second waits does not fit simple
  saturation at a 300 limit, and may indicate leaked, orphaned, or long-held
  connections.
- **Verification:** Written finding explaining the observation, or a fix with a
  before/after comparison of pool wait time at fixed concurrency.
- **Rollback:** Diagnostic action; any resulting fix follows normal rollback.

### C3. Add per-tenant retry rate limiting
- **Owner:** Queue service owner.
- **Why:** The US region at 2% exposure did not alert while eu-west did, showing
  exposure fraction is the real blast-radius lever. A per-tenant cap contains even
  an unknown future policy defect to a small share of traffic.
- **Verification:** Load test: a single tenant generating pathological retries
  cannot reduce another tenant's successful throughput.
- **Rollback:** Config-only; raise or remove the cap.

### C4. Make region and tenant exposure an explicit first-class rollout control
- **Owner:** Release engineer + Feature-flag owner.
- **Why:** The same release behaved differently in two regions purely because of
  flag exposure, which was discovered only after the fact.
- **Verification:** Any retry-policy rollout records its exposure percentage per
  region in the change record and is staged 1% → 10% → 50% → 100% with a defined
  abort threshold at each step.
- **Rollback:** Set exposure to 0.

---

## D. Corrective — P2 (process and detection)

### D1. Add a runbook entry: "queue growing while worker CPU falls"
- **Owner:** On-call engineer + Queue service owner.
- **Why:** The signature is inverted from normal capacity pressure and led to the
  harmful scale-up at 09:14.
- **Verification:** Runbook merged and referenced from the job-age alert; a tabletop
  exercise shows the responder checks retry-delay metrics before scaling.
- **Rollback:** Documentation only.

### D2. Capture terminal job state for retry-exhausted jobs
- **Owner:** Queue service owner + Observability owner.
- **Why:** Whether jobs were dropped, dead-lettered, duplicated, or externally
  retried is currently unknown, which blocks any customer-impact statement.
- **Verification:** Every job reaching retry-budget exhaustion emits a terminal
  state event; the disposition of `job=81` and `job=319` can be reconstructed
  retroactively or is confirmed unrecoverable.
- **Rollback:** Logging/metric change; disable the emitter.

### D3. Post-incident review
- **Owner:** Incident commander.
- **Why:** Multiple contributing factors (missing fallback, no backoff floor,
  coupled rollout controls, delayed detection) warrant a blameless review.
- **Verification:** Review held, actions B1–C4 assigned with dates.
- **Rollback:** Not applicable.

---

## Cross-cutting notes

- **Do not re-enable `tenant_retry_policy` anywhere** until B1, B2, B3, and B4 are
  complete and verified. The US region's 2% exposure is not evidence of safety —
  we do not know whether the empty-policy condition occurred there.
- **Ordering constraint:** C1 (pool decoupling) should land before any future
  increase in worker concurrency, otherwise worker scaling remains an amplifier.
- **Sequencing risk:** B1 and B2 both touch retry timing. Ship them as separate
  changes so that if recovery regresses, the cause is attributable.
