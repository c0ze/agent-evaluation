from copy import deepcopy
from itertools import combinations, permutations
import unittest

from jobqueue import Job, ScheduleError, plan_jobs


class PlanJobsTests(unittest.TestCase):
    def test_empty_input(self):
        self.assertEqual(plan_jobs([]), [])
        self.assertEqual(plan_jobs(iter(())), [])

    def test_single_job(self):
        self.assertEqual(plan_jobs([Job("only")]), ["only"])

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
        with self.assertRaisesRegex(ScheduleError, "build.*missing"):
            plan_jobs([Job("build", depends_on=("missing",))])

    def test_invalid_job_ids_are_rejected(self):
        for invalid_id in ("", None, 42, True, [], {}):
            with self.subTest(job_id=invalid_id):
                with self.assertRaisesRegex(ScheduleError, "non-empty string ID"):
                    plan_jobs([Job(invalid_id)])

    def test_duplicate_job_ids_are_rejected(self):
        with self.assertRaisesRegex(ScheduleError, "Duplicate.*same"):
            plan_jobs([Job("same", 1), Job("same", 100)])

    def test_invalid_dependencies_are_rejected(self):
        for dependency in ("", None, 42, True, [], {}):
            with self.subTest(dependency=dependency):
                with self.assertRaisesRegex(ScheduleError, "build.*invalid dependency"):
                    plan_jobs([Job("build", depends_on=(dependency,))])

    def test_all_components_are_validated(self):
        with self.assertRaisesRegex(ScheduleError, "broken.*missing"):
            plan_jobs([Job("ready", 100), Job("broken", depends_on=("missing",))])

    def test_nonempty_ids_are_not_normalized(self):
        jobs = [Job(" a "), Job("a"), Job(" "), Job("猫")]
        self.assertEqual(plan_jobs(jobs), [" a ", "a", " ", "猫"])

    def test_equal_priorities_use_input_order_not_id_order(self):
        jobs = [Job("z"), Job("m"), Job("a")]
        self.assertEqual(plan_jobs(jobs), ["z", "m", "a"])

    def test_negative_priorities(self):
        jobs = [Job("low", -10), Job("medium", -1), Job("high", 0)]
        self.assertEqual(plan_jobs(jobs), ["high", "medium", "low"])

    def test_newly_ready_job_preempts_lower_priority_job(self):
        jobs = [Job("waiting", 1), Job("root", 2), Job("child", 100, ("root",))]
        self.assertEqual(plan_jobs(jobs), ["root", "child", "waiting"])

    def test_newly_ready_tie_uses_original_order_not_ready_time(self):
        jobs = [Job("child", 1, ("root",)), Job("waiting", 1), Job("root", 2)]
        self.assertEqual(plan_jobs(jobs), ["root", "child", "waiting"])

    def test_simultaneously_ready_jobs_use_input_order(self):
        jobs = [Job("z", 1, ("root",)), Job("a", 1, ("root",)), Job("root")]
        self.assertEqual(plan_jobs(jobs), ["root", "z", "a"])

    def test_multiple_dependencies_and_shared_prerequisite(self):
        jobs = [
            Job("finish", 100, ("left", "right")),
            Job("left", 2, ("root",)),
            Job("right", 1, ("root",)),
            Job("root"),
        ]
        self.assertEqual(plan_jobs(jobs), ["root", "left", "right", "finish"])

    def test_repeated_dependencies_count_once(self):
        jobs = [Job("child", 100, ("root", "root", "other")), Job("root"), Job("other")]
        self.assertEqual(plan_jobs(jobs), ["root", "other", "child"])

    def test_generator_input(self):
        jobs = (job for job in [Job("child", 5, ("root",)), Job("root")])
        self.assertEqual(plan_jobs(jobs), ["root", "child"])

    def test_long_reverse_ordered_chain(self):
        jobs = [
            Job(str(index), depends_on=(str(index - 1),) if index else ())
            for index in reversed(range(1500))
        ]
        self.assertEqual(plan_jobs(jobs), [str(index) for index in range(1500)])

    def test_self_dependency_is_a_cycle(self):
        with self.assertRaisesRegex(ScheduleError, "cycle.*self"):
            plan_jobs([Job("self", depends_on=("self",))])

    def test_cycle_diagnostic_includes_involved_ids(self):
        jobs = [
            Job("alpha", depends_on=("gamma",)),
            Job("beta", depends_on=("alpha",)),
            Job("gamma", depends_on=("beta",)),
        ]
        with self.assertRaises(ScheduleError) as caught:
            plan_jobs(jobs)
        message = str(caught.exception)
        self.assertIn("cycle", message)
        for job in jobs:
            self.assertIn(job.id, message)

    def test_cycle_with_downstream_and_disconnected_jobs(self):
        jobs = [
            Job("ready", 100),
            Job("a", depends_on=("b",)),
            Job("b", depends_on=("a",)),
            Job("downstream", depends_on=("b",)),
        ]
        with self.assertRaises(ScheduleError) as caught:
            plan_jobs(jobs)
        message = str(caught.exception)
        self.assertIn("cycle", message)
        self.assertIn("'a'", message)
        self.assertIn("'b'", message)
        self.assertIn("blocked job IDs", message)
        self.assertNotIn("'ready'", message)

    def test_jobs_dependencies_and_payloads_are_not_mutated(self):
        dependencies = ["root", "root"]
        payload = {"items": [1, 2]}
        jobs = [Job("child", 10, dependencies, payload), Job("root")]
        snapshot = deepcopy(jobs)
        original_jobs = tuple(jobs)
        self.assertEqual(plan_jobs(jobs), ["root", "child"])
        self.assertEqual(plan_jobs(jobs), ["root", "child"])
        self.assertEqual(jobs, snapshot)
        for original, current in zip(original_jobs, jobs):
            self.assertIs(original, current)
        self.assertIs(jobs[0].depends_on, dependencies)
        self.assertIs(jobs[0].payload, payload)

    def test_invalid_input_is_not_mutated(self):
        cases = [
            [Job("a", depends_on=["b"]), Job("b", depends_on=["a"])],
            [Job("a", depends_on=["missing"])],
            [Job("a"), Job("a")],
        ]
        for jobs in cases:
            with self.subTest(jobs=jobs):
                snapshot = deepcopy(jobs)
                with self.assertRaises(ScheduleError):
                    plan_jobs(jobs)
                self.assertEqual(jobs, snapshot)

    def test_small_dags_match_best_valid_permutation(self):
        # An independent oracle: enumerate valid schedules and pick the best
        # lexicographic priority/input-order ranking, without simulating a queue.
        ids = ("a", "b", "c", "d")
        possible_edges = list(combinations(ids, 2))
        input_order = ("d", "b", "a", "c")
        priorities = {"a": 2, "b": -1, "c": 2, "d": 5}
        for mask in range(1 << len(possible_edges)):
            with self.subTest(edge_mask=mask):
                edges = [
                    edge for bit, edge in enumerate(possible_edges)
                    if mask & (1 << bit)
                ]
                jobs = [
                    Job(job_id, priorities[job_id], tuple(
                        source for source, target in edges if target == job_id
                    ))
                    for job_id in input_order
                ]
                valid_orders = [
                    order for order in permutations(ids)
                    if all(order.index(source) < order.index(target) for source, target in edges)
                ]
                expected = min(valid_orders, key=lambda order: [
                    (-priorities[job_id], input_order.index(job_id)) for job_id in order
                ])
                self.assertEqual(plan_jobs(jobs), list(expected))


if __name__ == "__main__":
    unittest.main()
