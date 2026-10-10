# Dependency-aware scheduler

Completed every deliverable: implemented `plan_jobs` in `jobqueue.py`, expanded
`test_jobqueue.py`, ran the tests, and wrote this response. All repository reads
and changes stayed inside `01-feature-building`; no network was used. The
implementation and tests use only the Python standard library.

## Design

The scheduler materializes the input iterable once, so generators work and input
positions remain stable. It validates non-empty string IDs and uniqueness before
checking dependencies, allowing references to jobs anywhere in the input. Invalid
IDs and dependencies raise `ScheduleError` with the offending value and its input
position or referring job. Duplicate dependencies count as one prerequisite.

Kahn's topological sort tracks unsatisfied prerequisites and reverse dependency
edges. A min-heap of `(-priority, input_position)` selects the highest-priority
ready job, breaking ties by original input order. Newly ready jobs enter the heap
before the next selection. Each job is scheduled once, after all prerequisites.

If the heap empties before every job is scheduled, `ScheduleError` reports a
dependency cycle and lists unresolved IDs in input order. This list includes
cycle members and any jobs blocked downstream; it does not claim that every
listed job belongs to a cycle. Only local graph bookkeeping changes; supplied
jobs, dependency lists, payloads, and input order remain untouched.

The algorithm takes O(V + E + V log V) time and O(V + E) space for V jobs and E
dependency entries. An iterative algorithm avoids recursion limits on long
chains. A heap was chosen over repeatedly scanning all jobs to keep ready-job
selection efficient. Priority values follow the existing integer-typed `Job`
contract; non-empty IDs are not restricted to identifier syntax.

## Edge cases covered

The 24 tests cover:

- Empty sequences and iterators, single jobs, and generator input.
- Empty, non-string, unhashable, and duplicate job IDs; Unicode and whitespace IDs.
- Unknown, empty, non-string, and unhashable dependency IDs, with useful diagnostics.
- References to later input jobs and dependencies overriding priority.
- Positive and negative priorities, original-order ties, and newly ready jobs
  competing immediately with already ready jobs.
- Fan-in, fan-out, disconnected jobs, exactly-once output, and prerequisite order.
- Repeated dependencies and a 1,500-job dependency chain.
- Self-cycles, two-job cycles, longer cycles with independent and downstream jobs,
  and missing-dependency validation even when a cycle exists.
- Preservation of jobs, mutable dependency lists, payloads, and input order on
  success and failure, including repeated scheduling of the same input.

## Verification

Working directory:
`/Users/arda/projects/agent-eval-runs/agent-eval-gpt-6.1-sol/01-feature-building`

Exact command:

```sh
python3 -B -m unittest -v
```

Result: exit code 0; all 24 tests passed. The runner's summary was:

```text
Ran 24 tests in 0.003s

OK
```

Model ID: `gpt-6.1-sol`.
