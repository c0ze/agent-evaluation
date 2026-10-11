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

    def test_single_job_is_returned(self):
        self.assertEqual(plan_jobs([Job("only", priority=-3)]), ["only"])

    def test_empty_id_is_rejected(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("", priority=1)])
        self.assertIn("non-empty strings", str(ctx.exception))

    def test_non_string_id_is_rejected(self):
        for bad_id in (None, 7, 1.5, ("a",)):
            with self.subTest(bad_id=bad_id):
                with self.assertRaises(ScheduleError):
                    plan_jobs([Job(bad_id)])

    def test_duplicate_ids_are_rejected(self):
        jobs = [Job("a", 1), Job("b", 2), Job("a", 3)]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        self.assertIn("duplicate job id 'a'", str(ctx.exception))
        self.assertIn("0", str(ctx.exception))
        self.assertIn("2", str(ctx.exception))

    def test_self_dependency_is_rejected_as_cycle(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("a", depends_on=("a",))])
        self.assertIn("a", str(ctx.exception))

    def test_simple_cycle_is_detected_with_ids(self):
        jobs = [
            Job("a", depends_on=("b",)),
            Job("b", depends_on=("a",)),
            Job("free", 9),
        ]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        self.assertIn("cycle", str(ctx.exception))
        self.assertIn("a", str(ctx.exception))
        self.assertIn("b", str(ctx.exception))

    def test_tail_leading_into_cycle_is_detected(self):
        jobs = [
            Job("head", depends_on=("x",)),
            Job("x", depends_on=("y",)),
            Job("y", depends_on=("x",)),
        ]
        with self.assertRaises(ScheduleError):
            plan_jobs(jobs)

    def test_disconnected_groups_are_scheduled_by_priority(self):
        jobs = [
            Job("a1", 1),
            Job("a2", 4, depends_on=("a1",)),
            Job("b1", 3),
            Job("b2", 2, depends_on=("b1",)),
        ]
        self.assertEqual(plan_jobs(jobs), ["b1", "b2", "a1", "a2"])

    def test_tie_break_applies_to_newly_ready_jobs(self):
        jobs = [
            Job("x", 1),
            Job("y", 1, depends_on=("x",)),
            Job("z", 1),
        ]
        self.assertEqual(plan_jobs(jobs), ["x", "y", "z"])

    def test_priority_beats_input_order_after_completion(self):
        jobs = [
            Job("fetch", 0),
            Job("docs", 5),
            Job("compile", 9, depends_on=("fetch",)),
        ]
        self.assertEqual(plan_jobs(jobs), ["docs", "fetch", "compile"])

    def test_multiple_dependencies_wait_for_all(self):
        jobs = [
            Job("merge", depends_on=("first", "second")),
            Job("second", 4),
            Job("first", 4),
        ]
        self.assertEqual(plan_jobs(jobs), ["second", "first", "merge"])

    def test_repeated_dependency_entries_are_allowed(self):
        jobs = [
            Job("a", 2),
            Job("b", 1, depends_on=("a", "a", "a")),
        ]
        self.assertEqual(plan_jobs(jobs), ["a", "b"])

    def test_diamond_dependencies(self):
        jobs = [
            Job("root", 5),
            Job("left", 3, depends_on=("root",)),
            Job("right", 4, depends_on=("root",)),
            Job("leaf", 6, depends_on=("left", "right")),
        ]
        self.assertEqual(plan_jobs(jobs), ["root", "right", "left", "leaf"])

    def test_negative_and_zero_priorities(self):
        jobs = [Job("low", -5), Job("zero", 0), Job("neg", -1)]
        self.assertEqual(plan_jobs(jobs), ["zero", "neg", "low"])

    def test_generator_input_is_supported(self):
        jobs = (job for job in [Job("a", 2), Job("b", 7), Job("c", 2)])
        self.assertEqual(plan_jobs(jobs), ["b", "a", "c"])

    def test_dependency_list_is_not_mutated(self):
        deps = ["a", "b"]
        jobs = [
            Job("merge", depends_on=deps),
            Job("a", 1),
            Job("b", 1),
        ]
        plan_jobs(jobs)
        self.assertEqual(deps, ["a", "b"])

    def test_input_jobs_are_not_mutated(self):
        jobs = [
            Job("build", priority=10, depends_on=("fetch", "test")),
            Job("fetch", priority=3),
            Job("test", priority=4, depends_on=("fetch",)),
        ]
        snapshot = [
            (job.id, job.priority, job.depends_on, job.payload)
            for job in jobs
        ]
        plan_jobs(jobs)
        self.assertEqual(
            [(job.id, job.priority, job.depends_on, job.payload) for job in jobs],
            snapshot,
        )

    def test_deep_chain_of_5000_jobs(self):
        jobs = [Job("j0", 0)]
        jobs += [
            Job(f"j{i}", priority=-(i % 7), depends_on=(f"j{i - 1}",))
            for i in range(1, 5001)
        ]
        order = plan_jobs(jobs)
        self.assertEqual(len(order), 5001)
        self.assertEqual(len(set(order)), 5001)
        for i in range(1, 5001):
            self.assertLess(order.index(f"j{i - 1}"), order.index(f"j{i}"))

    def test_large_cycle_is_detected(self):
        jobs = [
            Job(f"c{i}", depends_on=(f"c{(i + 1) % 1500}",))
            for i in range(1500)
        ]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        self.assertIn("c1499", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
