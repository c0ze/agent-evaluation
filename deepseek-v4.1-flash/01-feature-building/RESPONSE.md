# Task 01 — Dependency-aware scheduler

## Design

`plan_jobs` is a Kahn topological sort driven by a binary heap, so the output is
both dependency-valid and deterministic.

1. **Materialize and validate IDs** (`_collect_jobs`). The iterable is consumed
   once into a list, which supports generators and leaves the caller's container
   untouched. Each `id` must be a non-empty `str`; duplicates are rejected with
   the offending ID in the message.
2. **Validate dependencies** (`_unique_dependencies`). Every dependency must be a
   string naming a supplied job. A bare `str` is rejected explicitly because
   iterating it would otherwise mean characters. Duplicate entries in one
   `depends_on` are collapsed so they count as a single edge and do not inflate
   the indegree.
3. **Build the graph** as `dependencies` (job → validated deps), `dependents`
   (reverse edges), and `indegree`.
4. **Schedule.** All zero-indegree jobs enter a heap keyed by
   `(-priority, input_index, id)`: higher priority first, ties by original input
   order. Each popped job is appended to the result and its dependents'
   indegrees are decremented; a dependent that reaches zero is pushed immediately,
   so a newly unblocked high-priority job competes with jobs that were ready all
   along.
5. **Cycle detection.** If fewer jobs were emitted than supplied, a three-colour
   iterative DFS (`_find_cycle`) walks the unscheduled nodes and returns one
   concrete cycle, reported as `dependency cycle detected: a -> c -> b -> a`.
   Nodes merely downstream of a cycle are excluded from the path but still cause
   the failure.

Complexity is `O(V + E)` plus heap operations, i.e. `O((V + E) log V)`.

Mutation safety: `Job` is frozen, and `plan_jobs` only reads `depends_on` into
fresh tuples — neither the job list/order nor dependency containers are modified.

## Edge cases covered by `test_jobqueue.py`

- Empty input → `[]`; single job; generator input.
- Every ID returned exactly once; repeated calls are deterministic.
- Negative/zero priorities; multi-level priority ordering.
- Dependencies override priority at every depth; newly ready high-priority job
  jumps ahead of already-ready lower-priority jobs.
- Ties broken by input order, including jobs that become ready mid-run.
- Diamond dependencies and a 50-node chain.
- Duplicate `depends_on` entries counted once (with both order variants).
- Invalid input: duplicate IDs, empty ID, non-string IDs (`None`, `int`,
  `bytes`), unknown dependency (message names both jobs), non-string dependency,
  bare-string `depends_on`.
- Cycles: self-dependency, two-node, three-node, cycle with blocked dependents,
  cycle alongside independent jobs; diagnostics contain the involved IDs.
- `ScheduleError` is a `ValueError`; inputs (list, dependency list, payload,
  job order) are unchanged after a call.

Beyond the committed tests, a 500-case randomized property check compared the
implementation against a brute-force reference and verified the dependency
constraint on every output.

## Verification

Command (run in this directory):

```
python3 -m unittest -v test_jobqueue
```

Result:

```
Ran 29 tests in 0.002s

OK
```
