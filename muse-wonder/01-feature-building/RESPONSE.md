# Response — dependency-aware scheduler

## Design

`plan_jobs` in `jobqueue.py` (standard library only) works in three phases:

1. **Materialize & validate IDs** — the input iterable is copied with
   `list(jobs)` (so generators work and the caller's list is never touched).
   Each `Job.id` must be a non-empty string and unique; violations raise
   `ScheduleError` naming the position/value or the duplicated ID.
2. **Validate dependencies & build the graph** — each `depends_on` is copied
   to a new tuple. Every entry must be a non-empty string naming a supplied
   job, otherwise `ScheduleError` names both the job and the offending
   dependency. Duplicate entries within one `depends_on` are de-duplicated
   for indegree counting. Internal `dependents` adjacency lists and
   `indegree` counts are freshly built lists, so no input job or dependency
   tuple is mutated.
3. **Kahn topological sort with a priority heap** — jobs with indegree 0 are
   "ready" and pushed onto a `heapq` heap keyed by `(-priority, input_index)`,
   so the highest-priority ready job runs first and equal priorities keep
   original input order. Emitting a job decrements its dependents; newly
   ready jobs join the heap and compete by the same rule. If fewer than all
   jobs are emitted, the unscheduled IDs are reported in a `ScheduleError`
   as a dependency cycle (this set includes the cycle members, plus any jobs
   blocked behind them).

Empty input short-circuits to `[]`. Complexity is O((V + E) log V).

## Edge cases covered

Expanded `test_jobqueue.py` from 3 to 25 tests, keeping the original three:

- **Basics:** empty input, single job, chain, diamond, result contains every
  ID exactly once, generator input.
- **Ordering:** priority only among ready jobs (a blocked high-priority job
  waits), newly-ready jobs competing by priority against waiting jobs,
  equal-priority input-order tie-break, negative/zero priorities.
- **Validation:** duplicate ID, empty ID, non-string ID, unknown dependency
  (message names job and dependency), empty dependency entry, duplicated
  dependency entries tolerated.
- **Cycles:** self-dependency, 2-node cycle, 3-node cycle (messages include
  the involved IDs), cycle preceded by an acyclic job.
- **Non-mutation:** input list, job order, and `depends_on` tuples unchanged
  after both a successful run and a failing (cycle) run.

## Verification

Command (run inside this directory):

```
python3 -m unittest test_jobqueue -v
```

Result: **25 tests ran, all passed** (`OK`, exit code 0, ~0.001s).
