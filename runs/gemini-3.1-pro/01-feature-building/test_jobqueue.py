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
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("build", depends_on=("missing",))])
        self.assertIn("missing", str(ctx.exception))

    def test_empty_input_returns_empty_list(self):
        self.assertEqual(plan_jobs([]), [])
        self.assertEqual(plan_jobs(()), [])
        self.assertEqual(plan_jobs(iter([])), [])
        self.assertEqual(plan_jobs(j for j in []), [])

    def test_single_job_no_dependencies(self):
        self.assertEqual(plan_jobs([Job("solo", priority=42)]), ["solo"])

    def test_linear_dependency_chain(self):
        jobs = [
            Job("deploy", priority=10, depends_on=("test",)),
            Job("test", priority=20, depends_on=("build",)),
            Job("build", priority=30, depends_on=("compile",)),
            Job("compile", priority=40),
        ]
        self.assertEqual(plan_jobs(jobs), ["compile", "build", "test", "deploy"])

    def test_diamond_dependency(self):
        jobs = [
            Job("finish", priority=100, depends_on=("task_b", "task_c")),
            Job("task_c", priority=10, depends_on=("start",)),
            Job("task_b", priority=20, depends_on=("start",)),
            Job("start", priority=5),
        ]
        # start runs first; task_b has higher priority than task_c; finish runs last
        self.assertEqual(plan_jobs(jobs), ["start", "task_b", "task_c", "finish"])

    def test_tie_breaking_by_input_order_across_steps(self):
        # Even when jobs become ready at different points, ready jobs with equal
        # priority must be broken by original input order.
        jobs = [
            Job("early_input", priority=5, depends_on=("prep",)),
            Job("prep", priority=10),
            Job("other_ready", priority=5),
        ]
        # Initially ready: prep (pri 10), other_ready (pri 5).
        # prep runs first. early_input becomes ready.
        # Now both early_input (pri 5, idx 0) and other_ready (pri 5, idx 2) are ready.
        # early_input must precede other_ready because its input order index is 0 < 2.
        self.assertEqual(plan_jobs(jobs), ["prep", "early_input", "other_ready"])

    def test_negative_and_zero_and_float_priorities(self):
        jobs = [
            Job("neg_five", priority=-5),
            Job("neg_two", priority=-2),
            Job("zero", priority=0),
            Job("float_one_half", priority=1.5),
            Job("float_one_quarter", priority=1.25),
        ]
        self.assertEqual(
            plan_jobs(jobs),
            ["float_one_half", "float_one_quarter", "zero", "neg_two", "neg_five"],
        )

    def test_duplicate_dependency_entries_deduplicated(self):
        # A job depending on the same prerequisite multiple times in depends_on
        # should not double-count in-degree or fail.
        jobs = [
            Job("task", priority=1, depends_on=("prereq", "prereq")),
            Job("prereq", priority=0),
        ]
        self.assertEqual(plan_jobs(jobs), ["prereq", "task"])

    def test_self_dependency_cycle_detected(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("loop", depends_on=("loop",))])
        self.assertIn("loop", str(ctx.exception))

    def test_two_job_cycle_detected_with_diagnostic_ids(self):
        jobs = [
            Job("a", depends_on=("b",)),
            Job("b", depends_on=("a",)),
        ]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        msg = str(ctx.exception)
        self.assertIn("a", msg)
        self.assertIn("b", msg)
        self.assertIn("cycle", msg.lower())

    def test_three_job_cycle_detected_with_diagnostic_ids(self):
        jobs = [
            Job("x", depends_on=("y",)),
            Job("y", depends_on=("z",)),
            Job("z", depends_on=("x",)),
        ]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        msg = str(ctx.exception)
        self.assertIn("x", msg)
        self.assertIn("y", msg)
        self.assertIn("z", msg)

    def test_cycle_with_independent_and_downstream_jobs(self):
        jobs = [
            Job("ok", priority=10),
            Job("c1", depends_on=("c2",)),
            Job("c2", depends_on=("c1",)),
            Job("downstream", depends_on=("c1",)),
        ]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        msg = str(ctx.exception)
        self.assertIn("c1", msg)
        self.assertIn("c2", msg)

    def test_multiple_disjoint_cycles(self):
        jobs = [
            Job("c1_a", depends_on=("c1_b",)),
            Job("c1_b", depends_on=("c1_a",)),
            Job("c2_a", depends_on=("c2_b",)),
            Job("c2_b", depends_on=("c2_a",)),
        ]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        msg = str(ctx.exception)
        for expected in ("c1_a", "c1_b", "c2_a", "c2_b"):
            self.assertIn(expected, msg)

    def test_reject_empty_string_job_id(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("")])

    def test_reject_non_string_job_id(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job(123)])  # type: ignore

    def test_reject_duplicate_job_id(self):
        jobs = [Job("dup", priority=1), Job("dup", priority=2)]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        self.assertIn("dup", str(ctx.exception))

    def test_reject_non_job_object(self):
        with self.assertRaises(ScheduleError):
            plan_jobs(["not_a_job"])  # type: ignore
        with self.assertRaises(ScheduleError):
            plan_jobs([None])  # type: ignore

    def test_reject_invalid_priority_types(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("a", priority="high")])  # type: ignore
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("a", priority=True)])  # type: ignore
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("a", priority=float("nan"))])

    def test_reject_invalid_depends_on_type(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("a", depends_on=None)])  # type: ignore
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("a", depends_on="should_not_be_string")])  # type: ignore

    def test_reject_invalid_dependency_element(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("a", depends_on=("",))])
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("a", depends_on=(123,))])  # type: ignore

    def test_immutability_of_inputs(self):
        deps_list = ["dep"]
        dep_job = Job("dep", priority=5, payload={"key": "val"})
        main_job = Job("main", priority=1, depends_on=tuple(deps_list), payload=[1, 2, 3])
        jobs = [main_job, dep_job]
        jobs_copy = list(jobs)

        result = plan_jobs(jobs)
        self.assertEqual(result, ["dep", "main"])
        # Ensure jobs list was not modified or reordered in-place
        self.assertEqual(jobs, jobs_copy)
        self.assertEqual(main_job.depends_on, ("dep",))
        self.assertEqual(main_job.payload, [1, 2, 3])
        self.assertEqual(dep_job.payload, {"key": "val"})

    def test_generator_input(self):
        def job_generator():
            yield Job("first", priority=10)
            yield Job("second", priority=5)

        self.assertEqual(plan_jobs(job_generator()), ["first", "second"])


if __name__ == "__main__":
    unittest.main()


