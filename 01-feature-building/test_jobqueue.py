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

    def test_newly_ready_job_competes_by_priority(self):
        jobs = [Job("fetch", 5), Job("lint", 1), Job("build", 10, ("fetch",))]
        self.assertEqual(plan_jobs(jobs), ["fetch", "build", "lint"])

    def test_newly_ready_job_wins_tie_by_input_order(self):
        jobs = [Job("build", -1, ("fetch",)), Job("lint", -1), Job("fetch")]
        self.assertEqual(plan_jobs(jobs), ["fetch", "build", "lint"])

    def test_all_dependencies_must_finish(self):
        jobs = [
            Job("publish", 10, ("build", "test")),
            Job("build", 2, ("fetch",)),
            Job("test", 1, ("fetch",)),
            Job("fetch"),
        ]
        self.assertEqual(plan_jobs(iter(jobs)), ["fetch", "build", "test", "publish"])

    def test_repeated_dependencies_and_input_preservation(self):
        dependencies = ["z", "a", "z"]
        jobs = [Job("build", depends_on=dependencies), Job("a"), Job("z")]
        original_jobs = jobs.copy()

        self.assertEqual(plan_jobs(jobs), ["a", "z", "build"])
        self.assertEqual(jobs, original_jobs)
        self.assertIs(jobs[0].depends_on, dependencies)
        self.assertEqual(dependencies, ["z", "a", "z"])
        self.assertEqual(plan_jobs(jobs), ["a", "z", "build"])

    def test_invalid_job_ids_are_rejected(self):
        for job_id in ("", None, 23, []):
            with self.subTest(job_id=job_id):
                with self.assertRaisesRegex(ScheduleError, "non-empty string ID"):
                    plan_jobs([Job(job_id)])

    def test_duplicate_job_ids_are_rejected(self):
        with self.assertRaisesRegex(ScheduleError, "Duplicate job ID 'build'"):
            plan_jobs([Job("build"), Job("fetch"), Job("build", 10)])

    def test_unknown_dependency_is_rejected(self):
        with self.assertRaisesRegex(ScheduleError, "'build'.*'missing'"):
            plan_jobs([Job("build", depends_on=("missing",))])

    def test_non_string_dependency_is_rejected(self):
        with self.assertRaisesRegex(ScheduleError, "'build'.*unknown dependency"):
            plan_jobs([Job("build", depends_on=(["fetch"],)), Job("fetch")])

    def test_non_iterable_dependencies_are_rejected(self):
        with self.assertRaisesRegex(ScheduleError, "'build'.*iterable"):
            plan_jobs([Job("build", depends_on=None)])

    def test_self_dependency_reports_cycle(self):
        with self.assertRaisesRegex(ScheduleError, "cycle.*'build'"):
            plan_jobs([Job("build", depends_on=("build",))])

    def test_cycle_reports_members(self):
        jobs = [
            Job("publish", depends_on=("build",)),
            Job("build", depends_on=("package",)),
            Job("package", depends_on=("test",)),
            Job("test", depends_on=("build",)),
            Job("fetch"),
        ]
        with self.assertRaises(ScheduleError) as caught:
            plan_jobs(jobs)

        diagnostic = str(caught.exception)
        for job_id in ("build", "package", "test"):
            self.assertIn(job_id, diagnostic)
        self.assertNotIn("publish", diagnostic)
        self.assertNotIn("fetch", diagnostic)


if __name__ == "__main__":
    unittest.main()

