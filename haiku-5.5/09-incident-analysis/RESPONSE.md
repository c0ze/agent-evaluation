# Response: confidence and next data requests

**Confidence: moderate.**

- **Moderate** that the flag-gated empty retry policy amplified the database
  saturation. Recovery followed the flag change, and the API rollback alone did not
  restore throughput.
- **Low** that this path initiated the incident, or that it is the only driver. The
  first failure that started the retries is not in the materials.
- **Low** for the explanation of the four-minute stall on the restarted pool.
- **Low** as evidence from the US comparison. Exposure differs, and load and alert
  coverage may differ too.

Per-job traces and connection attribution, requested below, would move this to high
or rule it out.

## Next data request 1: per-job traces for affected jobs

For job 81, job 319, and about 20 other jobs logged with `policy=""`:

- the policy value at enqueue (as written by the API);
- the policy value the worker read;
- the flag value at each attempt;
- the error on the first failed attempt;
- the requeue and attempt history.

This shows where the empty value comes from, what started the retries, and whether job
IDs are reused. It is the data that would test the open question of origin.

## Next data request 2: database connection attribution, 09:00 to 10:20

At one-minute resolution:

- connections grouped by worker pool and worker, and by state (active, idle,
  idle-in-transaction);
- each pool's configured maximum;
- fleet size over time.

This separates three explanations. A retry storm holding connections (H1) would show
connections held in active states that track retry volume. Accumulating leaks (H2)
would show connections rising per worker over time without matching retry volume.
A pure capacity ceiling (H3) would show the total reaching 300 with no retry or leak
signature.
