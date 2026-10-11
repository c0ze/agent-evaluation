import copy
import random
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

    # --- basic behaviour -------------------------------------------------

    def test_empty_input_returns_empty_list(self):
        self.assertEqual(plan_jobs([]), [])

    def test_single_job(self):
        self.assertEqual(plan_jobs([Job("only")]), ["only"])

    def test_default_priority_and_dependencies(self):
        jobs = [Job("a"), Job("b"), Job("c")]
        self.assertEqual(plan_jobs(jobs), ["a", "b", "c"])

    def test_priorities_are_tied_by_input_order_not_by_id(self):
        jobs = [Job("z", 1), Job("y", 1), Job("x", 1)]
        self.assertEqual(plan_jobs(jobs), ["z", "y", "x"])

    def test_negative_and_float_priorities(self):
        jobs = [Job("low", -5), Job("high", 2.5), Job("mid", 0)]
        self.assertEqual(plan_jobs(jobs), ["high", "mid", "low"])

    def test_diamond_dependency_order(self):
        jobs = [
            Job("deploy", 10, ("test", "lint")),
            Job("test", 1, ("build",)),
            Job("lint", 2, ("build",)),
            Job("build", 0),
        ]
        order = plan_jobs(jobs)
        self.assertEqual(order, ["build", "lint", "test", "deploy"])

    def test_transitive_chain(self):
        jobs = [Job(f"j{i}", 0, (f"j{i - 1}",)) for i in range(1, 6)]
        jobs.append(Job("j0", 0))
        self.assertEqual(plan_jobs(jobs), [f"j{i}" for i in range(6)])

    def test_priority_only_applies_among_ready_jobs(self):
        # "c" has the top priority but is blocked by "a", which is last by priority.
        jobs = [
            Job("a", -10),
            Job("b", 1),
            Job("c", 100, ("a",)),
        ]
        self.assertEqual(plan_jobs(jobs), ["b", "a", "c"])

    def test_newly_ready_high_priority_job_jumps_the_queue(self):
        jobs = [
            Job("low1", 1),
            Job("low2", 2),
            Job("root", 10),
            Job("boss", 99, ("root",)),
        ]
        self.assertEqual(plan_jobs(jobs), ["root", "boss", "low2", "low1"])

    def test_duplicate_dependency_entries_are_tolerated(self):
        jobs = [Job("a"), Job("b", 0, ("a", "a", "a"))]
        self.assertEqual(plan_jobs(jobs), ["a", "b"])

    def test_every_job_returned_exactly_once(self):
        jobs = [
            Job("a"),
            Job("b", 0, ("a",)),
            Job("c", 0, ("a", "b")),
            Job("d", 0, ("c",)),
            Job("e", 0, ("b", "c", "d")),
        ]
        order = plan_jobs(jobs)
        self.assertEqual(sorted(order), sorted(j.id for j in jobs))
        self.assertEqual(len(order), len(set(order)))

    def test_accepts_any_iterable_of_jobs(self):
        jobs = (Job("a", 1), Job("b", 2))
        self.assertEqual(plan_jobs(iter(jobs)), ["b", "a"])

    def test_accepts_list_dependencies(self):
        jobs = [Job("a"), Job("b", 0, ["a"])]
        self.assertEqual(plan_jobs(jobs), ["a", "b"])

    # --- input is not mutated -------------------------------------------

    def test_input_jobs_are_not_mutated(self):
        jobs = [
            Job("build", 5, ("fetch",)),
            Job("fetch", 1),
            Job("test", 3, ["build", "fetch"]),
        ]
        snapshot = copy.deepcopy(jobs)
        plan_jobs(jobs)
        self.assertEqual(jobs, snapshot)
        self.assertEqual(jobs[2].depends_on, ["build", "fetch"])

    def test_input_list_object_is_not_reordered(self):
        jobs = [Job("a", 9), Job("b", 1)]
        plan_jobs(jobs)
        self.assertEqual([j.id for j in jobs], ["a", "b"])

    def test_repeated_calls_are_deterministic(self):
        jobs = [Job("a", 1, ("b",)), Job("b", 1), Job("c", 1, ("b",))]
        self.assertEqual(plan_jobs(jobs), plan_jobs(jobs))

    # --- invalid input ---------------------------------------------------

    def test_duplicate_ids_are_rejected(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("a"), Job("a", 5)])
        self.assertIn("duplicate", str(ctx.exception).lower())
        self.assertIn("a", str(ctx.exception))

    def test_empty_id_is_rejected(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("")])
        self.assertIn("non-empty", str(ctx.exception).lower())

    def test_non_string_id_is_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job(7)])
        with self.assertRaises(ScheduleError):
            plan_jobs([Job(None)])

    def test_non_string_dependency_is_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("a"), Job("b", 0, (1,))])

    def test_empty_string_dependency_is_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("a", 0, ("",))])

    def test_string_dependency_argument_is_rejected(self):
        # A bare string would otherwise be iterated character by character.
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("a"), Job("b", 0, "a")])

    def test_non_numeric_priority_is_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("a", "high")])

    def test_non_job_input_is_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([("a", 1)])

    def test_unknown_dependency_message_names_the_jobs(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("build", depends_on=("missing",))])
        message = str(ctx.exception)
        self.assertIn("build", message)
        self.assertIn("missing", message)

    def test_dependency_on_later_job_is_fine(self):
        self.assertEqual(
            plan_jobs([Job("second", 0, ("first",)), Job("first", 0)]),
            ["first", "second"],
        )

    # --- cycles ----------------------------------------------------------

    def test_self_dependency_is_a_cycle(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("a", 0, ("a",))])
        message = str(ctx.exception)
        self.assertIn("cycle", message.lower())
        self.assertIn("a", message)

    def test_two_node_cycle(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("a", 0, ("b",)), Job("b", 0, ("a",))])
        message = str(ctx.exception)
        self.assertIn("a", message)
        self.assertIn("b", message)

    def test_longer_cycle_with_healthy_jobs_around_it(self):
        jobs = [
            Job("ok"),
            Job("a", 0, ("c",)),
            Job("b", 0, ("a",)),
            Job("c", 0, ("b",)),
        ]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        message = str(ctx.exception)
        for job_id in ("a", "b", "c"):
            self.assertIn(job_id, message)
        self.assertNotIn("ok", message)

    def test_cycle_is_reported_even_when_unreachable_from_roots(self):
        jobs = [
            Job("root"),
            Job("x", 0, ("y",)),
            Job("y", 0, ("x",)),
        ]
        with self.assertRaises(ScheduleError):
            plan_jobs(jobs)

    def test_diamond_is_not_a_cycle(self):
        jobs = [
            Job("d", 0, ("b", "c")),
            Job("b", 0, ("a",)),
            Job("c", 0, ("a",)),
            Job("a", 0),
        ]
        self.assertEqual(plan_jobs(jobs), ["a", "b", "c", "d"])

    # --- randomized / structural ----------------------------------------

    def test_random_dags_respect_dependencies_and_priority(self):
        rng = random.Random(1234)
        for trial in range(200):
            size = rng.randint(1, 30)
            jobs = [Job(f"j{i}", rng.randint(-3, 3)) for i in range(size)]
            for i in range(size):
                deps = tuple(
                    f"j{j}" for j in rng.sample(range(i), rng.randint(0, min(i, 3)))
                )
                jobs[i] = Job(jobs[i].id, jobs[i].priority, deps)
            order = plan_jobs(jobs)
            self.assertEqual(len(order), size)
            self.assertEqual(set(order), {j.id for j in jobs})

            position = {job_id: pos for pos, job_id in enumerate(order)}
            for job in jobs:
                for dep in job.depends_on:
                    self.assertLess(position[dep], position[job.id])

            # Greedy property: each pick was the best available at the time.
            scheduled: set[str] = set()
            for job_id in order:
                ready = [
                    j
                    for j in jobs
                    if j.id not in scheduled and set(j.depends_on) <= scheduled
                ]
                best = min(ready, key=lambda j: (-j.priority, [x.id for x in jobs].index(j.id)))
                self.assertEqual(job_id, best.id)
                scheduled.add(job_id)

    def test_long_chain_does_not_blow_the_stack(self):
        size = 5000
        jobs = [Job("j0")] + [Job(f"j{i}", 0, (f"j{i - 1}",)) for i in range(1, size)]
        self.assertEqual(plan_jobs(jobs), [f"j{i}" for i in range(size)])

    def test_long_cycle_does_not_blow_the_stack(self):
        size = 5000
        jobs = [Job(f"j{i}", 0, (f"j{(i + 1) % size}",)) for i in range(size)]
        with self.assertRaises(ScheduleError):
            plan_jobs(jobs)


if __name__ == "__main__":
    unittest.main()
