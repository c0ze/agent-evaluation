# Response

## Confidence

- **Overall: moderate.** I am fairly confident that the `tenant_retry_policy` flag path was needed for the sustained outage, and much less sure how it produced database connection exhaustion.
- **Higher confidence (facts that line up):** exhausted jobs show `policy=""` with `delay_ms=0` and 38-41 ms budgets; the same job (319) retried with a 1000 ms delay and succeeded within seconds of the flag going off; the API rollback and a worker restart did not clear the problem while the flag stayed on; recovery began within two minutes of the flag being disabled.
- **Lower confidence (inference):** that zero-backoff retries are what saturated the 300 DB connections; that the worker scale-up made it worse (it is correlated, not shown); and that the flag was the origin rather than an amplifier of an earlier failure. The logs are a 12-line sample, with only one worker and one job showing the before/after change and no control group. The unrelated-infrastructure and API-only-release hypotheses are weakened, not ruled out.

## Next two pieces of data I would request

1. **Flag audit and policy resolution data.** The change history for `tenant_retry_policy` in eu-west and US (when it was enabled, scope, percentage, and role of the approver), plus, per tenant, the resolved retry policy value and where it came from. This fixes the onset time against the 09:02 deploy and the 09:07 symptoms, shows why the policy was empty and for how many tenants, and gives a real dose-response comparison between eu-west and the US 2% cohort.
2. **Time-aligned DB and retry telemetry, 09:00-10:20 UTC, both regions.** Per-minute DB connections by client and pool (API versus workers), pool wait times, lock waits and idle-in-transaction counts, next to per-minute counts of retries, `delay_ms` distribution, and `retry_budget_exhausted` by policy value, and the error that caused the first failed attempt. This tests the weakest link (retries to connection exhaustion), shows which happened first (pool waits at 09:06:56 or the zero-delay retries), and shows who held the connections.
