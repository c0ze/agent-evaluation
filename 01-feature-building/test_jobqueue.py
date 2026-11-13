import unittest

from jobqueue import Job, ScheduleError, plan_jobs


class PlanJobsTests(unittest.TestCase):
    def assert_valid_schedule(self, jobs: list[Job], order: list[str]) -> None:
        self.assertEqual(len(order), len(jobs))
        self.assertEqual(set(order), {job.id for job in jobs})
        position = {job_id: idx for idx, job_id in enumerate(order)}
        for job in jobs:
            for dep in job.depends_on:
                self.assertLess(position[dep], position[job.id])

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
        self.assertIn("build", str(ctx.exception))
        self.assertIn("missing", str(ctx.exception))

    def test_empty_inputs_return_empty_list(self):
        self.assertEqual(plan_jobs([]), [])
        self.assertEqual(plan_jobs(()), [])
        self.assertEqual(plan_jobs(job for job in ()), [])

    def test_single_job_and_generator_input(self):
        jobs = (Job("only", priority=-3),)
        self.assertEqual(plan_jobs(job for job in jobs), ["only"])

    def test_diamond_dependencies_and_dynamic_unblocking_priority(self):
        jobs = [
            Job("deploy", priority=100, depends_on=("test_unit", "test_int")),
            Job("test_unit", priority=10, depends_on=("compile",)),
            Job("test_int", priority=20, depends_on=("compile",)),
            Job("compile", priority=5),
            Job("docs", priority=15),
        ]
        order = plan_jobs(jobs)
        self.assert_valid_schedule(jobs, order)
        # Initially ready: compile (5), docs (15) -> docs runs first.
        # Then compile (5) unblocks test_unit (10) and test_int (20).
        # test_int runs before test_unit, then both unblock deploy (100).
        self.assertEqual(
            order, ["docs", "compile", "test_int", "test_unit", "deploy"]
        )

    def test_equal_priority_tiebreak_uses_original_input_order_after_unblock(self):
        jobs = [
            Job("early_in_input", priority=10, depends_on=("setup",)),
            Job("setup", priority=50),
            Job("mid", priority=20),
            Job("late_in_input", priority=10),
        ]
        # setup (50) runs first and unblocks early_in_input (10, idx 0).
        # mid (20) runs next.
        # Now early_in_input (10, idx 0) and late_in_input (10, idx 3) are both ready.
        self.assertEqual(
            plan_jobs(jobs),
            ["setup", "mid", "early_in_input", "late_in_input"],
        )

    def test_negative_zero_and_float_priorities(self):
        jobs = [
            Job("neg", priority=-10),
            Job("zero", priority=0),
            Job("frac", priority=0.5),  # type: ignore[arg-type]
            Job("neg_early", priority=-10),
        ]
        self.assertEqual(plan_jobs(jobs), ["frac", "zero", "neg", "neg_early"])

    def test_duplicate_dependencies_on_single_job_are_deduplicated(self):
        jobs = [
            Job("b", priority=5, depends_on=("a", "a")),
            Job("a", priority=1),
        ]
        self.assertEqual(plan_jobs(jobs), ["a", "b"])

    def test_does_not_mutate_jobs_or_dependency_lists_or_payloads(self):
        deps_b = ["a", "a"]
        deps_a: list[str] = []
        payload_a = {"items": [1, 2]}
        jobs = [
            Job("b", priority=10, depends_on=deps_b),  # type: ignore[arg-type]
            Job("a", priority=1, depends_on=deps_a, payload=payload_a),  # type: ignore[arg-type]
        ]
        snapshot = list(jobs)

        order = plan_jobs(jobs)

        self.assertEqual(order, ["a", "b"])
        self.assertEqual(jobs, snapshot)
        self.assertEqual(deps_b, ["a", "a"])
        self.assertEqual(deps_a, [])
        self.assertEqual(payload_a, {"items": [1, 2]})

    def test_invalid_job_ids_are_rejected(self):
        for bad_id in ("", None, 123):
            with self.subTest(bad_id=bad_id):
                with self.assertRaises(ScheduleError):
                    plan_jobs([Job(bad_id)])  # type: ignore[arg-type]

    def test_duplicate_job_ids_are_rejected(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("dup", priority=1), Job("dup", priority=2)])
        self.assertIn("dup", str(ctx.exception))

    def test_invalid_depends_on_structures_are_rejected(self):
        for bad_deps in ("a", b"a", None, 42, ("",), (None,)):
            with self.subTest(bad_deps=bad_deps):
                with self.assertRaises(ScheduleError):
                    plan_jobs([Job("a"), Job("b", depends_on=bad_deps)])  # type: ignore[arg-type]

    def test_invalid_collection_items_and_priorities_are_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs(None)  # type: ignore[arg-type]
        with self.assertRaises(ScheduleError):
            plan_jobs(["not-a-job"])  # type: ignore[list-item]
        for bad_priority in (None, "high", True, float("nan")):
            with self.subTest(bad_priority=bad_priority):
                with self.assertRaises(ScheduleError):
                    plan_jobs([Job("a", priority=bad_priority)])  # type: ignore[arg-type]

    def test_self_dependency_cycle_is_rejected_with_id(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("solo", depends_on=("solo",))])
        self.assertIn("solo", str(ctx.exception))

    def test_two_node_cycle_is_rejected_with_ids(self):
        jobs = [
            Job("alpha", depends_on=("beta",)),
            Job("beta", depends_on=("alpha",)),
        ]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        msg = str(ctx.exception)
        self.assertIn("alpha", msg)
        self.assertIn("beta", msg)

    def test_three_node_cycle_excludes_non_cycle_jobs_from_cycle_diagnostic(self):
        jobs = [
            Job("downstream", depends_on=("a",)),
            Job("a", depends_on=("b",)),
            Job("b", depends_on=("c",)),
            Job("c", depends_on=("a",)),
            Job("independent", priority=100),
        ]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        msg = str(ctx.exception)
        for cycle_id in ("a", "b", "c"):
            self.assertIn(cycle_id, msg)
        self.assertNotIn("downstream", msg)
        self.assertNotIn("independent", msg)

    def test_deep_chain_acyclic_and_cyclic_avoid_recursion_limit(self):
        depth = 2500
        acyclic_jobs = [Job("j0")] + [
            Job(f"j{i}", depends_on=(f"j{i - 1}",)) for i in range(1, depth)
        ]
        order = plan_jobs(reversed(acyclic_jobs))
        self.assertEqual(order, [f"j{i}" for i in range(depth)])

        cyclic_jobs = [Job("j0", depends_on=(f"j{depth - 1}",))] + [
            Job(f"j{i}", depends_on=(f"j{i - 1}",)) for i in range(1, depth)
        ]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(cyclic_jobs)
        self.assertIn("j0", str(ctx.exception))
        self.assertIn(f"j{depth - 1}", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()

