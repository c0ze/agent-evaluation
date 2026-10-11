# Response: Dependency-Aware Scheduler

## Design Summary

The `plan_jobs` function in `jobqueue.py` implements a deterministic dependency-aware job scheduler using Kahn's algorithm with a priority queue (min-heap via standard library `heapq`) and Tarjan's strongly connected components algorithm for cycle diagnostics:

1. **Input Validation & Graph Construction**:
   - Accepts any `Iterable[Job]` without mutating the input collection or `Job` objects.
   - Validates that each job has a non-empty `str` ID and that all job IDs within the input are unique.
   - Validates that job priorities are valid numeric values (`int` or `float`, excluding boolean types and `NaN`).
   - Validates that `depends_on` is an iterable of job IDs, and that every named dependency exists in the supplied jobs list.
   - Computes in-degrees using deduplicated dependencies (`set(job.depends_on)`) and creates an adjacency list of downstream dependents.

2. **Deterministic Scheduling**:
   - Ready jobs (in-degree 0) are tracked in a priority queue using tuples: `(-job.priority, original_index, job.id)`.
   - Higher priority jobs are popped first because `-priority` is minimized.
   - Ties in priority are broken strictly by `original_index`, guaranteeing that equal-priority jobs are executed in their original input order even if they become ready at different points during execution.
   - Upon job execution, dependent jobs have their in-degrees decremented; once a dependent's in-degree reaches 0, it is enqueued into the ready queue.

3. **Cycle Detection & Diagnosis**:
   - If the ready queue empties before all jobs are scheduled, a dependency cycle exists.
   - Tarjan's Strongly Connected Components (SCC) algorithm is applied across the remaining unscheduled jobs to identify the exact cycle components (SCCs of size > 1 or single-node self-dependencies).
   - Isolates the actual cycle participants from jobs merely blocked downstream, raising a `ScheduleError` containing the involved job IDs and an illustrative cycle path (e.g. `a -> b -> a`).

## Edge Cases Covered

`test_jobqueue.py` was expanded to test 24 distinct scenarios:
- **Empty inputs**: Empty lists, empty tuples, and empty generators/iterators return `[]`.
- **Single jobs & basic DAGs**: Standalone jobs, linear chains, and diamond dependency graphs.
- **Priority edge cases**: Negative priorities, zero priorities, and floating-point priorities.
- **Dynamic tie-breaking**: Jobs becoming ready dynamically across different steps break priority ties by original input order.
- **Dependency deduplication**: Duplicate entries in `depends_on` (e.g. `("prereq", "prereq")`) are deduplicated and do not cause overcounting or deadlocks.
- **Cycle detection and diagnostics**:
  - Self-dependency cycles (`loop -> loop`).
  - Two-job and three-job cycles with diagnostics verifying involved IDs.
  - Cycles with independent jobs and downstream blocked jobs.
  - Multiple disjoint/disconnected cycles reporting all involved IDs.
- **Input validation & error rejection**:
  - Empty string job ID (`""`).
  - Non-string job ID types (`int`, `None`).
  - Duplicate job IDs in input.
  - Non-Job objects in input list.
  - Invalid priority types (`str`, `bool`, `float("nan")`).
  - Invalid `depends_on` types (`None`, `str`).
  - Unknown dependency references and invalid dependency elements (`""`, non-string).
- **Immutability**: Input job list and job fields (`depends_on`, `payload`) are verified not to be mutated.
- **Generators**: Lazy generator inputs are consumed and planned correctly.

## Verification Command & Result

Verification command:
```bash
python3 -m unittest -v test_jobqueue.py
```

Result:
```text
test_cycle_with_independent_and_downstream_jobs (test_jobqueue.PlanJobsTests.test_cycle_with_independent_and_downstream_jobs) ... ok
test_dependencies_override_priority (test_jobqueue.PlanJobsTests.test_dependencies_override_priority) ... ok
test_diamond_dependency (test_jobqueue.PlanJobsTests.test_diamond_dependency) ... ok
test_duplicate_dependency_entries_deduplicated (test_jobqueue.PlanJobsTests.test_duplicate_dependency_entries_deduplicated) ... ok
test_empty_input_returns_empty_list (test_jobqueue.PlanJobsTests.test_empty_input_returns_empty_list) ... ok
test_generator_input (test_jobqueue.PlanJobsTests.test_generator_input) ... ok
test_immutability_of_inputs (test_jobqueue.PlanJobsTests.test_immutability_of_inputs) ... ok
test_linear_dependency_chain (test_jobqueue.PlanJobsTests.test_linear_dependency_chain) ... ok
test_multiple_disjoint_cycles (test_jobqueue.PlanJobsTests.test_multiple_disjoint_cycles) ... ok
test_negative_and_zero_and_float_priorities (test_jobqueue.PlanJobsTests.test_negative_and_zero_and_float_priorities) ... ok
test_ready_jobs_use_priority_then_input_order (test_jobqueue.PlanJobsTests.test_ready_jobs_use_priority_then_input_order) ... ok
test_reject_duplicate_job_id (test_jobqueue.PlanJobsTests.test_reject_duplicate_job_id) ... ok
test_reject_empty_string_job_id (test_jobqueue.PlanJobsTests.test_reject_empty_string_job_id) ... ok
test_reject_invalid_dependency_element (test_jobqueue.PlanJobsTests.test_reject_invalid_dependency_element) ... ok
test_reject_invalid_depends_on_type (test_jobqueue.PlanJobsTests.test_reject_invalid_depends_on_type) ... ok
test_reject_invalid_priority_types (test_jobqueue.PlanJobsTests.test_reject_invalid_priority_types) ... ok
test_reject_non_job_object (test_jobqueue.PlanJobsTests.test_reject_non_job_object) ... ok
test_reject_non_string_job_id (test_jobqueue.PlanJobsTests.test_reject_non_string_job_id) ... ok
test_self_dependency_cycle_detected (test_jobqueue.PlanJobsTests.test_self_dependency_cycle_detected) ... ok
test_single_job_no_dependencies (test_jobqueue.PlanJobsTests.test_single_job_no_dependencies) ... ok
test_three_job_cycle_detected_with_diagnostic_ids (test_jobqueue.PlanJobsTests.test_three_job_cycle_detected_with_diagnostic_ids) ... ok
test_tie_breaking_by_input_order_across_steps (test_jobqueue.PlanJobsTests.test_tie_breaking_by_input_order_across_steps) ... ok
test_two_job_cycle_detected_with_diagnostic_ids (test_jobqueue.PlanJobsTests.test_two_job_cycle_detected_with_diagnostic_ids) ... ok
test_unknown_dependency_is_rejected (test_jobqueue.PlanJobsTests.test_unknown_dependency_is_rejected) ... ok

----------------------------------------------------------------------
Ran 24 tests in 0.004s

OK
```
