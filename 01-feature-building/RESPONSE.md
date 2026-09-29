# Dependency-aware scheduler

All deliverables are complete: implemented `plan_jobs` in `jobqueue.py`, expanded
`test_jobqueue.py`, ran the tests, and recorded the design and results here.
Only Python standard-library modules are used. All repository reads and changes
were confined to this task directory, and no network access was used.

## Design

The scheduler materializes the input iterable once, validates non-empty string
IDs and uniqueness, then validates dependencies against the complete ID index.
Errors identify the invalid value and, where applicable, its owning job. IDs are
used exactly as supplied; whitespace is not stripped. Duplicate dependencies
represent a single prerequisite.

Kahn's topological sort tracks each job's outstanding prerequisites and reverse
dependency edges. A heap keyed by negative priority and original input index
selects the next ready job. Newly unblocked jobs enter the heap immediately,
so every choice respects priority and input-order ties across all ready jobs.
Scheduling is iterative and handles long chains without recursion.

If jobs remain blocked after the heap empties, `ScheduleError` reports a cycle
and lists blocked IDs in input order. This list includes cycle members and may
also include their downstream dependents; it is labeled as blocked jobs rather
than an exact cycle path. All scheduling state is kept in separate collections;
supplied jobs, dependency lists, and payloads are not modified.

For V jobs and E supplied dependency entries, time is O(V + E + V log V) and
auxiliary space is O(V + E).

## Edge cases covered

- Empty and single-job input, generator input, and a reversed 1,500-job chain.
- Empty, non-string, unhashable, and duplicate IDs; unchanged whitespace and
  Unicode IDs.
- Unknown, empty, non-string, and unhashable dependencies, including invalid
  jobs in otherwise schedulable input.
- Negative priorities, ties resolved by input order rather than ID or ready
  time, and newly ready jobs competing immediately with waiting jobs.
- Multiple prerequisites, shared prerequisites, and repeated dependency names.
- Self-cycles, multi-job cycles, downstream blocked jobs, and a disconnected
  ready component alongside a cycle.
- Non-mutation on success and failure, preservation of object identity and
  payloads, and repeatable results across repeated calls.
- An independent exhaustive oracle for 64 four-job DAGs: enumerate every valid
  permutation and compare the scheduler with the best priority/input-order
  ranking. This also checks completeness and dependency ordering.

## Verification

Working directory:
`/Users/arda/projects/agent-eval-runs/agent-eval-gpt-6-astra/01-feature-building`

Exact command:

```sh
python3 -B -m unittest -v test_jobqueue
```

Result: exit code 0; all 25 tests passed, including the oracle's 64 graph cases.
The command's final output was:

```text
Ran 25 tests in 0.005s

OK
```

Model ID: `gpt-6-astra`.
