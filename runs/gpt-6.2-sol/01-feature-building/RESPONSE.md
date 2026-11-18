# Dependency-aware scheduler

`plan_jobs` records original input positions and validates job IDs and dependency references before scheduling. It uses `graphlib.TopologicalSorter` to track when prerequisites finish. A `heapq` min-heap keyed by negative priority and input position selects the next job. Newly ready jobs enter the heap before each selection. If the graph has a cycle, `ScheduleError` reports the IDs along one detected cycle. The scheduler keeps its state separate from the supplied jobs and dependency lists.

## Edge cases covered

- Empty input, a one-pass job iterator, multiple prerequisites, and repeated references to the same prerequisite.
- Dependencies overriding priority, equal and negative priorities, and newly ready jobs competing with jobs already in the heap.
- Empty, non-string, and duplicate IDs, plus unknown dependencies, non-string dependency entries, and non-iterable dependency collections.
- Self-cycles and a multi-job cycle with downstream and unrelated jobs. The diagnostic identifies the cycle members.
- Preservation of the input job list and mutable dependency lists across repeated calls.

## Verification

Ran `python3 -B -m unittest -v` from `01-feature-building`.

```text
Ran 14 tests in 0.001s

OK
```

The command exited with status 0.
