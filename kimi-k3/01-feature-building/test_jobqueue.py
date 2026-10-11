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
        self.assertEqual(plan_jobs([Job("only", priority=-3)]), ["only"])

    def test_duplicate_id_is_rejected(self):
        jobs = [Job("a"), Job("a", priority=9)]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        self.assertIn("a", str(ctx.exception))

    def test_empty_id_is_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("")])

    def test_non_string_id_is_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job(42)])

    def test_self_dependency_is_a_cycle(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("a", depends_on=("a",))])
        self.assertIn("a", str(ctx.exception))

    def test_two_node_cycle_is_detected(self):
        jobs = [
            Job("a", depends_on=("b",)),
            Job("b", depends_on=("a",)),
        ]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        message = str(ctx.exception)
        self.assertIn("a", message)
        self.assertIn("b", message)

    def test_cycle_among_acyclic_jobs(self):
        jobs = [
            Job("ok"),
            Job("x", depends_on=("z",)),
            Job("y", depends_on=("x",)),
            Job("z", depends_on=("y",)),
        ]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        message = str(ctx.exception)
        for jid in ("x", "y", "z"):
            self.assertIn(jid, message)

    def test_diamond_dependency_runs_once_after_all_deps(self):
        jobs = [
            Job("top", priority=50, depends_on=("left", "right")),
            Job("left", depends_on=("base",)),
            Job("right", depends_on=("base",)),
            Job("base"),
        ]
        order = plan_jobs(jobs)
        self.assertEqual(sorted(order), ["base", "left", "right", "top"])
        self.assertLess(order.index("base"), order.index("left"))
        self.assertLess(order.index("base"), order.index("right"))
        self.assertLess(order.index("left"), order.index("top"))
        self.assertLess(order.index("right"), order.index("top"))

    def test_priority_only_applies_among_ready_jobs(self):
        jobs = [
            Job("low-but-free", priority=1),
            Job("high-blocked", priority=100, depends_on=("low-but-free",)),
        ]
        self.assertEqual(plan_jobs(jobs), ["low-but-free", "high-blocked"])

    def test_negative_priorities_order_correctly(self):
        jobs = [Job("a", -5), Job("b", -10), Job("c", 0)]
        self.assertEqual(plan_jobs(jobs), ["c", "a", "b"])

    def test_input_is_not_mutated(self):
        deps = ("base",)
        jobs = [
            Job("top", depends_on=deps),
            Job("base"),
        ]
        snapshot = [(j.id, j.priority, j.depends_on) for j in jobs]
        plan_jobs(jobs)
        self.assertEqual([(j.id, j.priority, j.depends_on) for j in jobs], snapshot)
        self.assertIs(jobs[0].depends_on, deps)

    def test_accepts_any_iterable(self):
        jobs = (Job(jid) for jid in ("a", "b"))
        self.assertEqual(plan_jobs(jobs), ["a", "b"])

    def test_repeated_dependency_edges_still_work(self):
        jobs = [
            Job("top", depends_on=("base", "base")),
            Job("base"),
        ]
        self.assertEqual(plan_jobs(jobs), ["base", "top"])

    def test_long_chain(self):
        count = 200
        jobs = [Job("j0")] + [
            Job(f"j{i}", depends_on=(f"j{i - 1}",)) for i in range(1, count)
        ]
        self.assertEqual(plan_jobs(jobs), [f"j{i}" for i in range(count)])


if __name__ == "__main__":
    unittest.main()

