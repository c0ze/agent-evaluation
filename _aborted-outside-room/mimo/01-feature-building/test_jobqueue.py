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
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("build", depends_on=("missing",))])

    def test_empty_input_returns_empty_list(self):
        self.assertEqual(plan_jobs([]), [])

    def test_single_job(self):
        self.assertEqual(plan_jobs([Job("only")]), ["only"])

    def test_transitive_chain(self):
        jobs = [
            Job("c", depends_on=("b",)),
            Job("b", depends_on=("a",)),
            Job("a"),
        ]
        self.assertEqual(plan_jobs(jobs), ["a", "b", "c"])

    def test_diamond_dependencies(self):
        jobs = [
            Job("d", depends_on=("b", "c")),
            Job("c", depends_on=("a",)),
            Job("b", depends_on=("a",)),
            Job("a", priority=1),
        ]
        order = plan_jobs(jobs)
        self.assertEqual(order[0], "a")
        self.assertEqual(order[-1], "d")
        self.assertEqual(set(order), {"a", "b", "c", "d"})
        self.assertLess(order.index("b"), order.index("d"))
        self.assertLess(order.index("c"), order.index("d"))

    def test_priority_applies_only_among_ready_jobs(self):
        jobs = [
            Job("slow_high", priority=10, depends_on=("prep",)),
            Job("quick_low", priority=1),
            Job("prep", priority=0),
        ]
        # quick_low and prep are ready first; quick_low wins on priority.
        # slow_high is not ready until prep finishes.
        self.assertEqual(plan_jobs(jobs), ["quick_low", "prep", "slow_high"])

    def test_multiple_dependencies_all_precede(self):
        jobs = [
            Job("join", depends_on=("x", "y", "z")),
            Job("x"),
            Job("y"),
            Job("z"),
        ]
        order = plan_jobs(jobs)
        join_at = order.index("join")
        for dep in ("x", "y", "z"):
            self.assertLess(order.index(dep), join_at)

    def test_duplicate_dependency_entries_are_harmless(self):
        jobs = [
            Job("use", depends_on=("src", "src")),
            Job("src"),
        ]
        self.assertEqual(plan_jobs(jobs), ["src", "use"])

    def test_self_dependency_is_a_cycle(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("loop", depends_on=("loop",))])
        self.assertIn("loop", str(ctx.exception))

    def test_two_node_cycle_reports_ids(self):
        jobs = [
            Job("a", depends_on=("b",)),
            Job("b", depends_on=("a",)),
        ]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        message = str(ctx.exception)
        self.assertIn("a", message)
        self.assertIn("b", message)

    def test_cycle_with_independent_jobs_reports_cycle_ids(self):
        jobs = [
            Job("free"),
            Job("a", depends_on=("b",)),
            Job("b", depends_on=("c",)),
            Job("c", depends_on=("a",)),
        ]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        message = str(ctx.exception)
        self.assertIn("a", message)
        self.assertIn("b", message)
        self.assertIn("c", message)

    def test_dependent_of_cycle_is_not_reported_as_cycle_member(self):
        jobs = [
            Job("a", depends_on=("b",)),
            Job("b", depends_on=("a",)),
            Job("tail", depends_on=("a",)),
        ]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        message = str(ctx.exception)
        self.assertIn("a", message)
        self.assertIn("b", message)
        self.assertNotIn("tail", message)

    def test_duplicate_ids_are_rejected(self):
        jobs = [Job("same"), Job("same")]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        self.assertIn("same", str(ctx.exception))

    def test_empty_id_is_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("")])

    def test_non_string_id_is_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job(123)])  # type: ignore[arg-type]

    def test_unknown_dependency_message_names_both_jobs(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("build", depends_on=("missing",))])
        message = str(ctx.exception)
        self.assertIn("build", message)
        self.assertIn("missing", message)

    def test_does_not_mutate_jobs_or_dependencies(self):
        deps = ["fetch"]
        job = Job("build", priority=3, depends_on=tuple(deps))
        jobs = [job, Job("fetch")]
        plan_jobs(jobs)
        self.assertEqual(job.id, "build")
        self.assertEqual(job.priority, 3)
        self.assertEqual(job.depends_on, ("fetch",))
        self.assertEqual(jobs[0], job)
        self.assertEqual(jobs[1].id, "fetch")

    def test_equal_priority_preserves_input_order_after_unlock(self):
        jobs = [
            Job("late1", depends_on=("root",)),
            Job("late2", depends_on=("root",)),
            Job("root", priority=99),
        ]
        # late1 and late2 share priority 0 and unlock together;
        # input order decides between them.
        self.assertEqual(plan_jobs(jobs), ["root", "late1", "late2"])

    def test_negative_priorities_supported(self):
        jobs = [Job("low", priority=-5), Job("high", priority=-1)]
        self.assertEqual(plan_jobs(jobs), ["high", "low"])

    def test_payload_is_preserved_and_ignored(self):
        jobs = [Job("a", payload={"k": 1}), Job("b", depends_on=("a",), payload=42)]
        self.assertEqual(plan_jobs(jobs), ["a", "b"])


if __name__ == "__main__":
    unittest.main()
