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

    def test_chain_of_dependencies(self):
        jobs = [
            Job("c", depends_on=("b",)),
            Job("b", depends_on=("a",)),
            Job("a"),
        ]
        self.assertEqual(plan_jobs(jobs), ["a", "b", "c"])

    def test_multiple_dependencies(self):
        jobs = [
            Job("d", depends_on=("b", "c")),
            Job("b", depends_on=("a",)),
            Job("c", depends_on=("a",)),
            Job("a"),
        ]
        self.assertEqual(plan_jobs(jobs), ["a", "b", "c", "d"])

    def test_diamond_dependencies(self):
        jobs = [
            Job("d", depends_on=("b", "c")),
            Job("b", depends_on=("a",)),
            Job("c", depends_on=("a",)),
            Job("a"),
        ]
        result = plan_jobs(jobs)
        self.assertEqual(result[0], "a")
        self.assertEqual(result[-1], "d")
        self.assertIn("b", result)
        self.assertIn("c", result)
        self.assertLess(result.index("b"), result.index("d"))
        self.assertLess(result.index("c"), result.index("d"))

    def test_priority_ordering_among_ready(self):
        jobs = [
            Job("low", priority=1),
            Job("high", priority=10),
            Job("mid", priority=5),
        ]
        self.assertEqual(plan_jobs(jobs), ["high", "mid", "low"])

    def test_equal_priority_uses_input_order(self):
        jobs = [
            Job("first", priority=5),
            Job("second", priority=5),
            Job("third", priority=5),
        ]
        self.assertEqual(plan_jobs(jobs), ["first", "second", "third"])

    def test_priority_with_dependencies(self):
        jobs = [
            Job("a", priority=1),
            Job("b", priority=10, depends_on=("a",)),
            Job("c", priority=5, depends_on=("a",)),
        ]
        result = plan_jobs(jobs)
        self.assertEqual(result[0], "a")
        self.assertEqual(result[1], "b")
        self.assertEqual(result[2], "c")

    def test_cycle_detection_two_jobs(self):
        jobs = [
            Job("a", depends_on=("b",)),
            Job("b", depends_on=("a",)),
        ]
        with self.assertRaises(ScheduleError) as cm:
            plan_jobs(jobs)
        self.assertIn("a", str(cm.exception))
        self.assertIn("b", str(cm.exception))

    def test_cycle_detection_three_jobs(self):
        jobs = [
            Job("a", depends_on=("c",)),
            Job("b", depends_on=("a",)),
            Job("c", depends_on=("b",)),
        ]
        with self.assertRaises(ScheduleError) as cm:
            plan_jobs(jobs)
        self.assertIn("a", str(cm.exception))
        self.assertIn("b", str(cm.exception))
        self.assertIn("c", str(cm.exception))

    def test_self_dependency_cycle(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("a", depends_on=("a",))])

    def test_duplicate_job_id_rejected(self):
        jobs = [Job("same"), Job("same")]
        with self.assertRaises(ScheduleError) as cm:
            plan_jobs(jobs)
        self.assertIn("Duplicate", str(cm.exception))

    def test_empty_job_id_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("")])

    def test_none_job_id_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job(None)])  # type: ignore[arg-type]

    def test_input_not_mutated(self):
        jobs = [Job("a", depends_on=("b",)), Job("b")]
        original_depends = jobs[0].depends_on
        plan_jobs(jobs)
        self.assertEqual(jobs[0].depends_on, original_depends)

    def test_dependency_lists_not_mutated(self):
        jobs = [Job("a", depends_on=("b",)), Job("b")]
        original_deps = list(jobs[0].depends_on)
        plan_jobs(jobs)
        self.assertEqual(list(jobs[0].depends_on), original_deps)

    def test_complex_graph_with_priorities(self):
        jobs = [
            Job("f", priority=1, depends_on=("d", "e")),
            Job("e", priority=5, depends_on=("c",)),
            Job("d", priority=10, depends_on=("b",)),
            Job("c", priority=2, depends_on=("a",)),
            Job("b", priority=8, depends_on=("a",)),
            Job("a", priority=3),
        ]
        result = plan_jobs(jobs)
        self.assertEqual(result[0], "a")
        self.assertEqual(result[-1], "f")
        self.assertLess(result.index("b"), result.index("d"))
        self.assertLess(result.index("c"), result.index("e"))
        self.assertLess(result.index("d"), result.index("f"))
        self.assertLess(result.index("e"), result.index("f"))


if __name__ == "__main__":
    unittest.main()

