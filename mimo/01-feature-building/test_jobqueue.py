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

    def test_empty_input(self):
        self.assertEqual(plan_jobs([]), [])

    def test_single_job(self):
        self.assertEqual(plan_jobs([Job("only")]), ["only"])

    def test_all_ids_returned_exactly_once(self):
        jobs = [
            Job("a", depends_on=("b", "c")),
            Job("b", depends_on=("d",)),
            Job("c", depends_on=("d",)),
            Job("d"),
        ]
        order = plan_jobs(jobs)
        self.assertEqual(sorted(order), ["a", "b", "c", "d"])
        self.assertEqual(len(order), 4)

    def test_diamond_dependencies(self):
        jobs = [
            Job("top", depends_on=("left", "right")),
            Job("left", depends_on=("root",)),
            Job("right", depends_on=("root",)),
            Job("root"),
        ]
        order = plan_jobs(jobs)
        self.assertEqual(order[0], "root")
        self.assertEqual(order[-1], "top")
        self.assertLess(order.index("left"), order.index("top"))
        self.assertLess(order.index("right"), order.index("top"))

    def test_priority_applies_when_job_becomes_ready(self):
        jobs = [
            Job("x", priority=1, depends_on=("z",)),
            Job("y", priority=2),
            Job("z", priority=0),
        ]
        self.assertEqual(plan_jobs(jobs), ["y", "z", "x"])

    def test_equal_priority_keeps_input_order_for_late_ready_jobs(self):
        jobs = [
            Job("late1", priority=3, depends_on=("root",)),
            Job("late2", priority=3, depends_on=("root",)),
            Job("root", priority=0),
        ]
        self.assertEqual(plan_jobs(jobs), ["root", "late1", "late2"])

    def test_negative_priority_orders_last_among_ready(self):
        jobs = [Job("low", priority=-5), Job("high", priority=0)]
        self.assertEqual(plan_jobs(jobs), ["high", "low"])

    def test_duplicate_job_id_rejected(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("a"), Job("a")])
        self.assertIn("duplicate", str(ctx.exception).lower())

    def test_empty_job_id_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("")])

    def test_non_string_job_id_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job(123)])  # type: ignore[arg-type]

    def test_unknown_dependency_message_names_jobs(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("build", depends_on=("missing",))])
        message = str(ctx.exception)
        self.assertIn("build", message)
        self.assertIn("missing", message)

    def test_self_dependency_is_a_cycle(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("a", depends_on=("a",))])
        self.assertIn("a", str(ctx.exception))

    def test_two_job_cycle(self):
        jobs = [
            Job("a", depends_on=("b",)),
            Job("b", depends_on=("a",)),
        ]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        message = str(ctx.exception)
        self.assertIn("cycle", message.lower())
        self.assertIn("a", message)
        self.assertIn("b", message)

    def test_longer_cycle_reports_involved_ids(self):
        jobs = [
            Job("a", depends_on=("b",)),
            Job("b", depends_on=("c",)),
            Job("c", depends_on=("a",)),
            Job("ok"),
        ]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        message = str(ctx.exception)
        for job_id in ("a", "b", "c"):
            self.assertIn(job_id, message)

    def test_cycle_with_bystander_dependency(self):
        jobs = [
            Job("a", depends_on=("b",)),
            Job("b", depends_on=("a",)),
            Job("c", depends_on=("a",)),
        ]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        message = str(ctx.exception)
        self.assertIn("a", message)
        self.assertIn("b", message)

    def test_duplicate_entries_in_depends_on(self):
        jobs = [
            Job("build", depends_on=("fetch", "fetch")),
            Job("fetch"),
        ]
        self.assertEqual(plan_jobs(jobs), ["fetch", "build"])

    def test_does_not_mutate_jobs_or_dependencies(self):
        deps = ["fetch"]
        jobs = [Job("build", depends_on=tuple(deps)), Job("fetch", priority=1)]
        snapshot = [(job.id, job.priority, job.depends_on) for job in jobs]
        plan_jobs(jobs)
        self.assertEqual(
            [(job.id, job.priority, job.depends_on) for job in jobs], snapshot
        )
        self.assertEqual(deps, ["fetch"])

    def test_generator_input(self):
        def gen():
            yield Job("b", priority=1, depends_on=("a",))
            yield Job("a", priority=9)

        self.assertEqual(plan_jobs(gen()), ["a", "b"])


if __name__ == "__main__":
    unittest.main()
