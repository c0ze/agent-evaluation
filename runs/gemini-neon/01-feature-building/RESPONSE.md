# Task 01 — Dependency-Aware Scheduler (`plan_jobs`)

## Design

`plan_jobs` in `jobqueue.py` implements deterministic priority-aware topological scheduling using only the Python standard library (`collections.abc`, `dataclasses`, `heapq`, `math`, `typing`):

1. **Non-mutating ingestion and validation**:
   - Materializes the input `Iterable[Job]` into a local list so generators/iterators work and caller containers are never mutated.
   - Returns `[]` immediately for empty input.
   - Validates each element is a `Job` with a non-empty unique `str` ID, a numeric (non-`bool`, non-`NaN`) `priority`, and an iterable (non-`str`/`bytes`) `depends_on` container whose entries are copied into a local tuple without modifying the caller's list.
   - Validates every dependency is a non-empty `str` referencing a supplied job, deduplicating repeated dependencies on the same job when building the adjacency list (`dependents`) and `in_degree` counts. All validation errors raise `ScheduleError` with descriptive messages.

2. **Priority-ordered Kahn's algorithm**:
   - Maintains a min-heap (`heapq`) of ready jobs keyed by `(-priority, original_input_index, job_id)`.
   - Negating `priority` schedules higher-priority ready jobs first; storing `original_input_index` deterministically breaks equal-priority ties by original input order, including when an earlier-listed job becomes ready after a later-listed job.
   - Runs in $O((V + E) \log V)$ time and emits every job ID exactly once after all of its dependencies.

3. **Iterative cycle diagnostics**:
   - If the emitted schedule has fewer items than the input, an iterative Tarjan's strongly connected components (SCC) pass (`_find_cyclic_sccs`) runs over the unscheduled subgraph (avoiding Python recursion limits on deep graphs).
   - Non-cyclic nodes that merely depend on a cycle are excluded; each cyclic SCC (size > 1 or self-loop) is deterministically ordered by input index and formatted via `_extract_cycle` into a `ScheduleError` message containing the cycle path (and full SCC member list for overlapping cycles).

## Edge Cases Covered in `test_jobqueue.py`

- Empty inputs (`[]`, `()`, empty generator), single job, and one-shot generator inputs.
- Dependencies overriding higher priorities; negative, zero, and positive priorities.
- Dynamic preemption when a newly unblocked high-priority job overtakes an already-ready lower-priority job.
- Equal-priority tie-breaking by original input order both initially and after unlocking.
- Diamond DAGs, disconnected components interleaved by priority, and duplicate dependencies listed on the same job.
- Validation failures (`ScheduleError`): empty/non-string IDs, duplicate IDs, unknown dependencies, empty/non-string/unhashable dependency entries, string/non-iterable `depends_on`, invalid priorities (`bool`, `str`, `None`, `NaN`), and invalid `jobs` containers/items.
- Cycle detection diagnostics: self-dependency, multi-node cycle with upstream valid and downstream dependent non-cycle nodes excluded from the error, multiple disjoint cycles, overlapping cycles, and deep 2,000-node chains and cycles without hitting recursion limits.
- Non-mutation verification on caller job lists, mutable dependency lists, and mutable payloads across both successful and failing (`ScheduleError`) calls.

## Verification

Command:

```bash
python3 -m unittest -v test_jobqueue.py
```

Result:

```text
Ran 20 tests in 0.024s

OK
```
