# Corrective and containment actions

Roles used as owners: **Incident lead** (on-call IC), **Service owner (API)**, **Service owner (worker runtime)**, **Release engineering**, **SRE / observability**, **Database owner**, **Support / customer ops**.

Time to implement and verification signals assume the system is currently in a recovered state (backlog cleared 10:18 UTC). Every action should be re-validated against current state before execution.

## A. Immediate containment (now)

| # | Action | Owner | Verification signal | Rollback / risk |
|---|---|---|---|---|
| A1 | Keep `tenant_retry_policy` **disabled globally** and confirm the flag state from an independent source (config store / API), not just from a worker's self-reported state. | Incident lead | Flag endpoint reports `off` in all regions; no new `retry_budget_exhausted` or `delay_ms=0` entries for 30 min | Disabling the flag disables the feature entirely; intended behaviour for the tenant-specific policy is off until A2/P1 lands |
| A2 | Freeze `api 2026.09.23.1` or any related rollout — no re-deploy, no config push touching the retry path — until the empty-policy defect is understood. | Release engineering | No builds promoted for the retry path; release dashboard shows freeze | None (blocks delivery); revert by lifting the freeze once P1-1 is merged |
| A3 | Confirm retry behaviour on **every** worker pool and both regions: effective policy non-empty and delay_ms > 0 in real traffic. Fire a one-off query over the last hour. | Service owner (worker runtime) | Zero records with `policy=""` and zero with `delay_ms=0`; delays within expected exponential range | None (read-only) |
| A4 | Return worker count toward the pre-incident baseline of 40 **only if** DB pool utilisation is comfortably below cap and the queue is draining. Do not scale up on rising queue depth while pool contention is present. | Incident lead | Queue depth and DB pool active/idle stable or improving after each increment; no pool-wait warnings | Scaling down too fast lengthens drain time — step down in increments and revert an increment if drain stalls |
| A5 | Preserve evidence: worker and API logs, config-store history and flag audit for 09:00–10:30 UTC, plus DB metrics for the window. | Incident lead | Snapshots stored and reads covered 09:00–10:30 UTC | None |
| A6 | Open a data-integrity check for the window: identify jobs whose retry attempts could have run twice and whether their side effects are idempotent. | Service owner (worker runtime) + Support / customer ops | Reconciled count of duplicate executions; explicit "no impact" or a list of affected records | None (read-only) |

## B. Prioritized corrective actions

### P1 — Fix the defect (highest priority)

**P1-1. Make an empty or unreadable tenant policy fall back to the default exponential policy, and add a validation layer that treats `delay_ms=0` on a user-facing retry as invalid.**
- Owner: Service owner (worker runtime), with Service owner (API) for the policy source.
- Verification signals: unit tests (`empty policy` → default exponential, `missing policy` → default exponential, malformed policy → logged + default); a synthetic job for a tenant with no policy configured shows `delay_ms >= base`; `delay_ms=0` occurrences = 0 in production; a new `policy_fallback_applied` counter/meter is visible and tracked.
- Rollback: guard the whole change behind the existing `tenant_retry_policy` flag; if the fix misbehaves, the kill switch is a flag disable (proven at 09:43).
- Evidence basis: `policy=""` with `delay_ms=0` at 09:06:58 and 09:35:12, versus `delay_ms=1000` after the flag was disabled.

**P1-2. Alert on the real failure signal, not the downstream symptom.**
- Owner: SRE / observability.
- Verification signals: alert fires within 60 s on a synthetic `delay_ms=0` or empty-policy event; alert fires on a sustained `retry_budget_exhausted` rate per worker; alerts confirmed routed to on-call.
- Verification that it would have caught this incident: replay the 09:06:58 log line against the rule and confirm a page.
- Rollback: alerts only — no runtime behaviour changes.

**P1-3. Stage flag rollouts instead of switching all tenants at once.**
- Owner: Release engineering.
- Verification signals: rollout limited to a small tenant percentage with automatic comparison of queue depth, job age and retry rate against control before promotion; the rollout halts on breach; the flag kill switch is exercised in a game-day.
- Rollback: kill switch per cohort; the 2% US exposure is the evidence that limited exposure contained impact.
- Note: the exact percentage that would have kept eu-west quiet is unknown; start conservative and expand on evidence, not on a schedule.

### P2 — Make the failure mode survivable

**P2-1. Add a retry-storm brake: per-tenant and global retry-rate caps, jitter/bounded backoff, and concurrency limits for retries versus first attempts.**
- Owner: Service owner (worker runtime).
- Verification signals: load test showing sustained retry volume while DB pool utilisation stays under target; retry queue has an explicit bound with dropped-and-logged (not silent) behaviour.
- Rollback: flag-gated, graduated limits that can be relaxed or disabled.

**P2-2. Give the database connection pool protection and better isolation.**
- Owner: Database owner.
- Verification signals: pool saturation no longer reaches 100% under retry load; critical paths (checkout/job intake) keep a reserved share; pool wait times stay under a defined SLO under the same load; `remaining connection slots reserved` does not recur.
- Rollback: pool-size and reservation changes are config-only and reversible; capacity headroom should be sized from measured load, not from the 09:20 event alone (peak was 300 by definition, which is a ceiling not a measurement of need).

**P2-3. Fix the operational response path.**
- Owner: Incident lead (runbook), Release engineering (tooling).
- Verification signals: a runbook entry stating that rising queue depth plus falling worker CPU plus DB pool pressure means *contention, not capacity* — so do not scale out and do not rely on a deploy rollback to disable a flag; a triage decision tree includes "list recently changed flags/config" as an early step; a game-day run of this scenario shows the flag check happening within ~10 minutes of first alert.
- Rollback: documentation and tooling only.

**P2-4. Per-tenant policy dashboards and config provenance.**
- Owner: SRE / observability.
- Verification signals: for each tenant you can see the resolved policy, its source, and last change time; mismatch between default and resolved policy is visible; a config write is attributable to a change/rollout.

### P3 — Process and follow-through

**P3-1. Blameless postmortem** with a written timeline, including why the 09:14 scale-up and the 09:24 rollback were chosen and what information would have led to the flag check sooner.
- Owner: Incident lead. Verification: review held, actions assigned with owners and dates inside 5 working days.

**P3-2. Customer-facing remediation decision** based on the A6 duplicate-execution reconciliation.
- Owner: Support / customer ops with Service owner. Verification: affected tenants contacted if impact is confirmed; no unexplained silent impact.

**P3-3. Review other feature-flag-gated config paths** for the same "empty value silently becomes aggressive behaviour" pattern.
- Owner: Service owner (API) and Service owner (worker runtime). Verification: a list of flag-gated config paths audited, each with a test for the missing-value case.

## C. Sequencing

1. A1–A6 immediately (read-only or flag-only; cheapest and fastest risk reduction).
2. P1-1 and P1-2 next — the defect fix and the alert that would have paged ~09:07 instead of 09:43.
3. P1-3 and P2-1/P2-2 as the durability layer; P2-3/P2-4 to shorten future diagnosis.
4. P3 after the postmortem, once impact scope is known.

## D. Cross-cutting caution

The provided evidence shows the tenant retry policy feature to be the trigger, but it does **not** identify the precise code or configuration defect, nor does it quantify user impact. Actions that change capacity (P2-1, P2-2) or retry behaviour (P1-1, P2-1) should therefore be validated with a targeted load test reproducing zero-delay retry volume before they are relied upon, rather than assuming the fix addresses every contributing factor.
