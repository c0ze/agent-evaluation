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

    def test_transitive_dependency_chain(self):
        jobs = [
            Job("a", depends_on=("b",)),
            Job("b", depends_on=("c",)),
            Job("c"),
        ]
        self.assertEqual(plan_jobs(jobs), ["c", "b", "a"])

    def test_priority_orders_newly_ready_jobs(self):
        jobs = [
            Job("a", priority=1, depends_on=("root",)),
            Job("b", priority=9, depends_on=("root",)),
            Job("c", priority=5, depends_on=("root",)),
            Job("root", priority=0),
        ]
        self.assertEqual(plan_jobs(jobs), ["root", "b", "c", "a"])

    def test_multiple_dependencies(self):
        jobs = [
            Job("deploy", depends_on=("test", "build")),
            Job("test", depends_on=("build",)),
            Job("build"),
        ]
        self.assertEqual(plan_jobs(jobs), ["build", "test", "deploy"])

    def test_direct_cycle_is_rejected_with_ids(self):
        jobs = [Job("a", depends_on=("b",)), Job("b", depends_on=("a",))]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        self.assertIn("a", str(ctx.exception))
        self.assertIn("b", str(ctx.exception))

    def test_self_dependency_cycle_is_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("a", depends_on=("a",))])

    def test_longer_cycle_is_rejected(self):
        jobs = [
            Job("a", depends_on=("c",)),
            Job("b", depends_on=("a",)),
            Job("c", depends_on=("b",)),
        ]
        with self.assertRaises(ScheduleError):
            plan_jobs(jobs)

    def test_duplicate_job_id_is_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("a"), Job("a")])

    def test_empty_job_id_is_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("")])

    def test_non_string_job_id_is_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job(123)])  # type: ignore[arg-type]

    def test_input_is_not_mutated(self):
        dep_list = ["b"]
        jobs = [Job("a", depends_on=tuple(dep_list)), Job("b")]
        snapshot = [(job.id, job.priority, tuple(job.depends_on)) for job in jobs]
        plan_jobs(jobs)
        self.assertEqual(
            [(job.id, job.priority, tuple(job.depends_on)) for job in jobs],
            snapshot,
        )

    def test_negative_priorities_are_honored(self):
        jobs = [Job("a", priority=-1), Job("b", priority=-5), Job("c", priority=0)]
        self.assertEqual(plan_jobs(jobs), ["c", "a", "b"])


if __name__ == "__main__":
    unittest.main()
