import unittest

from jobqueue import Job, ScheduleError, plan_jobs


class PlanJobsTests(unittest.TestCase):
    def test_empty_input(self):
        self.assertEqual(plan_jobs([]), [])

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
        with self.assertRaises(ScheduleError) as caught:
            plan_jobs([Job("build", depends_on=("missing",))])
        self.assertIn("build", str(caught.exception))
        self.assertIn("missing", str(caught.exception))

    def test_newly_ready_job_competes_immediately(self):
        jobs = [Job("later", -2), Job("first", -1), Job("next", 0, ("first",))]
        self.assertEqual(plan_jobs(jobs), ["first", "next", "later"])

    def test_newly_ready_tie_uses_original_position(self):
        jobs = [Job("zebra", 1, ("start",)), Job("start", 2), Job("alpha", 1)]
        self.assertEqual(plan_jobs(jobs), ["start", "zebra", "alpha"])

    def test_diamond_with_repeated_dependency_and_one_shot_input(self):
        dependencies = ["right", "left", "right"]
        jobs = [
            Job("finish", 10, dependencies),
            Job("left", 3, ("start",)),
            Job("right", 2, ("start",)),
            Job("start"),
        ]
        self.assertEqual(plan_jobs(iter(jobs)), ["start", "left", "right", "finish"])
        self.assertEqual(dependencies, ["right", "left", "right"])

    def test_job_list_keeps_its_input_order(self):
        jobs = [Job("low", -1), Job("high", 5)]
        original = jobs.copy()
        self.assertEqual(plan_jobs(jobs), ["high", "low"])
        self.assertEqual(jobs, original)

    def test_invalid_job_ids(self):
        for job_id in ("", None, 3, []):
            with self.subTest(job_id=job_id):
                with self.assertRaisesRegex(ScheduleError, "non-empty string"):
                    plan_jobs([Job(job_id)])

    def test_duplicate_job_id(self):
        with self.assertRaisesRegex(ScheduleError, "compile"):
            plan_jobs([Job("compile"), Job("compile", 9)])

    def test_unhashable_dependency(self):
        with self.assertRaisesRegex(ScheduleError, "build"):
            plan_jobs([Job("build", depends_on=([],))])

    def test_self_dependency(self):
        with self.assertRaises(ScheduleError) as caught:
            plan_jobs([Job("loop", depends_on=("loop",))])
        self.assertIn("cycle", str(caught.exception).lower())
        self.assertIn("loop", str(caught.exception))

    def test_cycle_in_disconnected_component(self):
        jobs = [
            Job("independent"),
            Job("downstream", depends_on=("red",)),
            Job("red", depends_on=("green",)),
            Job("green", depends_on=("blue",)),
            Job("blue", depends_on=("red",)),
        ]
        with self.assertRaises(ScheduleError) as caught:
            plan_jobs(jobs)
        for job_id in ("red", "green", "blue"):
            self.assertIn(job_id, str(caught.exception))


if __name__ == "__main__":
    unittest.main()

