# Corrective actions

Owners are roles, not people. "Verification signal" = observable evidence the action worked. Note: actions are informed by the analysis in `INCIDENT.md`; the root cause is a leading hypothesis, not proven.

## Immediate containment (already taken / to confirm)
1. **Disable `tenant_retry_policy` everywhere (not just the affected pool).** Owner: **On-call / Incident Commander**. Status: observed at 09:43; recovery began within ~2 min. Verify: `policy` no longer empty, retries show non-zero `delay_ms` (e.g., 1000), job age and queue depth falling. Rollback consideration: this restores prior retry behavior; it is the known-good state — no further rollback needed. Confirm the flag is off in *all* regions/pools, including any not alerting.
2. **Keep the API rollback in place until worker-side config is confirmed clean.** Owner: **On-call / Incident Commander**. Verify: new job creation remains normal and no `db remaining connection slots reserved` errors. Rollback consideration: re-deploying `2026.09.23.1` while the worker config issue persists would reintroduce the failure.
3. **Protect the database connection pool.** Owner: **On-call / DB platform role**. If still near 300, consider temporarily lowering per-worker concurrency or shedding non-critical jobs. Verify: active connections below ceiling, `db pool wait exceeded` warnings stop. Rollback consideration: reducing workers risks slower backlog drain once retries are fixed — reverse as recovery confirms; do NOT scale workers up as a mitigation, since scaling was observed to accelerate queue growth.
4. **Preserve evidence before further changes** (logs, flag states, job traces for affected tenants). Owner: **Incident Commander / SRE**. Verify: artifacts captured with timestamps. Rollback consideration: none.

## Prioritized corrective actions

### P0 — Prevent recurrence of the empty-policy retry loop
5. **Add fail-safe validation: an empty/unknown retry policy must fall back to a safe default (exponential with jitter) and emit a warning, never a zero-delay retry.** Owner: **Worker/queue engineering role**. Verification: unit + integration tests show `policy=""` → non-zero backoff; a staged canary with the flag on produces no `delay_ms=0` storms. Rollback consideration: feature-flag the fix and keep the current kill switch; revert via flag if backoff change causes throughput regression.

### P1 — Make containment and detection reliable
6. **Make the kill switch global and enforce consistent flag state across API and workers; add a config-drift check that fails closed.** Owner: **Platform/config engineering role**. Verification: audit shows single source of truth; an intentional drift in staging triggers an alert and jobs continue with safe defaults. Rollback consideration: fail-closed could cause temporary job pauses on config errors — scope carefully and roll out behind a flag.
7. **Add alerts on the leading indicators, not just the lagging ones:** zero-delay retry rate, `retry_budget_exhausted` rate, empty-policy occurrences, DB pool saturation, and worker CPU divergence. Owner: **SRE / Observability role**. Verification: a synthetic retry storm in staging fires these alerts before queue depth/job-age alerts. Rollback consideration: tune thresholds to avoid paging storms; no code rollback needed for alert rules.
8. **Isolate DB connection budgets** so a worker retry storm cannot starve customer-facing checkout (separate pools or strict per-pool caps). Owner: **DB platform + API engineering role**. Verification: load test showing saturated worker pool does not raise checkout latency. Rollback consideration: pool changes can shift capacity — stage and monitor; revert config if checkout throughput drops.

### P2 — Verify and harden
9. **Confirm no data loss or duplicate side effects** from the 3-attempt retries (e.g., job=81, job=319); add idempotency keys where missing. Owner: **Service owner role + QA role**. Verification: reconciliation of affected jobs shows no double processing; idempotency tests pass. Rollback consideration: idempotency changes are additive; roll back via flag if incompatible with existing consumers.
10. **Root-cause the config resolution path** that produced `policy=""` despite `config_retry_default="exponential"`, and why US's 2% cohort was unaffected. Owner: **Worker/queue engineering role**. Verification: reproduction in staging with a minimal tenant config, documented mechanism. Rollback consideration: none (investigation).
11. **Post-incident review and runbook update**, including: do not scale workers as a first response to a retry storm; verify rollback covers all components. Owner: **Incident Commander role**. Verification: runbook updated and reviewed; drill executed. Rollback consideration: none.

## Cross-cutting rollback guidance
- Prefer flag toggles over code re-deploys for rapid reversal; the 09:43 flag disable was the action that actually correlated with recovery.
- Any fix that changes retry timing should be canaried (US at 2% is a natural low-risk cohort) before global rollout.
- Reversing the API rollback or re-enabling the flag should only occur after P0 fail-safe validation is deployed and verified.
