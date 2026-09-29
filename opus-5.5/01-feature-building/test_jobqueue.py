import copy
import random
import unittest

from jobqueue import Job, ScheduleError, plan_jobs


def assert_valid_order(test, jobs, order):
    """Every job exactly once, and each after all of its dependencies."""
    ids = [job.id for job in jobs]
    test.assertCountEqual(order, ids)
    test.assertEqual(len(order), len(set(order)))
    position = {job_id: i for i, job_id in enumerate(order)}
    for job in jobs:
        for dep in job.depends_on:
            test.assertLess(
                position[dep], position[job.id], f"{dep} must precede {job.id}"
            )


class PlanJobsTests(unittest.TestCase):
    # --- Original cases -------------------------------------------------
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

    # --- Basic shapes ---------------------------------------------------
    def test_empty_input_returns_empty_list(self):
        self.assertEqual(plan_jobs([]), [])
        self.assertEqual(plan_jobs(iter(())), [])

    def test_single_job(self):
        self.assertEqual(plan_jobs([Job("only")]), ["only"])

    def test_accepts_generator_input(self):
        jobs = (Job(name, p) for name, p in [("x", 1), ("y", 3), ("z", 2)])
        self.assertEqual(plan_jobs(jobs), ["y", "z", "x"])

    def test_returns_new_list_each_call(self):
        jobs = [Job("a"), Job("b")]
        first = plan_jobs(jobs)
        first.append("junk")
        self.assertEqual(plan_jobs(jobs), ["a", "b"])

    # --- Ordering -------------------------------------------------------
    def test_all_equal_priority_preserves_input_order(self):
        jobs = [Job(name) for name in "qwerty"]
        self.assertEqual(plan_jobs(jobs), list("qwerty"))

    def test_negative_and_zero_priorities(self):
        jobs = [Job("low", -5), Job("zero", 0), Job("lower", -10), Job("high", 3)]
        self.assertEqual(plan_jobs(jobs), ["high", "zero", "low", "lower"])

    def test_newly_ready_high_priority_job_jumps_queue(self):
        # After "a" finishes, "urgent" becomes ready and outranks "b"/"c",
        # which were ready from the start.
        jobs = [
            Job("a", 10),
            Job("b", 5),
            Job("c", 5),
            Job("urgent", 50, depends_on=("a",)),
        ]
        self.assertEqual(plan_jobs(jobs), ["a", "urgent", "b", "c"])

    def test_newly_ready_job_ties_broken_by_input_order_not_readiness(self):
        # "late" is listed first, so once it becomes ready it beats "early"
        # at equal priority even though "early" has been waiting longer.
        jobs = [
            Job("late", 1, depends_on=("root",)),
            Job("root", 9),
            Job("early", 1),
        ]
        self.assertEqual(plan_jobs(jobs), ["root", "late", "early"])

    def test_low_priority_dependency_is_not_starved(self):
        jobs = [
            Job("deploy", 100, depends_on=("test",)),
            Job("lint", 50),
            Job("test", -1),
        ]
        self.assertEqual(plan_jobs(jobs), ["lint", "test", "deploy"])

    def test_diamond(self):
        jobs = [
            Job("d", 0, depends_on=("b", "c")),
            Job("b", 1, depends_on=("a",)),
            Job("c", 2, depends_on=("a",)),
            Job("a", 0),
        ]
        self.assertEqual(plan_jobs(jobs), ["a", "c", "b", "d"])

    def test_long_chain_listed_in_reverse(self):
        n = 50
        jobs = [
            Job(f"j{i}", depends_on=(f"j{i - 1}",) if i else ())
            for i in reversed(range(n))
        ]
        self.assertEqual(plan_jobs(jobs), [f"j{i}" for i in range(n)])

    def test_disconnected_components_interleave_by_priority(self):
        jobs = [
            Job("a1", 1),
            Job("a2", 1, depends_on=("a1",)),
            Job("b1", 2),
            Job("b2", 0, depends_on=("b1",)),
        ]
        self.assertEqual(plan_jobs(jobs), ["b1", "a1", "a2", "b2"])

    def test_duplicate_dependency_entries_are_tolerated(self):
        jobs = [Job("a"), Job("b", depends_on=("a", "a"))]
        self.assertEqual(plan_jobs(jobs), ["a", "b"])

    def test_list_depends_on_is_accepted(self):
        jobs = [Job("b", depends_on=["a"]), Job("a")]
        self.assertEqual(plan_jobs(jobs), ["a", "b"])

    def test_deterministic_across_calls(self):
        jobs = [Job(str(i), i % 3) for i in range(20)]
        self.assertEqual(plan_jobs(jobs), plan_jobs(jobs))

    def test_random_dags_produce_valid_orders(self):
        rng = random.Random(1234)
        for _ in range(200):
            n = rng.randint(1, 15)
            jobs = []
            for i in range(n):
                deps = tuple(
                    f"n{j}" for j in range(i) if rng.random() < 0.3
                )
                jobs.append(Job(f"n{i}", rng.randint(-2, 2), deps))
            rng.shuffle(jobs)
            order = plan_jobs(jobs)
            assert_valid_order(self, jobs, order)
            self._assert_greedy_priority(jobs, order)

    def _assert_greedy_priority(self, jobs, order):
        """Each emitted job is the best-ranked job ready at that moment."""
        position = {job.id: i for i, job in enumerate(jobs)}
        done = set()
        for job_id in order:
            ready = [
                j for j in jobs
                if j.id not in done and all(d in done for d in j.depends_on)
            ]
            best = min(ready, key=lambda j: (-j.priority, position[j.id]))
            self.assertEqual(job_id, best.id)
            done.add(job_id)

    # --- Validation -----------------------------------------------------
    def test_unknown_dependency_message_names_job_and_dependency(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("build", depends_on=("missing",))])
        self.assertIn("build", str(ctx.exception))
        self.assertIn("missing", str(ctx.exception))

    def test_duplicate_ids_rejected(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("a"), Job("b"), Job("a")])
        self.assertIn("'a'", str(ctx.exception))
        self.assertIn("duplicate", str(ctx.exception))

    def test_empty_id_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("")])

    def test_non_string_ids_rejected(self):
        for bad in (None, 1, b"bytes", ("a",)):
            with self.subTest(bad=bad):
                with self.assertRaises(ScheduleError):
                    plan_jobs([Job(bad)])

    def test_non_job_items_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs(["a"])

    def test_string_depends_on_rejected(self):
        # A bare string would otherwise be iterated character by character.
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("a"), Job("ab", depends_on="a")])

    def test_invalid_dependency_entries_rejected(self):
        for bad in (None, 3, ""):
            with self.subTest(bad=bad):
                with self.assertRaises(ScheduleError):
                    plan_jobs([Job("a"), Job("b", depends_on=(bad,))])

    def test_non_integer_priority_rejected(self):
        for bad in ("high", None, 1.5, True):
            with self.subTest(bad=bad):
                with self.assertRaises(ScheduleError):
                    plan_jobs([Job("a", priority=bad)])

    def test_schedule_error_is_value_error(self):
        with self.assertRaises(ValueError):
            plan_jobs([Job("a", depends_on=("zzz",))])

    # --- Cycles ---------------------------------------------------------
    def test_self_dependency_is_a_cycle(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("loop", depends_on=("loop",))])
        self.assertIn("cycle", str(ctx.exception))
        self.assertIn("loop", str(ctx.exception))

    def test_two_node_cycle_names_both_ids(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("a", depends_on=("b",)), Job("b", depends_on=("a",))])
        message = str(ctx.exception)
        self.assertIn("cycle", message)
        self.assertIn("a -> b -> a", message)

    def test_cycle_diagnostic_excludes_unrelated_jobs(self):
        jobs = [
            Job("ok"),
            Job("x", depends_on=("ok", "z")),
            Job("y", depends_on=("x",)),
            Job("z", depends_on=("y",)),
            Job("after", depends_on=("x",)),
        ]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        message = str(ctx.exception)
        cycle_part = message.split(";")[0]
        for job_id in ("x", "y", "z"):
            self.assertIn(job_id, cycle_part)
        self.assertNotIn("ok", message)
        self.assertNotIn("after", cycle_part)
        # Jobs downstream of the cycle are reported as blocked.
        self.assertIn("after", message.split(";")[1])

    def test_cycle_detected_even_when_other_jobs_are_schedulable(self):
        jobs = [Job(str(i)) for i in range(10)] + [
            Job("p", depends_on=("q",)),
            Job("q", depends_on=("p",)),
        ]
        with self.assertRaises(ScheduleError):
            plan_jobs(jobs)

    # --- Immutability ---------------------------------------------------
    def test_inputs_are_not_mutated(self):
        deps_list = ["a"]
        jobs = [
            Job("b", 1, depends_on=deps_list, payload={"k": [1]}),
            Job("a", 0),
            Job("c", 5, depends_on=("a", "b")),
        ]
        input_list = list(jobs)
        snapshot = copy.deepcopy(jobs)
        plan_jobs(jobs)
        self.assertEqual(jobs, input_list)
        self.assertEqual(jobs, snapshot)
        self.assertEqual(deps_list, ["a"])
        self.assertIs(jobs[0].depends_on, deps_list)

    def test_inputs_not_mutated_on_error(self):
        deps_list = ["b"]
        jobs = [Job("a", depends_on=deps_list), Job("b", depends_on=("a",))]
        snapshot = copy.deepcopy(jobs)
        with self.assertRaises(ScheduleError):
            plan_jobs(jobs)
        self.assertEqual(jobs, snapshot)
        self.assertEqual(deps_list, ["b"])


if __name__ == "__main__":
    unittest.main()
