# Task 01 response

`plan_jobs` snapshots the supplied iterable, validates that jobs have unique,
non-empty string IDs, and validates that each dependency is a non-empty string
that names a supplied job. It builds prerequisite counts and reverse edges, then
uses a heap to choose among ready jobs by descending priority and original input
order. If jobs remain blocked after scheduling, it raises `ScheduleError` and
lists their IDs. All scheduling state is local, so the input jobs and dependency
collections are left unchanged.

The tests cover empty input, dependency ordering over priority, priority among
ready jobs including jobs released during scheduling, stable ties, unknown and
malformed dependencies, empty/non-string/duplicate IDs, self and multi-job
cycles, and non-mutation of the input and a dependency list.

Verification command:

```text
python3 -m unittest -v
```

Result: **12 tests passed** (`Ran 12 tests in 0.000s`, `OK`).
