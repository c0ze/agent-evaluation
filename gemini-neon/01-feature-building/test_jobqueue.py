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
        self.assertIn("build", str(ctx.exception))
        self.assertIn("missing", str(ctx.exception))

    def test_empty_input_returns_empty_list(self):
        self.assertEqual(plan_jobs([]), [])
        self.assertEqual(plan_jobs(()), [])
        self.assertEqual(plan_jobs(j for j in ()), [])

    def test_single_job_and_generator_input(self):
        self.assertEqual(plan_jobs([Job("only")]), ["only"])
        gen = (
            job
            for job in [
                Job("deploy", priority=5, depends_on=("test",)),
                Job("test", priority=1, depends_on=("build",)),
                Job("build", priority=0),
            ]
        )
        self.assertEqual(plan_jobs(gen), ["build", "test", "deploy"])

    def test_negative_zero_and_positive_priorities(self):
        jobs = [
            Job("neg", priority=-10),
            Job("zero", priority=0),
            Job("pos", priority=10),
            Job("neg_two", priority=-10),
        ]
        self.assertEqual(plan_jobs(jobs), ["pos", "zero", "neg", "neg_two"])

    def test_newly_unlocked_higher_priority_preempts_waiting_job(self):
        jobs = [
            Job("setup", priority=10),
            Job("background", priority=5),
            Job("urgent", priority=100, depends_on=("setup",)),
        ]
        self.assertEqual(plan_jobs(jobs), ["setup", "urgent", "background"])

    def test_equal_priority_breaks_tie_by_original_input_order_when_unlocked(self):
        jobs = [
            Job("early_dep", priority=5, depends_on=("init",)),
            Job("later_ready", priority=5),
            Job("init", priority=10),
        ]
        self.assertEqual(plan_jobs(jobs), ["init", "early_dep", "later_ready"])

    def test_diamond_graph_and_duplicate_dependencies_on_same_job(self):
        jobs = [
            Job("package", priority=50, depends_on=("lint", "test", "test")),
            Job("lint", priority=1, depends_on=("fetch", "fetch")),
            Job("test", priority=2, depends_on=("fetch",)),
            Job("fetch", priority=0),
        ]
        self.assertEqual(plan_jobs(jobs), ["fetch", "test", "lint", "package"])

    def test_disconnected_components_interleaved_by_priority(self):
        jobs = [
            Job("a2", priority=20, depends_on=("a1",)),
            Job("b2", priority=5, depends_on=("b1",)),
            Job("a1", priority=1),
            Job("b1", priority=10),
        ]
        self.assertEqual(plan_jobs(jobs), ["b1", "b2", "a1", "a2"])

    def test_invalid_job_ids_are_rejected(self):
        for bad_id in ("", None, 123):
            with self.subTest(bad_id=bad_id):
                with self.assertRaises(ScheduleError):
                    plan_jobs([Job(bad_id)])  # type: ignore[arg-type]

    def test_duplicate_job_id_is_rejected(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("dup", priority=1), Job("dup", priority=2)])
        self.assertIn("dup", str(ctx.exception))

    def test_invalid_dependencies_container_or_entries_are_rejected(self):
        invalid_cases = [
            [Job("a"), Job("b", depends_on="a")],  # type: ignore[arg-type]
            [Job("a"), Job("b", depends_on=None)],  # type: ignore[arg-type]
            [Job("a"), Job("b", depends_on=("",))],
            [Job("a"), Job("b", depends_on=(None,))],  # type: ignore[arg-type]
            [Job("a"), Job("b", depends_on=(["a"],))],  # type: ignore[arg-type]
        ]
        for jobs in invalid_cases:
            with self.subTest(jobs=jobs):
                with self.assertRaises(ScheduleError):
                    plan_jobs(jobs)

    def test_invalid_priority_or_jobs_container_are_rejected(self):
        for bad_priority in (True, "high", None, float("nan")):
            with self.subTest(bad_priority=bad_priority):
                with self.assertRaises(ScheduleError):
                    plan_jobs([Job("a", priority=bad_priority)])  # type: ignore[arg-type]

        for bad_jobs in ("abc", None, 42, ["not-a-job"]):
            with self.subTest(bad_jobs=bad_jobs):
                with self.assertRaises(ScheduleError):
                    plan_jobs(bad_jobs)  # type: ignore[arg-type]

    def test_self_dependency_cycle(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("self_job", depends_on=("self_job",))])
        self.assertIn("self_job", str(ctx.exception))

    def test_cycle_diagnostic_includes_cycle_ids_and_excludes_non_cycle_nodes(self):
        jobs = [
            Job("root"),
            Job("downstream", depends_on=("alpha",)),
            Job("alpha", depends_on=("beta", "root")),
            Job("beta", depends_on=("gamma",)),
            Job("gamma", depends_on=("alpha",)),
        ]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        message = str(ctx.exception)
        for cycle_id in ("alpha", "beta", "gamma"):
            self.assertIn(cycle_id, message)
        self.assertNotIn("root", message)
        self.assertNotIn("downstream", message)

    def test_multiple_disjoint_cycles_report_all_cycle_ids(self):
        jobs = [
            Job("a", depends_on=("b",)),
            Job("b", depends_on=("a",)),
            Job("x", depends_on=("y",)),
            Job("y", depends_on=("x",)),
        ]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        message = str(ctx.exception)
        for cycle_id in ("a", "b", "x", "y"):
            self.assertIn(cycle_id, message)

    def test_overlapping_cycles_report_all_involved_ids(self):
        jobs = [
            Job("a", depends_on=("b", "c")),
            Job("b", depends_on=("a",)),
            Job("c", depends_on=("b",)),
        ]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        message = str(ctx.exception)
        for cycle_id in ("a", "b", "c"):
            self.assertIn(cycle_id, message)

    def test_deep_chain_and_deep_cycle_avoid_recursion_limit(self):
        size = 2000
        chain = [
            Job(f"j{i}", depends_on=(f"j{i - 1}",) if i > 0 else ())
            for i in range(size)
        ]
        self.assertEqual(plan_jobs(chain), [f"j{i}" for i in range(size)])

        cycle = [
            Job(f"c{i}", depends_on=(f"c{(i + 1) % size}",))
            for i in range(size)
        ]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(cycle)
        self.assertIn("c0", str(ctx.exception))
        self.assertIn(f"c{size - 1}", str(ctx.exception))

    def test_does_not_mutate_jobs_or_dependency_lists(self):
        deps_b = ["a", "a"]
        deps_c = ["b", "a"]
        payload_a = {"step": 1}
        job_a = Job("a", priority=1, depends_on=[], payload=payload_a)  # type: ignore[arg-type]
        job_b = Job("b", priority=2, depends_on=deps_b)  # type: ignore[arg-type]
        job_c = Job("c", priority=3, depends_on=deps_c)  # type: ignore[arg-type]
        jobs = [job_c, job_b, job_a]
        original_jobs_snapshot = list(jobs)

        result = plan_jobs(jobs)
        self.assertEqual(result, ["a", "b", "c"])
        self.assertEqual(jobs, original_jobs_snapshot)
        self.assertEqual(deps_b, ["a", "a"])
        self.assertEqual(deps_c, ["b", "a"])
        self.assertEqual(payload_a, {"step": 1})

        cyclic_deps = ["y"]
        cyclic_jobs = [
            Job("x", depends_on=cyclic_deps),  # type: ignore[arg-type]
            Job("y", depends_on=["x"]),  # type: ignore[arg-type]
        ]
        with self.assertRaises(ScheduleError):
            plan_jobs(cyclic_jobs)
        self.assertEqual(cyclic_deps, ["y"])
        self.assertEqual(cyclic_jobs[1].depends_on, ["x"])


if __name__ == "__main__":
    unittest.main()

