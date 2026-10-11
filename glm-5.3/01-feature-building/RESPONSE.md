# Task 01 — Response: dependency-aware scheduler

## Design

`plan_jobs` in `jobqueue.py` is implemented with stdlib only (`heapq`,
`dataclasses`, `typing`) in three phases:

1. **Validation.** The input iterable is materialized into a private list
   (never mutating the caller's collection). Each item's `id` must be a
   non-empty string and unique; duplicates and malformed ids raise
   `ScheduleError` with the offending id and index. Dependencies must be
   strings naming supplied jobs; unknown or non-string dependencies raise
   `ScheduleError` naming both the dependent job and the bad dependency.
   Duplicate entries in a single `depends_on` are de-duplicated so a job
   still becomes ready (indegrees count unique dependencies). Non-iterable
   `jobs` / `depends_on` values are also converted to `ScheduleError`.
2. **Scheduling.** Kahn's algorithm with a `(-priority, index)` min-heap.
   Only currently-ready jobs enter the heap, so the pop order is exactly
   "highest priority first, ties broken by original input order", while
   dependencies always precede dependents. Complexity is
   O(V + E log V).
3. **Cycle detection.** If scheduling stalls with jobs left over, a walk
   through the unscheduled subgraph follows unscheduled dependencies until
   it revisits a node, yielding a concrete cycle for the diagnostic, e.g.
   `dependency cycle detected: a -> b -> a (2 job(s) unschedulable)`. Self
   dependencies are caught by the same path.

No job, `depends_on` list, or input iterable is ever mutated (the module
only reads them), and empty input returns `[]`.

## Edge cases covered in `test_jobqueue.py`

Empty input (list/tuple/generator), single job, 500-node chain, diamond
dependencies, priorities applied at readiness time (late-arriving
high-priority job jumps ahead of an already-ready low-priority one),
input-order tie-breaks, negative priorities, interleaving of disconnected
components, dependency order beating priority, duplicate ids, empty and
non-string ids, non-`Job` items, non-iterable input, unknown dependency
message content, non-string dependencies, duplicate dependencies counted
once, self-cycle, two-node cycle, cycle with blocked downstream jobs (IDs
in message), non-mutation of jobs/`depends_on`/input order, determinism
across repeated calls, generator input, payload ignored, a realistic
fetch→lint/test→package→deploy pipeline, and 50 seeded random DAGs checked
with a generic topological-invariant helper.

## Verification

Command (run inside `01-feature-building/`):

```
python3 -m unittest -v test_jobqueue
```

Result:

```
Ran 29 tests in 0.055s

OK
```

(Also verified with `python3 -m py_compile jobqueue.py test_jobqueue.py`.)