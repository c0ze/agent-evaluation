# Task 01 — dependency-aware scheduler

`plan_jobs` is implemented in `jobqueue.py` and `test_jobqueue.py` now holds 51
tests, all passing. Standard library only (`heapq`, `math`, `dataclasses`).

## Design

`plan_jobs` works in three steps, all on private structures keyed by input
position, so the supplied `Job` objects and their `depends_on` collections are
only ever read.

1. **Validate.** The input is materialised once with `list(jobs)`, so
   generators work. Each entry must be a `Job` with a non-empty string `id`
   that has not been seen before and a usable `priority`. Each `depends_on` is
   then resolved to input positions; every entry must be a string naming a
   supplied job.
2. **Schedule.** Kahn's algorithm with a `heapq` ready set keyed by
   `(-priority, input_index)`. Popping the heap gives the highest-priority
   ready job, with ties going to the job supplied earliest. Jobs released
   later compete with jobs that were already ready on the same key.
3. **Diagnose cycles.** If any job was never released, the leftover jobs are
   the cycle members plus everything downstream of them. Starting from the
   earliest leftover job, the code follows leftover dependencies until a job
   repeats, which yields one concrete cycle.

Cost is O((V + E) log V) time and O(V + E) space. Nothing is recursive, so
graph depth is not limited by the interpreter's recursion limit.

## Error messages

Every failure raises `ScheduleError` (a `ValueError`). Examples of the actual
text:

```
job at index 1 has an empty id
duplicate job id 'a' at indexes 0 and 1
job 'b' depends on unknown job 'zz'
job 'c': depends_on must be a collection of job ids, not the single string 'ab'
dependency cycle detected: 'a' -> 'b' -> 'a' (each job depends on the next); other jobs that can never become ready: 'v'
```

Validation errors are reported before cycle errors, and the first problem in
input order wins, so the message is deterministic.

## Decisions the contract left open

- **Priority is not inherited.** A high-priority job does not pull its
  low-priority dependency forward; priority only ranks jobs that are ready, as
  the contract states.
- **A repeated dependency counts once.** `depends_on=("a", "a")` is accepted
  and treated as a single edge.
- **A self-dependency is a cycle**, reported as `'a' -> 'a'`.
- **A bare string for `depends_on` is rejected.** `depends_on="ab"` would
  otherwise be read silently as the two dependencies `"a"` and `"b"`.
- **Priorities must be `int` or `float` and not NaN.** Anything else (`None`,
  strings, NaN) is rejected up front, because it would either crash the heap
  comparison or misorder jobs silently. This is stricter than the contract
  requires.
- **IDs are compared exactly.** A whitespace-only ID such as `" "` is accepted
  because it is a non-empty string; no trimming or case folding is applied.
- **Only one cycle is spelled out.** When several cycles exist, the first in
  input order is shown as a chain and the members of the others appear in the
  "can never become ready" list.

## Edge cases covered by the tests

| Area | Cases |
| --- | --- |
| Ordering | empty list and empty iterator, single job, equal priorities, negative / float / infinite priorities, diamond, multi-dependency join, independent components interleaving, dependency declared after its dependent, newly released job overtaking an already-ready one, tie between a released job and an already-ready one |
| Input shapes | generator of jobs, `depends_on` as list / tuple / frozenset, repeated dependency, IDs differing only by case, whitespace or accents, unhashable and unorderable payloads |
| Scale | 20,000-job chain, 5,000-wide fan-out and fan-in, 20,000-job cycle |
| Cross-checks | 300 seeded random DAGs compared with an independent O(n²) reference model, plus all 24 input permutations of a small graph |
| No mutation | jobs, dependency lists and payloads compared against a deep copy and by identity, on both the success and the failure path; the returned list is fresh on each call |
| Invalid input | empty ID, non-string IDs, duplicate IDs (including the same object twice), unknown / empty / non-string dependencies, case-mismatched dependency, bare-string and non-iterable `depends_on`, non-`Job` entries, non-iterable `jobs`, unorderable priorities, validation reported ahead of cycles |
| Cycles | self-dependency, two-job and four-job cycles with the chain in order, schedulable jobs left out of the report, downstream jobs listed separately, cycle through a repeated dependency, several cycles reported deterministically |

The three tests that shipped with the task are kept unchanged.

## Verification

Run from this directory with Python 3.14.9:

```
$ python3 -m unittest test_jobqueue
...................................................
----------------------------------------------------------------------
Ran 51 tests in 0.195s

OK
```
