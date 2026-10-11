# Task 01 — Feature building: dependency-aware scheduler

## Design

`plan_jobs(jobs)` (in `jobqueue.py`) is a priority-driven topological sort, implemented
with the standard library only (`collections.abc`, `dataclasses`, `heapq`, `numbers`,
`typing`). It runs in three phases:

1. **Validate and index (single pass over the input).** Each job is checked for a
   non-empty string `id`, uniqueness of that id, and a numeric `priority`
   (`numbers.Real`, excluding `bool`). `depends_on` is accepted as any iterable of
   strings (a bare string is rejected rather than iterated character by character),
   is copied into a private tuple, and is de-duplicated while preserving order.
   Nothing in the input is written to, so caller-owned lists are never reordered or
   mutated and the original `Job` objects (frozen dataclass) stay untouched.
2. **Build the graph.** A `dependents` adjacency map (dependency -> jobs waiting on
   it) is built once; while doing so, any dependency that is not in the set of
   supplied ids raises `ScheduleError("job 'x' depends on unknown job 'y'")`.
3. **Kahn's algorithm with a priority queue.** Jobs with no outstanding dependencies
   are pushed onto a heap keyed by `(-priority, input_index, id)`, so the highest
   priority is always popped first and ties fall back to original input order (the
   id is only in the key to keep the heap total order deterministic). Each time a
   job is scheduled, its dependents' remaining-dependency counters are decremented
   and newly ready jobs are pushed. Complexity is O(V log V + E).

If the schedule ends with fewer jobs than were supplied, the unscheduled jobs form
(or depend on) a cycle. An iterative DFS (`_find_cycle`) then extracts one concrete
cycle from that subgraph, and the error names it, e.g.:

```
dependency cycle detected: a -> b -> c -> a (unschedulable jobs: a, b, c)
```

The DFS is iterative and the sort itself is loop-based, so a 5000-job chain or cycle
is handled without hitting the recursion limit.

Ordering is fully deterministic: no dependency on dict/set iteration order, and
repeated calls on the same input give the same result.

## Edge cases covered (37 tests in `test_jobqueue.py`)

Original three tests kept: dependencies override priority, priority-then-input-order
among ready jobs, unknown dependency rejected.

- **Shape/ordering:** empty input; single job; default priority/deps; ties broken by
  input order (not by id); negative and float priorities; diamond graph; transitive
  chain; priority only counts among *ready* jobs; a high-priority job jumps the queue
  the moment it becomes ready; forward references (dependency listed after the job);
  duplicate dependency entries tolerated; every job returned exactly once; accepts any
  iterable of jobs (generators) and list-valued `depends_on`.
- **No mutation:** deep-copied snapshot unchanged after planning (including a mutable
  list `depends_on`), input list not reordered, repeated calls identical.
- **Invalid input:** duplicate ids, empty-string id, non-string id (`int`, `None`),
  non-string dependency, empty-string dependency, string passed as `depends_on`,
  non-numeric priority, non-`Job` objects in the input; error messages name the
  offending job/dependency.
- **Cycles:** self-dependency, two-node cycle, three-node cycle alongside healthy jobs
  (message includes the cycle members and excludes healthy jobs), cycle unreachable
  from any root, diamond is *not* mistaken for a cycle.
- **Scale/property:** 200 seeded random DAGs (up to 30 jobs) verified for completeness,
  dependency ordering, and the greedy "best ready job at every step" property; a
  5000-node chain and a 5000-node cycle both run without recursion errors.

## Verification

Command (run from this directory):

```
python3 -m unittest -v test_jobqueue.py
```

Result:

```
Ran 37 tests in 0.520s

OK
```
