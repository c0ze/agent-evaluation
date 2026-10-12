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

    def test_empty_input_returns_empty_list(self):
        self.assertEqual(plan_jobs([]), [])
        self.assertEqual(plan_jobs(iter(())), [])

    def test_single_job(self):
        self.assertEqual(plan_jobs([Job("only")]), ["only"])

    def test_accepts_arbitrary_iterables(self):
        jobs = (Job(name) for name in ("a", "b"))
        self.assertEqual(plan_jobs(jobs), ["a", "b"])

    def test_equal_priority_keeps_input_order(self):
        jobs = [Job(name) for name in "abcdef"]
        self.assertEqual(plan_jobs(jobs), list("abcdef"))

    def test_negative_priorities_are_ordered(self):
        jobs = [Job("low", -5), Job("high", -1), Job("lowest", -10)]
        self.assertEqual(plan_jobs(jobs), ["high", "low", "lowest"])

    def test_transitive_chain_beats_priorities(self):
        jobs = [
            Job("last", priority=100, depends_on=("mid",)),
            Job("mid", priority=50, depends_on=("first",)),
            Job("first", priority=1),
        ]
        self.assertEqual(plan_jobs(jobs), ["first", "mid", "last"])

    def test_diamond_dependencies(self):
        jobs = [
            Job("d", priority=100, depends_on=("b", "c")),
            Job("b", priority=5, depends_on=("a",)),
            Job("c", priority=7, depends_on=("a",)),
            Job("a"),
        ]
        self.assertEqual(plan_jobs(jobs), ["a", "c", "b", "d"])

    def test_newly_ready_job_jumps_ahead_of_lower_priority_idle_job(self):
        jobs = [
            Job("idle", priority=1),
            Job("a", priority=50),
            Job("b", priority=100, depends_on=("a",)),
        ]
        self.assertEqual(plan_jobs(jobs), ["a", "b", "idle"])

    def test_dependency_on_later_supplied_job_is_allowed(self):
        jobs = [Job("build", depends_on=("fetch",)), Job("fetch")]
        self.assertEqual(plan_jobs(jobs), ["fetch", "build"])

    def test_duplicate_dependencies_are_tolerated(self):
        jobs = [Job("a", depends_on=("b", "b", "b")), Job("b")]
        self.assertEqual(plan_jobs(jobs), ["b", "a"])

    def test_list_depends_on_is_accepted(self):
        jobs = [Job("a", depends_on=["b", "c"]), Job("b"), Job("c")]
        self.assertEqual(plan_jobs(jobs), ["b", "c", "a"])

    def test_input_jobs_and_dependency_lists_are_not_mutated(self):
        deps = ["b"]
        jobs = [Job("a", priority=3, depends_on=deps), Job("b", priority=9)]
        snapshot = list(jobs)
        first = plan_jobs(jobs)
        second = plan_jobs(jobs)
        self.assertEqual(first, ["b", "a"])
        self.assertEqual(second, first)
        self.assertEqual(jobs, snapshot)
        self.assertEqual(deps, ["b"])
        self.assertEqual(jobs[0].depends_on, ["b"])

    def test_self_dependency_is_reported_as_cycle(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("a", depends_on=("a",))])
        self.assertIn("a", str(ctx.exception))

    def test_two_job_cycle_reports_both_ids(self):
        jobs = [Job("a", depends_on=("b",)), Job("b", depends_on=("a",))]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        message = str(ctx.exception)
        self.assertIn("a", message)
        self.assertIn("b", message)

    def test_cycle_below_acyclic_prefix_reports_cycle_ids(self):
        jobs = [
            Job("entry", depends_on=("x",)),
            Job("x", depends_on=("y",)),
            Job("y", depends_on=("z",)),
            Job("z", depends_on=("y",)),
        ]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        message = str(ctx.exception)
        self.assertIn("y", message)
        self.assertIn("z", message)

    def test_empty_id_is_rejected(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("a"), Job("")])
        self.assertIn("empty", str(ctx.exception))

    def test_non_string_id_is_rejected(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job(7)])
        self.assertIn("non-string", str(ctx.exception))

    def test_duplicate_ids_are_rejected(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("a"), Job("b"), Job("a")])
        self.assertIn("a", str(ctx.exception))

    def test_unknown_dependency_message_names_job_and_dependency(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("build", depends_on=("missing",))])
        message = str(ctx.exception)
        self.assertIn("build", message)
        self.assertIn("missing", message)

    def test_non_string_dependency_is_rejected_as_unknown(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("a", depends_on=(7,))])
        self.assertIn("unknown", str(ctx.exception))

    def test_non_job_entry_is_rejected(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("a"), "a"])
        self.assertIn("str", str(ctx.exception))

    def test_non_iterable_depends_on_is_rejected(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("a", depends_on=None)])
        self.assertIn("a", str(ctx.exception))

    def test_non_numeric_priority_is_rejected(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("a", priority="high"), Job("b", priority=1)])
        self.assertIn("priority", str(ctx.exception))

    def test_schedule_error_is_a_value_error(self):
        self.assertTrue(issubclass(ScheduleError, ValueError))

    def test_complex_graph_is_planned_deterministically_and_validly(self):
        jobs = [
            Job("deploy", priority=1, depends_on=("test", "package")),
            Job("package", priority=4, depends_on=("build",)),
            Job("build", priority=4, depends_on=("lint", "fetch")),
            Job("lint", priority=2),
            Job("fetch", priority=9),
            Job("test", priority=8, depends_on=("build",)),
        ]
        plan = plan_jobs(jobs)
        self.assertEqual(
            plan, ["fetch", "lint", "build", "test", "package", "deploy"]
        )
        position = {job_id: index for index, job_id in enumerate(plan)}
        self.assertEqual(len(plan), len(jobs))
        self.assertEqual(sorted(plan), sorted(job.id for job in jobs))
        for job in jobs:
            for dep in job.depends_on:
                self.assertLess(position[dep], position[job.id])

    def test_ties_among_newly_ready_jobs_use_input_order_not_id_order(self):
        jobs = [
            Job("y", priority=1, depends_on=("t",)),
            Job("x", priority=1, depends_on=("t",)),
            Job("t"),
        ]
        self.assertEqual(plan_jobs(jobs), ["t", "y", "x"])

    def test_random_dags_are_scheduled_validly(self):
        rng = random.Random(20261012)
        for _ in range(100):
            size = rng.randint(1, 15)
            ids = [f"j{i}" for i in range(size)]
            jobs = []
            for index, job_id in enumerate(ids):
                count = rng.randint(0, min(3, index))
                deps = tuple(rng.choice(ids[:index]) for _ in range(count))
                jobs.append(
                    Job(job_id, priority=rng.randint(-5, 5), depends_on=deps)
                )
            rng.shuffle(jobs)
            plan = plan_jobs(jobs)
            self.assertEqual(sorted(plan), sorted(ids))
            position = {job_id: at for at, job_id in enumerate(plan)}
            for job in jobs:
                for dep in job.depends_on:
                    self.assertLess(position[dep], position[job.id])

    def test_random_cycles_are_always_rejected(self):
        rng = random.Random(99)
        for _ in range(50):
            size = rng.randint(2, 8)
            ids = [f"c{i}" for i in range(size)]
            jobs = [
                Job(job_id, depends_on=(ids[(index + 1) % size],))
                for index, job_id in enumerate(ids)
            ]
            rng.shuffle(jobs)
            with self.assertRaises(ScheduleError) as ctx:
                plan_jobs(jobs)
            self.assertIn("cycle", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
