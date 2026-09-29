# Response — Task 01: dependency-aware scheduler

## Design

`plan_jobs` in `jobqueue.py` validates input, then runs Kahn's topological
sort with a priority queue over the currently-ready set:

1. Materialize the iterable (accepts generators); `[]` returns `[]`.
2. Validate: each item is a `Job`, each `id` is a unique non-empty string,
   each dependency names a supplied job — else `ScheduleError` with the
   offending id(s).
3. Build indegree counts (deduplicated deps) and a dependents map; copies are
   made into new lists, so inputs are never mutated.
4. Repeatedly pop the ready job with highest `priority`, ties broken by
   original input index, via a `heapq` keyed `(-priority, index, id)`.
5. If output is short, the unprocessed jobs are stuck in a cycle; raise
   `ScheduleError` listing their sorted ids.

Stdlib only (`heapq`). Complexity O((V+E) log V).

## Edge cases covered (added to `test_jobqueue.py`)

Original 3 tests kept. Added `PlanJobsEdgeCases` (12 tests): empty input,
duplicate ids, empty id, non-string id, self-dependency cycle (id in message),
two-node cycle (both ids in message), diamond ordering, priority applying only
among ready jobs, equal-priority input-order stability, non-mutation of jobs
and dependency tuples, generator input, duplicate dependency entries.

## Verification

Command (run inside this directory):

    python3 -m unittest test_jobqueue -v

Result: 15 tests ran, OK (3 original + 12 new), exit code 0.
