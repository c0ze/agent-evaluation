import copy
import unittest

from jobqueue import Job, ScheduleError, plan_jobs


def assert_valid_order(test, jobs, order):
    """Every id exactly once, and every job after all of its dependencies."""
    test.assertEqual(sorted(order), sorted(j.id for j in jobs))
    position = {job_id: i for i, job_id in enumerate(order)}
    for job in jobs:
        for dep in job.depends_on:
            test.assertLess(position[dep], position[job.id], f"{dep} before {job.id}")


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

    # -- ordering ---------------------------------------------------------

    def test_empty_input_returns_empty_list(self):
        self.assertEqual(plan_jobs([]), [])
        self.assertEqual(plan_jobs(iter(())), [])

    def test_single_job(self):
        self.assertEqual(plan_jobs([Job("only")]), ["only"])

    def test_equal_priorities_keep_input_order(self):
        jobs = [Job(name) for name in ("z", "m", "a", "q")]
        self.assertEqual(plan_jobs(jobs), ["z", "m", "a", "q"])

    def test_negative_and_mixed_priorities(self):
        jobs = [Job("low", -5), Job("zero", 0), Job("high", 3), Job("mid", -1)]
        self.assertEqual(plan_jobs(jobs), ["high", "zero", "mid", "low"])

    def test_float_priorities_are_supported(self):
        jobs = [Job("a", 0.5), Job("b", 1.5), Job("c", 1.5)]
        self.assertEqual(plan_jobs(jobs), ["b", "c", "a"])

    def test_priority_only_competes_among_currently_ready_jobs(self):
        # "urgent" has the top priority but must wait for "gate", so the
        # already-ready "medium" job goes first, then "gate", then "urgent".
        jobs = [
            Job("urgent", 100, depends_on=("gate",)),
            Job("gate", 1),
            Job("medium", 50),
        ]
        self.assertEqual(plan_jobs(jobs), ["medium", "gate", "urgent"])

    def test_newly_unlocked_job_competes_with_still_ready_jobs(self):
        jobs = [
            Job("first", 9),
            Job("unlocked", 10, depends_on=("first",)),
            Job("waiting", 5),
        ]
        self.assertEqual(plan_jobs(jobs), ["first", "unlocked", "waiting"])

    def test_unlocked_job_with_low_priority_waits_for_higher_ready_jobs(self):
        jobs = [
            Job("first", 9),
            Job("unlocked", 1, depends_on=("first",)),
            Job("waiting", 5),
        ]
        self.assertEqual(plan_jobs(jobs), ["first", "waiting", "unlocked"])

    def test_dependents_tie_break_by_original_input_order(self):
        # After "root" finishes, x and y unlock together with equal priority.
        jobs = [
            Job("y", 1, depends_on=("root",)),
            Job("x", 1, depends_on=("root",)),
            Job("root", 0),
        ]
        self.assertEqual(plan_jobs(jobs), ["root", "y", "x"])

    def test_diamond(self):
        jobs = [
            Job("top", 0, depends_on=("left", "right")),
            Job("left", 1, depends_on=("base",)),
            Job("right", 2, depends_on=("base",)),
            Job("base", 0),
        ]
        self.assertEqual(plan_jobs(jobs), ["base", "right", "left", "top"])

    def test_job_needing_several_dependencies_waits_for_all(self):
        jobs = [
            Job("c", 99, depends_on=("a", "b")),
            Job("a", 1),
            Job("b", 0),
        ]
        self.assertEqual(plan_jobs(jobs), ["a", "b", "c"])

    def test_duplicate_entries_in_depends_on_are_harmless(self):
        jobs = [Job("b", depends_on=("a", "a", "a")), Job("a")]
        self.assertEqual(plan_jobs(jobs), ["a", "b"])

    def test_dependencies_declared_as_list_are_accepted(self):
        jobs = [Job("b", depends_on=["a"]), Job("a")]
        self.assertEqual(plan_jobs(jobs), ["a", "b"])

    def test_accepts_one_shot_iterable(self):
        jobs = [Job("b", depends_on=("a",)), Job("a")]
        self.assertEqual(plan_jobs(iter(jobs)), ["a", "b"])
        self.assertEqual(plan_jobs(job for job in jobs), ["a", "b"])

    def test_disconnected_components_interleave_by_priority(self):
        jobs = [
            Job("a1", 1),
            Job("a2", 1, depends_on=("a1",)),
            Job("b1", 5),
            Job("b2", 0, depends_on=("b1",)),
        ]
        self.assertEqual(plan_jobs(jobs), ["b1", "a1", "a2", "b2"])

    def test_deterministic_and_repeatable(self):
        jobs = [
            Job("d", 1, depends_on=("b", "c")),
            Job("c", 1, depends_on=("a",)),
            Job("b", 1, depends_on=("a",)),
            Job("a", 1),
        ]
        first = plan_jobs(jobs)
        for _ in range(5):
            self.assertEqual(plan_jobs(jobs), first)
        self.assertEqual(first, ["a", "c", "b", "d"])

    def test_long_chain_does_not_hit_recursion_limit(self):
        n = 5000
        jobs = [Job("j0")] + [
            Job(f"j{i}", depends_on=(f"j{i - 1}",)) for i in range(1, n)
        ]
        # Reverse input order so dependencies always come later in the list.
        jobs.reverse()
        order = plan_jobs(jobs)
        self.assertEqual(order, [f"j{i}" for i in range(n)])

    def test_wide_fan_out_is_valid_and_sorted_by_priority(self):
        jobs = [Job("root")] + [
            Job(f"leaf{i}", priority=i % 7, depends_on=("root",)) for i in range(200)
        ]
        order = plan_jobs(jobs)
        assert_valid_order(self, jobs, order)
        priorities = {j.id: j.priority for j in jobs}
        leaf_priorities = [priorities[x] for x in order[1:]]
        self.assertEqual(leaf_priorities, sorted(leaf_priorities, reverse=True))

    def test_order_is_valid_for_a_scrambled_dag(self):
        jobs = [
            Job("e", 3, depends_on=("c", "d")),
            Job("a", 1),
            Job("d", 8, depends_on=("a",)),
            Job("c", 2, depends_on=("a", "b")),
            Job("b", 5),
            Job("f", 9, depends_on=("e",)),
        ]
        order = plan_jobs(jobs)
        assert_valid_order(self, jobs, order)
        self.assertEqual(order, ["b", "a", "d", "c", "e", "f"])

    # -- input validation -------------------------------------------------

    def test_duplicate_ids_are_rejected(self):
        with self.assertRaisesRegex(ScheduleError, "duplicate.*'a'"):
            plan_jobs([Job("a"), Job("b"), Job("a", priority=5)])

    def test_empty_id_is_rejected(self):
        with self.assertRaisesRegex(ScheduleError, "non-empty"):
            plan_jobs([Job("")])

    def test_non_string_id_is_rejected(self):
        for bad in (None, 7, b"a", ("a",)):
            with self.subTest(bad=bad):
                with self.assertRaisesRegex(ScheduleError, "non-empty string"):
                    plan_jobs([Job(bad)])

    def test_unknown_dependency_message_names_both_jobs(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("a"), Job("build", depends_on=("a", "missing"))])
        message = str(ctx.exception)
        self.assertIn("build", message)
        self.assertIn("missing", message)

    def test_dependency_ids_are_case_sensitive(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("a"), Job("b", depends_on=("A",))])

    def test_bare_string_depends_on_is_rejected(self):
        # ("ab") is just "ab"; iterating it would look like jobs "a" and "b".
        jobs = [Job("a"), Job("b"), Job("c", depends_on="ab")]
        with self.assertRaisesRegex(ScheduleError, "single string"):
            plan_jobs(jobs)

    def test_non_string_dependency_is_rejected(self):
        with self.assertRaisesRegex(ScheduleError, "non-string"):
            plan_jobs([Job("a"), Job("b", depends_on=(1,))])
        with self.assertRaisesRegex(ScheduleError, "non-string"):
            plan_jobs([Job("a"), Job("b", depends_on=(["a"],))])

    def test_non_iterable_depends_on_is_rejected(self):
        with self.assertRaisesRegex(ScheduleError, "iterable"):
            plan_jobs([Job("a", depends_on=None)])

    def test_non_job_items_are_rejected(self):
        with self.assertRaisesRegex(ScheduleError, "not a Job"):
            plan_jobs([Job("a"), "b"])

    def test_invalid_priority_is_rejected(self):
        for bad in ("high", None, float("nan")):
            with self.subTest(bad=bad):
                with self.assertRaisesRegex(ScheduleError, "priority"):
                    plan_jobs([Job("a", priority=bad)])

    def test_schedule_error_is_a_value_error(self):
        self.assertTrue(issubclass(ScheduleError, ValueError))

    # -- cycles -----------------------------------------------------------

    def test_self_dependency_is_a_cycle(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("a", depends_on=("a",))])
        self.assertIn("cycle", str(ctx.exception))
        self.assertIn("'a'", str(ctx.exception))

    def test_two_node_cycle(self):
        jobs = [Job("a", depends_on=("b",)), Job("b", depends_on=("a",))]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        message = str(ctx.exception)
        self.assertIn("cycle", message)
        self.assertIn("'a'", message)
        self.assertIn("'b'", message)

    def test_cycle_message_lists_the_cycle_path(self):
        jobs = [
            Job("a", depends_on=("b",)),
            Job("b", depends_on=("c",)),
            Job("c", depends_on=("a",)),
        ]
        with self.assertRaisesRegex(
            ScheduleError, r"'a' -> 'b' -> 'c' -> 'a'"
        ):
            plan_jobs(jobs)

    def test_cycle_message_excludes_innocent_and_downstream_jobs(self):
        jobs = [
            Job("ok1"),
            Job("ok2", depends_on=("ok1",)),
            Job("x", depends_on=("y", "ok2")),
            Job("y", depends_on=("x",)),
            Job("after", depends_on=("y",)),
        ]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        message = str(ctx.exception)
        self.assertIn("'x'", message)
        self.assertIn("'y'", message)
        for innocent in ("'ok1'", "'ok2'", "'after'"):
            self.assertNotIn(innocent, message)
        self.assertIn("1 more", message)  # "after" is blocked behind the cycle

    def test_cycle_reachable_only_through_a_valid_prefix(self):
        jobs = [
            Job("start"),
            Job("p", depends_on=("start", "q")),
            Job("q", depends_on=("r",)),
            Job("r", depends_on=("p",)),
        ]
        with self.assertRaisesRegex(ScheduleError, "cycle"):
            plan_jobs(jobs)

    def test_cycle_in_second_component_is_found(self):
        jobs = [
            Job("fine"),
            Job("also_fine", depends_on=("fine",)),
            Job("m", depends_on=("n",)),
            Job("n", depends_on=("m",)),
        ]
        with self.assertRaisesRegex(ScheduleError, "'m' -> 'n' -> 'm'"):
            plan_jobs(jobs)

    def test_long_cycle_does_not_hit_recursion_limit(self):
        n = 5000
        jobs = [Job(f"j{i}", depends_on=(f"j{(i + 1) % n}",)) for i in range(n)]
        with self.assertRaisesRegex(ScheduleError, "cycle"):
            plan_jobs(jobs)

    # -- no mutation ------------------------------------------------------

    def test_inputs_are_not_mutated(self):
        deps = ["b", "c"]
        jobs = [
            Job("a", 1, deps, payload={"k": [1, 2]}),
            Job("b", 2),
            Job("c", 3, ["b"]),
        ]
        before = copy.deepcopy(jobs)
        before_list = list(jobs)
        plan_jobs(jobs)
        self.assertEqual(jobs, before)
        self.assertEqual(jobs, before_list)
        self.assertEqual(deps, ["b", "c"])
        for original, current in zip(before_list, jobs):
            self.assertIs(original, current)

    def test_inputs_are_not_mutated_when_planning_fails(self):
        deps = ["b"]
        jobs = [Job("a", depends_on=deps), Job("b", depends_on=["a"])]
        before = copy.deepcopy(jobs)
        with self.assertRaises(ScheduleError):
            plan_jobs(jobs)
        self.assertEqual(jobs, before)
        self.assertEqual(deps, ["b"])

    def test_result_is_a_fresh_list_of_str(self):
        jobs = [Job("a"), Job("b")]
        first = plan_jobs(jobs)
        first.append("junk")
        second = plan_jobs(jobs)
        self.assertEqual(second, ["a", "b"])
        self.assertIsInstance(second, list)
        self.assertTrue(all(type(x) is str for x in second))


if __name__ == "__main__":
    unittest.main()
