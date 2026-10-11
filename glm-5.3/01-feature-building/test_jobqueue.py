import random
import unittest

from jobqueue import Job, ScheduleError, plan_jobs


def assert_valid_plan(testcase, jobs, result):
    """Assert generic topological invariants of ``result`` for ``jobs``."""
    ids = [job.id for job in jobs]
    testcase.assertEqual(
        sorted(result), sorted(ids), "every job id must appear exactly once"
    )
    position = {job_id: index for index, job_id in enumerate(result)}
    for job in jobs:
        for dep in job.depends_on:
            testcase.assertGreater(
                position[job.id],
                position[dep],
                msg=f"{dep!r} must run before {job.id!r}",
            )


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
        self.assertEqual(plan_jobs(()), [])
        self.assertEqual(plan_jobs(iter([])), [])

    def test_single_job(self):
        self.assertEqual(plan_jobs([Job("only")]), ["only"])
        self.assertEqual(plan_jobs([Job("only", priority=7)]), ["only"])

    def test_long_chain(self):
        jobs = [
            Job(f"j{i}", depends_on=(f"j{i - 1}",) if i else ())
            for i in range(500)
        ]
        self.assertEqual(plan_jobs(jobs), [f"j{i}" for i in range(500)])

    def test_diamond_dependency(self):
        jobs = [
            Job("d", depends_on=("b", "c")),
            Job("b", priority=-1, depends_on=("a",)),
            Job("c", priority=1, depends_on=("a",)),
            Job("a"),
        ]
        result = plan_jobs(jobs)
        assert_valid_plan(self, jobs, result)
        self.assertEqual(result, ["a", "c", "b", "d"])

    def test_priority_applies_when_job_becomes_ready(self):
        jobs = [
            Job("low", priority=0),
            Job("gate", priority=1),
            Job("high", priority=10, depends_on=("gate",)),
        ]
        self.assertEqual(plan_jobs(jobs), ["gate", "high", "low"])

    def test_equal_priorities_fall_back_to_input_order(self):
        jobs = [Job("a", 5), Job("b", 5), Job("c", 5)]
        self.assertEqual(plan_jobs(jobs), ["a", "b", "c"])

    def test_negative_priorities(self):
        jobs = [Job("a", -3), Job("b", -1), Job("c", -2)]
        self.assertEqual(plan_jobs(jobs), ["b", "c", "a"])

    def test_disconnected_components_interleave_by_priority(self):
        jobs = [
            Job("a1", 1),
            Job("b1", 5),
            Job("a2", 0, depends_on=("a1",)),
            Job("b2", 0, depends_on=("b1",)),
        ]
        self.assertEqual(plan_jobs(jobs), ["b1", "a1", "a2", "b2"])

    def test_equal_priority_dependent_waits_despite_earlier_index(self):
        jobs = [Job("b", 2, depends_on=("a",)), Job("a", 2), Job("c", 2)]
        self.assertEqual(plan_jobs(jobs), ["a", "b", "c"])

    def test_duplicate_ids_are_rejected(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("a"), Job("b"), Job("a")])
        message = str(ctx.exception)
        self.assertIn("duplicate", message)
        self.assertIn("'a'", message)

    def test_empty_id_is_rejected(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("ok"), Job("")])
        self.assertIn("index 1", str(ctx.exception))

    def test_non_string_id_is_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("ok"), Job(42)])

    def test_non_job_item_is_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("ok"), "not-a-job"])

    def test_non_iterable_input_is_rejected(self):
        for bad in (None, 42, Job("x")):
            with self.assertRaises(ScheduleError):
                plan_jobs(bad)

    def test_unknown_dependency_message_names_both_jobs(self):
        jobs = [Job("build", depends_on=("ghost",)), Job("other")]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        message = str(ctx.exception)
        self.assertIn("build", message)
        self.assertIn("ghost", message)

    def test_self_dependency_is_a_cycle(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("a", depends_on=("a",))])
        message = str(ctx.exception)
        self.assertIn("cycle", message.lower())
        self.assertIn("a", message)

    def test_two_node_cycle_message_lists_ids(self):
        jobs = [Job("a", depends_on=("b",)), Job("b", depends_on=("a",))]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        message = str(ctx.exception)
        self.assertIn("a", message)
        self.assertIn("b", message)

    def test_cycle_with_blocked_downstream_jobs(self):
        jobs = [
            Job("clean"),
            Job("compile", depends_on=("test",)),
            Job("test", depends_on=("compile",)),
            Job("deploy", depends_on=("test",)),
        ]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        message = str(ctx.exception)
        self.assertIn("compile", message)
        self.assertIn("test", message)

    def test_does_not_mutate_jobs_or_dependency_lists(self):
        depends = ["a", "a"]
        jobs = [Job("b", 3, depends_on=depends), Job("a", 9)]
        depends_before = list(depends)
        ids_before = [job.id for job in jobs]

        self.assertEqual(plan_jobs(jobs), ["a", "b"])

        self.assertEqual(depends, depends_before)
        self.assertEqual(jobs[0].depends_on, depends_before)
        self.assertEqual([job.id for job in jobs], ids_before)

    def test_repeated_calls_are_deterministic(self):
        jobs = (Job("b", depends_on=("a",)), Job("a"))
        self.assertEqual(plan_jobs(jobs), ["a", "b"])
        self.assertEqual(plan_jobs(jobs), plan_jobs(jobs))

    def test_generator_input(self):
        jobs = [Job("b", 1, depends_on=("a",)), Job("a", 2), Job("c", 0)]
        self.assertEqual(plan_jobs(iter(jobs)), ["a", "b", "c"])

    def test_duplicate_dependencies_count_once(self):
        jobs = [Job("a"), Job("b", depends_on=("a", "a", "a"))]
        self.assertEqual(plan_jobs(jobs), ["a", "b"])

    def test_non_string_dependency_is_rejected(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("a"), Job("b", depends_on=(123,))])
        self.assertIn("b", str(ctx.exception))

    def test_payload_is_ignored_for_ordering(self):
        jobs = [
            Job("a", payload={"k": 1}),
            Job("b", payload=None, depends_on=("a",)),
        ]
        self.assertEqual(plan_jobs(jobs), ["a", "b"])

    def test_pipeline_example(self):
        jobs = [
            Job("deploy", depends_on=("package",), priority=10),
            Job("package", depends_on=("lint", "test"), priority=5),
            Job("test", depends_on=("fetch",), priority=3),
            Job("lint", depends_on=("fetch",), priority=4),
            Job("fetch", priority=2),
        ]
        result = plan_jobs(jobs)
        assert_valid_plan(self, jobs, result)
        self.assertEqual(
            result, ["fetch", "lint", "test", "package", "deploy"]
        )

    def test_random_dags_stay_valid_and_deterministic(self):
        rng = random.Random(20261011)
        for _ in range(50):
            n = rng.randint(0, 40)
            jobs = []
            for i in range(n):
                deps = tuple(
                    f"j{d}"
                    for d in rng.sample(
                        range(i), min(i, rng.randint(0, 3))
                    )
                )
                jobs.append(Job(f"j{i}", rng.randint(-10, 10), deps))
            result = plan_jobs(jobs)
            assert_valid_plan(self, jobs, result)
            self.assertEqual(plan_jobs(jobs), result)


if __name__ == "__main__":
    unittest.main()