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
        self.assertEqual(plan_jobs(()), [])

    def test_single_job(self):
        self.assertEqual(plan_jobs([Job("solo", priority=3)]), ["solo"])

    def test_duplicate_ids_rejected(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("a"), Job("b"), Job("a")])
        self.assertIn("a", str(ctx.exception))

    def test_empty_string_id_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("")])

    def test_non_string_id_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job(123)])  # type: ignore[arg-type]
        with self.assertRaises(ScheduleError):
            plan_jobs([Job(None)])  # type: ignore[arg-type]

    def test_unknown_dependency_message_is_useful(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("build", depends_on=("missing",))])
        msg = str(ctx.exception)
        self.assertIn("build", msg)
        self.assertIn("missing", msg)

    def test_invalid_dependency_entries_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("a", depends_on=("",))])
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("a", depends_on=(123,))])  # type: ignore[arg-type]
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("a", depends_on=None)])  # type: ignore[arg-type]

    def test_string_depends_on_rejected(self):
        # A bare string must not be treated as an iterable of IDs.
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("a", depends_on="b"), Job("b")])  # type: ignore[arg-type]

    def test_self_dependency_is_cycle(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("a", depends_on=("a",))])
        self.assertIn("a", str(ctx.exception))

    def test_direct_cycle_reports_ids(self):
        jobs = [Job("a", depends_on=("b",)), Job("b", depends_on=("a",))]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        msg = str(ctx.exception)
        self.assertIn("a", msg)
        self.assertIn("b", msg)

    def test_longer_cycle_reports_ids(self):
        jobs = [
            Job("a", depends_on=("c",)),
            Job("b", depends_on=("a",)),
            Job("c", depends_on=("b",)),
            Job("ok"),
        ]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        msg = str(ctx.exception)
        for jid in ("a", "b", "c"):
            self.assertIn(jid, msg)

    def test_duplicate_dependencies_tolerated(self):
        jobs = [Job("a", depends_on=("b", "b")), Job("b")]
        self.assertEqual(plan_jobs(jobs), ["b", "a"])

    def test_diamond_dependencies(self):
        jobs = [
            Job("a"),
            Job("b", depends_on=("a",)),
            Job("c", depends_on=("a",)),
            Job("d", depends_on=("b", "c")),
        ]
        self.assertEqual(plan_jobs(jobs), ["a", "b", "c", "d"])

    def test_chain_overrides_priority(self):
        jobs = [
            Job("c", priority=100, depends_on=("b",)),
            Job("b", priority=50, depends_on=("a",)),
            Job("a", priority=1),
        ]
        self.assertEqual(plan_jobs(jobs), ["a", "b", "c"])

    def test_newly_ready_high_priority_jumps_ahead(self):
        jobs = [
            Job("low", priority=1),
            Job("blocked_high", priority=100, depends_on=("low",)),
            Job("mid", priority=50),
        ]
        self.assertEqual(plan_jobs(jobs), ["mid", "low", "blocked_high"])

    def test_equal_priority_keeps_input_order_after_unblock(self):
        jobs = [
            Job("root"),
            Job("x", priority=5, depends_on=("root",)),
            Job("y", priority=5, depends_on=("root",)),
        ]
        self.assertEqual(plan_jobs(jobs), ["root", "x", "y"])

    def test_does_not_mutate_inputs(self):
        jobs = [Job("b", priority=2), Job("a", priority=1, depends_on=("b",))]
        snapshot = [(j.id, j.priority, tuple(j.depends_on)) for j in jobs]
        plan_jobs(jobs)
        self.assertEqual([(j.id, j.priority, tuple(j.depends_on)) for j in jobs], snapshot)

    def test_does_not_mutate_list_depends_on(self):
        deps = ["y"]
        jobs = [Job("x", depends_on=deps), Job("y")]  # type: ignore[arg-type]
        self.assertEqual(plan_jobs(jobs), ["y", "x"])
        self.assertEqual(deps, ["y"])

    def test_accepts_generator_input(self):
        def gen():
            yield Job("b", priority=1)
            yield Job("a", priority=9, depends_on=("b",))

        self.assertEqual(plan_jobs(gen()), ["b", "a"])

    def test_returns_every_id_exactly_once(self):
        jobs = [
            Job("a", priority=2),
            Job("b", priority=3, depends_on=("a",)),
            Job("c", priority=3),
            Job("d", priority=1, depends_on=("b", "c")),
            Job("e", priority=9, depends_on=("d",)),
        ]
        result = plan_jobs(jobs)
        self.assertEqual(sorted(result), ["a", "b", "c", "d", "e"])
        pos = {jid: i for i, jid in enumerate(result)}
        for job in jobs:
            for dep in job.depends_on:
                self.assertLess(pos[dep], pos[job.id])


if __name__ == "__main__":
    unittest.main()
