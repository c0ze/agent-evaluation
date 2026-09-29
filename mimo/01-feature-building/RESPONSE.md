# RESPONSE — Task 01: dependency-aware scheduler

## Design

`plan_jobs` is a deterministic Kahn topological sort with a priority queue.

1. **Materialize and validate.** The iterable is copied to a list (generators work).
   Each `Job.id` must be a non-empty `str` and unique; violations raise `ScheduleError`.
   Dependencies are validated against the supplied ID set. Duplicate dependency entries
   are ignored after the first so they cannot skew in-degree counts.
2. **Graph build.** For each job, a local `seen` set dedupes `depends_on` while filling
   `dependents` and per-job remaining-dependency counts. Dependencies are read via
   `tuple(job.depends_on)`, so the caller’s sequence is never mutated (and `Job` is a
   frozen dataclass).
3. **Ready selection.** A binary heap of `(-priority, input_index, id)` pops the best
   currently ready job: higher `priority` first, equal priority by original input order.
   Newly unlocked jobs re-enter the same heap, so priority is re-evaluated among
   whatever is ready at that moment. Dependencies always win over priority: a job is
   never scheduled before its deps, even at `priority=100`.
4. **Cycle detection.** If the sort finishes early, the remaining IDs are exactly the
   unresolvable set (cycle members plus jobs that depend on them). A small DFS over that
   subgraph extracts one concrete cycle path for the diagnostic, e.g.
   `dependency cycle detected: a -> b -> c -> a (unresolvable jobs: a, b, c)`.
   Self-dependencies surface as `a -> a`. No cycle helper mutates inputs.

Empty input returns `[]`. Output length equals input length on success (each ID once).
Standard library only (`heapq`, `dataclasses`, `typing`).

## Edge cases covered in `test_jobqueue.py`

| Area | Cases |
|---|---|
| Core contract | empty input; single job; every ID exactly once; generator input |
| Ordering | deps override priority; ready set by priority then input order; priority applied when a job becomes ready; equal priority keeps input order for late-ready jobs; negative priority |
| Structure | diamond dependency; duplicate `depends_on` entries |
| Validation | unknown dependency (message names both jobs); duplicate job ID; empty job ID; non-string job ID |
| Cycles | self-dependency; 2-cycle; 3-cycle with a bystander job in the plan; cycle with a dependent stuck outside the cycle — IDs appear in the diagnostic |
| Immutability | jobs and their dependency tuples unchanged after planning; caller-owned list unchanged |

The three original tests are preserved unchanged.

## Verification

Command (from this directory):

```bash
python3 -m unittest test_jobqueue -v
```

Result:

```
Ran 21 tests in 0.001s

OK
```

All 21 tests passed. No further checks were required by the task (stdlib only; no linter
or type-checker config was supplied).
