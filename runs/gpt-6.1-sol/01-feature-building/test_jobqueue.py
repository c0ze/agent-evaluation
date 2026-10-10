from copy import deepcopy
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
        with self.assertRaises(ScheduleError) as raised:
            plan_jobs([Job("build", depends_on=("missing",))])
        self.assertIn("build", str(raised.exception))
        self.assertIn("missing", str(raised.exception))

    def test_empty_input(self):
        self.assertEqual(plan_jobs([]), [])
        self.assertEqual(plan_jobs(iter(())), [])

    def test_single_job(self):
        self.assertEqual(plan_jobs([Job("only")]), ["only"])

    def test_invalid_ids_are_rejected(self):
        for invalid_id in ("", None, 0, False, [], {}, b"job"):
            with self.subTest(id=invalid_id):
                with self.assertRaises(ScheduleError) as raised:
                    plan_jobs([Job(invalid_id)])
                self.assertIn("non-empty strings", str(raised.exception))
                self.assertIn("position 0", str(raised.exception))

    def test_duplicate_ids_are_rejected(self):
        with self.assertRaises(ScheduleError) as raised:
            plan_jobs([Job("same", 1), Job("same", 2)])
        self.assertIn("Duplicate", str(raised.exception))
        self.assertIn("same", str(raised.exception))

    def test_invalid_dependency_ids_are_rejected(self):
        for dependency in ("", None, 0, False, [], {}, b"source"):
            with self.subTest(dependency=dependency):
                with self.assertRaises(ScheduleError) as raised:
                    plan_jobs([
                        Job("source"),
                        Job("consumer", depends_on=(dependency,)),
                    ])
                self.assertIn("consumer", str(raised.exception))
                self.assertIn("invalid dependency", str(raised.exception))

    def test_valid_ids_need_not_be_identifiers(self):
        jobs = [Job("完成", depends_on=(" ",)), Job(" ")]
        self.assertEqual(plan_jobs(jobs), [" ", "完成"])

    def test_dependencies_can_refer_to_later_input(self):
        jobs = [
            Job("last", depends_on=("middle",)),
            Job("middle", depends_on=("first",)),
            Job("first"),
        ]
        self.assertEqual(plan_jobs(jobs), ["first", "middle", "last"])

    def test_newly_ready_job_can_preempt_existing_ready_jobs(self):
        jobs = [
            Job("waiting", 2),
            Job("unlock", 3),
            Job("urgent", 100, depends_on=("unlock",)),
        ]
        self.assertEqual(plan_jobs(jobs), ["unlock", "urgent", "waiting"])

    def test_newly_ready_tie_uses_original_input_order(self):
        jobs = [
            Job("earlier", 5, depends_on=("unlock",)),
            Job("waiting", 5),
            Job("unlock", 10),
        ]
        self.assertEqual(plan_jobs(jobs), ["unlock", "earlier", "waiting"])

    def test_ties_do_not_use_lexical_id_order(self):
        self.assertEqual(
            plan_jobs([Job("z"), Job("a"), Job("m")]), ["z", "a", "m"]
        )

    def test_negative_priorities(self):
        jobs = [Job("low", -10), Job("high", -1), Job("tied", -1)]
        self.assertEqual(plan_jobs(jobs), ["high", "tied", "low"])

    def test_fan_in_fan_out_and_disconnected_jobs(self):
        jobs = [
            Job("finish", 100, depends_on=("left", "right")),
            Job("right", 2, depends_on=("root",)),
            Job("independent", 0),
            Job("left", 1, depends_on=("root",)),
            Job("root", -1),
        ]
        result = plan_jobs(jobs)
        self.assertEqual(result, ["independent", "root", "right", "left", "finish"])
        self.assertCountEqual(result, [job.id for job in jobs])
        positions = {job_id: index for index, job_id in enumerate(result)}
        for job in jobs:
            for dependency in job.depends_on:
                self.assertLess(positions[dependency], positions[job.id])

    def test_repeated_dependencies_count_once(self):
        jobs = [
            Job("finish", depends_on=("source", "other", "source", "other")),
            Job("source"),
            Job("other"),
        ]
        self.assertEqual(plan_jobs(jobs), ["source", "other", "finish"])

    def test_generator_input(self):
        jobs = (job for job in [Job("b", depends_on=("a",)), Job("a")])
        self.assertEqual(plan_jobs(jobs), ["a", "b"])

    def test_self_dependency_is_a_cycle(self):
        with self.assertRaises(ScheduleError) as raised:
            plan_jobs([Job("self", depends_on=("self",))])
        self.assertIn("cycle", str(raised.exception))
        self.assertIn("self", str(raised.exception))

    def test_two_job_cycle(self):
        with self.assertRaises(ScheduleError) as raised:
            plan_jobs([
                Job("alpha", depends_on=("beta",)),
                Job("beta", depends_on=("alpha",)),
            ])
        self.assertIn("cycle", str(raised.exception))
        self.assertIn("alpha", str(raised.exception))
        self.assertIn("beta", str(raised.exception))

    def test_cycle_with_independent_and_downstream_jobs(self):
        jobs = [
            Job("alpha", depends_on=("gamma",)),
            Job("beta", depends_on=("alpha",)),
            Job("gamma", depends_on=("beta",)),
            Job("blocked", depends_on=("gamma",)),
            Job("independent", 100),
        ]
        with self.assertRaises(ScheduleError) as raised:
            plan_jobs(jobs)
        message = str(raised.exception)
        self.assertIn("cycle", message)
        for job_id in ("alpha", "beta", "gamma", "blocked"):
            self.assertIn(job_id, message)
        self.assertNotIn("independent", message)

    def test_missing_dependency_is_validated_even_in_a_cycle(self):
        with self.assertRaises(ScheduleError) as raised:
            plan_jobs([Job("loop", depends_on=("loop", "missing"))])
        self.assertIn("unknown dependency", str(raised.exception))
        self.assertIn("missing", str(raised.exception))

    def test_success_does_not_mutate_input(self):
        dependencies = ["source", "source"]
        payload = {"nested": [1, 2, 3]}
        jobs = [
            Job("consumer", 100, depends_on=dependencies, payload=payload),
            Job("source"),
        ]
        before = deepcopy(jobs)
        original_jobs = tuple(jobs)
        for _ in range(2):
            self.assertEqual(plan_jobs(jobs), ["source", "consumer"])
            self.assertEqual(jobs, before)
        self.assertTrue(all(job is original for job, original in zip(jobs, original_jobs)))
        self.assertIs(jobs[0].depends_on, dependencies)
        self.assertIs(jobs[0].payload, payload)

    def test_failure_does_not_mutate_input(self):
        for dependencies in (["missing"], ["consumer"]):
            with self.subTest(dependencies=dependencies):
                jobs = [Job("consumer", depends_on=dependencies), Job("source")]
                before = deepcopy(jobs)
                with self.assertRaises(ScheduleError):
                    plan_jobs(jobs)
                self.assertEqual(jobs, before)
                self.assertIs(jobs[0].depends_on, dependencies)

    def test_long_dependency_chain(self):
        jobs = [
            Job(f"job-{index}", depends_on=(f"job-{index - 1}",))
            for index in range(1499, 0, -1)
        ]
        jobs.append(Job("job-0"))
        self.assertEqual(plan_jobs(jobs), [f"job-{index}" for index in range(1500)])


if __name__ == "__main__":
    unittest.main()
