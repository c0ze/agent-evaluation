# Response 01 — Dependency-aware scheduler

## Design

`plan_jobs` validates, then runs Kahn's topological sort with priority
scheduling among the currently ready set:

1. Materialize the input iterable to a list (accepts generators/iterators);
   empty input returns `[]`. Reject `None`, `str`/`bytes`, non-iterables,
   and non-`Job` items with `ScheduleError`.
2. Validate every `Job.id` is a non-empty string and unique; validate each
   dependency is a non-empty string naming a supplied job, else
   `ScheduleError` with the offending job/dependency quoted. Deduplicate
   repeated edges so `depends_on=("a", "a")` counts once.
3. Build indegrees plus a dependent adjacency list (reads only — inputs are
   never mutated).
4. Push all zero-indegree jobs onto a heap keyed `(-priority, input_index)`,
   then repeatedly pop the highest-priority ready job and decrement its
   dependents. This yields: dependencies always precede dependents, and
   among ready jobs higher `priority` wins with ties broken by original
   input order.
5. If output is shorter than input, the leftover jobs form/are fed by a
   cycle; raise `ScheduleError` listing their IDs in input order.

Only the standard library is used (`heapq`, `dataclasses`, `typing`).
Complexity is O((V + E) log V).

## Edge cases covered (in `test_jobqueue.py`)

Kept the 3 supplied tests; added 13:

- Empty input, single job, forward-reference dependency
- Duplicate / empty / non-string IDs rejected
- Unknown dependency rejected; invalid (non-string) dependency rejected
  (via implementation; covered by validation path)
- Self-dependency and 2-/3-job cycles raise `ScheduleError` naming the IDs
- Chain, diamond (priority re-applied after a join), duplicate-dependency
  tolerance, input-order tiebreak (existing test), no-mutation of jobs or
  their dependency lists

## Verification

Command (run inside this directory):

    python3 -m unittest test_jobqueue -v

Result: 16 tests ran, all OK (Python 3.14.7). Extra probe confirmed
generator/iterator inputs schedule correctly (`['a','b','c']`,
`['y','x']`). Implementation imports only stdlib (`heapq`).
