import random
import unittest

from jobqueue import Job, ScheduleError, plan_jobs


def reference_plan(jobs):
    """Slow but obviously-correct scheduler used to cross-check plan_jobs.

    Repeatedly picks, among the jobs whose dependencies are all placed, the
    one with the highest priority, breaking ties by input position.
    """
    jobs = list(jobs)
    placed = []
    remaining = list(range(len(jobs)))
    while remaining:
        ready = [
            i
            for i in remaining
            if all(dep in placed for dep in jobs[i].depends_on)
        ]
        assert ready, "reference scheduler stalled on a cycle"
        best = max(ready, key=lambda i: (jobs[i].priority, -i))
        placed.append(jobs[best].id)
        remaining.remove(best)
    return placed


def random_dag(rng, size):
    """Build a random acyclic job set with random priorities and input order."""
    ids = [f"job{n}" for n in range(size)]
    hidden_order = ids[:]
    rng.shuffle(hidden_order)
    jobs = []
    for position, job_id in enumerate(hidden_order):
        candidates = hidden_order[:position]
        dep_count = min(len(candidates), rng.choice([0, 0, 1, 1, 2, 3]))
        deps = tuple(rng.sample(candidates, dep_count))
        jobs.append(Job(job_id, priority=rng.randint(-3, 3), depends_on=deps))
    rng.shuffle(jobs)
    return jobs


def assert_valid_plan(test, jobs, plan):
    """Every ID exactly once, every dependency before its dependant."""
    jobs = list(jobs)
    test.assertEqual(sorted(plan), sorted(job.id for job in jobs))
    test.assertEqual(len(plan), len(set(plan)))
    position = {job_id: index for index, job_id in enumerate(plan)}
    for job in jobs:
        for dep in job.depends_on:
            test.assertLess(
                position[dep], position[job.id], f"{dep} must run before {job.id}"
            )


class PlanJobsOrderingTests(unittest.TestCase):
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
        self.assertEqual(plan_jobs(()), [])
        self.assertEqual(plan_jobs(iter([])), [])

    def test_single_job(self):
        self.assertEqual(plan_jobs([Job("only")]), ["only"])

    def test_accepts_a_one_shot_iterator(self):
        jobs = (job for job in [Job("b", depends_on=("a",)), Job("a")])
        self.assertEqual(plan_jobs(jobs), ["a", "b"])

    def test_list_dependencies_are_accepted(self):
        jobs = [Job("c", depends_on=["a", "b"]), Job("a"), Job("b")]
        self.assertEqual(plan_jobs(jobs), ["a", "b", "c"])

    def test_priority_sort_is_stable_across_many_ready_jobs(self):
        jobs = [Job("p3a", 3), Job("p1a", 1), Job("p3b", 3), Job("p2", 2), Job("p1b", 1)]
        self.assertEqual(plan_jobs(jobs), ["p3a", "p3b", "p2", "p1a", "p1b"])

    def test_negative_priorities_sort_below_zero(self):
        jobs = [Job("neg", -5), Job("zero"), Job("pos", 5)]
        self.assertEqual(plan_jobs(jobs), ["pos", "zero", "neg"])

    def test_newly_unblocked_high_priority_job_jumps_ahead(self):
        # Once "gate" finishes, "high" becomes ready and must beat "mid",
        # which had been ready from the start.
        jobs = [Job("gate", 5), Job("mid", 3), Job("high", 10, depends_on=("gate",))]
        self.assertEqual(plan_jobs(jobs), ["gate", "high", "mid"])

    def test_no_priority_inheritance_through_dependencies(self):
        # A high-priority job waiting on a low-priority gate does not pull
        # the gate forward: only ready jobs are compared.
        jobs = [Job("low", 1), Job("gate", 0), Job("high", 10, depends_on=("gate",))]
        self.assertEqual(plan_jobs(jobs), ["low", "gate", "high"])

    def test_equal_priority_ties_use_input_order_not_readiness_time(self):
        # "c" is unblocked after "d" was already ready, but "c" comes earlier
        # in the input, so it still wins the tie.
        jobs = [Job("a"), Job("x"), Job("c", depends_on=("x",)), Job("d")]
        self.assertEqual(plan_jobs(jobs), ["a", "x", "c", "d"])

    def test_diamond_dependencies(self):
        jobs = [
            Job("top", priority=9, depends_on=("left", "right")),
            Job("left", priority=1, depends_on=("root",)),
            Job("right", priority=2, depends_on=("root",)),
            Job("root"),
        ]
        self.assertEqual(plan_jobs(jobs), ["root", "right", "left", "top"])

    def test_duplicate_dependencies_within_one_job_are_tolerated(self):
        jobs = [Job("b", depends_on=("a", "a", "a")), Job("a")]
        self.assertEqual(plan_jobs(jobs), ["a", "b"])

    def test_disconnected_components_interleave_by_priority(self):
        jobs = [
            Job("x2", 1, depends_on=("x1",)),
            Job("y1", 5),
            Job("x1", 2),
            Job("y2", 0, depends_on=("y1",)),
        ]
        self.assertEqual(plan_jobs(jobs), ["y1", "x1", "x2", "y2"])

    def test_random_dags_match_reference_scheduler(self):
        rng = random.Random(20260929)
        for size in (1, 2, 5, 10, 25, 60):
            for _ in range(20):
                jobs = random_dag(rng, size)
                plan = plan_jobs(jobs)
                assert_valid_plan(self, jobs, plan)
                self.assertEqual(plan, reference_plan(jobs))

    def test_result_is_deterministic(self):
        jobs = random_dag(random.Random(7), 40)
        first = plan_jobs(jobs)
        self.assertEqual(first, plan_jobs(jobs))
        self.assertEqual(first, plan_jobs(list(jobs)))

    def test_long_chain_does_not_hit_recursion_limit(self):
        size = 5000
        jobs = [Job(f"n{i}", depends_on=(f"n{i - 1}",)) for i in range(1, size)]
        jobs.append(Job("n0"))
        plan = plan_jobs(jobs)
        self.assertEqual(plan, [f"n{i}" for i in range(size)])


class PlanJobsValidationTests(unittest.TestCase):
    def test_unknown_dependency_is_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("build", depends_on=("missing",))])

    def test_unknown_dependency_message_names_job_and_dependency(self):
        with self.assertRaisesRegex(ScheduleError, r"'build'.*'missing'"):
            plan_jobs([Job("build", depends_on=("missing",))])

    def test_all_unknown_dependencies_of_a_job_are_listed(self):
        with self.assertRaisesRegex(ScheduleError, r"'nope1'.*'nope2'"):
            plan_jobs([Job("a"), Job("b", depends_on=("a", "nope1", "nope2"))])

    def test_duplicate_id_is_rejected(self):
        with self.assertRaisesRegex(ScheduleError, r"Duplicate job id 'dup'"):
            plan_jobs([Job("dup"), Job("other"), Job("dup")])

    def test_empty_id_is_rejected(self):
        with self.assertRaisesRegex(ScheduleError, r"empty id"):
            plan_jobs([Job("")])

    def test_non_string_id_is_rejected(self):
        for bad in (None, 7, b"bytes"):
            with self.subTest(bad=bad):
                with self.assertRaisesRegex(ScheduleError, r"non-string id"):
                    plan_jobs([Job(bad)])

    def test_non_string_dependency_is_rejected(self):
        with self.assertRaisesRegex(ScheduleError, r"'b'.*non-string dependency"):
            plan_jobs([Job("a"), Job("b", depends_on=("a", 3))])

    def test_bare_string_depends_on_is_rejected(self):
        # A common slip: depends_on="a" instead of depends_on=("a",).
        with self.assertRaisesRegex(ScheduleError, r"bare string"):
            plan_jobs([Job("a"), Job("b", depends_on="a")])

    def test_non_iterable_depends_on_is_rejected(self):
        with self.assertRaisesRegex(ScheduleError, r"depends_on must be an iterable"):
            plan_jobs([Job("a", depends_on=None)])

    def test_validation_happens_before_any_scheduling(self):
        # An invalid job at the end of the input must still be reported.
        jobs = [Job("a"), Job("b", depends_on=("a",)), Job("")]
        with self.assertRaises(ScheduleError):
            plan_jobs(jobs)

    def test_schedule_error_is_a_value_error(self):
        with self.assertRaises(ValueError):
            plan_jobs([Job("a", depends_on=("a",))])


class PlanJobsCycleTests(unittest.TestCase):
    def test_self_dependency_is_a_cycle(self):
        with self.assertRaisesRegex(ScheduleError, r"cycle.*\ba -> a\b"):
            plan_jobs([Job("a", depends_on=("a",))])

    def test_two_node_cycle_names_both_jobs(self):
        with self.assertRaisesRegex(ScheduleError, r"cycle.*\ba -> b -> a\b"):
            plan_jobs([Job("a", depends_on=("b",)), Job("b", depends_on=("a",))])

    def test_longer_cycle_lists_only_the_cycle_members(self):
        jobs = [
            Job("start"),
            Job("downstream", depends_on=("c",)),
            Job("a", depends_on=("c",)),
            Job("b", depends_on=("a",)),
            Job("c", depends_on=("b",)),
            Job("leaf", depends_on=("start",)),
        ]
        with self.assertRaises(ScheduleError) as caught:
            plan_jobs(jobs)
        message = str(caught.exception)
        self.assertIn("Dependency cycle detected", message)
        self.assertIn("c -> b -> a -> c", message)
        for outsider in ("start", "downstream", "leaf"):
            self.assertNotIn(outsider, message)

    def test_cycle_is_detected_even_when_priorities_are_high(self):
        jobs = [Job("x", 100, depends_on=("y",)), Job("y", 100, depends_on=("x",))]
        with self.assertRaises(ScheduleError):
            plan_jobs(jobs)

    def test_cycle_among_multiple_cycles_reports_one_concrete_cycle(self):
        jobs = [
            Job("p", depends_on=("q",)),
            Job("q", depends_on=("p",)),
            Job("r", depends_on=("s",)),
            Job("s", depends_on=("r",)),
        ]
        with self.assertRaisesRegex(ScheduleError, r"p -> q -> p"):
            plan_jobs(jobs)

    def test_very_long_cycle_does_not_hit_recursion_limit(self):
        size = 5000
        jobs = [Job(f"n{i}", depends_on=(f"n{(i + 1) % size}",)) for i in range(size)]
        with self.assertRaises(ScheduleError) as caught:
            plan_jobs(jobs)
        self.assertIn("n0", str(caught.exception))
        self.assertIn(f"n{size - 1}", str(caught.exception))


class PlanJobsImmutabilityTests(unittest.TestCase):
    def test_inputs_are_not_mutated(self):
        deps_c = ["a", "b", "a"]
        deps_b = ["a"]
        jobs = [
            Job("c", 1, depends_on=deps_c, payload={"k": "v"}),
            Job("b", 2, depends_on=deps_b),
            Job("a", 3),
        ]
        original_jobs = list(jobs)
        snapshot = [(job.id, job.priority, list(job.depends_on), job.payload) for job in jobs]

        self.assertEqual(plan_jobs(jobs), ["a", "b", "c"])

        self.assertEqual(jobs, original_jobs)
        self.assertIs(jobs[0].depends_on, deps_c)
        self.assertEqual(deps_c, ["a", "b", "a"])
        self.assertEqual(deps_b, ["a"])
        self.assertEqual(
            [(job.id, job.priority, list(job.depends_on), job.payload) for job in jobs],
            snapshot,
        )

    def test_returns_a_fresh_list_each_call(self):
        jobs = [Job("a"), Job("b")]
        first = plan_jobs(jobs)
        second = plan_jobs(jobs)
        self.assertEqual(first, second)
        self.assertIsNot(first, second)
        first.append("tampered")
        self.assertEqual(plan_jobs(jobs), ["a", "b"])


if __name__ == "__main__":
    unittest.main()
