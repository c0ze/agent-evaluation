# Response — Task 01: dependency-aware scheduler

## Deliverables

- `jobqueue.py` — implemented `plan_jobs` (standard library only).
- `test_jobqueue.py` — expanded from 3 to 28 `unittest` tests.
- `RESPONSE.md` — this summary.

## Design

`plan_jobs` uses Kahn's algorithm over the dependency graph:

1. **Copy, never mutate.** The input iterable is materialized into a new list
   and each `depends_on` is copied before use, so the caller's jobs and
   dependency lists are untouched. Any iterable (list, tuple, generator) works;
   empty input returns `[]`.
2. **Validate first (all failures raise `ScheduleError`, a `ValueError`).**
   - each ID must be a non-empty `str`, and unique (duplicates name the ID and
     both indices);
   - priority must support negation (i.e. be numeric);
   - `depends_on` must be a non-string iterable of non-empty string IDs (a bare
     string such as `"ab"` is rejected rather than split into characters);
   - every dependency must name a supplied job. This is checked in a second
     pass, so a job may depend on one defined later in the input; the error
     names both the job and the unknown dependency.
   - Repeated entries in one `depends_on` are deduplicated (order-preserving),
     so a duplicate is not counted as an extra prerequisite.
3. **Schedule.** A heap over the currently-ready jobs keyed by
   `(-priority, input_index, id)` yields higher priority first and breaks ties
   by original input order. Emitting a job decrements its dependents'
   in-degrees; newly-ready jobs are pushed, so a high-priority job unlocked
   mid-run can overtake jobs that were ready from the start. Every job is
   emitted exactly once, after all its dependencies. Running time is
   `O((V + E) log V)`, extra space `O(V + E)`.
4. **Cycle diagnosis.** If the heap empties with jobs left over, those jobs are
   on or downstream of a cycle. Downstream sinks (no residual dependents) are
   pruned iteratively so the error message names the jobs actually on a cycle,
   and lists downstream unscheduled jobs separately, e.g.
   `dependency cycle detected involving job(s): a, b; also unscheduled (dependent on the cycle): downstream`.
   Self-dependencies are handled as cycles by the same path.

## Edge cases covered in `test_jobqueue.py`

- Original three tests (dependencies override priority; priority then input
  order; unknown dependency rejected), kept unchanged.
- Empty input (list/tuple/iterator), single job, arbitrary iterables/generators.
- Reverse-order transitive chain, diamond graph, 200-job chain, payload ignored.
- Newly-ready high-priority job jumping ahead of an already-ready job; equal
  priorities keep input order; negative and zero priorities.
- Global invariant on a mixed graph: each ID exactly once, every dependency
  positioned before its dependent.
- Duplicate dependency entries count once.
- Validation: duplicate ID (message names it), empty ID, non-string IDs
  (`None`, `int`, `float`, `bytes`), unknown dependency (message names job and
  dependency), non-string dependency, bare-string `depends_on`, and
  `ScheduleError` being a `ValueError`.
- Cycles: self-loop, 2-cycle, 3-cycle with an independent job, and a cycle with
  a downstream dependent — all rejected with involved IDs in the message.
- Non-mutation: input list order and a caller-owned dependency list unchanged
  after the call; the returned list is a fresh object.

## Verification

Exact command (run from this directory):

```
python3 -m unittest -v
```

Result:

```
Ran 28 tests in 0.006s

OK
```

Before the fix the same command failed with 3 errors (`NotImplementedError`
from the stub). Two additional checks were also run and passed: a throwaway
randomized property check comparing `plan_jobs` against a naive step-by-step
ready-set reference on 300 random DAGs (seed 42), and
`python3 -m py_compile jobqueue.py test_jobqueue.py`.
