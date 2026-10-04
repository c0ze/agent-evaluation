# Plan Jobs — Design Notes

## Overview

`plan_jobs` returns a deterministic execution order for a set of jobs with
dependencies. Among the jobs currently free to run, it picks the highest
`priority` first and breaks ties by the order the jobs appeared in the input.
It rejects invalid input with `ScheduleError` and detects dependency cycles.

## Algorithm

1. **Materialize the iterable** into a list. The original position of each
   job is recorded in `order_index` and is used as the tiebreaker when two
   ready jobs share the same priority.
2. **Validate ids.** Each `Job.id` must be a non-empty string and unique.
   Violations raise `ScheduleError` with the offending value and its index.
3. **Validate dependencies.** Each entry in `depends_on` must reference
   another supplied job; missing targets raise `ScheduleError` and the
   message names both the dependent and the missing id.
4. **Build the graph.** `dependents[dep_id]` lists every job that depends
   on `dep_id`. `pending[job_id]` is a *fresh* `set` copied from
   `job.depends_on` so the caller's tuple is never touched. (The dataclass
   is `frozen` and `depends_on` is a tuple, but I keep this defensive copy
   as a belt-and-braces guarantee.)
5. **Schedule with a min-heap.** Jobs with empty `pending` are pushed with
   the key `(-priority, input_order, id)`. Popping gives the best ready job
   at every step. When a job is emitted, every job that listed it as a
   dependency has that id `discard`-ed from its `pending` set; once a
   dependent's `pending` empties, it joins the heap.
6. **Detect cycles.** If the heap empties before every job has been
   emitted, the jobs still in `pending` form one or more cyclic
   subgraphs. Their ids are sorted and included in the `ScheduleError`
   message.

The algorithm is `O((V + E) log V)` and uses only the standard library
(`dataclasses`, `heapq`).

## Edge cases covered by the test suite

The expanded `test_jobqueue.py` covers, beyond the three original tests:

- **Trivial input** — empty list, single-job list, generator input
  (consumed exactly once).
- **Shapes** — diamond DAG, chain DAG where the highest priority sits in
  the middle, equal-priority jobs that must be ordered by input position,
  two disjoint subgraphs, and a larger DAG that exercises both ordering
  and completeness.
- **Completeness / uniqueness** — every input id appears exactly once in
  the output.
- **Priorities** — negative priorities still rank lower than higher
  ones.
- **Cycles** — two-node cycle, three-node cycle, self-loop, and a mixed
  graph where a free node sits next to a `a↔b` cycle. Each `ScheduleError`
  message is checked to confirm the cyclic ids are named and unrelated
  ids are *not* blamed.
- **Input validation** — duplicate id, empty-string id, non-string id
  (integer, `None`).
- **Non-mutation** — the supplied `Job` objects and their `depends_on`
  tuples are checked to be byte-for-byte unchanged after the call.

## Verification

Command run from inside `01-feature-building/`:

```
python3 -m unittest test_jobqueue.py -v
```

Result:

```
Ran 20 tests in 0.000s

OK
```