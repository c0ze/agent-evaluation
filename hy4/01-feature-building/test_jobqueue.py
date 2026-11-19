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

    # --- Empty / trivial inputs ---------------------------------------------
    def test_empty_list_returns_empty(self):
        self.assertEqual(plan_jobs([]), [])

    def test_empty_generator_returns_empty(self):
        self.assertEqual(plan_jobs(iter(())), [])

    def test_single_job(self):
        self.assertEqual(plan_jobs([Job("only", priority=-3)]), ["only"])

    def test_accepts_any_iterable_not_just_list(self):
        jobs = (Job("a"), Job("b"))
        self.assertEqual(plan_jobs(jobs), ["a", "b"])

    def test_consumes_generator_once(self):
        gen = (Job(i) for i in ("x", "y", "z"))
        self.assertEqual(plan_jobs(gen), ["x", "y", "z"])

    # --- Validation of ids ---------------------------------------------------
    def test_duplicate_id_rejected(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("dup"), Job("dup")])
        self.assertIn("dup", str(ctx.exception))

    def test_empty_string_id_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("")])

    def test_whitespace_only_id_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("   ")])

    def test_non_string_id_rejected(self):
        for bad in (None, 7, ("tuple",)):
            with self.subTest(bad=bad), self.assertRaises(ScheduleError):
                plan_jobs([Job(bad)])

    def test_non_job_item_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs(["not a job"])

    def test_non_string_dependency_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("a", depends_on=(42,))])

    def test_dependency_error_message_names_missing_id(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("build", depends_on=("ghost",))])
        self.assertIn("ghost", str(ctx.exception))

    def test_self_dependency_is_a_cycle(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("a", depends_on=("a",))])

    # --- Cycle detection -----------------------------------------------------
    def test_two_node_cycle(self):
        jobs = [Job("a", depends_on=("b",)), Job("b", depends_on=("a",))]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        msg = str(ctx.exception)
        self.assertIn("cycle", msg.lower())
        for jid in ("a", "b"):
            self.assertIn(jid, msg)

    def test_three_node_cycle_with_ids_in_diagnostic(self):
        jobs = [
            Job("a", depends_on=("c",)),
            Job("b", depends_on=("a",)),
            Job("c", depends_on=("b",)),
        ]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        self.assertIn("cycle", str(ctx.exception).lower())

    def test_cycle_plus_independent_jobs_still_raises(self):
        # A valid, independently-runnable job must not mask the cycle.
        jobs = [
            Job("free", priority=99),
            Job("a", depends_on=("b",)),
            Job("b", depends_on=("a",)),
        ]
        with self.assertRaises(ScheduleError):
            plan_jobs(jobs)

    def test_cycle_behind_a_dependency_chain(self):
        # 'entry' is blocked by a downstream cycle; nothing may be emitted.
        jobs = [
            Job("entry", depends_on=("x",)),
            Job("x", depends_on=("y",)),
            Job("y", depends_on=("x",)),
        ]
        with self.assertRaises(ScheduleError):
            plan_jobs(jobs)

    # --- Ordering / readiness semantics --------------------------------------
    def test_priority_recomputed_as_jobs_become_ready(self):
        # Initially 'gate'(5) and 'low'(1) are ready, so 'gate' runs first.
        # That unblocks 'z'(100), the new highest-priority ready job, which
        # must now beat the still-ready 'low'(1). A stale priority snapshot
        # taken only at startup would wrongly emit 'low' before 'z'.
        jobs = [
            Job("gate", priority=5),
            Job("low", priority=1),
            Job("z", priority=100, depends_on=("gate",)),
        ]
        result = plan_jobs(jobs)
        self.assertEqual(result, ["gate", "z", "low"])
        self.assertLess(result.index("gate"), result.index("z"))

    def test_negative_and_equal_priorities(self):
        jobs = [Job("a", -1), Job("b", 0), Job("c", -1), Job("d", 0)]
        self.assertEqual(plan_jobs(jobs), ["b", "d", "a", "c"])

    def test_long_chain(self):
        ids = [f"j{i}" for i in range(50)]
        jobs = [Job(ids[0])] + [
            Job(ids[i], depends_on=(ids[i - 1],)) for i in range(1, 50)
        ]
        self.assertEqual(plan_jobs(jobs), ids)

    def test_diamond_dependency(self):
        jobs = [
            Job("root"),
            Job("left", priority=1, depends_on=("root",)),
            Job("right", priority=2, depends_on=("root",)),
            Job("join", depends_on=("left", "right")),
        ]
        result = plan_jobs(jobs)
        self.assertEqual(result[0], "root")
        self.assertEqual(result[1], "right")   # higher priority first
        self.assertEqual(result[-1], "join")
        self.assertEqual(len(result), 4)
        self.assertEqual(len(set(result)), 4)

    def test_duplicate_dependency_entries_collapsed(self):
        jobs = [Job("base"), Job("top", depends_on=("base", "base", "base"))]
        self.assertEqual(plan_jobs(jobs), ["base", "top"])

    def test_every_job_returned_once_and_after_dependencies(self):
        jobs = [
            Job("deploy", priority=5, depends_on=("test", "build")),
            Job("test", priority=3, depends_on=("build",)),
            Job("build", priority=1, depends_on=("fetch",)),
            Job("fetch", priority=0),
        ]
        result = plan_jobs(jobs)
        self.assertEqual(len(result), 4)
        self.assertEqual(set(result), {"deploy", "test", "build", "fetch"})
        positions = {jid: i for i, jid in enumerate(result)}
        self.assertLess(positions["fetch"], positions["build"])
        self.assertLess(positions["build"], positions["test"])
        self.assertLess(positions["build"], positions["deploy"])
        self.assertLess(positions["test"], positions["deploy"])

    # --- Non-mutation guarantees ---------------------------------------------
    def test_does_not_mutate_jobs_or_dependency_lists(self):
        deps_top = ["base"]
        # Build a Job with a list dependency to prove we never mutate it.
        base = Job("base")
        top = Job("top", depends_on=tuple(deps_top))
        dep_snapshot = top.depends_on
        plan_jobs([top, base])
        self.assertEqual(top.depends_on, dep_snapshot)
        self.assertEqual(deps_top, ["base"])

    def test_input_order_not_reordered(self):
        jobs = [Job("first"), Job("second"), Job("third")]
        plan_jobs(jobs)
        self.assertEqual([j.id for j in jobs], ["first", "second", "third"])

    def test_job_payload_preserved(self):
        marker = object()
        job = Job("a", payload=marker)
        self.assertEqual(plan_jobs([job]), ["a"])
        self.assertIs(job.payload, marker)


if __name__ == "__main__":
    unittest.main()
