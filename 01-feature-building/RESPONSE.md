# Dependency-aware scheduler

`plan_jobs` records each job’s input position and validates all IDs before checking dependencies, so a job can refer to a prerequisite later in the input. The standard library’s `TopologicalSorter` tracks which jobs are ready and identifies a cycle for the error message. After each selection, newly ready jobs enter the same heap as waiting jobs. The heap selects the highest priority first and uses the earliest input position to break ties. All scheduling state is separate from the supplied jobs and dependency lists.

The 13 tests cover empty and one-shot inputs, forward references, negative priorities, ties involving newly ready jobs, and a diamond with a repeated dependency. They also check input preservation, invalid and duplicate IDs, unknown and unhashable dependencies, a self-dependency, and a multi-job cycle in a disconnected graph.

## Verification

Ran `python3 -B -m unittest -v test_jobqueue` from this directory. The command exited with status 0.

```text
Ran 13 tests in 0.001s

OK
```
