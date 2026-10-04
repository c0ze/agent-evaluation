# ACTIONS.md — Corrective actions

Owners are **roles**, not individuals. Priorities are by risk reduction per unit of
effort, not by effort alone. Every action carries a verification signal that is
observable without the author's judgement, and a rollback note — a corrective action
that cannot be independently reverted is itself a new risk.

Derived from `INCIDENT.md`. Root cause accepted at the level of *chain*, not *specific
defect*, so every fix below must hold regardless of which of H5's two readings is
correct.

---

## Part 1 — Immediate containment (state at end of incident)

The incident is closed out: backlog cleared at 10:18. These are the containment
positions to hold while Part 2 lands.

| # | Containment action | Role | Status |
|---|---|---|---|
| C1 | Keep `tenant_retry_policy` **disabled** in all regions. Do not re-enable until P0-1 and P0-3 are verified in a canary. | Release engineering | In effect since 09:43 — hold |
| C2 | Pin the queue service to release `2026.09.23.1`-pre retry code. Verify no tenant anywhere still has the flag on, including eu-west stragglers. | Queue service backend | Verify, do not assume |
| C3 | Freeze deploys and worker-count changes to the queue service until the P0s are complete. | SRE on-call lead | New |
| C4 | Return eu-west worker count to the pre-incident 40 until the connection-budget change (P1-1) lands, and confirm the queue is stable at that count. | SRE on-call lead | New |
| C5 | Publish the incident to the on-call channel with a pointer to `INCIDENT.md`, and state explicitly that the 09:24 rollback was **not** an effective mitigation. | Incident commander | New |

**C2 caveat:** the 09:24 API rollback left the system broken for 19 minutes, so a
rollback alone is not evidence of a reverted state. C2 requires a *positive* check
(resolved policy non-empty, backoff non-zero on a synthetic retry), not a version
number.

---

## Part 2 — Prioritized corrective actions

### P0 — before any re-enablement

---

**P0-1 · Make an unresolved retry policy fall back to the safe default, never to zero backoff**

- **Action:** in the tenant retry-policy path, treat "policy not found / empty /
  unparseable" as a resolution *failure* and apply `config_retry_default` (already
  `exponential` and demonstrably correct in production at 09:31:10). Never allow a
  resolved policy to yield `delay_ms=0`. Add a hard floor on first-retry backoff
  independent of any policy value.
- **Owner:** Queue service backend
- **Verification signal:** unit test asserting that a tenant with no policy entry
  resolves to `exponential` with `delay_ms >= floor`; staging run with the flag on
  for a synthetic tenant produces `delay_ms > 0` on first retry; metric
  `retry_resolve_fallback_total` increments instead of the policy silently resolving
  empty.
- **Rollback:** single revertible commit; the feature flag remains an independent
  kill switch, so reverting the code while the flag is off is a no-op. Must be
  reverted alone, never bundled with another change.

---

**P0-2 · Enforce a global retry ceiling and a circuit breaker on the DB path**

- **Action:** cap retry attempts globally and per tenant so no tenant's failure
  pattern can monopolize shared connections. Add a breaker that trips on pool-wait
  pressure. Make `retry_budget_exhausted` actually *stop* the loop — dead-letter or
  park the job, and record the disposition.
- **Owner:** Platform reliability, with Queue service backend
- **Verification signal:** fault-injection in staging — a tenant whose jobs fail 100%
  of the time — leaves eu-wide retry rate under the configured ceiling, DB pool wait
  p99 below threshold, and healthy tenants' p99 checkout latency unchanged. Dead-letter
  counts are non-zero and match injected failures.
- **Rollback:** thresholds are config-driven behind a flag; revert to the previous
  threshold set without a deploy. Verify the previous values are still known-good —
  do not rely on "git revert the whole service".

---

**P0-3 · Validate retry configuration at load time and refuse to start on an invalid value**

- **Action:** schema-validate the tenant policy map at worker startup. Reject or
  explicitly fall back on empty values, and log loudly rather than accepting `""`.
  A worker should never start in a state where its own policy is empty.
- **Owner:** Configuration / config-management, with Queue service backend
- **Verification signal:** staging worker started with an empty policy entry either
  refuses startup or starts on the documented default *and* increments
  `retry_policy_empty_total`; no worker in staging or production ever logs
  `policy=""` again.
- **Rollback:** validation strictness is toggleable; keep the toggle and its current
  value documented. Note the failure mode to avoid — making validation so strict that
  a malformed unrelated entry blocks all workers, which converts a degraded queue
  into a stopped one.

---

**P0-4 · Audit job outcomes from the incident window**

- **Action:** determine the final disposition of every job processed 09:07–10:18:
  succeeded, permanently failed, dead-lettered, dropped, duplicated, or executed
  more than once. Reconcile against checkout and payment totals. Contact affected
  customers; remediate duplicate or failed charges.
- **Owner:** Support engineering, with Data engineering
- **Verification signal:** audit returns a count per disposition class for the
  window; checkout and payment totals reconcile against the job ledger; a named
  owner confirms customer contact was made for every discrepancy found.
- **Rollback:** none needed — read-only analysis plus customer remediation. If the
  audit is inconclusive, record that explicitly rather than assuming no impact.
- **Note:** this is P0 despite being non-technical, because the inputs contain *no*
  evidence about job disposition, and permanent job failure is the failure mode that
  would actually hurt a customer.

---

### P1 — before restoring full traffic

**P1-1 · Make worker count and DB connection budget one coordinated setting**
- Worker pool sizing, per-worker pool size, and the global 300-connection cap must be
  derived from a single documented budget. worker-22 showed pool-wait exhaustion at
  `active=10 idle=0` while global usage was far from 300, so the worker-local budget
  is the binding constraint and is currently undocumented.
- **Owner:** Database / platform
- **Verification signal:** load test at the 90-worker configuration keeps global
  connection usage below the cap with stated headroom and pool-wait p99 under 100 ms;
  a written "max safe workers" number exists in the runbook.
- **Rollback:** the ratio is config-driven; restore the prior ratio independently.
  Reduce rather than remove workers, and watch the queue while doing it.

**P1-2 · Require a canary and an automated rollback gate for flag-gated releases**
- Flags default off. No region or tenant cohort reaches full exposure without a
  canary step. Automated rollback triggers on retry rate, empty-policy resolution,
  and pool wait.
- **Owner:** Release engineering
- **Verification signal:** a deliberately faulty retry policy in staging triggers
  automatic rollback within the configured window; the us-east 2% pattern is
  documented as the standard rollout shape.
- **Rollback:** rollback the *gate policy* only if it blocks a legitimate deploy —
  never by disabling the gate and the canary simultaneously.

**P1-3 · Fix the rollback surface so a deploy revert also reverts flag-gated worker config**
- The 09:24 rollback consumed time without recovering service. Rollback procedures
  must enumerate every component touched by a release, including flag and worker
  config, and must not report "reverted" until a behavioural check passes.
- **Owner:** Release engineering, with Queue service backend
- **Verification signal:** a rollback drill in staging reverts both the binary and
  flag-gated config, and verification asserts non-zero backoff rather than a version
  string.
- **Rollback:** n/a — this changes the rollback procedure itself.

**P1-4 · Fix the runbook's first move for queue/backlog incidents**
- Remove "scale workers" as a default first action. Add a diagnostic gate: check
  retry rate and pool wait *before* scaling. Scaling is correct for a
  capacity-bound backlog and actively harmful against a shared-resource bottleneck,
  which is what happened at 09:14.
- **Owner:** SRE on-call lead / incident management
- **Verification signal:** runbook reviewed and signed off; the next DB-bound
  incident timeline shows a diagnostic step before any scaling decision.
- **Rollback:** n/a — documentation.

**P1-5 · Add the missing signals and alert on the causal metric, not the symptom**
- Instrument per-tenant retry attempt rate, resolved-policy value as a metric
  dimension, pool-wait histogram, connection-acquisition rate, and dead-letter
  counts. Alert on empty-policy resolution and on per-tenant retry rate.
- **Owner:** Observability / SRE
- **Verification signal:** a game day reproduces the empty-policy condition and the
  new alerts fire within 2 minutes — versus the observed 4-minute gap before a
  symptom alert, and a signal that was never alerted at all.
- **Rollback:** disable or re-threshold individual alerts; avoid a big-bang
  dashboard change that removes existing symptom alerts before the new ones exist.

---

### P2 — durability

**P2-1 · Enforce a maximum per-region flag exposure ceiling**
- No region reaches 100% exposure on a retry or queue-affecting flag without an
  explicit, reviewed exception. Audit all regions' current percentages.
- **Owner:** Platform
- **Verification signal:** a config report shows no region above the ceiling without
  a recorded exception.
- **Rollback:** n/a — reporting.

**P2-2 · Add a failure-path integration test for retry behaviour**
- Simulate a failing job under the flag on and assert pacing, attempt cap, and
  disposition. Block release on this test.
- **Owner:** Queue service backend
- **Verification signal:** the test fails against `2026.09.23.1` and passes against the
  fixed build. *(This is the regression test that would have caught the incident at
  09:02.)*
- **Rollback:** n/a — test-only.

**P2-3 · Review and ratify the postmortem**
- Walk `INCIDENT.md` with on-call, service, and database owners; capture corrections
  to the unknown list in Part 4 before the next release trains on it.
- **Owner:** Incident commander
- **Verification signal:** postmortem signed off by all three functions; the eight
  open unknowns are each marked resolved or explicitly accepted.
- **Rollback:** n/a.

---

## Part 3 — Sequencing and interlock

- **P0-1, P0-2, P0-3 must all land before the flag is re-enabled anywhere**, even at
  the 2% canary level. P0-1 alone stops the storm; P0-2 alone bounds the blast radius
  if something else recurs; P0-3 alone prevents a recurrence at load time. Any one
  of them re-enabled alone leaves a known hole.
- **P0-4 runs in parallel and is not gated** by the engineering fixes. It should not
  wait behind them — it is the item with direct customer consequences.
- **Re-enablement order:** eu-west at 2% → hold through one peak → 25% → hold → 100%,
  with P1-5's alerts live and a named owner watching each step. Do not re-enable in
  us-east and eu-west simultaneously; the us-east cohort is what made the 2% pattern
  survivable the first time, and that evidence should not be spent twice in one step.
- **Do not bundle corrective actions.** Several of these touch the same worker
  config path; bundling them makes the 09:24 rollback failure mode — an unverifiable
  state after a partial revert — more likely to repeat.
