# RESPONSE — Task 01: dependency-aware scheduler

## Design

`plan_jobs` is a deterministic topological sort based on Kahn's algorithm with a
priority queue of currently ready jobs.

1. **Materialize** the input iterable once so jobs can be indexed without
   re-iterating generators. Empty input short-circuits to `[]`.
2. **Validate IDs** — each `Job.id` must be a non-empty `str` and unique across
   the input. Failures raise `ScheduleError` with the offending value.
3. **Validate dependencies** — every name in `depends_on` must match a supplied
   job. The error message names both the dependent job and the missing target.
4. **Build the graph** — reverse edges (`dependents`) and remaining-dependency
   counts. Duplicate entries inside one `depends_on` are collapsed via `set` so
   they cannot inflate the count.
5. **Ready queue** — a min-heap of `(-priority, input_index, id)`. Negating
   priority yields highest-priority-first; the input index breaks ties so equal
   priorities keep original order. Input order is never disturbed by heap
   insertion order because the index is part of the key.
6. **Emit** — pop the best ready job, append its ID, decrement dependents, and
   push any newly ready jobs. Dependencies always precede dependents because a
   job only enters the queue after every dependency has been emitted.
7. **Cycle detection** — if fewer IDs were emitted than supplied, the remaining
   nodes are stuck. `_cycle_members` walks each stuck node's dependency edges
   restricted to stuck nodes and keeps only those that can reach themselves
   (true cycle participants). Nodes that merely depend on a cycle are omitted
   from the message. The raised `ScheduleError` lists the cycle IDs.

Jobs are frozen dataclasses and `depends_on` is a tuple; the implementation only
reads them, so the supplied objects and their dependency lists are never mutated.

Complexity: O(V + E) for validation and graph construction, O((V + E) log V) for
the ready-queue loop.

## Edge cases covered in `test_jobqueue.py`

| Area | Cases |
| --- | --- |
| Core ordering | dependencies beat priority; ready jobs by priority then input order; transitive chain; diamond; multiple dependencies; equal priorities after unlock; negative priorities |
| Priority scope | high-priority job stays blocked until its dependency runs; low-priority ready job can run first |
| Validation | unknown dependency (message names both jobs); duplicate IDs; empty ID; non-string ID |
| Cycles | self-dependency; two-node cycle with IDs in message; three-node cycle with independent jobs; dependent-of-cycle is *not* listed as a cycle member |
| Robustness | empty input; single job; duplicate dependency entries; no mutation of jobs/deps; payload ignored and preserved |
| Existing contract tests | the three original tests retained unchanged in behavior |

## Verification

Command (run from this directory):

```
python -m unittest test_jobqueue -v
```

Result:

```
Ran 22 tests in 0.001s

OK
```

All 22 tests passed, including the three supplied contract tests and the 19
additional edge-case tests.
