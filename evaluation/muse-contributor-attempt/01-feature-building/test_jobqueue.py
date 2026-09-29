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

    def test_two_job_cycle_names_ids(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("a", depends_on=("b",)), Job("b", depends_on=("a",))])
        msg = str(ctx.exception)
        self.assertIn("a", msg)
        self.assertIn("b", msg)

    def test_three_job_cycle(self):
        jobs = [
            Job("a", depends_on=("c",)),
            Job("b", depends_on=("a",)),
            Job("c", depends_on=("b",)),
        ]
        with self.assertRaises(ScheduleError):
            plan_jobs(jobs)

    def test_chain_order(self):
        jobs = [Job("c", depends_on=("b",)), Job("b", depends_on=("a",)), Job("a")]
        self.assertEqual(plan_jobs(jobs), ["a", "b", "c"])

    def test_diamond_priority_after_join(self):
        jobs = [
            Job("low", priority=1, depends_on=("root",)),
            Job("high", priority=9, depends_on=("root",)),
            Job("root", priority=0),
        ]
        self.assertEqual(plan_jobs(jobs), ["root", "high", "low"])

    def test_duplicate_dependencies_ok(self):
        jobs = [Job("a"), Job("b", depends_on=("a", "a"))]
        self.assertEqual(plan_jobs(jobs), ["a", "b"])

    def test_does_not_mutate_inputs(self):
        deps = ["b"]
        jobs = [Job("a", depends_on=deps), Job("b")]  # type: ignore[arg-type]
        snapshot = (list(deps), [(j.id, tuple(j.depends_on)) for j in jobs])
        plan_jobs(jobs)
        self.assertEqual(list(deps), snapshot[0])
        self.assertEqual([(j.id, tuple(j.depends_on)) for j in jobs], snapshot[1])

    def test_forward_reference_dependency(self):
        jobs = [Job("a", depends_on=("b",)), Job("b")]
        self.assertEqual(plan_jobs(jobs), ["b", "a"])


if __name__ == "__main__":
    unittest.main()
