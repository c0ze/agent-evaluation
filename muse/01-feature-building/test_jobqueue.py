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


class PlanJobsEdgeCases(unittest.TestCase):
    def test_empty_input_returns_empty(self):
        self.assertEqual(plan_jobs([]), [])

    def test_duplicate_ids_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("a"), Job("a")])

    def test_empty_id_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("")])

    def test_non_string_id_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job(123)])  # type: ignore[arg-type]

    def test_self_dependency_is_cycle(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("a", depends_on=("a",))])
        self.assertIn("a", str(ctx.exception))

    def test_two_node_cycle_names_ids(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("a", depends_on=("b",)), Job("b", depends_on=("a",))])
        msg = str(ctx.exception)
        self.assertIn("a", msg)
        self.assertIn("b", msg)

    def test_diamond_dependency_order(self):
        jobs = [
            Job("d", depends_on=("b", "c")),
            Job("b", depends_on=("a",)),
            Job("c", depends_on=("a",)),
            Job("a"),
        ]
        order = plan_jobs(jobs)
        self.assertEqual(order[0], "a")
        self.assertEqual(order[-1], "d")
        self.assertEqual(sorted(order), ["a", "b", "c", "d"])

    def test_priority_applies_only_among_ready(self):
        jobs = [
            Job("low", priority=1),
            Job("high", priority=99, depends_on=("low",)),
            Job("mid", priority=50),
        ]
        self.assertEqual(plan_jobs(jobs), ["mid", "low", "high"])

    def test_equal_priority_keeps_input_order(self):
        jobs = [Job("x", 3), Job("y", 3), Job("z", 3)]
        self.assertEqual(plan_jobs(jobs), ["x", "y", "z"])

    def test_does_not_mutate_inputs(self):
        dep_list = ("b",)
        jobs = [Job("a", depends_on=dep_list), Job("b")]
        snapshot = (list(jobs), jobs[0].depends_on)
        plan_jobs(jobs)
        self.assertEqual(list(jobs), snapshot[0])
        self.assertEqual(jobs[0].depends_on, snapshot[1])
        self.assertIs(jobs[0].depends_on, dep_list)

    def test_accepts_generator_input(self):
        order = plan_jobs(Job(i) for i in ("a", "b"))
        self.assertEqual(order, ["a", "b"])

    def test_duplicate_dependency_entries_ok(self):
        jobs = [Job("a", depends_on=("b", "b")), Job("b")]
        self.assertEqual(plan_jobs(jobs), ["b", "a"])


if __name__ == "__main__":
    unittest.main()

