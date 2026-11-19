# Analysis Confidence and Next Data Requests

## Confidence Level

- **Overall Confidence: Medium-High (~75%)**
  - **High confidence (~90%) on the proximate trigger and mitigation path:** Observed logs directly link `feature_flag=true` + `policy=""` to immediate `delay_ms=0` retries (`job=81`, `job=319`), show that disabling `tenant_retry_policy` immediately restored `delay_ms=1000` backoff and allowed `job=319` to succeed (`09:43:07–10`), and align with recovery beginning within 2 minutes of the flag toggle (whereas API rollback alone left the backlog stuck). The math on worker scaling (`40 -> 90` workers with `active=10` local pool slots against a `300`-connection DB limit) also strongly explains why scaling worsened congestion.
  - **Lower confidence (~45%) on the exact low-level DB exhaustion mechanism and initial spark:** Available logs do not prove whether DB connection exhaustion (`300/300`) and the 4-minute stall after the `09:31` worker pool restart were caused purely by active retry-storm query/lock contention or also by a connection leak/unreleased transaction on the `policy=""` / `retry_budget_exhausted` path. They also do not show what error caused attempt 1 of `job=81` and `job=319` to fail originally.

---

## Next Two Pieces of Data Requested

1. **Database Connection and Wait-State Telemetry for `eu-west` (`09:00–10:20 UTC`)**
   - *Specifically:* Active connection counts broken down by client (`api` vs. `worker`), session states (`active`, `idle`, `idle in transaction`), lock waits, and top slow/failing queries around `09:06–09:36 UTC`.
   - *Why:* Distinguishes retry-driven query/lock contention from a connection/transaction leak, explains why the restarted worker pool (`09:31`) processed normally for 4 minutes before stalling, and shows whether an underlying DB error or lock triggered the initial attempt-1 retries.

2. **Code Diff for Release `2026.09.23.1` Plus Worker Retry-Policy / DB-Pool Implementation (and Regional Flag Rollout Config)**
   - *Specifically:* How `tenant_retry_policy` resolves empty/missing policies (`policy=""` -> `delay_ms=0` instead of `config_retry_default="exponential"`), how DB connections are checked out/released around retries and `retry_budget_exhausted`, what payload/query changes were reverted in the `09:24` API rollback, what happens to exhausted jobs (`requeued` vs. `DLQ` vs. `dropped`), and the exact `eu-west` flag rollout percentage.
   - *Why:* Converts log correlation into causal proof at the code level, confirms whether jobs like `job=81` need customer reconciliation/replay, and defines the exact P0 fix before re-enabling the flag.
