# Task 01 — Dependency-aware scheduler

Files changed: `jobqueue.py` (implemented `plan_jobs`), `test_jobqueue.py` (3 original tests kept, 40 added). Standard library only (`heapq`, `numbers`).

## Design

`plan_jobs` is Kahn's topological sort driven by a min-heap, in three steps.

1. **Validate (`_validate`).** The input is materialised once with `list(jobs)`, so generators work. Each job's `depends_on` is also copied to a tuple once. All bad input raises `ScheduleError` with a message that names the job and the offending value. Nothing is modified.
2. **Order.** For each job, count its distinct dependencies as `unmet` and record it in each dependency's `dependents` list. Jobs with `unmet == 0` go into a heap keyed `(-priority, input_index)`. The heap always pops the highest-priority ready job, and equal priorities fall back to input order. When a job is popped, its dependents' counters go down, and any that reach 0 are pushed. So priority is only compared among jobs that are ready at that moment, and a job can never come before its dependencies. Runtime is O((V+E) log V).
3. **Cycle diagnostics (`_find_cycle`).** If the heap empties before every job is emitted, the jobs left with `unmet > 0` are either on a cycle or blocked behind one. Every such job has at least one dependency that is also stuck. Following those edges from the earliest stuck job must therefore revisit a job, and the revisited segment is an actual cycle. The error reads like `dependency cycle detected: 'a' -> 'b' -> 'c' -> 'a' (1 more job(s) are blocked behind it)`. It lists only jobs on the cycle, not innocent or downstream jobs, and the choice is deterministic. There is no recursion, so 5000-job chains and cycles are fine.

Other choices:
- A bare string for `depends_on` (e.g. `"ab"`) is rejected instead of being read as the jobs `"a"` and `"b"`.
- Duplicate entries inside one `depends_on` are tolerated. They collapse, so the counter can't be left off by one.
- A self-dependency is reported as a one-node cycle.
- Priorities may be any real number (int or float). Non-numbers and NaN are rejected, because NaN has no defined order in a heap.
- The returned list is new on every call, and the inputs are never touched.

## Edge cases covered (43 tests)

- **Ordering:** empty input (list and iterator); a single job; equal priorities keep input order; negative, mixed and float priorities; dependencies beat priority; priority competes only among currently ready jobs; a newly unlocked job competes with jobs that were already ready, both when it wins and when it loses; dependents unlocked together tie-break by input order; a diamond; several dependencies; duplicate `depends_on` entries; `depends_on` given as a list; one-shot iterables and generators; disconnected components; repeatable output; a scrambled DAG checked against a validity helper; a 5000-job chain given in reverse order; a 200-leaf fan-out.
- **Validation:** duplicate ids; empty id; non-string ids (`None`, `int`, `bytes`, `tuple`); unknown dependency (message names both jobs); case-sensitive ids; bare-string `depends_on`; non-string dependency; non-iterable `depends_on`; non-`Job` items; invalid priority (`str`, `None`, NaN); `ScheduleError` is a `ValueError`.
- **Cycles:** self-dependency; a 2-node cycle; the exact path text for a 3-cycle; message excludes innocent and downstream jobs; a cycle reachable only past a valid prefix; a cycle in the second component; a 5000-node cycle (no recursion error).
- **Immutability:** jobs, the input list, and the caller's `depends_on` list are unchanged after success and after failure; the result is a fresh list of `str`.

Outside the committed tests, I also fuzzed `plan_jobs` against a naive O(n^2) reference scheduler: 20,000 random graphs of up to 9 jobs, with random priorities, duplicate priorities, and cyclic and acyclic cases mixed. Outputs matched exactly, and `ScheduleError` was raised exactly when the reference found no ready job (15,325 valid plans, 4,675 cycles). The fuzz script lived in a scratch directory outside this task directory and is not part of the deliverable.

## Verification

Command (run from this directory):

```
python3 -m unittest -v
```

Result (Python 3.11.15):

```
Ran 43 tests in 0.034s

OK
```
