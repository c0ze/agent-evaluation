import copy
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

    # --- basic shapes -----------------------------------------------------

    def test_empty_input_returns_empty_list(self):
        self.assertEqual(plan_jobs([]), [])

    def test_single_job_without_dependencies(self):
        self.assertEqual(plan_jobs([Job("only")]), ["only"])

    def test_chain_of_dependencies(self):
        jobs = [
            Job("c", priority=99, depends_on=("b",)),
            Job("b", priority=50, depends_on=("a",)),
            Job("a", priority=1),
        ]
        self.assertEqual(plan_jobs(jobs), ["a", "b", "c"])

    def test_diamond_graph(self):
        jobs = [
            Job("join", depends_on=("left", "right")),
            Job("left", depends_on=("root",)),
            Job("right", depends_on=("root",)),
            Job("root"),
        ]
        self.assertEqual(plan_jobs(jobs), ["root", "left", "right", "join"])

    def test_blocked_high_priority_job_does_not_stall_ready_ones(self):
        jobs = [
            Job("late", priority=10, depends_on=("slow",)),
            Job("ready_low", priority=1),
            Job("slow", priority=0),
            Job("ready_high", priority=2),
        ]
        self.assertEqual(
            plan_jobs(jobs), ["ready_high", "ready_low", "slow", "late"]
        )

    def test_negative_priorities_order_descending(self):
        jobs = [Job("a", -5), Job("b", -1), Job("c", -3)]
        self.assertEqual(plan_jobs(jobs), ["b", "c", "a"])

    def test_duplicate_dependencies_are_tolerated(self):
        jobs = [Job("a"), Job("b", depends_on=("a", "a"))]
        self.assertEqual(plan_jobs(jobs), ["a", "b"])

    def test_payload_is_ignored_for_ordering(self):
        jobs = [Job("a", payload={"x": 1}), Job("b", 1, payload=[1, 2])]
        self.assertEqual(plan_jobs(jobs), ["b", "a"])

    def test_accepts_any_iterable(self):
        jobs = iter([Job("a", 3), Job("b", 3)])
        self.assertEqual(plan_jobs(jobs), ["a", "b"])

    def test_result_is_deterministic_across_calls(self):
        jobs = [Job("a", 1), Job("b", 1), Job("c", 2, depends_on=("a",))]
        self.assertEqual(plan_jobs(jobs), plan_jobs(jobs))

    def test_complex_graph_yields_each_job_once_and_after_dependencies(self):
        jobs = [
            Job("lint", priority=7, depends_on=("parse",)),
            Job("parse", priority=1, depends_on=("fetch",)),
            Job("fetch", priority=3),
            Job("test", priority=9, depends_on=("lint", "parse")),
            Job("report", priority=0, depends_on=("test", "lint", "fetch")),
            Job("docs", priority=100),
        ]
        plan = plan_jobs(jobs)
        self.assertEqual(sorted(plan), sorted(j.id for j in jobs))
        self.assertEqual(len(plan), len(set(plan)))
        seen: set[str] = set()
        for job_id in plan:
            for job in jobs:
                if job.id == job_id:
                    self.assertTrue(seen.issuperset(job.depends_on))
            seen.add(job_id)
        self.assertEqual(plan[0], "docs")  # highest priority among ready jobs

    # --- validation errors ------------------------------------------------

    def test_self_dependency_is_rejected(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("loop", depends_on=("loop",))])
        self.assertIn("loop", str(ctx.exception))

    def test_duplicate_job_ids_are_rejected(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("dup"), Job("dup", priority=5)])
        self.assertIn("dup", str(ctx.exception))

    def test_empty_job_id_is_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("")])

    def test_non_string_job_id_is_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job(3)])  # type: ignore[arg-type]

    def test_empty_dependency_name_is_rejected(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("a"), Job("b", depends_on=("",))])
        self.assertIn("b", str(ctx.exception))

    def test_bare_string_dependency_is_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("a"), Job("b", depends_on="a")])  # type: ignore[arg-type]

    def test_unknown_dependency_message_names_both_jobs(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("build", depends_on=("ghost",))])
        message = str(ctx.exception)
        self.assertIn("build", message)
        self.assertIn("ghost", message)

    def test_non_job_entry_is_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("a"), "not-a-job"])  # type: ignore[list-item]

    # --- cycles -----------------------------------------------------------

    def test_two_job_cycle_is_rejected(self):
        jobs = [Job("a", depends_on=("b",)), Job("b", depends_on=("a",))]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        message = str(ctx.exception)
        self.assertIn("a", message)
        self.assertIn("b", message)

    def test_three_job_cycle_names_every_member(self):
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

    def test_cycle_reachable_only_through_acyclic_prefix(self):
        jobs = [
            Job("root"),
            Job("m", depends_on=("root", "n")),
            Job("n", depends_on=("m",)),
        ]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        message = str(ctx.exception)
        self.assertIn("m", message)
        self.assertIn("n", message)
        self.assertNotIn("root", message)

    def test_acyclic_graph_with_shared_edges_is_not_a_cycle(self):
        jobs = [
            Job("a"),
            Job("b", depends_on=("a",)),
            Job("c", depends_on=("a", "b")),
        ]
        self.assertEqual(plan_jobs(jobs), ["a", "b", "c"])

    # --- immutability -----------------------------------------------------

    def test_input_jobs_are_not_mutated(self):
        deps = ("fetch",)
        jobs = [Job("build", priority=2, depends_on=deps), Job("fetch")]
        snapshot = copy.deepcopy(jobs)
        plan_jobs(jobs)
        self.assertEqual(jobs, snapshot)
        self.assertEqual(jobs[0].depends_on, ("fetch",))

    def test_input_sequence_is_not_mutated(self):
        jobs = [Job("b", 5), Job("a", 5)]
        plan_jobs(jobs)
        self.assertEqual([j.id for j in jobs], ["b", "a"])

    def test_list_dependencies_are_accepted_and_not_mutated(self):
        deps = ["a"]
        jobs = [Job("a"), Job("b", depends_on=deps)]  # type: ignore[arg-type]
        self.assertEqual(plan_jobs(jobs), ["a", "b"])
        self.assertEqual(deps, ["a"])


if __name__ == "__main__":
    unittest.main()
