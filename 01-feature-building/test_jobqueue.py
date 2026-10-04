import copy
import unittest

from jobqueue import Job, ScheduleError, plan_jobs


def assert_valid_order(testcase, jobs, order):
    """Assert the contract properties hold for `order` over `jobs`."""
    expected = [job.id for job in jobs]
    testcase.assertEqual(sorted(order), sorted(expected), "every job id exactly once")
    testcase.assertEqual(len(order), len(set(order)), "no duplicates")

    seen = []
    for job_id in order:
        job = next(j for j in jobs if j.id == job_id)
        for dep in job.depends_on:
            testcase.assertIn(
                dep, seen, f"{job_id!r} emitted before its dependency {dep!r}"
            )
        seen.append(job_id)


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

    # --- baseline / trivial input ---------------------------------------

    def test_empty_input_returns_empty_list(self):
        self.assertEqual(plan_jobs([]), [])

    def test_single_job(self):
        self.assertEqual(plan_jobs([Job("only")]), ["only"])

    def test_no_dependencies_preserves_input_order(self):
        jobs = [Job("a"), Job("b"), Job("c")]
        self.assertEqual(plan_jobs(jobs), ["a", "b", "c"])

    def test_accepts_any_iterable_including_a_generator(self):
        jobs = (Job("a", 1, depends_on=("b",)), Job("b", 2))
        self.assertEqual(plan_jobs(iter(jobs)), ["b", "a"])

    def test_generator_is_consumed_only_once(self):
        gen = (job for job in [Job("a", 5), Job("b", 1)])
        self.assertEqual(plan_jobs(gen), ["a", "b"])
        self.assertEqual(list(gen), [], "the generator is not replayed")

    def test_schedule_error_is_a_value_error(self):
        self.assertTrue(issubclass(ScheduleError, ValueError))

    # --- id validation ---------------------------------------------------

    def test_duplicate_id_is_rejected(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("dup"), Job("other"), Job("dup")])
        self.assertIn("dup", str(ctx.exception))

    def test_empty_id_is_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job(""), Job("b")])

    def test_whitespace_only_id_is_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("   ")])

    def test_non_string_id_is_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job(7)])

    def test_non_string_dependency_is_rejected(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("a", depends_on=(3,))])
        self.assertIn("a", str(ctx.exception))

    def test_bare_string_depends_on_is_rejected(self):
        # A plain string is iterable but would silently split into characters.
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("a", depends_on="b"), Job("b")])  # type: ignore[arg-type]

    def test_none_depends_on_is_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("a", depends_on=None)])  # type: ignore[arg-type]

    def test_non_job_item_is_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs(["not-a-job"])  # type: ignore[list-item]

    def test_non_numeric_priority_is_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("a", priority="high")])  # type: ignore[arg-type]

    def test_non_iterable_input_is_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs(42)  # type: ignore[arg-type]

    # --- dependency resolution -------------------------------------------

    def test_unknown_dependency_message_names_the_missing_job(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("build", depends_on=("ghost",))])
        message = str(ctx.exception)
        self.assertIn("ghost", message)
        self.assertIn("build", message)

    def test_declaration_order_does_not_matter(self):
        jobs = [
            Job("last", depends_on=("middle",)),
            Job("middle", depends_on=("first",)),
            Job("first"),
        ]
        self.assertEqual(plan_jobs(jobs), ["first", "middle", "last"])

    def test_duplicate_dependency_entries_do_not_stall(self):
        jobs = [Job("a", depends_on=("b", "b", "b")), Job("b")]
        self.assertEqual(plan_jobs(jobs), ["b", "a"])

    def test_depends_on_may_be_a_list_and_is_not_mutated(self):
        deps = ["b", "c"]
        jobs = [Job("a", depends_on=deps), Job("b"), Job("c")]
        # 'a' is blocked; {b, c} are ready and tie on priority, so they keep
        # input order and 'a' comes last.
        self.assertEqual(plan_jobs(jobs), ["b", "c", "a"])
        self.assertEqual(deps, ["b", "c"], "the caller's list is untouched")

    def test_diamond_dependency(self):
        #   top -> left -> base, top -> right -> base
        jobs = [
            Job("top", 0, depends_on=("left", "right")),
            Job("left", 5, depends_on=("base",)),
            Job("right", 1, depends_on=("base",)),
            Job("base", 9),
        ]
        order = plan_jobs(jobs)
        # base(9) is the only ready job; it unblocks left(5) and right(1),
        # so left wins on priority; 'top' waits for both.
        self.assertEqual(order, ["base", "left", "right", "top"])
        # 'top' is not released until both 'left' and 'right' are done.
        self.assertLess(order.index("left"), order.index("top"))
        self.assertLess(order.index("right"), order.index("top"))
        assert_valid_order(self, jobs, order)

    def test_priority_only_applies_among_ready_jobs(self):
        jobs = [
            Job("low_prereq", 0),
            Job("high_blocked", 100, depends_on=("low_prereq",)),
            Job("mid_free", 50),
        ]
        # At t=0 the ready set is {low_prereq(0), mid_free(50)}; mid_free wins.
        # Only then does high_blocked(100) become runnable -- a blocked
        # high-priority job never preempts an already-ready one.
        self.assertEqual(plan_jobs(jobs), ["mid_free", "low_prereq", "high_blocked"])

    def test_equal_priorities_fall_back_to_input_order(self):
        jobs = [Job("j%d" % i, 1) for i in range(6)]
        self.assertEqual(plan_jobs(jobs), [job.id for job in jobs])

    def test_negative_and_zero_priorities(self):
        jobs = [Job("neg", -5), Job("zero", 0), Job("pos", 5)]
        self.assertEqual(plan_jobs(jobs), ["pos", "zero", "neg"])

    def test_is_deterministic_across_repeated_calls(self):
        jobs = [
            Job("a", 3, depends_on=("c",)),
            Job("b", 3, depends_on=("a",)),
            Job("c", 1),
            Job("d", 3),
        ]
        first = plan_jobs(jobs)
        for _ in range(5):
            self.assertEqual(plan_jobs(jobs), first)

    def test_wide_fan_in(self):
        jobs = [Job("leaf%d" % i) for i in range(50)]
        jobs.append(Job("fan", 1, depends_on=tuple("leaf%d" % i for i in range(50))))
        order = plan_jobs(jobs)
        self.assertEqual(order[-1], "fan")
        assert_valid_order(self, jobs, order)

    def test_deep_chain_does_not_exhaust_the_stack(self):
        depth = 2000
        jobs = [Job("step0")]
        jobs += [Job("step%d" % i, depends_on=("step%d" % (i - 1),)) for i in range(1, depth)]
        order = plan_jobs(jobs)
        self.assertEqual(len(order), depth)
        self.assertEqual(order[0], "step0")
        self.assertEqual(order[-1], "step%d" % (depth - 1))

    def test_every_id_returned_exactly_once(self):
        jobs = [
            Job("a", 1, depends_on=("b", "c")),
            Job("b", 2, depends_on=("d",)),
            Job("c", 3),
            Job("d", 0),
            Job("e", 4, depends_on=("a",)),
        ]
        order = plan_jobs(jobs)
        self.assertEqual(sorted(order), ["a", "b", "c", "d", "e"])
        assert_valid_order(self, jobs, order)

    # --- cycle detection -------------------------------------------------

    def test_self_dependency_is_a_cycle(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("loop", depends_on=("loop",))])
        self.assertIn("loop", str(ctx.exception))

    def test_two_node_cycle(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("a", depends_on=("b",)), Job("b", depends_on=("a",))])
        self.assertIn("a", str(ctx.exception))
        self.assertIn("b", str(ctx.exception))

    def test_three_node_cycle_names_every_member(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([
                Job("a", depends_on=("c",)),
                Job("b", depends_on=("a",)),
                Job("c", depends_on=("b",)),
            ])
        message = str(ctx.exception)
        for job_id in ("a", "b", "c"):
            self.assertIn(job_id, message)

    def test_cycle_message_identifies_the_cycle_not_unrelated_jobs(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([
                Job("loopy", depends_on=("other",)),
                Job("other", depends_on=("loopy",)),
                Job("innocent", 5),
            ])
        message = str(ctx.exception)
        self.assertIn("cycle", message)
        self.assertIn("loopy", message)
        self.assertIn("other", message)
        self.assertNotIn("innocent", message, "unrelated runnable job is not a casualty")

    def test_jobs_blocked_by_a_cycle_are_reported_separately(self):
        # 'downstream' is not itself in a cycle, but can never run either.
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([
                Job("a", depends_on=("b",)),
                Job("b", depends_on=("a",)),
                Job("downstream", depends_on=("a",)),
            ])
        message = str(ctx.exception)
        self.assertIn("cycle", message)
        self.assertIn("downstream", message)

    def test_long_cycle_is_reported(self):
        size = 60
        jobs = [
            Job("n%d" % i, depends_on=("n%d" % ((i + 1) % size),)) for i in range(size)
        ]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        self.assertIn("n0", str(ctx.exception))
        self.assertIn("n%d" % (size - 1), str(ctx.exception))

    def test_cycle_fails_the_whole_plan(self):
        # Even though most jobs are schedulable, a cycle aborts everything.
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("ok"), Job("a", depends_on=("b",)), Job("b", depends_on=("a",))])

    def test_deep_cycle_does_not_exhaust_the_stack(self):
        depth = 2000
        jobs = [Job("c0", depends_on=("c%d" % (depth - 1),))]
        jobs += [Job("c%d" % i, depends_on=("c%d" % (i - 1),)) for i in range(1, depth)]
        with self.assertRaises(ScheduleError):
            plan_jobs(jobs)

    # --- immutability ----------------------------------------------------

    def test_does_not_mutate_the_supplied_jobs(self):
        jobs = [
            Job("build", 2, depends_on=("fetch", "compile")),
            Job("fetch", 1),
            Job("compile", 3),
        ]
        before = copy.deepcopy(jobs)
        plan_jobs(jobs)
        self.assertEqual(jobs, before, "job objects are unchanged")

    def test_does_not_mutate_dependency_lists(self):
        deps = ["b"]
        jobs = [Job("a", 1, depends_on=deps), Job("b", 2)]
        plan_jobs(jobs)
        self.assertEqual(deps, ["b"])

    def test_does_not_mutate_on_failure_paths(self):
        jobs = [Job("a", depends_on=("b",)), Job("b", depends_on=("a",))]
        before = copy.deepcopy(jobs)
        with self.assertRaises(ScheduleError):
            plan_jobs(jobs)
        self.assertEqual(jobs, before)

    def test_result_is_a_fresh_list_each_call(self):
        jobs = [Job("a"), Job("b")]
        first = plan_jobs(jobs)
        first.append("tampered")
        self.assertEqual(plan_jobs(jobs), ["a", "b"])

    def test_does_not_mutate_payloads(self):
        payload = {"touches": [1, 2, 3]}
        jobs = [Job("a", 1, payload=payload), Job("b", 2)]
        plan_jobs(jobs)
        self.assertEqual(payload, {"touches": [1, 2, 3]})


if __name__ == "__main__":
    unittest.main()
