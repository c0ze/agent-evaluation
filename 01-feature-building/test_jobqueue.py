import unittest

from jobqueue import Job, ScheduleError, plan_jobs


class PlanJobsTests(unittest.TestCase):
    # --- Existing contract tests -------------------------------------

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

    # --- Basic shapes -------------------------------------------------

    def test_empty_input_returns_empty_list(self):
        self.assertEqual(plan_jobs([]), [])

    def test_single_job(self):
        self.assertEqual(plan_jobs([Job("only")]), ["only"])

    def test_chain_dependencies(self):
        jobs = [
            Job("c", depends_on=("b",)),
            Job("b", depends_on=("a",)),
            Job("a"),
        ]
        self.assertEqual(plan_jobs(jobs), ["a", "b", "c"])

    def test_diamond_dependency(self):
        jobs = [
            Job("d", depends_on=("b", "c")),
            Job("b", depends_on=("a",)),
            Job("c", depends_on=("a",)),
            Job("a"),
        ]
        result = plan_jobs(jobs)
        self.assertEqual(result[0], "a")
        self.assertEqual(result[-1], "d")
        self.assertEqual(sorted(result), ["a", "b", "c", "d"])
        # b before c by input order (both priority 0, b earlier)
        self.assertLess(result.index("b"), result.index("c"))

    def test_result_contains_every_id_exactly_once(self):
        jobs = [Job("x"), Job("y", depends_on=("x",)), Job("z")]
        result = plan_jobs(jobs)
        self.assertEqual(len(result), 3)
        self.assertEqual(set(result), {"x", "y", "z"})

    # --- Priority / ordering ------------------------------------------

    def test_priority_only_among_ready_jobs(self):
        # "high" has top priority but is blocked until "low" runs.
        jobs = [
            Job("high", priority=100, depends_on=("low",)),
            Job("low", priority=1),
            Job("mid", priority=50),
        ]
        self.assertEqual(plan_jobs(jobs), ["mid", "low", "high"])

    def test_newly_ready_job_competes_by_priority(self):
        # After "a" runs, "c" becomes ready and outranks waiting "b".
        jobs = [
            Job("a", priority=10),
            Job("b", priority=1),
            Job("c", priority=5, depends_on=("a",)),
        ]
        self.assertEqual(plan_jobs(jobs), ["a", "c", "b"])

    def test_equal_priorities_preserve_input_order(self):
        jobs = [Job("first", 3), Job("second", 3), Job("third", 3)]
        self.assertEqual(plan_jobs(jobs), ["first", "second", "third"])

    def test_negative_and_zero_priorities(self):
        jobs = [Job("neg", -5), Job("zero", 0), Job("pos", 5)]
        self.assertEqual(plan_jobs(jobs), ["pos", "zero", "neg"])

    def test_accepts_generator_input(self):
        jobs = (Job(name) for name in ["a", "b", "c"])
        self.assertEqual(plan_jobs(jobs), ["a", "b", "c"])

    # --- Validation ----------------------------------------------------

    def test_duplicate_id_is_rejected(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("dup"), Job("dup")])
        self.assertIn("dup", str(ctx.exception))

    def test_empty_id_is_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("")])

    def test_non_string_id_is_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job(123)])  # type: ignore[arg-type]

    def test_unknown_dependency_message_names_job_and_dependency(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("build", depends_on=("missing",))])
        msg = str(ctx.exception)
        self.assertIn("build", msg)
        self.assertIn("missing", msg)

    def test_empty_dependency_is_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("a", depends_on=("",))])

    def test_duplicate_dependency_entries_are_tolerated(self):
        jobs = [Job("b", depends_on=("a", "a")), Job("a")]
        self.assertEqual(plan_jobs(jobs), ["a", "b"])

    # --- Cycles ----------------------------------------------------------

    def test_self_dependency_is_a_cycle(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("a", depends_on=("a",))])
        self.assertIn("a", str(ctx.exception))

    def test_two_node_cycle(self):
        jobs = [
            Job("a", depends_on=("b",)),
            Job("b", depends_on=("a",)),
        ]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        msg = str(ctx.exception)
        self.assertIn("a", msg)
        self.assertIn("b", msg)

    def test_three_node_cycle(self):
        jobs = [
            Job("a", depends_on=("c",)),
            Job("b", depends_on=("a",)),
            Job("c", depends_on=("b",)),
        ]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        msg = str(ctx.exception)
        for jid in ("a", "b", "c"):
            self.assertIn(jid, msg)

    def test_cycle_detected_despite_acyclic_prefix(self):
        jobs = [
            Job("start"),
            Job("a", depends_on=("b",)),
            Job("b", depends_on=("a",)),
        ]
        with self.assertRaises(ScheduleError):
            plan_jobs(jobs)

    # --- Non-mutation -----------------------------------------------------

    def test_does_not_mutate_input_list_or_dependencies(self):
        deps_b = ("a",)
        jobs = [Job("b", priority=1, depends_on=deps_b), Job("a", priority=9)]
        snapshot_ids = [j.id for j in jobs]
        snapshot_deps = [j.depends_on for j in jobs]
        plan_jobs(jobs)
        self.assertEqual([j.id for j in jobs], snapshot_ids)
        self.assertEqual([j.depends_on for j in jobs], snapshot_deps)
        self.assertIs(jobs[0].depends_on, deps_b)
        self.assertEqual(len(jobs), 2)

    def test_does_not_mutate_on_error(self):
        jobs = [Job("a", depends_on=("b",)), Job("b", depends_on=("a",))]
        snapshot = [(j.id, j.depends_on) for j in jobs]
        with self.assertRaises(ScheduleError):
            plan_jobs(jobs)
        self.assertEqual([(j.id, j.depends_on) for j in jobs], snapshot)


if __name__ == "__main__":
    unittest.main()
