# Response: incident analysis

## Confidence

**Medium-high** that the retry-policy code behind `tenant_retry_policy` triggered the incident. **Low-medium** on exactly how it stalled the workers.

- **Trigger (medium-high).** The logs show `policy=""` and `delay_ms=0` while the flag was on. Right after the flag was turned off, the same job on the same worker, with no restart, retried at a 1000 ms delay and succeeded. The API rollback and the worker restart did not fix the problem while the flag stayed on. Together, these point strongly to the code the flag controls. It is still an association in time, from a small sample of logs, and not a controlled test.
- **Mechanism (low-medium).** I infer that an empty policy skips the default and causes immediate retries, which saturate DB connections. Nothing in the data shows why workers sat blocked with low CPU instead of spinning. Nor does it show how retries that give up after about 40 ms kept connections tied up. The per-worker pool size of about 10 is inferred from a single log line.
- **Contributing factors (medium).** Scaling workers from 40 to 90 made the connection pressure worse. It could not have started the incident, because the queue was already rising. The US "no alert" point is weak and confounded evidence.

Facts are kept separate from inference throughout `INCIDENT.md`, and the unknowns are listed there.

## Next two pieces of data I would request

1. **Database connections broken down by client and state, 09:00–10:20 UTC, for eu-west.** For example, `pg_stat_activity` snapshots: application or host, state (active / idle / idle in transaction), wait events and locks. Pair this with per-worker pool metrics (active, idle, waiting).
   - This tests the weakest link: whether workers were holding connections on the `retry_budget_exhausted` path (a leak or open transactions) or just competing for them.
   - It also shows why connections were released when the flag was turned off.

2. **The code change to retry-policy resolution in `2026.09.23.1`, the flag targeting rules, and the tenant retry-policy records for eu-west and the US.** Specifically: which tenants had the flag on, and which resolved to an empty policy.
   - This confirms or refutes the inference that `""` bypasses the default.
   - It shows how many tenants were exposed in each region.
   - It tests whether the US 2% cohort included any tenants with an empty policy, which is currently confounded evidence.

## Deliverables

- `INCIDENT.md`: impact, timeline, root-cause hypotheses with evidence for and against, contributing factors, and unknowns.
- `ACTIONS.md`: containment steps and prioritized corrective actions, each with an owner role, a verification signal and rollback considerations.
- `CUSTOMER_UPDATE.md`: a plain-language update under 180 words, with no blame and no claims beyond the evidence.
- `RESPONSE.md`: this file.
