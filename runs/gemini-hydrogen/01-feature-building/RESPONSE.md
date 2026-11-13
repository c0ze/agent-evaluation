# Task 01 Summary — Dependency-Aware Job Scheduler

## Design

`plan_jobs` in `jobqueue.py` uses only the Python standard library (`dataclasses`, `heapq`, `math`, `typing`) and implements a two-phase validation and priority-aware Kahn's topological sort:

1. **Non-mutating validation & indexing (`_validate_and_index_jobs`)**:
   - Materializes `jobs` once via `list(jobs)` so any `Iterable[Job]` (including generators) is supported without mutating caller containers.
   - Verifies each item is a `Job` with a unique, non-empty `str` `id`, a valid real numeric `priority` (excluding `bool` and `NaN`), and an iterable `depends_on` (rejecting bare `str`/`bytes`, `None`, non-iterables, or empty/non-string dependency IDs) with `ScheduleError`.
   - Deduplicates per-job dependencies via `dict.fromkeys`-style dict insertion while preserving order and leaving `job.depends_on` untouched.
   - Verifies every dependency names a supplied job ID in a second pass so forward references work cleanly.
2. **Priority-aware topological scheduling (`plan_jobs`)**:
   - Returns `[]` immediately for empty input.
   - Builds `in_degree` counts and a `dependents` adjacency list keyed by `job.id` (never hashing `Job` or `Job.payload`).
   - Maintains ready jobs (`in_degree == 0`) in a `heapq` min-heap keyed by `(-job.priority, input_index, job.id)` so higher-priority ready jobs always execute first and equal priorities break deterministically by original input order.
3. **Iterative cycle detection (`_find_cycle`)**:
   - If `len(order) != len(job_list)`, runs an iterative three-state DFS over the unscheduled subgraph (`remaining`) following `depends_on` edges, avoiding Python recursion limits on deep chains.
   - Slices the active path from the repeated vertex to extract an exact cycle (`a -> b -> ... -> a`) and raises `ScheduleError` excluding upstream/downstream non-cycle jobs.

## Edge Cases Covered (`test_jobqueue.py`)

- Empty inputs (`[]`, `()`, empty generator) and single-job / generator inputs.
- Dependency precedence over higher-priority blocked jobs, diamond/fan-in dependencies, and dynamic priority preemption upon unblocking.
- Equal-priority tie-breaking by original input order both initially and after dynamic unblocking.
- Negative, zero, and floating-point priorities.
- Duplicate dependencies on a single job treated idempotently.
- Strict non-mutation of input lists, mutable `list` `depends_on` values, and unhashable mutable `payload` dicts.
- `ScheduleError` diagnostics for empty/non-string/duplicate `Job.id`, unknown dependencies, invalid `depends_on` containers/elements, non-`Job` items, non-iterable `jobs`, and invalid priorities (`None`, `str`, `bool`, `NaN`).
- Self-dependencies, 2-node and 3-node cycles (verifying non-cycle upstream/downstream jobs are excluded from the cycle trace), and 2,500-node acyclic and cyclic chains beyond Python's default recursion limit.

## Verification

Command:

```bash
python3 -m unittest discover -s 01-feature-building -t 01-feature-building -v
```

Result:

- `Ran 18 tests in 0.025s` — `OK` (all 18 tests passed).
