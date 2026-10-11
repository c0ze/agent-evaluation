# Response: Dependency-Aware Scheduler Implementation

## Design Summary

The `plan_jobs` function implements a **topological sort** using **Kahn's algorithm** with a **priority queue** (min-heap) to satisfy the ordering constraints:

1. **Graph Construction**: Jobs are converted to a directed graph where edges represent dependencies. In-degree counts track how many dependencies each job has remaining.

2. **Priority Queue for Ready Jobs**: Jobs with zero in-degree (no remaining dependencies) are pushed into a min-heap keyed by `(-priority, input_index, job_id)`. The negative priority ensures higher priorities pop first; the input index breaks ties deterministically by original input order.

3. **Processing Loop**: Repeatedly pop the highest-priority ready job, append to result, decrement in-degree of its dependents, and push newly-ready jobs onto the heap.

4. **Cycle Detection**: After the loop, if the result length doesn't match the input count, a cycle exists. The error message lists all jobs not in the result (those involved in the cycle).

5. **Input Validation**: Validates non-empty string IDs, uniqueness, and that all dependencies reference known jobs—all before any scheduling.

6. **Immutability**: The input jobs and their `depends_on` tuples are never mutated; all state is tracked in separate dictionaries.

## Edge Cases Covered

| Test | Description |
|------|-------------|
| `test_empty_input_returns_empty_list` | Empty iterable returns `[]` |
| `test_single_job` | Single job with no dependencies |
| `test_chain_of_dependencies` | Linear dependency chain |
| `test_multiple_dependencies` | Job depends on multiple predecessors |
| `test_diamond_dependencies` | Diamond DAG pattern (a→b, a→c, b→d, c→d) |
| `test_priority_ordering_among_ready` | Higher priority chosen first when multiple ready |
| `test_equal_priority_uses_input_order` | Stable ordering by input index for equal priority |
| `test_priority_with_dependencies` | Priority only applies among ready jobs |
| `test_cycle_detection_two_jobs` | 2-node cycle (a→b→a) |
| `test_cycle_detection_three_jobs` | 3-node cycle (a→b→c→a) |
| `test_self_dependency_cycle` | Job depending on itself |
| `test_duplicate_job_id_rejected` | Duplicate IDs raise `ScheduleError` |
| `test_empty_job_id_rejected` | Empty string ID rejected |
| `test_none_job_id_rejected` | Non-string ID rejected |
| `test_input_not_mutated` | Input list unchanged after call |
| `test_dependency_lists_not_mutated` | `depends_on` tuples unchanged |

## Verification

**Command:**
```bash
python test_jobqueue.py
```

**Result:**
```
....................
----------------------------------------------------------------------
Ran 20 tests in 0.006s

OK
```

All 20 tests pass, covering the core contract requirements and additional edge cases.