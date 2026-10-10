# Task 01 — Dependency-aware scheduler

## What was delivered

- `jobqueue.py`: `plan_jobs` implemented (standard library only), plus three
  private helpers. `Job` and `ScheduleError` are unchanged apart from a
  docstring on the exception.
- `test_jobqueue.py`: the original 3 tests kept verbatim and expanded to 36
  tests across four groups (ordering, validation, cycles, immutability).
- This file.

## Design

`plan_jobs` is Kahn's topological sort driven by a heap:

1. **Materialize** the input with `list(jobs)` so one-shot iterators work and
   nothing the caller owns is ever touched. Empty input returns `[]` right away.
2. **Validate IDs** (`_validate_ids`): every `id` must be a `str`, non-empty and
   unique. The error names the offending position and, for duplicates, both
   positions. This runs over the whole input before anything else so unknown
   dependencies can be judged against the complete ID set.
3. **Resolve dependencies** (`_resolve_dependencies`): each job's `depends_on`
   is copied into a fresh tuple of job *indexes*. A bare string
   (`depends_on="a"`) and non-iterables (`None`) are rejected with targeted
   messages, non-string entries are rejected, and unknown IDs are reported all
   at once per job (`Job 'b' depends on unknown jobs: 'x', 'y'`). Repeated
   dependencies within a job are de-duplicated so in-degree counting stays
   correct.
4. **Schedule**: an in-degree array plus a reverse adjacency list feed a
   `heapq` keyed on `(-priority, input_index)`. Popping yields the
   highest-priority ready job, ties broken by original position. Because the
   index is unique, heap entries never compare `Job` objects, and because
   readiness is re-evaluated on every push, a high-priority job that has just
   been unblocked jumps ahead of lower-priority jobs that were ready earlier.
   There is deliberately no priority inheritance: a low-priority gate is not
   promoted because something important waits on it (the contract only ranks
   *currently ready* jobs).
5. **Cycle diagnostic** (`_find_cycle`): if the heap drains before every job is
   placed, the leftover jobs each still have at least one leftover dependency.
   Starting from the earliest stuck job and iteratively following the first
   stuck dependency must revisit a node; the walk from that first visit is a
   concrete cycle, rendered as `Dependency cycle detected: c -> b -> a -> c`.
   Jobs that are merely downstream of a cycle are not listed. The walk is
   iterative, so a 5000-node cycle does not hit the recursion limit.

Complexity is O((J + D) log J) for J jobs and D dependency edges; memory is
O(J + D). Output is fully deterministic for a given input sequence.

`ScheduleError` stays a `ValueError` subclass, so callers catching the more
general type keep working.

## Edge cases covered by the tests

Ordering
- Dependencies beat priority; priority beats input order; input order breaks
  ties (stable across many ready jobs, including negative priorities).
- Ties are broken by input position even when the earlier job only became
  ready later (not first-come-first-served).
- A newly unblocked high-priority job runs before lower-priority jobs that were
  already ready; conversely no priority inheritance through a low-priority gate.
- Diamond graphs, disconnected components, duplicate dependency entries inside
  one job, list-typed `depends_on`, single job, empty list/tuple/iterator, and
  a one-shot generator.
- Property test: 120 random DAGs (1 to 60 nodes, seeded RNG) are checked for
  "each ID exactly once, every dependency earlier" and compared exactly against
  an independent O(n²) reference scheduler.
- Determinism across repeated calls; a 5000-node chain to prove no recursion.

Validation (all raise `ScheduleError` with the IDs in the message)
- Duplicate ID, empty ID, non-string ID (`None`, `int`, `bytes`).
- Unknown dependency (message names both job and dependency; multiple unknowns
  listed together), non-string dependency, bare-string `depends_on`, non-iterable
  `depends_on`.
- Validation covers the whole input before scheduling starts.
- `ScheduleError` is catchable as `ValueError`.

Cycles
- Self-dependency (`a -> a`), two-node cycle, three-node cycle with unrelated
  and downstream jobs (asserting those are *not* in the message), cycles with
  high priorities, two independent cycles (one concrete cycle reported), and a
  5000-node cycle (iterative detection).

Immutability
- List-typed `depends_on` objects are the same objects and unchanged afterwards;
  the job list and each job's fields match a pre-call snapshot.
- Each call returns a fresh list; mutating a result does not affect later calls.

## Verification

Command (run from this directory; `-B` only stops Python writing
`__pycache__` into the task folder):

    cd /home/user/agent-eval-fable-5.1/01-feature-building && python3 -B -m unittest -v test_jobqueue

Result (tail of the output):

    ----------------------------------------------------------------------
    Ran 36 tests in 0.065s
    
    OK

Python 3.11.15. No network access was used; no files outside this directory
were created or changed.
