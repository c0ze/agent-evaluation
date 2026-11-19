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

    # --- basic shapes ---------------------------------------------------

    def test_empty_input_returns_empty_list(self):
        self.assertEqual(plan_jobs([]), [])

    def test_generator_input_is_supported(self):
        jobs = (Job(name) for name in ("a", "b"))
        self.assertEqual(plan_jobs(jobs), ["a", "b"])

    def test_single_job(self):
        self.assertEqual(plan_jobs([Job("only")]), ["only"])

    def test_every_id_returned_exactly_once(self):
        jobs = [
            Job("a"),
            Job("b", depends_on=("a",)),
            Job("c", depends_on=("a",)),
            Job("d", depends_on=("b", "c")),
        ]
        order = plan_jobs(jobs)
        self.assertEqual(sorted(order), ["a", "b", "c", "d"])
        self.assertEqual(len(order), len(set(order)))

    def test_negative_and_zero_priorities(self):
        jobs = [Job("low", -5), Job("zero", 0), Job("high", 5)]
        self.assertEqual(plan_jobs(jobs), ["high", "zero", "low"])

    # --- validation -----------------------------------------------------

    def test_duplicate_ids_are_rejected(self):
        with self.assertRaisesRegex(ScheduleError, "duplicate"):
            plan_jobs([Job("a"), Job("a")])

    def test_empty_id_is_rejected(self):
        with self.assertRaisesRegex(ScheduleError, "non-empty"):
            plan_jobs([Job("")])

    def test_non_string_id_is_rejected(self):
        for bad in (None, 7, b"bytes"):
            with self.subTest(bad=bad):
                with self.assertRaises(ScheduleError):
                    plan_jobs([Job(bad)])

    def test_unknown_dependency_message_names_the_job_and_dependency(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("build", depends_on=("missing",))])
        message = str(ctx.exception)
        self.assertIn("build", message)
        self.assertIn("missing", message)

    def test_non_string_dependency_is_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("a"), Job("b", depends_on=(5,))])

    def test_bare_string_dependency_is_rejected(self):
        # Iterating a str would otherwise silently mean characters, not IDs.
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("a"), Job("b", depends_on="a")])

    # --- cycles ---------------------------------------------------------

    def test_self_dependency_is_a_cycle(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("a", depends_on=("a",))])
        self.assertIn("a", str(ctx.exception))

    def test_two_node_cycle_is_reported_with_both_ids(self):
        jobs = [Job("a", depends_on=("b",)), Job("b", depends_on=("a",))]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        message = str(ctx.exception)
        self.assertIn("a", message)
        self.assertIn("b", message)

    def test_three_node_cycle_is_reported(self):
        jobs = [
            Job("a", depends_on=("c",)),
            Job("b", depends_on=("a",)),
            Job("c", depends_on=("b",)),
        ]
        with self.assertRaisesRegex(ScheduleError, "cycle"):
            plan_jobs(jobs)

    def test_cycle_blocks_dependents_and_is_still_detected(self):
        jobs = [
            Job("root"),
            Job("a", depends_on=("root", "b")),
            Job("b", depends_on=("a",)),
            Job("leaf", depends_on=("a",)),
        ]
        with self.assertRaises(ScheduleError):
            plan_jobs(jobs)

    def test_independent_jobs_beside_a_cycle_do_not_hide_it(self):
        jobs = [Job("free"), Job("a", depends_on=("b",)), Job("b", depends_on=("a",))]
        with self.assertRaises(ScheduleError):
            plan_jobs(jobs)

    # --- scheduling order ----------------------------------------------

    def test_newly_ready_job_is_chosen_by_priority(self):
        # "hot" is blocked only until "gate" runs; it should then jump ahead
        # of the lower-priority jobs that were ready all along.
        jobs = [
            Job("gate", 6),
            Job("hot", 10, depends_on=("gate",)),
            Job("warm", 5),
        ]
        self.assertEqual(plan_jobs(jobs), ["gate", "hot", "warm"])

    def test_ties_keep_input_order_for_newly_ready_jobs(self):
        jobs = [
            Job("first", 1),
            Job("second", 1),
            Job("third", 1),
            Job("unlock", 2),
            Job("blocked", 2, depends_on=("unlock",)),
        ]
        self.assertEqual(
            plan_jobs(jobs), ["unlock", "blocked", "first", "second", "third"]
        )

    def test_diamond_dependency(self):
        jobs = [
            Job("d", depends_on=("b", "c")),
            Job("c"),
            Job("b"),
            Job("a"),
            Job("e", depends_on=("d",)),
        ]
        order = plan_jobs(jobs)
        self.assertEqual(order[-1], "e")
        self.assertLess(order.index("d"), len(order) - 1)
        self.assertLess(order.index("b"), order.index("d"))
        self.assertLess(order.index("c"), order.index("d"))

    def test_deep_chain_preserves_order(self):
        names = [f"n{i}" for i in range(50)]
        jobs = [Job(names[0])] + [
            Job(names[i], 100 - i, depends_on=(names[i - 1],))
            for i in range(1, len(names))
        ]
        self.assertEqual(plan_jobs(jobs), names)

    def test_priority_does_not_override_dependencies_at_any_depth(self):
        jobs = [
            Job("top", 1000, depends_on=("mid",)),
            Job("mid", 500, depends_on=("bottom",)),
            Job("bottom", -1000),
        ]
        self.assertEqual(plan_jobs(jobs), ["bottom", "mid", "top"])

    def test_duplicate_dependency_entries_are_counted_once(self):
        jobs = [Job("a"), Job("b", depends_on=("a", "a", "a"))]
        self.assertEqual(plan_jobs(jobs), ["a", "b"])

    def test_duplicate_dependencies_both_ready_jobs(self):
        jobs = [Job("x", 1, depends_on=("a", "b")), Job("a", 0), Job("b", 2)]
        self.assertEqual(plan_jobs(jobs), ["b", "a", "x"])

    # --- purity ---------------------------------------------------------

    def test_inputs_are_not_mutated(self):
        dependencies = ["a", "b"]
        jobs = [
            Job("a"),
            Job("b"),
            Job("c", depends_on=dependencies, payload={"keep": True}),
        ]
        jobs_before = [job.id for job in jobs]
        deps_before = list(dependencies)

        plan_jobs(jobs)

        self.assertEqual([job.id for job in jobs], jobs_before)
        self.assertEqual(list(dependencies), deps_before)
        self.assertEqual(list(jobs[2].depends_on), ["a", "b"])
        self.assertEqual(jobs[2].payload, {"keep": True})

    def test_repeated_calls_are_deterministic(self):
        jobs = [
            Job("a", 1),
            Job("b", 1, depends_on=("a",)),
            Job("c", 1),
            Job("d", 3),
        ]
        self.assertEqual(plan_jobs(jobs), plan_jobs(jobs))

    def test_schedule_error_is_a_value_error(self):
        self.assertTrue(issubclass(ScheduleError, ValueError))


if __name__ == "__main__":
    unittest.main()
