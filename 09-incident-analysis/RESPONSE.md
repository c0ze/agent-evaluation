# Response — confidence and next data requests

## Confidence level

**Moderate-to-high (roughly 75–80%)** that the eu-west backlog was caused by a
zero-delay retry loop: the `tenant_retry_policy` rollout resolving to an empty
policy (`policy=""`), with the retry path treating that empty value as
`delay_ms=0` instead of falling back to `config_retry_default="exponential"`.

Confidence is not higher because:

- The evidence set is **13 log lines** and one timeline. There is no code, no
  configuration, and no full log export.
- The central mechanism is a **co-occurrence** (`policy=""` alongside
  `delay_ms=0`), not a demonstrated code path.
- Exactly **one affected tenant (`acme`) and one clean tenant (`beta`)** are
  named, so the affected population is unquantified.
- One observation, the **four minutes of normal processing after the 09:31
  restart**, is not fully explained by this account and may indicate an
  additional contributing mechanism.

What I hold with **higher** confidence:

- **It was not worker capacity.** CPU fell 65% → 18% while the queue grew, and
  scaling 40 → 90 made the queue rise faster. This is strong evidence against the
  capacity hypothesis and was the basis of a harmful mitigation.
- **The feature flag, not the API deploy alone, governed the ongoing behaviour.**
  The rollback at 09:24 fixed job creation but the backlog persisted for ~19
  minutes, and a worker starting at 09:31:10 (after the rollback, with
  `feature_flag=true`) still reproduced the fault.
- **Database pool exhaustion was an amplifier, not the trigger.** It appeared
  after the retry anomaly, no database errors appear in the logs, and the backlog
  cleared without any change to pool size.

What I hold with **low** confidence:

- Whether an underlying dependency problem (H4) contributed anything at all.
  Nothing in the evidence supports it beyond the bare fact that retries occurred.
- The `active=10 idle=0` with `wait_ms=5000` observation. This does not fit
  simple saturation at a 300 ceiling and is genuinely unexplained.

## Two pieces of data I would request next

**1. Complete worker and API logs for 08:55–10:30 UTC, including the resolved
`policy` value for every tenant, per-attempt `delay_ms`, and the terminal state
of every job that reached `retry_budget_exhausted`.**

This is the highest-value request because it directly tests the root-cause
hypothesis and closes the largest gaps at once. It would let me: confirm that
empty policy maps to zero delay rather than merely co-occurring with it;
enumerate which and how many tenants were affected; determine whether jobs were
dropped, dead-lettered, duplicated, or externally retried (currently unknown, and
the blocker on any customer-impact statement); and check whether the empty-policy
condition also occurred in the US 2% cohort, which is the only way to turn the
US/eu-west comparison from a suggestive anecdote into a real dose–response
signal.

**2. Per-pool database connection metrics for the same window — active, idle,
wait time, and acquisition failures, broken down by client (worker pools vs. API)
— together with the retry-policy configuration diff and flag-evaluation records
for the 09:02 deploy.**

The pool metrics would separate pool exhaustion from the retry loop, quantify how
much of the outage was amplification versus primary cause, and explain the
anomalous `active=10 idle=0` reading. The config and flag-evaluation records
would address the single most important remaining "why": whether the empty policy
came from a misconfiguration, a missing default, or a propagation failure. That
distinction determines whether the fix in B1 is sufficient or whether B4
(validation at rollout time) is the real control.

## Note on method

I have deliberately kept observed facts and inference in separate sections, and
have recorded the US region's lack of alerts as "no alert fired" rather than "no
impact," since a 2% exposure with no alerting on the mechanism does not establish
that the region was unaffected. I have not attributed the incident to any
individual; the contributing factors are properties of the system's defaults,
rollout controls, and alerting coverage.
