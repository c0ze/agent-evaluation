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
        with self.assertRaisesRegex(ScheduleError, "unknown job 'missing'"):
            plan_jobs([Job("build", depends_on=("missing",))])

    def test_newly_ready_high_priority_job_precedes_waiting_jobs(self):
        jobs = [
            Job("first", priority=10),
            Job("second", priority=1),
            Job("urgent", priority=20, depends_on=("first",)),
        ]
        self.assertEqual(plan_jobs(jobs), ["first", "urgent", "second"])

    def test_equal_priority_jobs_keep_input_order_when_released_together(self):
        jobs = [
            Job("dependent-later", priority=3, depends_on=("root",)),
            Job("root", priority=4),
            Job("already-ready", priority=3),
        ]
        self.assertEqual(plan_jobs(jobs), ["root", "dependent-later", "already-ready"])

    def test_rejects_empty_and_non_string_ids(self):
        for job_id in ("", None, 12):
            with self.subTest(job_id=job_id):
                with self.assertRaisesRegex(ScheduleError, "non-empty strings"):
                    plan_jobs([Job(job_id)])

    def test_rejects_duplicate_ids(self):
        with self.assertRaisesRegex(ScheduleError, "Duplicate job ID: 'same'"):
            plan_jobs([Job("same"), Job("same")])

    def test_rejects_invalid_dependencies(self):
        for dependency in ("", None, 42):
            with self.subTest(dependency=dependency):
                with self.assertRaisesRegex(ScheduleError, "non-empty job ID strings"):
                    plan_jobs([Job("build", depends_on=(dependency,))])

    def test_self_dependency_is_a_cycle(self):
        with self.assertRaisesRegex(ScheduleError, "cycle.*self"):
            plan_jobs([Job("self", depends_on=("self",))])

    def test_multi_job_cycle_reports_blocked_ids(self):
        jobs = [
            Job("a", depends_on=("b",)),
            Job("b", depends_on=("a",)),
            Job("blocked", depends_on=("a",)),
        ]
        with self.assertRaises(ScheduleError) as raised:
            plan_jobs(jobs)
        self.assertIn("a", str(raised.exception))
        self.assertIn("b", str(raised.exception))

    def test_does_not_mutate_jobs_or_dependency_lists(self):
        dependencies = ["root"]
        jobs = [Job("child", depends_on=dependencies), Job("root")]
        original_jobs = jobs.copy()

        self.assertEqual(plan_jobs(jobs), ["root", "child"])
        self.assertEqual(jobs, original_jobs)
        self.assertEqual(dependencies, ["root"])
        self.assertIs(jobs[0].depends_on, dependencies)


if __name__ == "__main__":
    unittest.main()
