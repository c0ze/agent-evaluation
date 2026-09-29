# Dependency-aware scheduler

`plan_jobs` returns a deterministic execution order for a batch of `Job` values. It uses only the Python standard library (`heapq` plus Kahn's algorithm). The caller's jobs and dependency collections are snapshotted and never modified.

## Design

1. Copy the input iterable into a local list. Empty input returns `[]`.
2. Reject a job whose `id` is not a non-empty string, a repeated id, a non-iterable `depends_on` (including `str` and `bytes`, which would otherwise split into characters), a dependency that does not name a supplied job, or a priority that cannot be ordered. Each failure raises `ScheduleError` with the offending id in the message. Validation finishes before any order is returned, so a missing dependency is reported even when the graph also contains a cycle.
3. Treat duplicate names in one `depends_on` collection as a single edge. Counting them twice would leave a leftover indegree and look like a cycle.
4. Schedule with Kahn's algorithm. A job is ready when every dependency is already in the order. Among ready jobs, a binary heap selects the highest `priority`, then the earliest original input index. A job that becomes ready later is ranked against the jobs already waiting, so a newly unblocked high-priority job runs before an older lower-priority one, and an equal priority still follows input order rather than the order in which jobs became ready.
5. If any job remains, the leftover graph has a cycle. Iterative Kosaraju strongly connected components (plus self-loops) collect every job that sits on a cycle, in input order. The exception is `dependency cycle detected involving 'a', 'b'`. Jobs that could still run, and jobs that only wait on a cycle, are left out of that list. The search is iterative so a long cycle does not hit the recursion limit.

## Edge cases covered

`test_jobqueue.py` keeps the original three cases and adds:

- Empty input, a single job, a one-shot generator, and repeated calls that stay deterministic.
- Empty ids, non-string ids, blank-but-non-empty ids, and duplicate ids (rejected before cycle detection).
- Unknown dependencies, exact id match (integer `1` is not the job `"1"`), string/`bytes` `depends_on`, non-iterable jobs, and non-iterable `depends_on`.
- Incomparable priorities.
- Forward references, chains where a high priority sits behind its dependencies, negative priorities, fan-in, fan-out, and diamonds.
- Equal priorities keep input order; a job that becomes ready later still yields to an earlier equal-priority job; a newly ready higher priority jumps ahead of a job that was already waiting.
- Repeated dependency edges schedule normally.
- Payloads do not affect order. Success and failure leave the job list, dependency list identity, and payload unchanged.
- Self-cycles, mutual cycles, three-node cycles, disjoint cycles, and a self-loop combined with another edge. Diagnostics name every cycle member and omit runnable or merely blocked jobs.
- A 1,200-job chain respects dependencies over priority. A 1,200-job cycle raises `ScheduleError` and names participants.
- Forty seeded random DAGs match an independent ready-set reference (highest priority, then input index, duplicate edges counted once) and place every dependency first. Fifteen seeded random cycles name every participant and omit independent and blocked jobs.

## Verification

Command, run from `/Users/arda/projects/agent-eval-runs/agent-eval-grok-4.7/01-feature-building`:

```bash
python3 -m unittest -v test_jobqueue.py
```

Result: exit code 0.

```text
Ran 45 tests in 0.010s

OK
```
