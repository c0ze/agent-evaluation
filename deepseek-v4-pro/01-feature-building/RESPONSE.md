# Task 01 — Feature building: dependency-aware scheduler

## Design

`plan_jobs` implements a deterministic topological sort via Kahn's algorithm,
driven by a min-heap to respect the priority/input-order contract:

1. **Input snapshot**: the iterable is copied to a list so the supplied jobs and
   their `depends_on` lists are never mutated.
2. **Validation**:
   - every `Job.id` must be a non-empty `str` and unique, else `ScheduleError`;
   - every dependency must name a supplied job, else `ScheduleError` with the
     offending job and dependency in the message.
3. **Graph construction**: builds `dependents` adjacency and `indegree` counts.
4. **Scheduling**: a heap of ready jobs keyed by `(-priority, input_index, id)`
   yields higher priority first, with ties broken by original input order. When a
   job completes, its dependents' indegree drops; newly ready jobs are pushed.
5. **Cycle detection**: if fewer jobs are emitted than supplied, the remaining
   positive-indegree IDs are collected and reported in the `ScheduleError`.

## Edge cases covered

- Dependencies override priority.
- Priority then input order among ready jobs (including negative priorities).
- Newly-ready jobs ordered by priority.
- Multiple dependencies and transitive chains.
- Direct two-node, longer, and self-dependency cycles (IDs included in message).
- Unknown dependency rejection.
- Duplicate, empty, and non-string job IDs rejected.
- Empty input returns `[]`.
- Input (jobs and dependency lists) is not mutated.

## Verification

Command:

```
python -m unittest -v test_jobqueue.py
```

Result:

```
Ran 15 tests in 0.003s

OK
```
