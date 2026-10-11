import math
import unittest

from jobqueue import Job, ScheduleError, plan_jobs


class PlanJobsTests(unittest.TestCase):
    def test_dependencies_override_priority(self):
        jobs = [
            Job("build", priority=100, depends_on=("fetch",)),
            Job("fetch", priority=1),
        ]
        self.assertEqual(plan_jobs(jobs), ["fetch", "build"])

    def test_ready_jobs_use_priority_then_input_order(self):
        jobs = [Job("a", 2), Job("b", 5), Job("c", 2)]
        self.assertEqual(plan_jobs(jobs), ["b", "a", "c"])

    def test_unknown_dependency_is_rejected(self):
        with self.assertRaises(ScheduleError) as cm:
            plan_jobs([Job("build", depends_on=("missing",))])
        self.assertIn("missing", str(cm.exception))

    def test_empty_input_returns_empty_list(self):
        self.assertEqual(plan_jobs([]), [])
        self.assertEqual(plan_jobs(()), [])
        self.assertEqual(plan_jobs(iter([])), [])

    def test_single_job_without_dependencies(self):
        self.assertEqual(plan_jobs([Job("solo", priority=42)]), ["solo"])

    def test_linear_chain_dependencies(self):
        jobs = [
            Job("deploy", priority=50, depends_on=("test",)),
            Job("test", priority=40, depends_on=("build",)),
            Job("build", priority=30, depends_on=("lint",)),
            Job("lint", priority=20),
        ]
        self.assertEqual(plan_jobs(jobs), ["lint", "build", "test", "deploy"])

    def test_diamond_dependencies(self):
        # A is base; B (pri 5) and C (pri 10) depend on A; D depends on B and C.
        jobs = [
            Job("d", priority=100, depends_on=("b", "c")),
            Job("b", priority=5, depends_on=("a",)),
            Job("c", priority=10, depends_on=("a",)),
            Job("a", priority=1),
        ]
        # 'a' must run first; then 'c' has higher priority than 'b'; finally 'd'.
        self.assertEqual(plan_jobs(jobs), ["a", "c", "b", "d"])

    def test_disconnected_components_respect_priorities(self):
        # Component 1: root1 -> child1
        # Component 2: root2 -> child2
        jobs = [
            Job("root1", priority=10),
            Job("child1", priority=50, depends_on=("root1",)),
            Job("root2", priority=20),
            Job("child2", priority=60, depends_on=("root2",)),
        ]
        # At start, root2 (pri 20) > root1 (pri 10).
        # root2 finishes, unblocking child2 (pri 60).
        # Currently ready: child2 (pri 60), root1 (pri 10).
        # child2 runs first.
        # Then root1 runs, unblocking child1 (pri 50).
        # Finally child1 runs.
        self.assertEqual(plan_jobs(jobs), ["root2", "child2", "root1", "child1"])

    def test_negative_and_zero_priorities(self):
        jobs = [
            Job("low", priority=-10),
            Job("zero", priority=0),
            Job("mid", priority=-2),
            Job("high", priority=5),
        ]
        self.assertEqual(plan_jobs(jobs), ["high", "zero", "mid", "low"])

    def test_dynamic_readiness_priority_selection(self):
        # Ready initially: slow_low (pri 1), idle_wait (pri 5).
        # idle_wait should run before slow_low, but once slow_low finishes,
        # it unblocks urgent (pri 100), which should run ahead of idle_wait2 (pri 10).
        jobs = [
            Job("idle_wait", priority=5),
            Job("slow_low", priority=1),
            Job("idle_wait2", priority=10),
            Job("urgent", priority=100, depends_on=("slow_low",)),
        ]
        # Step 1: ready are idle_wait2 (10), idle_wait (5), slow_low (1).
        # Step 1 picks idle_wait2.
        # Step 2: ready are idle_wait (5), slow_low (1). Picks idle_wait.
        # Step 3: ready is slow_low (1). Picks slow_low.
        # Step 4: urgent (100) unblocked and picked.
        self.assertEqual(plan_jobs(jobs), ["idle_wait2", "idle_wait", "slow_low", "urgent"])

    def test_equal_priority_tie_breaking_by_input_order(self):
        jobs = [
            Job("job_3", priority=10),
            Job("job_1", priority=10),
            Job("job_2", priority=10),
        ]
        self.assertEqual(plan_jobs(jobs), ["job_3", "job_1", "job_2"])

    def test_job_id_must_be_non_empty_string(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("", priority=1)])
        with self.assertRaises(ScheduleError):
            plan_jobs([Job(123)])  # type: ignore[arg-type]
        with self.assertRaises(ScheduleError):
            plan_jobs([Job(None)])  # type: ignore[arg-type]

    def test_job_id_must_be_unique(self):
        jobs = [Job("duplicate", priority=1), Job("duplicate", priority=2)]
        with self.assertRaises(ScheduleError) as cm:
            plan_jobs(jobs)
        self.assertIn("duplicate", str(cm.exception))

    def test_non_iterable_input_raises_schedule_error(self):
        with self.assertRaises(ScheduleError):
            plan_jobs(None)  # type: ignore[arg-type]
        with self.assertRaises(ScheduleError):
            plan_jobs(12345)  # type: ignore[arg-type]

    def test_non_job_items_raise_schedule_error(self):
        with self.assertRaises(ScheduleError):
            plan_jobs(["not_a_job"])  # type: ignore[arg-type]
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("valid"), None])  # type: ignore[arg-type]

    def test_invalid_priority_raises_schedule_error(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("bad_pri", priority="high")])  # type: ignore[arg-type]
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("bad_pri", priority=None)])  # type: ignore[arg-type]
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("bad_pri", priority=True)])  # bool disallowed
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("bad_pri", priority=float("nan"))])

    def test_invalid_depends_on_raises_schedule_error(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("bad_dep", depends_on=None)])  # type: ignore[arg-type]
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("bad_dep", depends_on="string_not_iterable_of_ids")])  # type: ignore[arg-type]
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("bad_dep", depends_on=("",))])
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("bad_dep", depends_on=(123,))])  # type: ignore[arg-type]

    def test_duplicate_dependencies_in_single_job_handled_correctly(self):
        jobs = [
            Job("parent"),
            Job("child", depends_on=("parent", "parent")),
        ]
        self.assertEqual(plan_jobs(jobs), ["parent", "child"])

    def test_input_is_not_mutated(self):
        dep_list = ["dep_a", "dep_b"]
        job_a = Job("dep_a")
        job_b = Job("dep_b")
        job_c = Job("consumer", depends_on=dep_list)  # type: ignore[arg-type]
        jobs = [job_c, job_b, job_a]
        original_jobs = list(jobs)

        result = plan_jobs(jobs)
        self.assertEqual(result, ["dep_b", "dep_a", "consumer"])
        # Original jobs list intact
        self.assertEqual(jobs, original_jobs)
        # Original dependency list intact
        self.assertEqual(dep_list, ["dep_a", "dep_b"])

    def test_generator_input_supported(self):
        def job_stream():
            yield Job("first", priority=1)
            yield Job("second", priority=2)

        self.assertEqual(plan_jobs(job_stream()), ["second", "first"])

    def test_cycle_detection_self_dependency(self):
        with self.assertRaises(ScheduleError) as cm:
            plan_jobs([Job("self_dep", depends_on=("self_dep",))])
        self.assertIn("self_dep", str(cm.exception))

    def test_cycle_detection_two_jobs(self):
        jobs = [
            Job("a", depends_on=("b",)),
            Job("b", depends_on=("a",)),
        ]
        with self.assertRaises(ScheduleError) as cm:
            plan_jobs(jobs)
        err = str(cm.exception)
        self.assertIn("a", err)
        self.assertIn("b", err)

    def test_cycle_detection_three_jobs(self):
        jobs = [
            Job("step1", depends_on=("step3",)),
            Job("step2", depends_on=("step1",)),
            Job("step3", depends_on=("step2",)),
        ]
        with self.assertRaises(ScheduleError) as cm:
            plan_jobs(jobs)
        err = str(cm.exception)
        self.assertIn("step1", err)
        self.assertIn("step2", err)
        self.assertIn("step3", err)

    def test_cycle_detection_with_independent_ready_jobs(self):
        jobs = [
            Job("ready1", priority=10),
            Job("ready2", priority=5),
            Job("cycle_a", depends_on=("cycle_b",)),
            Job("cycle_b", depends_on=("cycle_a",)),
        ]
        with self.assertRaises(ScheduleError) as cm:
            plan_jobs(jobs)
        err = str(cm.exception)
        self.assertIn("cycle_a", err)
        self.assertIn("cycle_b", err)

    def test_cycle_detection_downstream_dependency(self):
        # cycle_a <-> cycle_b; downstream depends on cycle_b.
        jobs = [
            Job("cycle_a", depends_on=("cycle_b",)),
            Job("cycle_b", depends_on=("cycle_a",)),
            Job("downstream", depends_on=("cycle_b",)),
        ]
        with self.assertRaises(ScheduleError) as cm:
            plan_jobs(jobs)
        err = str(cm.exception)
        self.assertIn("cycle_a", err)
        self.assertIn("cycle_b", err)


if __name__ == "__main__":
    unittest.main()
