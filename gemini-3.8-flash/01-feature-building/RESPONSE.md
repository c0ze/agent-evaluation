# Implementation Report: Dependency-Aware Scheduler

## Design Summary

`plan_jobs` in `jobqueue.py` implements a deterministic topological scheduler based on Kahn's algorithm augmented with a priority queue (Python's `heapq`):

1. **Validation & Preprocessing**:
   - Validates that `jobs` is an iterable and safely materializes it into a list without mutating the original input.
   - Ensures each item is a `Job` (or compatible duck-typed object) with a non-empty string `id`, unique across all jobs.
   - Verifies that `priority` is numeric (disallowing `bool` and `NaN`).
   - Validates that `depends_on` is an iterable collection of non-empty strings (disallowing strings/bytes directly as dependency collections).
   - Verifies that all referenced dependency IDs exist in the supplied jobs list.

2. **Graph Construction**:
   - Computes in-degrees based on unique dependencies per job (`set(job.depends_on)`), preserving the immutability of the original dependency lists and gracefully handling duplicated dependencies within a single job.
   - Constructs an adjacency mapping `dependents: dict[str, list[str]]`.

3. **Deterministic Priority Queue (Kahn's Algorithm)**:
   - Jobs with an in-degree of 0 are enqueued into a min-heap storing `(-job.priority, original_index, job.id)`.
   - The heap ordering guarantees that jobs with higher priority are popped first. Ties in priority are resolved by `original_index`, preserving original input order.
   - As each job finishes, the in-degree of its successors is decremented. When a successor reaches an in-degree of 0, it is pushed to the heap using its original input index.

4. **Cycle Detection & Diagnostics**:
   - If the number of scheduled jobs is fewer than the total number of jobs, a dependency cycle is present.
   - A directed depth-first search (`_find_cycle`) inspects the remaining unscheduled jobs using three-state tracking (unvisited, visiting, visited) to extract the exact cycle path (e.g., `A -> B -> A`).
   - A `ScheduleError` is raised containing the specific job IDs involved in the cycle and the cycle chain.

---

## Edge Cases Covered

The expanded test suite in `test_jobqueue.py` covers 25 comprehensive test cases:

- **Empty and Minimal Inputs**:
  - Empty lists, tuples, and empty generators return `[]`.
  - Single job without dependencies schedules immediately.
- **Dependency Structures**:
  - Linear dependency chains (`lint` -> `build` -> `test` -> `deploy`).
  - Diamond dependency DAGs (`A` -> `B`, `C` -> `D`) with priority tie-breaking among branches.
  - Disconnected DAG components with interleaved priority execution.
  - Jobs with duplicate entries in `depends_on` (e.g., `("parent", "parent")`).
- **Priority and Tie-Breaking**:
  - Ready jobs with equal priorities break ties by original input order.
  - Negative and zero priorities (`high` > `0` > `-2` > `-10`).
  - Dynamic readiness: newly unblocked high-priority jobs execute ahead of lower-priority jobs that were already ready.
- **Cycle Detection**:
  - Self-dependency cycle (`Job("a", depends_on=("a",))`).
  - Two-job circular dependency (`a` <-> `b`).
  - Three-job circular dependency (`step1` -> `step3` -> `step2` -> `step1`).
  - Independent ready jobs coexisting with a cycle.
  - Jobs downstream of a cycle (cycle nodes correctly isolated in diagnostic).
- **Immutability & Input Types**:
  - Passing mutable lists as input jobs and mutable lists as `depends_on`; verified neither is mutated.
  - Generators / streaming iterables supported.
- **Input Validation**:
  - Non-iterable inputs (`None`, integers) raise `ScheduleError`.
  - Non-Job elements raise `ScheduleError`.
  - Empty string ID (`""`) or non-string IDs (`None`, integers) raise `ScheduleError`.
  - Duplicate job IDs raise `ScheduleError`.
  - Invalid priorities (`"high"`, `None`, `True`, `float("nan")`) raise `ScheduleError`.
  - Invalid `depends_on` types (e.g., `None`, raw strings instead of collections) raise `ScheduleError`.
  - Dependencies referencing unknown/missing job IDs raise `ScheduleError`.

---

## Verification Command & Results

### Command
```bash
python3 -m unittest -v test_jobqueue.py
```

### Result
```
test_cycle_detection_downstream_dependency (test_jobqueue.PlanJobsTests.test_cycle_detection_downstream_dependency) ... ok
test_cycle_detection_self_dependency (test_jobqueue.PlanJobsTests.test_cycle_detection_self_dependency) ... ok
test_cycle_detection_three_jobs (test_jobqueue.PlanJobsTests.test_cycle_detection_three_jobs) ... ok
test_cycle_detection_two_jobs (test_jobqueue.PlanJobsTests.test_cycle_detection_two_jobs) ... ok
test_cycle_detection_with_independent_ready_jobs (test_jobqueue.PlanJobsTests.test_cycle_detection_with_independent_ready_jobs) ... ok
test_dependencies_override_priority (test_jobqueue.PlanJobsTests.test_dependencies_override_priority) ... ok
test_diamond_dependencies (test_jobqueue.PlanJobsTests.test_diamond_dependencies) ... ok
test_disconnected_components_respect_priorities (test_jobqueue.PlanJobsTests.test_disconnected_components_respect_priorities) ... ok
test_duplicate_dependencies_in_single_job_handled_correctly (test_jobqueue.PlanJobsTests.test_duplicate_dependencies_in_single_job_handled_correctly) ... ok
test_dynamic_readiness_priority_selection (test_jobqueue.PlanJobsTests.test_dynamic_readiness_priority_selection) ... ok
test_empty_input_returns_empty_list (test_jobqueue.PlanJobsTests.test_empty_input_returns_empty_list) ... ok
test_equal_priority_tie_breaking_by_input_order (test_jobqueue.PlanJobsTests.test_equal_priority_tie_breaking_by_input_order) ... ok
test_generator_input_supported (test_jobqueue.PlanJobsTests.test_generator_input_supported) ... ok
test_input_is_not_mutated (test_jobqueue.PlanJobsTests.test_input_is_not_mutated) ... ok
test_invalid_depends_on_raises_schedule_error (test_jobqueue.PlanJobsTests.test_invalid_depends_on_raises_schedule_error) ... ok
test_invalid_priority_raises_schedule_error (test_jobqueue.PlanJobsTests.test_invalid_priority_raises_schedule_error) ... ok
test_job_id_must_be_non_empty_string (test_jobqueue.PlanJobsTests.test_job_id_must_be_non_empty_string) ... ok
test_job_id_must_be_unique (test_jobqueue.PlanJobsTests.test_job_id_must_be_unique) ... ok
test_linear_chain_dependencies (test_jobqueue.PlanJobsTests.test_linear_chain_dependencies) ... ok
test_negative_and_zero_priorities (test_jobqueue.PlanJobsTests.test_negative_and_zero_priorities) ... ok
test_non_iterable_input_raises_schedule_error (test_jobqueue.PlanJobsTests.test_non_iterable_input_raises_schedule_error) ... ok
test_non_job_items_raise_schedule_error (test_jobqueue.PlanJobsTests.test_non_job_items_raise_schedule_error) ... ok
test_ready_jobs_use_priority_then_input_order (test_jobqueue.PlanJobsTests.test_ready_jobs_use_priority_then_input_order) ... ok
test_single_job_without_dependencies (test_jobqueue.PlanJobsTests.test_single_job_without_dependencies) ... ok
test_unknown_dependency_is_rejected (test_jobqueue.PlanJobsTests.test_unknown_dependency_is_rejected) ... ok

----------------------------------------------------------------------
Ran 25 tests in 0.003s

OK
```
