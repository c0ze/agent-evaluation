# Task 01 — Feature building: dependency-aware scheduler

## Design

`plan_jobs(jobs)` produces a deterministic, dependency-respecting execution order.

1. **Materialize and validate.** The input `Iterable[Job]` is copied into a list so generators are supported and the source is not mutated. An empty input returns `[]` immediately. Each job is checked for a non-empty, non-whitespace string `id` and for uniqueness; violations raise `ScheduleError`. Note that `Job` is frozen, so jobs themselves cannot be mutated.

2. **Build the dependency graph.** For each job, dependencies are validated to be IDs of supplied jobs; unknown dependencies raise `ScheduleError` naming both the dependent and the missing job. Duplicate dependency entries are collapsed to a single edge (harmless, and keeps in-degree correct). All graph structures (`deps`, `indegree`, `dependents`) are freshly built dictionaries/lists — the supplied jobs and their `depends_on` tuples are never touched.

3. **Topological sort with priority.** Kahn's algorithm is used with a min-heap as the ready queue. Heap entries are `(-priority, input_index, id)`: negated priority so the highest priority is popped first, input position so equal priorities break by original input order, and the ID as a final tie-breaker. Unlocking a job (in-degree reaching zero) pushes it into the heap, so a newly-ready high-priority job correctly competes with already-ready jobs.

4. **Cycle detection.** If fewer jobs were emitted than supplied, a cycle exists. An iterative DFS (`_find_cycle`) with white/gray/black coloring returns the actual cycle as `a -> b -> ... -> a`, which is included in the `ScheduleError` message. This handles self-dependencies and cycles disjoint from otherwise-valid jobs.

No third-party libraries are used — only `dataclasses`, `heapq`, and `typing` from the standard library.

## Edge cases covered

- Empty input (list and iterator) returns an empty list.
- Dependencies overriding priority; priority-then-input-order among ready jobs.
- A newly-unlocked job competing by priority with still-ready jobs.
- Chains, fan-in, and a final "join" job after all its dependencies.
- Every job returned exactly once; duplicate dependency entries.
- Input jobs/dependency lists not mutated; generic iterable inputs.
- Rejection with useful messages for: empty ID, whitespace-only ID, non-string ID, duplicate IDs, unknown dependency.
- Cycle detection for a 2-node cycle (with IDs in the message), self-dependency, a longer 3-node cycle, and a cycle disjoint from valid jobs.
- Negative priorities and fully identical priorities.

## Verification

Command (run from this task directory):

```
python3 -m unittest -v
```

Result: **21 tests, all passing** (`OK`, exit code 0).
