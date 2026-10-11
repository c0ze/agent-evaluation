# RESPONSE — Task 01: dependency-aware scheduler

## Design

`plan_jobs` in `jobqueue.py` is implemented with Kahn's algorithm plus a min-heap
that encodes the required ordering rule, so the plan is always a valid
topological order and is fully deterministic:

1. **Validation first.** The iterable is materialized once (`list(jobs)`), then
   every `Job.id` is checked to be a non-empty string, uniqueness is enforced via
   an `id -> input index` map, and every dependency is checked against that map
   (non-string or unsupplied IDs fail). All diagnostics include the offending
   IDs/indexes and raise `ScheduleError`. Nothing is mutated: jobs are frozen
   dataclasses, and dependency containers are only iterated (via
   `dict.fromkeys` to dedupe repeated entries).
2. **In-degree bookkeeping.** Each job's pending count is the number of
   *distinct* dependencies, and a reverse `dependents` adjacency map is built.
   Deduplicating means `depends_on=("a", "a")` still completes the job.
3. **Heap-driven ready set.** Jobs with no pending dependencies are pushed onto
   a heap keyed by `(-priority, input_index, id)`, so among currently ready jobs
   the highest priority runs first and equal priorities fall back to original
   input order. Popping a job decrements its dependents and pushes any that hit
   zero pending, which naturally handles jobs that become ready later — the
   static input index is their tie-break key.
4. **Cycle detection.** If fewer jobs are emitted than were supplied, at least
   one cycle exists. An iterative (no recursion) three-color DFS over the
   dependency edges restricted to the unresolved jobs extracts one concrete
   cycle path, and the error message includes it (e.g.
   `dependency cycle detected: a -> b -> a`). The iterative approach keeps deep
   graphs safe from recursion-limit crashes.
5. **Output.** A list of IDs, each exactly once, always after all of its
   dependencies; empty input yields `[]`.

Only the standard library is used (`heapq`, `dataclasses`, `typing`).

## Edge cases covered (23 tests, all passing)

- Existing tests kept: dependencies override priority; priority-then-input-order
  for ready jobs; unknown dependency rejected.
- Input shapes: empty input `[]`, single job, generator input.
- ID validation: empty string ID, non-string IDs (`None`, `7`, `1.5`, tuple),
  duplicate IDs (message names both indexes).
- Dependencies: unknown/missing dep, repeated dependency entries, diamond
  dependency graph, multiple deps waited on together, dependency passed as a
  `list`.
- Cycles: self-dependency, two-node cycle, tail hanging off a cycle, and a
  1500-node cycle (iterative DFS, error names IDs involved).
- Ordering: tie-break by input order for jobs that become ready later, priority
  vs. input order across completion boundaries, disconnected groups, negative
  and zero priorities.
- Scale: a 5000-deep dependency chain (topological property checked pairwise;
  exercises the non-recursive implementation).
- Purity: input jobs and dependency lists are unchanged after planning.

## Verification

Command:

```
python3 -m unittest -v test_jobqueue
```

Result:

```
test_deep_chain_of_5000_jobs ... ok
test_dependencies_override_priority ... ok
...
Ran 23 tests in 4.273s

OK
```
