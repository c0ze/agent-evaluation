# Response — Task 01: dependency-aware scheduler

## Design

`plan_jobs` (jobqueue.py) is a two-phase algorithm using only the standard
library:

1. **Validation** — the input iterable is materialized once (generators work),
   then every entry is checked: it must be a `Job`; its `id` must be a
   non-empty string and unique (the duplicate error names both positions);
   `depends_on` must be iterable and every dependency must name a supplied job
   (errors name both the job and the missing dependency). Priorities are
   negated up front so non-numeric priorities raise `ScheduleError` with a
   useful message instead of a raw `TypeError`. All checks raise
   `ScheduleError` (a `ValueError` subclass). Dependency sequences are copied
   into internal structures, so nothing supplied by the caller is ever
   mutated; duplicates within a `depends_on` are de-duplicated so they cannot
   corrupt the readiness counters. Unknown-dependency checks run after all
   jobs are indexed, so forward references to later-supplied jobs are legal.

2. **Greedy scheduling** — Kahn's algorithm over a min-heap keyed by
   `(-priority, input_index)`. At each step the highest-priority *currently
   ready* job is emitted, exactly matching the contract ("among jobs
   currently ready, choose higher priority first; ties by original input
   order"); a job unlocked later can therefore jump ahead of an idle
   lower-priority one. Each ID is emitted exactly once, always after all of
   its dependencies. Empty input yields `[]`.

3. **Cycle detection** — if the heap drains before every job is emitted, the
   jobs with unresolved dependencies necessarily contain at least one cycle.
   An iterative DFS over the unresolved subgraph extracts one concrete cycle
   and the error message prints it as a path (e.g.
   `dependency cycle detected: a -> b -> a`), so the IDs involved are always
   included. Self-dependencies surface as `a -> a`.

Complexity: O(n log n + e) for n jobs and e dependency edges.

## Edge cases covered by the tests (31 total)

- Original contract tests kept: dependencies override priority, ready-set
  ordering by priority then input order, unknown dependency rejected.
- Empty input (list and iterator), single job, generator input.
- Equal priorities preserve input order; negative priorities; ties among
  newly-unlocked jobs use input order, not alphabetical ID order.
- Transitive chains, diamond dependencies, a newly ready high-priority job
  jumping ahead of an idle low-priority job, dependency on a later-supplied
  job, duplicated entries inside `depends_on`, `depends_on` given as a list.
- Non-mutation and determinism: caller's job list, `Job` objects, and a
  caller-owned dependency list are unchanged; repeated calls agree.
- Errors: self-cycle, two-job cycle (message contains both IDs), cycle below
  an acyclic prefix (message contains the cycle IDs), empty ID, non-string
  ID, duplicate IDs, unknown dependency message content, non-string
  dependency, non-`Job` entry, non-iterable `depends_on` (`None`),
  non-numeric priority, `ScheduleError` is a `ValueError`.
- Property-style randomized tests (fixed seeds): 100 random DAGs (with
  shuffled input order and duplicate-prone dependency draws) all produce a
  plan containing every ID exactly once with all dependencies first; 50
  random cyclic graphs are all rejected with a "cycle" diagnostic.
- A six-job pipeline graph asserts the exact deterministic plan and
  topological validity.

## Verification

Command (run inside this directory):

```
python3 -m unittest -v test_jobqueue
```

Result:

```
Ran 31 tests in 0.052s

OK
```

All 31 tests pass on Python 3.14.7; no third-party packages are used.
