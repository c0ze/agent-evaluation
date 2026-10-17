# Task 01 — Dependency-Aware Job Scheduler

## Design Summary

`plan_jobs` in `jobqueue.py` implements a deterministic topological scheduler using Kahn's algorithm backed by a binary min-heap (`heapq`) and Tarjan's strongly connected components algorithm for cycle diagnostics:

1. **Input Validation & Immutability:**
   - Converts the input `Iterable[Job]` into a local list without mutating the caller's collection, job instances, dependency sequences, or payloads.
   - Verifies that every element is a `Job` with a unique, non-empty string `id`, a numeric `priority`, and a valid iterable `depends_on` (explicitly rejecting bare strings/bytes or unknown/empty dependency IDs with `ScheduleError`).
   - Deduplicates repeated dependency references per job internally so redundant entries (e.g., `depends_on=("a", "a")`) do not inflate in-degree counts.

2. **Priority + Input-Order Scheduling:**
   - Tracks each job's unmet dependency count (`in_degree`) and reverse adjacency list (`dependents_by_id`).
   - Pushes ready jobs (`in_degree == 0`) into a `heapq` keyed by `(-job.priority, input_index, job.id)`. Negating priority selects the highest-priority ready job first, while `input_index` deterministically breaks ties in original input order across both initially ready and newly unblocked jobs.

3. **Cycle Detection & Diagnostics:**
   - If the heap drains before all jobs are scheduled, `_find_cycle_info` runs Tarjan's SCC algorithm on the unscheduled subgraph to isolate the exact jobs participating in cycles (excluding jobs that are merely downstream of a cycle) and extracts a concrete cycle trace for the `ScheduleError` message.

## Edge Cases Covered in `test_jobqueue.py`

- Empty list and empty generator inputs returning `[]`.
- Invalid job IDs (empty string, whitespace-only string, `None`, non-string) and duplicate job IDs.
- Unknown dependencies, empty dependency IDs, and bare-string `depends_on` values.
- Self-dependency cycles (`self_loop -> self_loop`) and multi-node cycles (`alpha -> gamma -> beta -> alpha`) with both independent and downstream blocked jobs, verifying that only actual cycle members appear in the diagnostic.
- Diamond dependency graphs with negative, zero, and positive priorities.
- Priority tie-breaking by original input order when an earlier job in input order becomes ready after a gate job finishes.
- Duplicate entries in a job's `depends_on` sequence.
- Non-mutation of input lists, mutable `depends_on` lists, and payloads, plus generator support.

## Verification

- **Command:** `python3 -m unittest -v test_jobqueue.py`
- **Result:** All 11 unit tests in `PlanJobsTests` pass (`OK`).
