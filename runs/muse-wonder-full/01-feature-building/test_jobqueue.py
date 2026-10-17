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

    # --- Basic shapes -------------------------------------------------

    def test_empty_input_returns_empty_list(self):
        self.assertEqual(plan_jobs([]), [])
        self.assertEqual(plan_jobs(()), [])
        self.assertEqual(plan_jobs(iter([])), [])

    def test_single_job(self):
        self.assertEqual(plan_jobs([Job("only")]), ["only"])

    def test_accepts_any_iterable(self):
        jobs = (Job(name) for name in ("x", "y"))
        self.assertEqual(plan_jobs(jobs), ["x", "y"])
        self.assertEqual(plan_jobs((Job("x"), Job("y"))), ["x", "y"])

    def test_transitive_chain_in_reverse_input_order(self):
        jobs = [
            Job("c", depends_on=("b",)),
            Job("b", depends_on=("a",)),
            Job("a"),
        ]
        self.assertEqual(plan_jobs(jobs), ["a", "b", "c"])

    def test_diamond_dependency(self):
        jobs = [
            Job("d", depends_on=("b", "c")),
            Job("c", depends_on=("a",)),
            Job("b", depends_on=("a",)),
            Job("a"),
        ]
        result = plan_jobs(jobs)
        # b and c tie on priority, so input order (c before b) decides.
        self.assertEqual(result, ["a", "c", "b", "d"])
        self.assertEqual(sorted(result), ["a", "b", "c", "d"])

    def test_long_chain(self):
        n = 200
        jobs = [
            Job(f"j{i}", depends_on=(f"j{i - 1}",) if i else ())
            for i in reversed(range(n))
        ]
        self.assertEqual(plan_jobs(jobs), [f"j{i}" for i in range(n)])

    def test_payload_is_ignored(self):
        jobs = [Job("a", payload={"k": [1, 2]}), Job("b", payload=object())]
        self.assertEqual(plan_jobs(jobs), ["a", "b"])

    # --- Ready-set ordering -------------------------------------------

    def test_newly_ready_high_priority_job_jumps_ahead(self):
        # "urgent" only becomes ready after "prep"; it must then beat the
        # already-ready low-priority "background".
        jobs = [
            Job("background", priority=-10),
            Job("urgent", priority=100, depends_on=("prep",)),
            Job("prep", priority=0),
        ]
        self.assertEqual(
            plan_jobs(jobs), ["prep", "urgent", "background"]
        )

    def test_equal_priorities_keep_input_order(self):
        jobs = [Job(name, priority=3) for name in ("m", "a", "z", "b")]
        self.assertEqual(plan_jobs(jobs), ["m", "a", "z", "b"])

    def test_negative_and_zero_priorities(self):
        jobs = [Job("neg", -5), Job("zero", 0), Job("more-neg", -100)]
        self.assertEqual(plan_jobs(jobs), ["zero", "neg", "more-neg"])

    def test_every_job_returned_exactly_once_after_its_dependencies(self):
        jobs = [
            Job("deploy", 9, ("test", "package")),
            Job("package", 1, ("build",)),
            Job("lint", 5),
            Job("test", 3, ("build",)),
            Job("build", 0, ("fetch",)),
            Job("fetch", 0),
        ]
        result = plan_jobs(jobs)
        self.assertEqual(sorted(result), sorted(j.id for j in jobs))
        self.assertEqual(len(result), len(set(result)))
        position = {name: i for i, name in enumerate(result)}
        for job in jobs:
            for dep in job.depends_on:
                self.assertLess(position[dep], position[job.id])

    def test_duplicate_dependency_entries_count_once(self):
        jobs = [
            Job("b", depends_on=("a", "a", "a")),
            Job("a"),
        ]
        self.assertEqual(plan_jobs(jobs), ["a", "b"])

    # --- Validation ----------------------------------------------------

    def test_duplicate_id_is_rejected(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("same"), Job("other"), Job("same")])
        self.assertIn("same", str(ctx.exception))

    def test_empty_id_is_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("")])

    def test_non_string_id_is_rejected(self):
        for bad_id in (None, 42, 3.5, b"bytes"):
            with self.subTest(bad_id=bad_id):
                with self.assertRaises(ScheduleError):
                    plan_jobs([Job(bad_id)])  # type: ignore[arg-type]

    def test_unknown_dependency_message_names_both_jobs(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("build", depends_on=("missing",))])
        self.assertIn("missing", str(ctx.exception))
        self.assertIn("build", str(ctx.exception))

    def test_non_string_dependency_is_rejected(self):
        with self.assertRaises(ScheduleError):
            plan_jobs([Job("a", depends_on=(1,))])  # type: ignore[arg-type]

    def test_string_depends_on_is_rejected_not_split_into_characters(self):
        # "ab" as a bare string must not be read as deps ("a", "b").
        with self.assertRaises(ScheduleError):
            plan_jobs(
                [Job("a"), Job("b"), Job("c", depends_on="ab")]  # type: ignore[arg-type]
            )

    def test_schedule_error_is_a_value_error(self):
        with self.assertRaises(ValueError):
            plan_jobs([Job("")])

    # --- Cycles ---------------------------------------------------------

    def test_self_dependency_is_a_cycle(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("loop", depends_on=("loop",))])
        self.assertIn("loop", str(ctx.exception))

    def test_two_job_cycle_is_rejected_and_named(self):
        jobs = [
            Job("a", depends_on=("b",)),
            Job("b", depends_on=("a",)),
        ]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        message = str(ctx.exception)
        self.assertIn("a", message)
        self.assertIn("b", message)

    def test_longer_cycle_is_rejected_and_named(self):
        jobs = [
            Job("a", depends_on=("c",)),
            Job("b", depends_on=("a",)),
            Job("c", depends_on=("b",)),
            Job("independent"),
        ]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        message = str(ctx.exception)
        for name in ("a", "b", "c"):
            self.assertIn(name, message)

    def test_cycle_with_downstream_job_is_rejected(self):
        jobs = [
            Job("downstream", depends_on=("a",)),
            Job("a", depends_on=("b",)),
            Job("b", depends_on=("a",)),
        ]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        message = str(ctx.exception)
        self.assertIn("a", message)
        self.assertIn("b", message)
        self.assertIn("downstream", message)

    # --- Non-mutation ----------------------------------------------------

    def test_inputs_are_not_mutated(self):
        deps = ["a"]
        jobs = [Job("b", depends_on=deps), Job("a")]  # type: ignore[arg-type]
        snapshot = copy.deepcopy([(j.id, j.priority) for j in jobs])
        original_list = list(jobs)

        self.assertEqual(plan_jobs(jobs), ["a", "b"])

        self.assertEqual(deps, ["a"])
        self.assertEqual(jobs, original_list)
        self.assertEqual([(j.id, j.priority) for j in jobs], snapshot)

    def test_result_is_a_new_list(self):
        jobs = [Job("a")]
        result = plan_jobs(jobs)
        result.append("tampered")
        self.assertEqual(plan_jobs(jobs), ["a"])


if __name__ == "__main__":
    unittest.main()
