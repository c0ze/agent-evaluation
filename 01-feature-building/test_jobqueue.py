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

    # --- Trivial input -----------------------------------------------------

    def test_empty_input_returns_empty_list(self):
        self.assertEqual(plan_jobs([]), [])

    def test_single_job_with_no_deps(self):
        self.assertEqual(plan_jobs([Job("solo")]), ["solo"])

    def test_generator_input_is_consumed_once(self):
        def gen():
            yield Job("a", priority=1)
            yield Job("b", priority=2)

        self.assertEqual(plan_jobs(gen()), ["b", "a"])

    # --- Shape coverage ----------------------------------------------------

    def test_diamond_dependency_preserves_partial_order(self):
        # A is depended on by B and D; C depends on both B and D.
        jobs = [
            Job("A"),
            Job("B", depends_on=("A",)),
            Job("D", depends_on=("A",)),
            Job("C", depends_on=("B", "D")),
        ]
        result = plan_jobs(jobs)
        self.assertEqual(len(result), 4)
        self.assertEqual(set(result), {"A", "B", "D", "C"})
        idx = {jid: i for i, jid in enumerate(result)}
        self.assertLess(idx["A"], idx["B"])
        self.assertLess(idx["A"], idx["D"])
        self.assertLess(idx["B"], idx["C"])
        self.assertLess(idx["D"], idx["C"])

    def test_complex_chain_with_priorities(self):
        # Highest priority sits in the middle of the chain; correctness of
        # the topological order must override the priority preference.
        jobs = [
            Job("compile", priority=1),
            Job("link", priority=10, depends_on=("compile",)),
            Job("test", priority=5, depends_on=("link",)),
            Job("package", priority=5, depends_on=("test",)),
        ]
        self.assertEqual(
            plan_jobs(jobs),
            ["compile", "link", "test", "package"],
        )

    def test_ready_jobs_with_equal_priority_use_input_order(self):
        jobs = [Job("first"), Job("b"), Job("c"), Job("last")]
        self.assertEqual(plan_jobs(jobs), ["first", "b", "c", "last"])

    def test_disjoint_subgraphs_are_ordered_independently(self):
        jobs = [
            Job("x1"),
            Job("x2", depends_on=("x1",)),
            Job("y1"),
            Job("y2", depends_on=("y1",)),
        ]
        result = plan_jobs(jobs)
        idx = {jid: i for i, jid in enumerate(result)}
        self.assertEqual(set(result), {"x1", "x2", "y1", "y2"})
        self.assertLess(idx["x1"], idx["x2"])
        self.assertLess(idx["y1"], idx["y2"])

    def test_result_is_complete_and_unique(self):
        jobs = [
            Job("a"),
            Job("b", depends_on=("a",)),
            Job("c", depends_on=("a", "b")),
            Job("d", depends_on=("c",)),
            Job("e", depends_on=("c",)),
        ]
        result = plan_jobs(jobs)
        self.assertEqual(len(result), len(set(result)))
        self.assertEqual(set(result), {"a", "b", "c", "d", "e"})

    # --- Priorities --------------------------------------------------------

    def test_negative_priorities_order_lower_first(self):
        jobs = [Job("a", priority=-5), Job("b", priority=-1)]
        self.assertEqual(plan_jobs(jobs), ["b", "a"])

    # --- Cycle detection ---------------------------------------------------

    def test_cycle_of_two_jobs_raises_with_ids_in_message(self):
        jobs = [
            Job("a", depends_on=("b",)),
            Job("b", depends_on=("a",)),
        ]
        with self.assertRaises(ScheduleError) as cm:
            plan_jobs(jobs)
        msg = str(cm.exception)
        self.assertIn("'a'", msg)
        self.assertIn("'b'", msg)

    def test_cycle_of_three_jobs_raises_with_ids_in_message(self):
        jobs = [
            Job("a", depends_on=("c",)),
            Job("b", depends_on=("a",)),
            Job("c", depends_on=("b",)),
        ]
        with self.assertRaises(ScheduleError) as cm:
            plan_jobs(jobs)
        msg = str(cm.exception)
        for jid in ("a", "b", "c"):
            self.assertIn(f"'{jid}'", msg)

    def test_self_loop_is_a_cycle(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("a", depends_on=("a",))])

    def test_cycle_diagnostic_excludes_unrelated_jobs(self):
        # "free" is independent of the a<->b cycle.
        jobs = [
            Job("free"),
            Job("a", depends_on=("b",)),
            Job("b", depends_on=("a",)),
        ]
        with self.assertRaises(ScheduleError) as cm:
            plan_jobs(jobs)
        msg = str(cm.exception)
        self.assertIn("'a'", msg)
        self.assertIn("'b'", msg)
        # The unrelated job must not be blamed.
        self.assertNotIn("'free'", msg)

    # --- Input validation --------------------------------------------------

    def test_duplicate_id_is_rejected(self):
        jobs = [Job("dup", priority=1), Job("dup", priority=2)]
        with self.assertRaises(ScheduleError) as cm:
            plan_jobs(jobs)
        self.assertIn("dup", str(cm.exception))

    def test_empty_id_string_is_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("")])

    def test_non_string_id_is_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job(123)])  # type: ignore[arg-type]
        with self.assertRaises(ScheduleError):
            plan_jobs([Job(None)])  # type: ignore[arg-type]

    # --- Non-mutation ------------------------------------------------------

    def test_inputs_are_not_mutated(self):
        jobs = [
            Job("a", priority=3, depends_on=()),
            Job("b", priority=1, depends_on=("a",)),
            Job("c", priority=2, depends_on=("b",)),
        ]
        snapshot_ids = [job.id for job in jobs]
        snapshot_deps = [job.depends_on for job in jobs]
        snapshot_priorities = [job.priority for job in jobs]
        snapshot_payloads = [job.payload for job in jobs]

        plan_jobs(jobs)

        self.assertEqual([job.id for job in jobs], snapshot_ids)
        self.assertEqual([job.depends_on for job in jobs], snapshot_deps)
        self.assertEqual([job.priority for job in jobs], snapshot_priorities)
        self.assertEqual([job.payload for job in jobs], snapshot_payloads)


if __name__ == "__main__":
    unittest.main()