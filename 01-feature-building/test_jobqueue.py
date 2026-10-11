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

    def test_single_job(self):
        self.assertEqual(plan_jobs([Job("only")]), ["only"])

    def test_every_job_returned_exactly_once(self):
        jobs = [
            Job("a", 1, ("b",)),
            Job("b", 2, ("c",)),
            Job("c", 3),
            Job("d", 4),
        ]
        order = plan_jobs(jobs)
        self.assertEqual(sorted(order), ["a", "b", "c", "d"])
        self.assertEqual(len(order), len(set(order)))

    def test_empty_id_is_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("")])

    def test_non_string_id_is_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job(123)])  # type: ignore[arg-type]

    def test_duplicate_id_is_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("a"), Job("b"), Job("a")])

    def test_duplicate_id_error_mentions_id(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("dup"), Job("dup")])
        self.assertIn("dup", str(ctx.exception))

    def test_unknown_dependency_error_mentions_missing_id(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("build", depends_on=("ghost",))])
        self.assertIn("ghost", str(ctx.exception))

    def test_self_dependency_is_a_cycle(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("loop", depends_on=("loop",))])
        self.assertIn("loop", str(ctx.exception))

    def test_two_node_cycle_is_detected(self):
        jobs = [
            Job("a", depends_on=("b",)),
            Job("b", depends_on=("a",)),
            Job("free"),
        ]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        message = str(ctx.exception)
        self.assertIn("a", message)
        self.assertIn("b", message)
        self.assertNotIn("free", message)

    def test_three_node_cycle_is_detected(self):
        jobs = [
            Job("x", depends_on=("z",)),
            Job("y", depends_on=("x",)),
            Job("z", depends_on=("y",)),
        ]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        message = str(ctx.exception)
        for job_id in ("x", "y", "z"):
            self.assertIn(job_id, message)

    def test_diamond_dependency(self):
        jobs = [
            Job("top", priority=1, depends_on=("left", "right")),
            Job("left", priority=5, depends_on=("bottom",)),
            Job("right", priority=5, depends_on=("bottom",)),
            Job("bottom", priority=1),
        ]
        order = plan_jobs(jobs)
        self.assertEqual(order, ["bottom", "left", "right", "top"])

    def test_newly_ready_job_competes_by_priority(self):
        jobs = [
            Job("low", priority=1),
            Job("gate", priority=5, depends_on=("high",)),
            Job("high", priority=9),
        ]
        self.assertEqual(plan_jobs(jobs), ["high", "gate", "low"])

    def test_equal_priorities_keep_input_order(self):
        jobs = [Job("first", 3), Job("second", 3), Job("third", 3)]
        self.assertEqual(plan_jobs(jobs), ["first", "second", "third"])

    def test_negative_priorities(self):
        jobs = [Job("neg", -5), Job("zero", 0), Job("pos", 5)]
        self.assertEqual(plan_jobs(jobs), ["pos", "zero", "neg"])

    def test_duplicate_dependency_entries(self):
        jobs = [Job("a", depends_on=("b", "b")), Job("b")]
        self.assertEqual(plan_jobs(jobs), ["b", "a"])

    def test_input_is_not_mutated(self):
        jobs = [
            Job("a", 1, ("b",)),
            Job("b", 2, ("c",)),
            Job("c", 3),
        ]
        snapshot = [(j.id, j.priority, j.depends_on, j.payload) for j in jobs]
        plan_jobs(jobs)
        self.assertEqual(
            [(j.id, j.priority, j.depends_on, j.payload) for j in jobs], snapshot
        )

    def test_accepts_any_iterable(self):
        jobs = (Job("a"), Job("b"))
        self.assertEqual(sorted(plan_jobs(iter(jobs))), ["a", "b"])

    def test_large_chain(self):
        n = 500
        jobs = [Job(f"j{i}", priority=i, depends_on=(f"j{i-1}",) if i else ()) for i in range(n)]
        order = plan_jobs(jobs)
        self.assertEqual(order, [f"j{i}" for i in range(n)])


if __name__ == "__main__":
    unittest.main()
