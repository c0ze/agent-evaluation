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

    def test_newly_ready_job_competes_by_priority(self):
        # After 'a', ready jobs are 'c'(50) and 'b'(1): 'c' wins. Unlocking
        # 'c' makes 'd'(200) ready, which then beats the still-ready 'b'.
        jobs = [
            Job("a", 100),
            Job("b", 1),
            Job("c", 50, depends_on=("a",)),
            Job("d", 200, depends_on=("c",)),
        ]
        self.assertEqual(plan_jobs(jobs), ["a", "c", "d", "b"])

    def test_chain_and_fan_in(self):
        jobs = [
            Job("top"),
            Job("mid", depends_on=("top",)),
            Job("left", depends_on=("mid",)),
            Job("right", depends_on=("mid",)),
            Job("join", depends_on=("left", "right")),
        ]
        result = plan_jobs(jobs)
        self.assertEqual(result[0], "top")
        self.assertEqual(result[-1], "join")
        self.assertLess(result.index("mid"), result.index("left"))
        self.assertLess(result.index("mid"), result.index("right"))
        self.assertEqual(len(set(result)), len(jobs))

    def test_all_jobs_returned_exactly_once(self):
        jobs = [
            Job("a", 3, depends_on=("c",)),
            Job("b", 1),
            Job("c", 2),
            Job("d", 1, depends_on=("a", "b")),
        ]
        result = plan_jobs(jobs)
        self.assertEqual(sorted(result), sorted(job.id for job in jobs))
        self.assertEqual(len(result), len(set(result)))

    def test_duplicate_dependency_is_harmless(self):
        jobs = [
            Job("a"),
            Job("b", depends_on=("a", "a", "a")),
        ]
        self.assertEqual(plan_jobs(jobs), ["a", "b"])

    def test_input_jobs_are_not_mutated(self):
        jobs = [
            Job("a", depends_on=("b",)),
            Job("b"),
        ]
        before = [(job.id, job.priority, job.depends_on) for job in jobs]
        plan_jobs(jobs)
        after = [(job.id, job.priority, job.depends_on) for job in jobs]
        self.assertEqual(before, after)

    def test_accepts_generic_iterable(self):
        jobs = (Job("a", 1), Job("b", 2))
        self.assertEqual(plan_jobs(iter(jobs)), ["b", "a"])
        self.assertEqual(plan_jobs(jobs), ["b", "a"])

    def test_empty_string_id_is_rejected(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("")])
        self.assertIn("non-empty", str(ctx.exception))

    def test_whitespace_only_id_is_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("   ")])

    def test_non_string_id_is_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job(123)])

    def test_duplicate_ids_are_rejected(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("a"), Job("a")])
        self.assertIn("a", str(ctx.exception))

    def test_unknown_dependency_message_is_useful(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("build", depends_on=("ghost",))])
        message = str(ctx.exception)
        self.assertIn("build", message)
        self.assertIn("ghost", message)

    def test_simple_cycle_is_detected(self):
        jobs = [
            Job("a", depends_on=("b",)),
            Job("b", depends_on=("a",)),
        ]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        self.assertIn("cycle", str(ctx.exception).lower())
        self.assertIn("a", str(ctx.exception))
        self.assertIn("b", str(ctx.exception))

    def test_self_dependency_is_detected(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("a", depends_on=("a",))])
        self.assertIn("cycle", str(ctx.exception).lower())

    def test_longer_cycle_is_detected_with_ids(self):
        jobs = [
            Job("a", depends_on=("c",)),
            Job("b", depends_on=("a",)),
            Job("c", depends_on=("b",)),
        ]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        message = str(ctx.exception)
        for job_id in ("a", "b", "c"):
            self.assertIn(job_id, message)

    def test_cycle_disjoint_from_valid_jobs_is_detected(self):
        jobs = [
            Job("free"),
            Job("x", depends_on=("y",)),
            Job("y", depends_on=("x",)),
        ]
        with self.assertRaises(ScheduleError):
            plan_jobs(jobs)

    def test_negative_priorities(self):
        jobs = [Job("a", -5), Job("b", -1), Job("c", -5)]
        self.assertEqual(plan_jobs(jobs), ["b", "a", "c"])

    def test_identical_priorities_follow_input_order(self):
        jobs = [Job("first"), Job("second"), Job("third")]
        self.assertEqual(plan_jobs(jobs), ["first", "second", "third"])


if __name__ == "__main__":
    unittest.main()
