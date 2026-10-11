# Task 01 — Dependency-aware scheduler

## Design

`plan_jobs` in `jobqueue.py` is implemented in three phases using only the
Python standard library (`heapq`, `dataclasses`, `typing`):

1. **Validation** — the input iterable is materialized once into a list. Each
   job ID must be a non-empty string and unique; every entry in
   `depends_on` must reference a supplied job. Any violation raises
   `ScheduleError` with a message naming the offending ID(s).
2. **Graph construction** — indegree counts and dependent adjacency lists are
   built in fresh dicts keyed by job ID, so the supplied `Job` objects and
   their dependency tuples are never mutated.
3. **Kahn's algorithm with a priority heap** — ready jobs live in a min-heap
   keyed by `(-priority, input_index, job_id)`, so among ready jobs the
   highest priority is always emitted first, with equal priorities broken by
   original input order (deterministic). If the emitted count is smaller than
   the input count, the leftover jobs form one or more cycles; a
   `ScheduleError` is raised listing the remaining (cycle-involved) job IDs.

Complexity: O(V + E log V) — heap operations dominate.

## Edge cases covered by tests (18 total)

- Empty input returns `[]`; single job; arbitrary iterable (generator) input.
- Invalid IDs: empty string, non-string ID, duplicate IDs (error names the ID).
- Unknown dependency rejected.
- Cycles: self-dependency, two-node cycle, a 3-node cycle mixed with acyclic
  jobs — in each case the error message includes the involved IDs.
- Ordering: dependencies override priority; priority applies only among
  currently-ready jobs; equal priorities fall back to input order; negative
  priorities order correctly.
- Structural: diamond dependency (each job emitted exactly once, after all
  deps), repeated dependency edges, a 200-job chain.
- Non-mutation: input jobs and their dependency tuples are unchanged and the
  same objects after the call.

## Verification

Command (run inside this directory):

```
python3 -m unittest test_jobqueue -v
```

Result:

```
Ran 18 tests in 0.005s

OK
```
