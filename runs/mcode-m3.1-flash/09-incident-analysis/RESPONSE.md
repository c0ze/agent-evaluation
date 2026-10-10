# RESPONSE.md

## Confidence

Overall: **moderate-to-high for the causal chain, low for the specific defect.**

The evidence base is two files totalling roughly 30 lines. That is enough to
reconstruct *what happened* with reasonable confidence, and not enough to pin the
*specific code or config defect*. I have split the confidence deliberately rather
than giving a single number, because the two halves are genuinely different in
strength.

**High confidence (directly observed, or falsified by a failed test):**

- An unresolved retry policy produced zero backoff. `policy=""` with `delay_ms=0` on
  all three attempts, and the same worker/job pair flipping to `delay_ms=1000` two
  seconds after the flag was disabled. This is the closest thing to a controlled
  comparison available.
- Disabling `tenant_retry_policy` ended the incident; the backlog drained in 35
  minutes.
- The retry storm preceded the queue growth, not the other way round: 09:06:58 vs 09:07.
- The API binary was not the whole cause. Its 09:24 rollback failed to recover
  service for 19 minutes. This is a real falsification, not a correlation.
- Corrupted worker state is ruled out. A freshly restarted pool worked normally for
  four minutes, then reproduced the identical `policy=""` failure with a *correct*
  `config_retry_default="exponential"`. Note what that simultaneously proves: the
  default was healthy, so the fault is in the tenant-specific override path.
- A runaway CPU loop is ruled out. CPU fell 65% → 18%; workers were blocked on I/O.
- Workers were starving before the API was (09:07:01 vs 09:19:52), and pure database
  capacity is ruled out as root cause — the 300-connection cap was not reached until
  13 minutes after degradation began.

**Moderate confidence (inference, plausible, not proven):**

- That zero-delay retries consumed connections *by rate* rather than through a
  connection leak on the failure path. Both produce the same symptoms; the inputs
  contain no connection-lifecycle data at all. This is the weakest load-bearing link
  in the chain and the reason I request metric data below.
- That the 40 → 90 scale-up amplified rather than caused the incident. Cause is
  cleanly excluded on timing. Amplification is likely but confounded: queue depth is
  (arrival rate − service rate), so faster growth could partly reflect rising arrivals.
- That us-east saw no impact because exposure was 2%. I would only claim the weaker
  statement: **no alert fired there, which is not evidence of no impact.** 2%
  exposure may simply sit under the alert threshold.

**Low confidence / unresolved:**

- Whether the fault is a code defect or a bad config value (H5). The two readings
  predict identical evidence so far and I am explicitly not claiming the code is at
  fault over the configuration.
- The trigger condition. First failure came ~5 min after deploy, and ~4 min after a
  worker restart. Something recurring provokes it, and I do not know what.
- Customer impact magnitude, and whether any job failed permanently, was dropped, or
  ran twice. Entirely absent from the inputs. I have not assumed "no data loss" —
  absence of evidence here is not evidence of absence.
- Whether the "new job creation normalizes" at 09:24 was caused by the rollback or
  coincided with it. Single region, no control.

**Bounded by data access:** this analysis is based only on `TIMELINE.md` and
`LOGS.txt`. No external systems, logs, metrics, or configuration were consulted, and
the logs are a 13-line sample, not a complete record — absence of a signal in this
sample is weak evidence about the system.

---

## The next two pieces of data I would request

**1. The tenant retry-policy resolver diff for `2026.09.23.1`, together with the
per-tenant policy map as it actually stood at 09:02.**

Specifically: the diff of the policy resolution path, and the config store's version
history showing the full map contents at deploy time — including the entry for tenant
`acme` and at least one tenant with no entry, plus the `beta` tenant for contrast
against the one logged success at 09:07:03.

*Why this is first:* it is the only request that can resolve H5, which is the
difference between a code fix and a config fix. It distinguishes a missing map entry,
a tenant-key mismatch, a parse failure, and an error swallowed into an empty string —
and it tells me whether the defect is reachable for any tenant or only for tenants
with partial configuration. It also directly tests whether the tenant boundary
(`acme` failing while `beta` succeeded) is load-bearing or coincidental. Nothing else
in my analysis can substitute for it, and most of the P0 actions in `ACTIONS.md`
change shape depending on the answer.

**2. A 09:00–10:20 UTC time series for both eu-west and us-east: per-tenant retry
attempt rate, database connection acquisition rate and hold duration, per-worker pool
size against the global connection gauge, and the pool-wait histogram.**

*Why this is second:* it is the only way to close the weakest link in the chain —
whether connections were exhausted by retry *rate* or by a *leak*. It resolves the
puzzle that worker-22 reported `pool wait exceeded` at `active=10 idle=0` while the
global cap of 300 was still 13 minutes away, which implies a worker-local constraint
that is currently undocumented. It quantifies what the 40 → 90 scale-up actually added
on top of the existing load, and comparing against us-east at 2% exposure is the only
control available to test whether eu-west behaved differently for reasons other than
exposure. It also gives the missing impact numbers — affected tenant count, retry
volume, and how much of the delay each job absorbed — which is what a defensible
customer-facing impact statement requires.

Between them, these two would move the specific defect from low confidence to
high, and would let me put a real number on the affected population instead of an
unquantified region.
