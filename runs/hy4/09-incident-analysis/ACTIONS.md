# Actions — eu-west queue incident

Owners are **roles**, not individuals. Priorities: **P0** = containment/stop the
bleeding, **P1** = prevent recurrence on the critical path, **P2** = hardening
and detection. Each item carries a verification signal and rollback note.

## A. Immediate containment (already applied / to confirm)

| # | Action | Owner role | Verification signal | Rollback / safety |
|---|--------|-----------|--------------------|-------------------|
| C1 | Keep feature flag `tenant_retry_policy` **disabled** in all regions until the code fix ships and is verified. | On-call engineer / Incident commander | Flag state `false` in every region; `config_changed feature_flag=false` on workers; no new `policy=""` / `delay_ms=0` log lines; `retry_budget_exhausted` rate returns to baseline. | Re-enabling is the risky action — do it only via a staged rollout (P1.3), never globally. If disabling causes a regression, the prior state is recoverable but must be accompanied by a rollback of the retry behavior itself. |
| C2 | Confirm the backlog is fully drained and monitor for a second wave. | On-call engineer / SRE | Queue depth at baseline from 10:18 onward for a sustained observation window; job age and checkout latency alerts clear and stay clear. | If depth rises again, keep the flag off, re-scale workers down (C3) and escalate rather than re-enabling. |
| C3 | Return worker count from 90 toward the pre-incident 40 in a controlled step-down. | SRE / Capacity owner | DB connections comfortably below the 300 cap; no `db pool wait exceeded`; queue does not rise during step-down. | Scaling up again reproduced worse behavior (F7); step down gradually and stop if latency degrades. Reversible by scaling back up, but only after DB headroom is confirmed. |
| C4 | Do **not** rely on API rollback or worker restarts as the fix — both failed (F10, F11, F12). Record this in the runbook so the next responder goes to the flag first. | Incident commander / On-call engineer | Runbook updated; incident review includes this misdirection. | N/A (documentation). |

## B. Prioritized corrective actions

### P0 — Fix and prove the defect

| # | Action | Owner role | Verification signal | Rollback / safety |
|---|--------|-----------|--------------------|-------------------|
| P0.1 | Reproduce in staging: with `tenant_retry_policy=true` and a tenant lacking a policy, confirm logs show `policy=""` and `delay_ms=0`, and that retry budget is exhausted in tens of ms. Then confirm `false` yields `delay_ms=1000`. | Backend / Queue service owner | Staging logs reproduce exactly F2/F13 and F16/F17 on the same synthetic job; a failing test exists. | Staging-only; no production impact. If unreproducible, stop and re-open root-cause analysis — the current hypothesis would be weakened. |
| P0.2 | Code fix: when the flag is on but no tenant policy resolves (or it is empty/invalid), fall back to `config_retry_default="exponential"` and enforce a **non-zero minimum backoff** (e.g. reject/clamp `delay_ms=0`). | Backend / Queue service owner | Unit + integration tests cover: empty tenant policy, zero delay, invalid policy, exponential default applied; no `retry_budget_exhausted` in <1s for transient failures in staging. | Ship behind the existing flag (still `false`); guard with the new tests. If the fix misbehaves, roll back the release and keep the flag off — the flag disable is the independent safety net. |
| P0.3 | Add a **dead-letter / durable requeue** path for jobs that exhaust retries, so exhausted-budget jobs (81, 319) are never silently dropped. | Backend / Queue service owner | Exhausted jobs appear in a dead-letter queue and are replayable; end-to-end test confirms no silent loss and replay is idempotent. | Feature-flagged; replay must be idempotent (checkout jobs) to avoid double-charging on rollback/replay. Verify idempotency before enabling replay. |

### P1 — Control the rollout and protect shared capacity

| # | Action | Owner role | Verification signal | Rollback / safety |
|---|--------|-----------|--------------------|-------------------|
| P1.1 | **Staged/canary rollout** for the flag: 1% -> 5% -> 25% -> 100% per region, with automatic hold on the leading indicators (P2.1). The 2%-exposure US region had no alert (F19) — mirror that pattern deliberately. | Release manager / SRE | Each step holds for a defined soak window with `retry_budget_exhausted` rate, `delay_ms=0` count, DB connection count, and queue depth within thresholds; auto-disable on breach. | **Auto-disable of the flag is the rollback.** Keep it fast and independent of a code deploy; verify (as in F14/F15) that disabling propagates to workers within ~2 minutes. |
| P1.2 | **Isolate / cap DB connection usage** per worker pool and add backpressure so retry storms cannot consume all 300 shared slots. Review the 300 cap against real concurrency. | Database / Platform owner (SRE) | Load test: a simulated retry storm leaves headroom for API connections; no `remaining connection slots reserved` (F8) and no `db pool wait exceeded` (F4) for healthy traffic. | Tune caps via config with a documented prior value; revert to prior limits if latency regresses. Avoid raising pool size as the first fix — it can mask the problem and worsen contention. |
| P1.3 | **Add a capacity/contention guard to scaling**: worker auto-scaling must consult DB connection headroom, not just queue depth. Add a runbook note that scaling 40 -> 90 made the queue rise faster (F7). | SRE / Capacity owner | Scaling policy refuses to increase workers when DB connections exceed a threshold; game-day/drill demonstrates it. | Scaling policy config change is reversible; return to the prior policy if it causes under-provisioning. |

### P2 — Detection, observability, and process

| # | Action | Owner role | Verification signal | Rollback / safety |
|---|--------|-----------|--------------------|-------------------|
| P2.1 | **Cause-level alerts** (the biggest gap: alerts were on symptoms F6, not the cause): `retry_budget_exhausted` rate, count of `delay_ms=0` retries, empty/invalid `policy=""` resolution, and DB connection saturation — plus these as the canary hold metrics in P1.1. | Observability / SRE owner | Synthetic injection of a zero-backoff job fires a cause-level alert before job-age/checkout-latency alerts; measured detection-to-mitigation time improves. | Alert-threshold config only; tune to avoid paging fatigue. |
| P2.2 | **Structured config-change audit**: log every flag transition with timestamp, region, actor/role, and old/new value, and correlate with queue/DB metrics. Closes the gap behind the 09:43 flag-disable correlation (was it the flag, or a coincident change?). | Platform / Backend owner | Every `config_changed` event (F15) is queryable with before/after metrics; the 09:43 window can be reconstructed. | Logging-only; no runtime behavior change. |
| P2.3 | **Post-incident data reconciliation**: quantify dropped/dead-lettered/duplicated jobs and any checkout double-processing; identify affected tenants; confirm whether the 2%-exposure US tenants had silent impact. | Data / Support / Service owner | A report with counts of failed, replayed, and duplicated jobs and affected tenants; feeds the customer update and `RESPONSE.md` unknowns. | Read-only analysis; replay (if needed) gated by P0.3 idempotency verification. |
| P2.4 | **Update incident runbook**: for "queue depth up + worker CPU down + DB pool saturated", check `policy=""`/`delay_ms=0` and disable the tenant-retry flag **first**; note that rollback (F10) and restart (F11, F12) did not help. | Incident commander / SRE | Tabletop exercise: responders reach flag-disable as first mitigation. | Documentation; reversible. |

## Cross-cutting rollback considerations

- The **flag** is the fastest, most reliable rollback lever — proven at 09:43
  (recovery within two minutes). Every new change should be flag-gated so it can
  be undone without a deploy.
- A **code deploy rollback was insufficient** (F10): it fixed new job creation
  but left the backlog stuck, because the bad behavior came from live config read
  by workers (F12). Do not treat "rollback the deploy" as equivalent to "mitigated".
- **Worker restarts are not a rollback** for config-driven faults; restarted
  worker-51 re-read `feature_flag=true` and stalled again (F11-F13).
- Before any replay of failed/exhausted jobs, **verify idempotency** for checkout
  jobs to avoid duplicate charges; replay is harder to reverse than a flag flip.
- Sequence: containment (C1-C4) -> prove + fix in staging (P0) -> canary rollout
  (P1) -> detection hardening (P2). Do not re-enable the flag globally until P0.1,
  P0.2 and P1.1 verification signals all pass.
