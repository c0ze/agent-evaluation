import copy
import itertools
import random
import unittest

from jobqueue import Job, ScheduleError, plan_jobs


def reference_plan(jobs):
    """Obviously-correct O(n^2) model of the contract, for cross-checking."""
    jobs = list(jobs)
    done = set()
    order = []
    while len(order) < len(jobs):
        ready = [
            (-job.priority, index)
            for index, job in enumerate(jobs)
            if job.id not in done and all(dep in done for dep in job.depends_on)
        ]
        _, index = min(ready)
        done.add(jobs[index].id)
        order.append(jobs[index].id)
    return order


class OrderingTests(unittest.TestCase):
    def test_dependencies_override_priority(self):
        jobs = [
            Job("build", priority=100, depends_on=("fetch",)),
            Job("fetch", priority=1),
        ]
        self.assertEqual(plan_jobs(jobs), ["fetch", "build"])

    def test_ready_jobs_use_priority_then_input_order(self):
        jobs = [Job("a", 2), Job("b", 5), Job("c", 2)]
        self.assertEqual(plan_jobs(jobs), ["b", "a", "c"])

    def test_empty_input_returns_empty_list(self):
        self.assertEqual(plan_jobs([]), [])
        self.assertEqual(plan_jobs(iter(())), [])

    def test_single_job(self):
        self.assertEqual(plan_jobs([Job("only")]), ["only"])

    def test_returns_a_fresh_list_each_call(self):
        jobs = [Job("a"), Job("b")]
        first = plan_jobs(jobs)
        first.append("junk")
        self.assertEqual(plan_jobs(jobs), ["a", "b"])

    def test_equal_priorities_keep_input_order(self):
        ids = ["m", "z", "a", "q", "b"]
        self.assertEqual(plan_jobs([Job(i) for i in ids]), ids)

    def test_negative_priorities_sort_below_default(self):
        jobs = [Job("low", -5), Job("default"), Job("lowest", -10), Job("high", 1)]
        self.assertEqual(plan_jobs(jobs), ["high", "default", "low", "lowest"])

    def test_newly_ready_job_competes_with_already_ready_jobs(self):
        # Finishing "root" releases "urgent", which must jump ahead of "idle"
        # even though "idle" has been ready from the start.
        jobs = [
            Job("idle", priority=1),
            Job("root", priority=5),
            Job("urgent", priority=9, depends_on=("root",)),
        ]
        self.assertEqual(plan_jobs(jobs), ["root", "urgent", "idle"])

    def test_newly_ready_job_ties_break_by_input_order_not_release_order(self):
        # "late" becomes ready first (it has no dependencies) but "early" was
        # supplied first, so once both are ready "early" wins the tie.
        jobs = [
            Job("early", priority=1, depends_on=("root",)),
            Job("late", priority=1),
            Job("root", priority=5),
        ]
        self.assertEqual(plan_jobs(jobs), ["root", "early", "late"])

    def test_high_priority_job_does_not_pull_its_dependency_forward(self):
        # Priority only ranks jobs that are ready; it is not inherited.
        jobs = [
            Job("mid", priority=5),
            Job("dep", priority=1),
            Job("top", priority=9, depends_on=("dep",)),
        ]
        self.assertEqual(plan_jobs(jobs), ["mid", "dep", "top"])

    def test_diamond(self):
        jobs = [
            Job("d", depends_on=("b", "c")),
            Job("c", priority=3, depends_on=("a",)),
            Job("b", priority=1, depends_on=("a",)),
            Job("a"),
        ]
        self.assertEqual(plan_jobs(jobs), ["a", "c", "b", "d"])

    def test_job_waits_for_all_dependencies(self):
        jobs = [
            Job("join", priority=99, depends_on=("x", "y", "z")),
            Job("x"),
            Job("y"),
            Job("z"),
        ]
        self.assertEqual(plan_jobs(jobs), ["x", "y", "z", "join"])

    def test_independent_components_interleave_by_priority(self):
        jobs = [
            Job("a1", priority=1),
            Job("a2", priority=10, depends_on=("a1",)),
            Job("b1", priority=5),
            Job("b2", priority=2, depends_on=("b1",)),
        ]
        self.assertEqual(plan_jobs(jobs), ["b1", "b2", "a1", "a2"])

    def test_dependency_declared_after_dependent(self):
        jobs = [Job("c", depends_on=("b",)), Job("b", depends_on=("a",)), Job("a")]
        self.assertEqual(plan_jobs(jobs), ["a", "b", "c"])

    def test_repeated_dependency_counts_once(self):
        jobs = [Job("fetch"), Job("build", depends_on=("fetch", "fetch", "fetch"))]
        self.assertEqual(plan_jobs(jobs), ["fetch", "build"])

    def test_accepts_any_iterable_of_jobs(self):
        jobs = (Job(name, depends_on=deps) for name, deps in [("b", ("a",)), ("a", ())])
        self.assertEqual(plan_jobs(jobs), ["a", "b"])

    def test_accepts_list_and_other_collections_for_depends_on(self):
        jobs = [
            Job("c", depends_on=["a", "b"]),
            Job("b", depends_on=frozenset({"a"})),
            Job("a"),
        ]
        self.assertEqual(plan_jobs(jobs), ["a", "b", "c"])

    def test_ids_are_compared_exactly(self):
        # Case, whitespace and unicode differences make distinct IDs.
        jobs = [Job("a"), Job("A"), Job(" a"), Job("ä", depends_on=(" a",))]
        self.assertEqual(plan_jobs(jobs), ["a", "A", " a", "ä"])

    def test_float_and_bool_priorities_order_numerically(self):
        jobs = [Job("half", 0.5), Job("one", 1), Job("inf", float("inf")), Job("zero")]
        self.assertEqual(plan_jobs(jobs), ["inf", "one", "half", "zero"])

    def test_payload_is_ignored_even_when_unorderable_or_unhashable(self):
        jobs = [Job("a", payload={"k": []}), Job("b", payload=object()), Job("c", payload=None)]
        self.assertEqual(plan_jobs(jobs), ["a", "b", "c"])

    def test_long_chain_does_not_hit_the_recursion_limit(self):
        size = 20_000
        jobs = [Job(f"j{i}", depends_on=(f"j{i - 1}",) if i else ()) for i in range(size)]
        jobs.reverse()
        self.assertEqual(plan_jobs(jobs), [f"j{i}" for i in range(size)])

    def test_wide_fan_out_and_fan_in(self):
        width = 5_000
        jobs = [Job("sink", depends_on=tuple(f"m{i}" for i in range(width)))]
        jobs += [Job(f"m{i}", priority=i, depends_on=("source",)) for i in range(width)]
        jobs.append(Job("source"))
        expected = ["source", *(f"m{i}" for i in reversed(range(width))), "sink"]
        self.assertEqual(plan_jobs(jobs), expected)

    def test_matches_reference_model_on_random_dags(self):
        rng = random.Random(20261114)
        for _ in range(300):
            size = rng.randint(0, 12)
            ids = [f"j{i}" for i in range(size)]
            # Dependencies only point at lower topological rank, so the graph
            # is acyclic; shuffling decouples that rank from input order.
            jobs = [
                Job(
                    job_id,
                    priority=rng.randint(-2, 2),
                    depends_on=tuple(rng.sample(ids[:rank], rng.randint(0, min(rank, 3)))),
                )
                for rank, job_id in enumerate(ids)
            ]
            rng.shuffle(jobs)
            with self.subTest(jobs=jobs):
                order = plan_jobs(jobs)
                self.assertEqual(order, reference_plan(jobs))
                self.assertCountEqual(order, ids)
                position = {job_id: i for i, job_id in enumerate(order)}
                for job in jobs:
                    for dep in job.depends_on:
                        self.assertLess(position[dep], position[job.id])

    def test_every_permutation_of_a_small_graph_is_valid_and_deterministic(self):
        base = [
            Job("a", 1),
            Job("b", 1, ("a",)),
            Job("c", 2, ("a",)),
            Job("d", 0, ("b", "c")),
        ]
        for jobs in itertools.permutations(base):
            with self.subTest(order=[job.id for job in jobs]):
                self.assertEqual(plan_jobs(jobs), ["a", "c", "b", "d"])
                self.assertEqual(plan_jobs(jobs), plan_jobs(list(jobs)))


class NoMutationTests(unittest.TestCase):
    def test_jobs_and_dependency_lists_are_left_untouched(self):
        deps_for_c = ["a", "b", "a"]
        payload = {"nested": [1, 2, 3]}
        jobs = [
            Job("c", priority=1, depends_on=deps_for_c, payload=payload),
            Job("b", priority=2, depends_on=["a"]),
            Job("a", priority=3),
        ]
        snapshot = copy.deepcopy(jobs)
        original_identities = [id(job) for job in jobs]

        self.assertEqual(plan_jobs(jobs), ["a", "b", "c"])

        self.assertEqual(jobs, snapshot)
        self.assertEqual([id(job) for job in jobs], original_identities)
        self.assertEqual(deps_for_c, ["a", "b", "a"])
        self.assertIs(jobs[0].depends_on, deps_for_c)
        self.assertIs(jobs[0].payload, payload)

    def test_input_is_untouched_when_planning_fails(self):
        deps = ["b"]
        jobs = [Job("a", depends_on=deps), Job("b", depends_on=["a"])]
        snapshot = copy.deepcopy(jobs)
        with self.assertRaises(ScheduleError):
            plan_jobs(jobs)
        self.assertEqual(jobs, snapshot)
        self.assertEqual(deps, ["b"])


class InvalidInputTests(unittest.TestCase):
    def assertRejected(self, jobs, *fragments):
        with self.assertRaises(ScheduleError) as caught:
            plan_jobs(jobs)
        message = str(caught.exception)
        for fragment in fragments:
            self.assertIn(fragment, message)
        return message

    def test_schedule_error_is_a_value_error(self):
        with self.assertRaises(ValueError):
            plan_jobs([Job("")])

    def test_unknown_dependency_is_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("build", depends_on=("missing",))])

    def test_unknown_dependency_message_names_both_jobs(self):
        self.assertRejected(
            [Job("fetch"), Job("build", depends_on=("fetch", "missing"))],
            "'build'",
            "'missing'",
        )

    def test_dependency_lookup_is_case_sensitive(self):
        self.assertRejected([Job("Fetch"), Job("build", depends_on=("fetch",))], "'fetch'")

    def test_empty_id_is_rejected(self):
        self.assertRejected([Job("ok"), Job("")], "index 1", "empty")

    def test_non_string_ids_are_rejected(self):
        for bad in (None, 7, 1.5, b"bytes", ("a",), True):
            with self.subTest(id=bad):
                self.assertRejected([Job(bad)], "index 0", repr(bad))

    def test_duplicate_ids_are_rejected(self):
        self.assertRejected([Job("a"), Job("b"), Job("a", priority=9)], "'a'", "0", "2")

    def test_duplicate_ids_are_rejected_even_for_identical_jobs(self):
        job = Job("same")
        self.assertRejected([job, job], "'same'")

    def test_empty_string_dependency_is_rejected_as_unknown(self):
        self.assertRejected([Job("a", depends_on=("",))], "'a'", "''")

    def test_non_string_dependencies_are_rejected(self):
        for bad in (None, 3, ["a"], ("a",)):
            with self.subTest(dependency=bad):
                self.assertRejected(
                    [Job("a"), Job("b", depends_on=(bad,))], "'b'", repr(bad)
                )

    def test_bare_string_depends_on_is_rejected(self):
        # Without a guard this would be read as dependencies "a" and "b".
        self.assertRejected(
            [Job("a"), Job("b"), Job("c", depends_on="ab")], "'c'", "'ab'"
        )

    def test_non_iterable_depends_on_is_rejected(self):
        for bad in (None, 5):
            with self.subTest(depends_on=bad):
                self.assertRejected([Job("a", depends_on=bad)], "'a'", "depends_on")

    def test_non_job_entries_are_rejected(self):
        for bad in (None, "a", {"id": "a"}, ("a", 0)):
            with self.subTest(entry=bad):
                self.assertRejected([Job("ok"), bad], "index 1", type(bad).__name__)

    def test_non_iterable_jobs_argument_is_rejected(self):
        self.assertRejected(None, "NoneType")
        self.assertRejected(42, "int")

    def test_unorderable_priorities_are_rejected(self):
        for bad in (None, "high", float("nan"), [1], 1j):
            with self.subTest(priority=bad):
                self.assertRejected([Job("a"), Job("b", priority=bad)], "'b'", "priority")

    def test_invalid_input_is_reported_before_cycles(self):
        jobs = [
            Job("a", depends_on=("b",)),
            Job("b", depends_on=("a", "ghost")),
        ]
        message = self.assertRejected(jobs, "'ghost'")
        self.assertNotIn("cycle", message)


class CycleTests(unittest.TestCase):
    def cycle_message(self, jobs):
        with self.assertRaises(ScheduleError) as caught:
            plan_jobs(jobs)
        message = str(caught.exception)
        self.assertIn("cycle", message)
        return message

    def test_self_dependency_is_a_cycle(self):
        self.assertIn("'a' -> 'a'", self.cycle_message([Job("a", depends_on=("a",))]))

    def test_two_job_cycle_names_both_jobs(self):
        message = self.cycle_message(
            [Job("a", depends_on=("b",)), Job("b", depends_on=("a",))]
        )
        self.assertIn("'a' -> 'b' -> 'a'", message)

    def test_long_cycle_lists_every_member_in_dependency_order(self):
        jobs = [
            Job("a", depends_on=("b",)),
            Job("b", depends_on=("c",)),
            Job("c", depends_on=("d",)),
            Job("d", depends_on=("a",)),
        ]
        self.assertIn("'a' -> 'b' -> 'c' -> 'd' -> 'a'", self.cycle_message(jobs))

    def test_cycle_report_excludes_schedulable_jobs(self):
        jobs = [
            Job("free"),
            Job("upstream"),
            Job("x", depends_on=("y", "upstream")),
            Job("y", depends_on=("x",)),
        ]
        message = self.cycle_message(jobs)
        self.assertIn("'x' -> 'y' -> 'x'", message)
        self.assertNotIn("free", message)
        self.assertNotIn("upstream", message)

    def test_jobs_downstream_of_a_cycle_are_reported_separately(self):
        jobs = [
            Job("victim", depends_on=("x",)),
            Job("x", depends_on=("y",)),
            Job("y", depends_on=("x",)),
        ]
        message = self.cycle_message(jobs)
        chain, _, rest = message.partition(";")
        self.assertIn("'x' -> 'y' -> 'x'", chain)
        self.assertNotIn("victim", chain)
        self.assertIn("'victim'", rest)

    def test_cycle_is_detected_regardless_of_priority(self):
        jobs = [
            Job("a", priority=1000, depends_on=("b",)),
            Job("b", priority=-1000, depends_on=("a",)),
            Job("ok", priority=0),
        ]
        self.cycle_message(jobs)

    def test_cycle_reached_through_a_repeated_dependency(self):
        jobs = [Job("a", depends_on=("b", "b")), Job("b", depends_on=("a",))]
        self.assertIn("'a' -> 'b' -> 'a'", self.cycle_message(jobs))

    def test_one_of_several_cycles_is_reported_deterministically(self):
        jobs = [
            Job("p", depends_on=("q",)),
            Job("q", depends_on=("p",)),
            Job("r", depends_on=("s",)),
            Job("s", depends_on=("r",)),
        ]
        first = self.cycle_message(jobs)
        self.assertEqual(first, self.cycle_message(jobs))
        self.assertIn("'p' -> 'q' -> 'p'", first)
        # The jobs of the other cycle are still surfaced as blocked.
        self.assertIn("'r'", first)
        self.assertIn("'s'", first)

    def test_large_cycle_does_not_hit_the_recursion_limit(self):
        size = 20_000
        jobs = [Job(f"j{i}", depends_on=(f"j{(i + 1) % size}",)) for i in range(size)]
        message = self.cycle_message(jobs)
        self.assertIn("'j0' -> 'j1' -> ", message)
        self.assertIn(f" -> 'j{size - 1}' -> 'j0' (", message)
        self.assertNotIn("never become ready", message)


if __name__ == "__main__":
    unittest.main()
