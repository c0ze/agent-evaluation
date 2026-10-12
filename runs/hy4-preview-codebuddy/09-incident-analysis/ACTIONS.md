# Corrective actions — eu-west queue backlog, 2026-09-23

Owners are expressed as **roles**, not individuals. Every action carries a
verification signal (how we know it worked) and rollback considerations.

## 1. Immediate containment (already done / keep in place)

| # | Action | Owner role | Verification signal | Rollback consideration |
| --- | --- | --- | --- | --- |
| C1 | Keep `tenant_retry_policy` **disabled** in all regions until the policy-resolution defect is fixed and verified. | On-call engineer (SRE) + Feature flag owner | Flag state = false everywhere; `delay_ms` > 0 on retry lines; queue depth trending to zero | Already the safe state. Re-enabling is the risky direction — requires staged rollout (see A2) |
| C2 | Confirm backlog is drained and job age SLO is met in eu-west. | Queue service owner | Job age back within SLO; backlog depth ≈ 0; checkout latency alerts cleared | None — monitor only |
| C3 | Reconcile job outcomes: enumerate every job that hit `retry_budget_exhausted` during 09:02–09:45 and identify dropped vs. dead-lettered vs. re-queued. | Queue service owner + Data/on-call engineer | Complete list with per-job final state; zero unexplained jobs; affected customers notified if any work was lost | Replay from dead-letter queue; replaying must be idempotent — verify no duplicate side effects before doing so |
| C4 | Freeze further rollouts of `2026.09.23.1` (and any retry-related change) in all regions. | Release manager | No rollout in progress; deploy queue shows the release blocked | N/A |
| C5 | Preserve evidence: export worker logs, DB connection metrics, and flag-change audit records for 09:00–10:30 before any log rotation. | Observability owner | Archived dataset exists and is queryable | N/A |

## 2. Prioritized corrective actions

### P1 — Fix the defect (this week)

| # | Action | Owner role | Verification signal | Rollback consideration |
| --- | --- | --- | --- | --- |
| A1 | Make empty/unresolvable tenant retry policies fall back to the configured default (`config_retry_default="exponential"`) and reject `delay_ms=0` as invalid; add a validation error (not a silent empty string) at policy-resolution time. | Queue service owner | Unit + integration tests: `policy=""` → default exponential backoff; zero-delay rejected with an explicit error; staging replay of the acme case shows `delay_ms` ≥ 1000 | Behind the existing flag; disable flag to revert instantly. Flag-off path must be exercised in staging before any re-enable |
| A2 | Add a worker-side retry-rate guardrail: minimum retry delay and a per-tenant cap on retries per minute, independent of tenant config. | Queue service owner | Load test with a deliberately hostile policy (delay 0) shows rate capped and no pool saturation | Guardrail default must match current healthy behaviour; ship disabled-by-default behind its own flag, then enable |
| A3 | Add alerting on policy resolution failures (`policy=""`, unknown tenant policy) and on retry-delay < configured minimum. | Observability owner | Alert fires in staging when a bad policy is injected | Alert-only; safe to remove rules if noisy |

### P2 — Remove the blast radius (this sprint)

| # | Action | Owner role | Verification signal | Rollback consideration |
| --- | --- | --- | --- | --- |
| A4 | Isolate the shared DB connection pool: per-tenant (or per-pool-class) connection quotas so one tenant's retry amplification cannot starve all others. | Database owner (DBRE) + Queue service owner | Chaos test: one tenant saturating its quota leaves other tenants' throughput unchanged | Quota changes can throttle healthy traffic — stage with generous limits first, then tighten |
| A5 | Alert on connection-pool saturation at a leading threshold (e.g. 80% of 300) with the top connection holders identified, well before hard exhaustion. | Database owner (DBRE) + Observability owner | Alert fires in a load test before pool exhaustion; runbook links to holder attribution | Threshold tuning may cause noise; start conservative |
| A6 | Make rollback complete by definition: any rollback or flag-disable procedure must enumerate and revert all coupled state (code, config, flags, cached policy). Add a post-rollback verification step that asserts behaviour, not just version. | Release manager + Platform owner | Runbook updated; drill shows a rollback restoring both version *and* behaviour within SLO | Runbook change only; the drill itself must run in staging |
| A7 | Require automatic staged flag rollout (small % → metric gate → ramp) with an automatic kill switch, for any change affecting retry, rate, or connection behaviour. | Feature flag owner + Release manager | A simulated regression at 1% exposure trips the gate and auto-disables in staging | Auto-disable could halt a healthy rollout; require manual override documented |

### P3 — Detect and diagnose faster (this quarter)

| # | Action | Owner role | Verification signal | Rollback consideration |
| --- | --- | --- | --- | --- |
| A8 | Alert on the "stalled worker" signature itself: queue depth rising **while** worker CPU/throughput falls. This fires earlier than job-age alerts did (09:07 vs 09:11). | Observability owner + Queue service owner | Alert reproduces against the recorded 09:07–09:11 data | Alert-only |
| A9 | Capture worker wait-event / stack-sample telemetry so that "why is the worker idle" is answerable from data next time. | Queue service owner |Idle-worker dashboards show blocking reason (connection wait vs lock vs sleep) | Sampling overhead — enable at low rate, monitor worker overhead |
| A10 | Add per-tenant throughput, retry-rate, and job-age dashboards so a 2%-exposure rollout produces a measurable signal. | Observability owner | Per-tenant metrics visible for a staging tenant at 1% traffic | Metrics-only |
| A11 | Update the incident response runbook: when scaling workers makes the queue worse, stop scaling and look for a shared-resource bottleneck. | On-call engineer (SRE) lead | Runbook section merged; reviewed in the incident retro | Doc change only |

## 3. Cross-cutting rollback considerations

- **The flag is the fastest lever.** `tenant_retry_policy` off restored correct
  behaviour in seconds; keep this kill switch available and document it as the
  first response for any retry-behaviour regression.
- **Rollback ≠ revert.** This incident's defining lesson: the code rollback was
  correct and complete, and still did not restore service, because behaviour was
  config/flag-driven. Every future rollback needs a behavioural assertion
  (A6), not just a version check.
- **Re-enabling the flag is the risky step.** Sequence: fix (A1) → guardrail
  (A2) → observability (A3, A8) → staged rollout with auto-kill (A7) → 1% in
  one region → metric gate → ramp.
- **Connection-pool changes (A4) can throttle healthy traffic**, so ship quotas
  with generous initial limits and tighten with data.
- **Any replay of affected jobs (C3) must be idempotency-checked first**; a
  replay that double-executes side effects would be worse than the original
  delay.

## 4. Exit criteria for closing this incident

1. Backlog cleared and job-age SLO met in all regions (met at 10:18 for
   eu-west — confirm sustained).
2. Every `retry_budget_exhausted` job accounted for, with customer
   notification if any work was lost.
3. A1, A2, A3 merged and verified in staging.
4. Post-rollback behavioural verification (A6) exercised in a drill.
