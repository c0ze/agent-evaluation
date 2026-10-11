# Task 01 — Feature building: dependency-aware scheduler

## Design

`plan_jobs` in `jobqueue.py` validates the input, then schedules with Kahn's
algorithm over a heap:

1. **Validation** — every `Job.id` must be a non-empty string and unique;
   every entry in `depends_on` must name a supplied job. Violations raise
   `ScheduleError` with a message naming the offending ID(s) and index.
2. **Scheduling** — a ready-queue is implemented as a min-heap keyed by
   `(-priority, input_index, id)`. Popping the heap always yields the
   currently ready job with the highest priority, breaking ties by original
   input order. When a job completes, each dependent's remaining-dependency
   count is decremented and newly ready jobs are pushed with their own
   priority, so they compete fairly with jobs that were already waiting.
3. **Cycle detection** — if the loop finishes with fewer jobs emitted than
   supplied, the unprocessed jobs are exactly those on or downstream of a
   cycle; their IDs are collected and reported in the `ScheduleError`
   message.
4. **Purity** — the input iterable is only read (copied into a list);
   dependency counts and the dependents map are built fresh, so neither the
   jobs nor their `depends_on` tuples are mutated. Empty input returns `[]`.

Only the Python standard library is used (`heapq`, `dataclasses`, `typing`).

## Edge cases covered by tests (22 total)

- Empty input, single job, any iterable (not just lists)
- Dependencies override priority; ready jobs ordered by priority then input
  order; equal priorities keep input order; negative priorities
- Newly unblocked jobs re-compete by priority against already-ready jobs
- Every job returned exactly once (length + uniqueness check)
- Diamond dependency shape
- Duplicate dependency entries on the same job
- Rejection: empty ID, non-string ID, duplicate IDs (message names the ID),
  unknown dependency (message names the missing ID)
- Cycles: self-loop, two-node, three-node; error message lists exactly the
  cyclic IDs and excludes uninvolved jobs
- Input immutability (snapshot of all job fields before/after)
- Large chain (500 jobs) for scale sanity

## Verification

Command:

```
python3 -m unittest test_jobqueue -v
```

Result: `Ran 22 tests in 0.009s` — `OK` (all 22 tests pass).
