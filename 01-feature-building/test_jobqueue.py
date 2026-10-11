import random
import unittest

from jobqueue import Job, ScheduleError, plan_jobs


def _reference_order(jobs):
    """Brute-force oracle: at each step pick the best ready job by (-priority, input index)."""
    index = {job.id: i for i, job in enumerate(jobs)}
    done = []
    while len(done) < len(jobs):
        ready = [
            job for job in jobs
            if job.id not in done and all(dep in done for dep in job.depends_on)
        ]
        best = min(ready, key=lambda job: (-job.priority, index[job.id]))
        done.append(best.id)
    return done


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

    # Ordering

    def test_empty_input_returns_empty_list(self):
        self.assertEqual(plan_jobs([]), [])

    def test_accepts_generator_input(self):
        jobs = (job for job in [Job("b", depends_on=("a",)), Job("a")])
        self.assertEqual(plan_jobs(jobs), ["a", "b"])

    def test_newly_ready_high_priority_job_beats_waiting_low_priority_job(self):
        jobs = [Job("gate", 5), Job("low", 1), Job("high", 9, depends_on=("gate",))]
        self.assertEqual(plan_jobs(jobs), ["gate", "high", "low"])

    def test_equal_priority_released_jobs_keep_input_order_not_alphabetical(self):
        jobs = [Job("root"), Job("z", depends_on=("root",)), Job("a", depends_on=("root",))]
        self.assertEqual(plan_jobs(jobs), ["root", "z", "a"])

    def test_diamond_runs_shared_parent_first_and_join_last(self):
        jobs = [
            Job("join", 0, ("left", "right")),
            Job("right", 1, ("top",)),
            Job("left", 2, ("top",)),
            Job("top", 0),
        ]
        self.assertEqual(plan_jobs(jobs), ["top", "left", "right", "join"])

    def test_duplicate_dependency_names_are_harmless(self):
        jobs = [Job("a"), Job("b", depends_on=("a", "a"))]
        self.assertEqual(plan_jobs(jobs), ["a", "b"])

    def test_list_valued_depends_on_is_accepted(self):
        jobs = [Job("b", depends_on=["a"]), Job("a")]
        self.assertEqual(plan_jobs(jobs), ["a", "b"])

    def test_random_dags_match_reference_and_respect_dependencies(self):
        rng = random.Random(1234)
        for trial in range(25):
            with self.subTest(trial=trial):
                count = rng.randint(1, 60)
                ids = [f"job{i}" for i in range(count)]
                rng.shuffle(ids)
                jobs = []
                for i, job_id in enumerate(ids):
                    # Depend only on earlier entries in the shuffled list, so the graph is acyclic.
                    candidates = ids[:i]
                    deps = tuple(rng.sample(candidates, rng.randint(0, min(3, len(candidates)))))
                    jobs.append(Job(job_id, rng.randint(-3, 3), deps))

                plan = plan_jobs(jobs)

                self.assertEqual(sorted(plan), sorted(ids))
                self.assertEqual(len(plan), len(set(plan)))
                position = {job_id: n for n, job_id in enumerate(plan)}
                for job in jobs:
                    for dep in job.depends_on:
                        self.assertLess(position[dep], position[job.id])
                self.assertEqual(plan, _reference_order(jobs))

    # Input validation

    def test_duplicate_ids_are_rejected(self):
        with self.assertRaisesRegex(ScheduleError, "duplicate job id 'a'"):
            plan_jobs([Job("a"), Job("a", priority=1)])

    def test_empty_or_blank_ids_are_rejected(self):
        for bad_id in ("", "   "):
            with self.subTest(bad_id=bad_id):
                with self.assertRaisesRegex(ScheduleError, "non-empty string id"):
                    plan_jobs([Job(bad_id)])

    def test_non_string_ids_are_rejected(self):
        for bad_id in (None, 3, ["a"]):
            with self.subTest(bad_id=bad_id):
                with self.assertRaisesRegex(ScheduleError, "non-empty string id"):
                    plan_jobs([Job(bad_id)])

    def test_unknown_dependency_message_names_the_missing_job(self):
        with self.assertRaisesRegex(ScheduleError, "'build' depends on unknown job 'missing'"):
            plan_jobs([Job("build", depends_on=("missing",))])

    def test_non_string_dependency_is_rejected(self):
        for bad_dep in (None, 0, ["a"]):
            with self.subTest(bad_dep=bad_dep):
                with self.assertRaisesRegex(ScheduleError, "non-string dependency"):
                    plan_jobs([Job("a"), Job("b", depends_on=(bad_dep,))])

    def test_bare_string_depends_on_is_rejected(self):
        # Without this check "fetch" would be read as the characters "f", "e", ...
        with self.assertRaisesRegex(ScheduleError, "not a string"):
            plan_jobs([Job("fetch"), Job("build", depends_on="fetch")])

    def test_non_iterable_depends_on_is_rejected(self):
        with self.assertRaisesRegex(ScheduleError, "must be iterable"):
            plan_jobs([Job("a", depends_on=None)])

    def test_non_job_items_are_rejected(self):
        with self.assertRaisesRegex(ScheduleError, "expected Job"):
            plan_jobs(["a"])

    def test_priority_must_be_a_plain_int(self):
        # bool is a subclass of int, but True as a priority is almost always a mistake.
        for bad_priority in (1.5, "high", True):
            with self.subTest(priority=bad_priority):
                with self.assertRaisesRegex(ScheduleError, "priority must be an int"):
                    plan_jobs([Job("a", priority=bad_priority)])

    # Cycles

    def test_self_dependency_is_a_cycle(self):
        with self.assertRaisesRegex(ScheduleError, "dependency cycle: a -> a"):
            plan_jobs([Job("a", depends_on=("a",))])

    def test_two_job_cycle_reports_its_ids(self):
        jobs = [Job("a", depends_on=("b",)), Job("b", depends_on=("a",))]
        with self.assertRaisesRegex(ScheduleError, "dependency cycle: a -> b -> a"):
            plan_jobs(jobs)

    def test_cycle_is_detected_alongside_acyclic_jobs(self):
        jobs = [
            Job("setup"),
            Job("x", depends_on=("y",)),
            Job("y", depends_on=("z",)),
            Job("z", depends_on=("x",)),
            Job("after", depends_on=("setup",)),
        ]
        with self.assertRaisesRegex(ScheduleError, "dependency cycle: x -> y -> z -> x"):
            plan_jobs(jobs)

    def test_cycle_message_names_the_loop_even_when_it_starts_downstream(self):
        jobs = [Job("c", depends_on=("a",)), Job("a", depends_on=("b",)), Job("b", depends_on=("a",))]
        with self.assertRaisesRegex(ScheduleError, "dependency cycle: a -> b -> a"):
            plan_jobs(jobs)

    def test_jobs_blocked_by_a_cycle_are_listed_as_unschedulable(self):
        jobs = [Job("a", depends_on=("b",)), Job("b", depends_on=("a",)), Job("c", depends_on=("a",))]
        with self.assertRaisesRegex(ScheduleError, "unschedulable jobs: a, b, c"):
            plan_jobs(jobs)

    # Immutability

    def test_does_not_mutate_inputs(self):
        needs_a = ["a"]
        jobs = [Job("c", 1, ("b",)), Job("b", 0, needs_a), Job("a", 2)]
        before = list(jobs)
        self.assertEqual(plan_jobs(jobs), ["a", "b", "c"])
        self.assertEqual(jobs, before)
        self.assertEqual(needs_a, ["a"])


if __name__ == "__main__":
    unittest.main()
