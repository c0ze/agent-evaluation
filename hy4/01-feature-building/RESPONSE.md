# Task 01 — Response

## Design

`plan_jobs` uses **Kahn's algorithm with a min-heap** to produce a valid,
deterministic topological order while honoring the ready-set priority rule.

1. **Materialize & validate.** The input `Iterable[Job]` is converted to a list
   (so generators are consumed exactly once). Each item is checked to be a
   `Job`, its `id` must be a non-empty string (after `strip()`), and ids must be
   unique. Violations raise `ScheduleError` with the offending id, position, and
   reason.
2. **Validate & snapshot dependencies.** Each `depends_on` is copied into a new
   tuple and its entries are validated (must be strings naming a supplied job).
   Duplicate dependency entries are collapsed to a single edge. Because the
   frozen `Job` dataclass and the caller's lists are never written to, the
   supplied jobs and their dependency lists are **not mutated**.
3. **Graph setup.** `in_degree[j]` = number of distinct dependencies; a
   `dependents` map holds reverse edges (`dep -> [jobs that need it]`).
4. **Ready selection.** Only jobs with `in_degree == 0` are pushed onto a heap
   keyed by `(-priority, input_position, id)`. The negation makes higher
   `priority` pop first; the input position breaks ties by original order; the
   id is a deterministic final tiebreak. Newly-unblocked jobs are pushed as
   each job completes, so **priority is re-evaluated among the currently-ready
   set at every step** rather than snapshotted once.
5. **Cycle handling.** If fewer ids are emitted than supplied, the remainder is
   part of (or blocked by) a dependency cycle. An iterative DFS over the
   unscheduled subgraph finds one concrete cycle and `ScheduleError` is raised
   with the involved ids joined by `->` in the message.
6. Empty input short-circuits to `[]`.

Only the Python standard library is used (`dataclasses`, `typing`, `heapq`).
`ScheduleError` remains a `ValueError` subclass.

## Edge cases covered in `test_jobqueue.py` (29 tests)

- **Validation:** duplicate ids; empty / whitespace-only ids; non-string ids
  (`None`, int, tuple); non-`Job` items; non-string dependencies; unknown
  dependency (and that the message names the missing id).
- **Cycles:** self-dependency; two-node and three-node cycles; a cycle plus an
  independent runnable job (must still raise); a cycle hidden behind a dependency
  chain. All assert `ScheduleError`, with ids present in the diagnostic.
- **Ordering:** dependencies override priority; higher priority first with
  input-order tiebreak; priority re-evaluated as jobs become ready; negative
  and equal priorities; a 50-job chain; diamond dependency; duplicate dependency
  entries collapsed; every job returned exactly once and after all its deps.
- **Inputs:** empty list, empty generator, single job, tuple / generator
  iterables.
- **Non-mutation:** dependency tuples unchanged, external lists unchanged,
  input list order unchanged, payload preserved by identity.

## Verification

Command (run from this directory):

```
python -m unittest -v test_jobqueue
```

Result:

```
Ran 29 tests in 0.003s

OK
```

`python -m unittest -v` (discovery) reports the same: `Ran 29 tests ... OK`.
Exit code 0.

## Deliverables

- `jobqueue.py` — `plan_jobs` implemented (plus `_find_cycle` helper).
- `test_jobqueue.py` — expanded with 29 tests.
- `RESPONSE.md` — this file.
