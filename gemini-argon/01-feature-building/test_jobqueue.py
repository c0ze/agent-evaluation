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
        self.assertEqual(plan_jobs(job for job in ()), [])

    def test_invalid_job_ids_are_rejected(self):
        for bad_id in ("", "   ", None, 42):
            with self.subTest(bad_id=bad_id):
                with self.assertRaises(ScheduleError):
                    plan_jobs([Job(bad_id)])  # type: ignore[arg-type]

    def test_duplicate_job_ids_are_rejected(self):
        jobs = [Job("dup", priority=1), Job("dup", priority=2)]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        self.assertIn("dup", str(ctx.exception))

    def test_invalid_depends_on_container_or_element_is_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("a"), Job("b", depends_on="a")])  # type: ignore[arg-type]
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("a", depends_on=("",))])

    def test_self_dependency_cycle_is_rejected_with_id(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("self_loop", depends_on=("self_loop",))])
        self.assertIn("self_loop", str(ctx.exception))

    def test_multi_node_cycle_reports_involved_ids_only(self):
        jobs = [
            Job("independent", priority=10),
            Job("alpha", priority=5, depends_on=("gamma",)),
            Job("beta", priority=4, depends_on=("alpha",)),
            Job("gamma", priority=3, depends_on=("beta",)),
            Job("downstream", priority=20, depends_on=("alpha",)),
        ]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        message = str(ctx.exception)
        for cycle_id in ("alpha", "beta", "gamma"):
            self.assertIn(cycle_id, message)
        self.assertNotIn("independent", message)
        self.assertNotIn("downstream", message)

    def test_diamond_graph_and_negative_priorities(self):
        jobs = [
            Job("deploy", priority=50, depends_on=("test_unit", "test_integ")),
            Job("test_unit", priority=-5, depends_on=("compile",)),
            Job("test_integ", priority=0, depends_on=("compile",)),
            Job("compile", priority=-10),
        ]
        self.assertEqual(
            plan_jobs(jobs),
            ["compile", "test_integ", "test_unit", "deploy"],
        )

    def test_tie_breaking_uses_original_input_order_across_waves(self):
        jobs = [
            Job("late_unblocked_first_in_input", priority=10, depends_on=("gate",)),
            Job("already_ready_second_in_input", priority=10),
            Job("gate", priority=20),
        ]
        # "gate" runs first (priority 20), unlocking index 0 (priority 10),
        # which ties with index 1 (priority 10) and wins by earlier input index.
        self.assertEqual(
            plan_jobs(jobs),
            [
                "gate",
                "late_unblocked_first_in_input",
                "already_ready_second_in_input",
            ],
        )

    def test_duplicate_dependency_entries_are_handled(self):
        jobs = [
            Job("b", priority=5, depends_on=("a", "a")),
            Job("a", priority=1),
        ]
        self.assertEqual(plan_jobs(jobs), ["a", "b"])

    def test_does_not_mutate_inputs_and_accepts_generators(self):
        dep_list = ["a", "b"]
        payload = {"key": "value"}
        jobs = [
            Job("c", priority=10, depends_on=dep_list, payload=payload),  # type: ignore[arg-type]
            Job("b", priority=2),
            Job("a", priority=2),
        ]
        jobs_snapshot = list(jobs)
        dep_snapshot = list(dep_list)

        result = plan_jobs(job for job in jobs)
        self.assertEqual(result, ["b", "a", "c"])
        self.assertEqual(jobs, jobs_snapshot)
        self.assertEqual(dep_list, dep_snapshot)
        self.assertEqual(payload, {"key": "value"})


if __name__ == "__main__":
    unittest.main()
