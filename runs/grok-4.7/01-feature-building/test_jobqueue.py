import random
import unittest

from jobqueue import Job, ScheduleError, plan_jobs


def _ready_set_order(jobs):
    """Independent reading of the scheduling rule for comparison tests.

    Repeatedly select the ready job with the highest priority, breaking ties
    by original input index. Duplicate dependency names count once.
    """
    job_list = list(jobs)
    original_index = {job.id: index for index, job in enumerate(job_list)}
    pending = set(original_index)
    order = []
    satisfied = set()
    while pending:
        ready = []
        for job_id in pending:
            job = job_list[original_index[job_id]]
            seen = set()
            unmet = False
            for dep in job.depends_on:
                if dep in seen:
                    continue
                seen.add(dep)
                if dep not in satisfied:
                    unmet = True
                    break
            if not unmet:
                ready.append(job)
        if not ready:
            raise AssertionError("reference found a cycle in a DAG fixture")
        chosen = min(
            ready,
            key=lambda job: (-job.priority, original_index[job.id]),
        )
        order.append(chosen.id)
        pending.remove(chosen.id)
        satisfied.add(chosen.id)
    return order


class PlanJobsTests(unittest.TestCase):
    maxDiff = None

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

        def generate():
            if False:
                yield Job("unused")

        self.assertEqual(plan_jobs(generate()), [])

    def test_single_job(self):
        payload = {"path": "src"}
        job = Job("only", payload=payload)
        self.assertEqual(plan_jobs([job]), ["only"])
        self.assertIs(job.payload, payload)

    def test_blank_but_non_empty_id_is_allowed(self):
        self.assertEqual(plan_jobs([Job(" ")]), [" "])

    def test_empty_id_is_rejected(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("")])
        self.assertIn("non-empty", str(ctx.exception))

    def test_non_string_ids_are_rejected(self):
        for bad_id in (None, 0, b"a", ("a",)):
            with self.subTest(bad_id=bad_id):
                with self.assertRaises(ScheduleError) as ctx:
                    plan_jobs([Job(bad_id)])
                message = str(ctx.exception)
                self.assertIn("non-empty", message)
                self.assertIn(repr(bad_id), message)

    def test_duplicate_id_is_rejected_before_scheduling(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(
                [
                    Job("a", depends_on=("a",)),
                    Job("b"),
                    Job("a", priority=9),
                ]
            )
        message = str(ctx.exception)
        self.assertIn("duplicate", message)
        self.assertIn("'a'", message)
        self.assertNotIn("cycle", message)

    def test_unknown_dependency_names_both_jobs(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(
                [
                    Job("build", depends_on=("fetch", "missing")),
                    Job("fetch"),
                    Job("later", depends_on=("also-missing",)),
                ]
            )
        message = str(ctx.exception)
        self.assertIn("unknown", message)
        self.assertIn("'build'", message)
        self.assertIn("'missing'", message)
        self.assertNotIn("also-missing", message)

    def test_dependency_match_is_exact_not_stringified(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("1"), Job("next", depends_on=(1,))])
        message = str(ctx.exception)
        self.assertIn("unknown", message)
        self.assertIn("'next'", message)
        self.assertIn("1", message)

    def test_string_depends_on_is_rejected(self):
        # Iterating the string "ab" would look like dependencies "a" and "b".
        for value in ("ab", "a", b"ab"):
            with self.subTest(value=value):
                with self.assertRaises(ScheduleError) as ctx:
                    plan_jobs([Job("ab", depends_on=value), Job("a"), Job("b")])
                message = str(ctx.exception)
                self.assertIn("depends_on", message)
                self.assertNotIn("cycle", message)

    def test_non_iterable_jobs_are_rejected(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(None)
        self.assertIn("iterable", str(ctx.exception))
        with self.assertRaises(ScheduleError):
            plan_jobs(Job("a"))

    def test_non_iterable_depends_on_is_rejected(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("a", depends_on=123)])
        self.assertIn("depends_on", str(ctx.exception))

    def test_incomparable_priorities_are_rejected(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("a", priority=1), Job("b", priority="high")])
        message = str(ctx.exception)
        self.assertIn("priority", message)
        self.assertIn("'b'", message)

    def test_forward_dependency_is_honored(self):
        jobs = [
            Job("child", priority=50, depends_on=("parent",)),
            Job("parent", priority=0),
        ]
        self.assertEqual(plan_jobs(jobs), ["parent", "child"])

    def test_chain_keeps_high_priority_job_behind_its_dependencies(self):
        jobs = [
            Job("a", priority=1, depends_on=("b",)),
            Job("b", priority=10, depends_on=("c",)),
            Job("c", priority=100),
        ]
        self.assertEqual(plan_jobs(jobs), ["c", "b", "a"])

    def test_negative_priorities_rank_below_zero(self):
        jobs = [Job("a", priority=-5), Job("b", priority=-1), Job("c", priority=0)]
        self.assertEqual(plan_jobs(jobs), ["c", "b", "a"])

    def test_equal_priorities_keep_input_order(self):
        jobs = [Job("a", priority=5), Job("b", priority=5), Job("c", priority=5)]
        self.assertEqual(plan_jobs(jobs), ["a", "b", "c"])

    def test_equal_priority_uses_input_order_not_ready_time(self):
        # b is ready immediately. a becomes ready only after c, but a appears
        # earlier in the input and has the same priority, so a goes before b.
        jobs = [
            Job("a", priority=1, depends_on=("c",)),
            Job("b", priority=1),
            Job("c", priority=5),
        ]
        self.assertEqual(plan_jobs(jobs), ["c", "a", "b"])

    def test_newly_ready_higher_priority_jumps_ahead(self):
        jobs = [
            Job("slow", priority=1),
            Job("gate", priority=2),
            Job("fast", priority=50, depends_on=("gate",)),
        ]
        self.assertEqual(plan_jobs(jobs), ["gate", "fast", "slow"])

    def test_lower_priority_dependency_runs_before_a_waiting_high_priority_job(self):
        jobs = [
            Job("low", priority=1),
            Job("blocker", priority=0),
            Job("high", priority=100, depends_on=("blocker",)),
        ]
        self.assertEqual(plan_jobs(jobs), ["low", "blocker", "high"])

    def test_same_moment_ready_jobs_follow_input_order_not_dependency_list_order(self):
        deps = ["left", "right"]
        jobs = [
            Job("top", priority=1, depends_on=deps),
            Job("right", priority=5),
            Job("left", priority=5),
        ]
        self.assertEqual(plan_jobs(jobs), ["right", "left", "top"])
        self.assertEqual(deps, ["left", "right"])

    def test_fan_in_waits_for_every_dependency(self):
        jobs = [
            Job("final", priority=100, depends_on=("a", "b", "c")),
            Job("b", priority=2),
            Job("c", priority=3),
            Job("a", priority=1),
        ]
        self.assertEqual(plan_jobs(jobs), ["c", "b", "a", "final"])

    def test_fan_out_orders_siblings_by_priority_then_input(self):
        jobs = [
            Job("a", depends_on=("root",)),
            Job("b", priority=10, depends_on=("root",)),
            Job("c", priority=10, depends_on=("root",)),
            Job("root"),
        ]
        self.assertEqual(plan_jobs(jobs), ["root", "b", "c", "a"])

    def test_diamond_dependency(self):
        jobs = [
            Job("d", priority=1, depends_on=("b", "a")),
            Job("a", priority=3, depends_on=("c",)),
            Job("b", priority=3, depends_on=("c",)),
            Job("c", priority=0),
        ]
        self.assertEqual(plan_jobs(jobs), ["c", "a", "b", "d"])

    def test_unlocked_jobs_do_not_pass_an_earlier_equal_priority_job(self):
        jobs = [
            Job("a"),
            Job("b", priority=-1),
            Job("c", depends_on=("a",)),
            Job("d", depends_on=("a",)),
        ]
        self.assertEqual(plan_jobs(jobs), ["a", "c", "d", "b"])

    def test_duplicate_dependency_edges_are_not_a_cycle(self):
        jobs = [
            Job("a", priority=100, depends_on=("b", "b")),
            Job("b", priority=0),
        ]
        self.assertEqual(plan_jobs(jobs), ["b", "a"])

    def test_payload_does_not_affect_order(self):
        jobs = [
            Job("a", priority=1, payload={"heavy": True}),
            Job("b", priority=2, payload=["x"]),
        ]
        self.assertEqual(plan_jobs(jobs), ["b", "a"])

    def test_accepts_one_shot_iterable(self):
        def generate():
            yield Job("b", priority=1, depends_on=("a",))
            yield Job("a", priority=0)

        self.assertEqual(plan_jobs(generate()), ["a", "b"])

    def test_repeated_calls_are_deterministic(self):
        jobs = [
            Job("a", priority=1, depends_on=("c",)),
            Job("b", priority=1),
            Job("c", priority=4),
            Job("d", priority=4, depends_on=("b",)),
        ]
        first = plan_jobs(jobs)
        self.assertEqual(first, ["c", "a", "b", "d"])
        self.assertEqual(plan_jobs(tuple(jobs)), first)
        self.assertEqual(plan_jobs(iter(jobs)), first)
        first.append("extra")
        self.assertEqual(plan_jobs(jobs), ["c", "a", "b", "d"])

    def test_self_cycle_names_the_job(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("solo", depends_on=("solo",))])
        self.assertEqual(
            str(ctx.exception),
            "dependency cycle detected involving 'solo'",
        )

    def test_self_cycle_with_an_outside_dependency(self):
        jobs = [
            Job("a", depends_on=("a", "c")),
            Job("c", priority=2),
            Job("b", priority=1),
        ]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        self.assertEqual(
            str(ctx.exception),
            "dependency cycle detected involving 'a'",
        )

    def test_two_node_cycle_names_both_jobs(self):
        jobs = [
            Job("a", depends_on=("b",)),
            Job("b", depends_on=("a",)),
        ]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        self.assertEqual(
            str(ctx.exception),
            "dependency cycle detected involving 'a', 'b'",
        )

    def test_three_node_cycle_names_every_participant(self):
        jobs = [
            Job("a", depends_on=("b",)),
            Job("b", depends_on=("c",)),
            Job("c", depends_on=("a",)),
        ]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        self.assertEqual(
            str(ctx.exception),
            "dependency cycle detected involving 'a', 'b', 'c'",
        )

    def test_disjoint_cycles_name_every_participant(self):
        jobs = [
            Job("a", depends_on=("b",)),
            Job("b", depends_on=("a",)),
            Job("c", depends_on=("d",)),
            Job("d", depends_on=("c",)),
        ]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        self.assertEqual(
            str(ctx.exception),
            "dependency cycle detected involving 'a', 'b', 'c', 'd'",
        )

    def test_cycle_diagnostic_omits_runnable_and_merely_blocked_jobs(self):
        jobs = [
            Job("outside", priority=100),
            Job("a", depends_on=("b", "base")),
            Job("b", depends_on=("a",)),
            Job("blocked", depends_on=("a",)),
            Job("base", priority=1),
        ]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        self.assertEqual(
            str(ctx.exception),
            "dependency cycle detected involving 'a', 'b'",
        )

    def test_self_loop_plus_mutual_dependency(self):
        jobs = [
            Job("a", depends_on=("a", "b")),
            Job("b", depends_on=("a",)),
        ]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        self.assertEqual(
            str(ctx.exception),
            "dependency cycle detected involving 'a', 'b'",
        )

    def test_unknown_dependency_is_reported_before_cycle_check(self):
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs([Job("a", depends_on=("a", "missing"))])
        message = str(ctx.exception)
        self.assertIn("unknown", message)
        self.assertIn("'missing'", message)
        self.assertNotIn("cycle", message)

    def test_schedule_error_is_a_value_error(self):
        with self.assertRaises(ValueError):
            plan_jobs([Job("a", depends_on=("missing",))])

    def test_does_not_mutate_inputs_on_success_or_failure(self):
        success_deps = ["b", "b"]
        success_payload = {"n": 1}
        success_jobs = [
            Job("a", priority=1, depends_on=success_deps, payload=success_payload),
            Job("b", priority=2, payload=["keep"]),
        ]
        failure_deps = ["a"]
        failure_jobs = [
            Job("a", depends_on=failure_deps),
            Job("free", priority=3),
        ]
        success_before = _snapshot(success_jobs)
        failure_before = _snapshot(failure_jobs)
        success_order_before = [job.id for job in success_jobs]
        failure_order_before = [job.id for job in failure_jobs]

        self.assertEqual(plan_jobs(success_jobs), ["b", "a"])
        with self.assertRaises(ScheduleError):
            plan_jobs(failure_jobs)

        self.assertEqual(_snapshot(success_jobs), success_before)
        self.assertEqual(_snapshot(failure_jobs), failure_before)
        self.assertEqual([job.id for job in success_jobs], success_order_before)
        self.assertEqual([job.id for job in failure_jobs], failure_order_before)
        self.assertIs(success_jobs[0].depends_on, success_deps)
        self.assertIs(failure_jobs[0].depends_on, failure_deps)
        self.assertIs(success_jobs[0].payload, success_payload)
        self.assertEqual(success_deps, ["b", "b"])
        self.assertEqual(failure_deps, ["a"])
        self.assertEqual(success_payload, {"n": 1})

    def test_long_chain_respects_dependencies_over_priority(self):
        count = 1200
        jobs = [
            Job(str(i), priority=i, depends_on=((str(i - 1),) if i else ()))
            for i in range(count)
        ]
        self.assertEqual(plan_jobs(jobs), [str(i) for i in range(count)])

    def test_long_cycle_reports_members_without_recursion_limit(self):
        count = 1200
        jobs = [
            Job(str(i), depends_on=(str((i + 1) % count),))
            for i in range(count)
        ]
        with self.assertRaises(ScheduleError) as ctx:
            plan_jobs(jobs)
        message = str(ctx.exception)
        self.assertIn("'0'", message)
        self.assertIn(f"'{count - 1}'", message)
        self.assertIn("cycle", message)

    def test_random_dags_match_ready_set_rule(self):
        rng = random.Random(0)
        for trial in range(40):
            count = rng.randint(1, 30)
            ranked_ids = [f"j{index:02d}" for index in range(count)]
            input_ids = ranked_ids[:]
            rng.shuffle(input_ids)
            rank = {job_id: index for index, job_id in enumerate(ranked_ids)}
            jobs = []
            for job_id in input_ids:
                candidates = [
                    other for other in ranked_ids if rank[other] < rank[job_id]
                ]
                dep_count = rng.randint(0, min(3, len(candidates)))
                deps = tuple(rng.sample(candidates, dep_count)) if dep_count else ()
                if deps and rng.random() < 0.4:
                    deps = deps + (deps[0],)
                jobs.append(
                    Job(job_id, priority=rng.randint(-3, 6), depends_on=deps)
                )
            with self.subTest(trial=trial, count=count):
                order = plan_jobs(jobs)
                self.assertEqual(order, _ready_set_order(jobs))
                self._assert_respects_dependencies(jobs, order)

    def test_random_cycles_name_every_participant(self):
        rng = random.Random(1)
        for trial in range(15):
            cycle_len = rng.randint(1, 8)
            other_count = rng.randint(0, 5)
            cycle_ids = [f"cycle{index:02d}" for index in range(cycle_len)]
            other_ids = [f"other{index:02d}" for index in range(other_count)]
            cycled = [
                Job(
                    cycle_ids[index],
                    priority=rng.randint(0, 5),
                    depends_on=(cycle_ids[(index + 1) % cycle_len],),
                )
                for index in range(cycle_len)
            ]
            others = [
                Job(other_id, priority=rng.randint(0, 5)) for other_id in other_ids
            ]
            blocked = Job("blocked", priority=9, depends_on=(cycle_ids[0],))
            jobs = [*others, blocked, *cycled]
            rng.shuffle(jobs)
            with self.subTest(trial=trial, cycle_len=cycle_len):
                with self.assertRaises(ScheduleError) as ctx:
                    plan_jobs(jobs)
                message = str(ctx.exception)
                for job_id in cycle_ids:
                    self.assertIn(repr(job_id), message)
                for job_id in other_ids:
                    self.assertNotIn(repr(job_id), message)
                self.assertNotIn(repr("blocked"), message)

    def _assert_respects_dependencies(self, jobs, order):
        self.assertEqual(len(order), len({job.id for job in jobs}))
        self.assertEqual(set(order), {job.id for job in jobs})
        position = {job_id: index for index, job_id in enumerate(order)}
        for job in jobs:
            seen = set()
            for dep in job.depends_on:
                if dep in seen:
                    continue
                seen.add(dep)
                self.assertLess(position[dep], position[job.id])


def _snapshot(jobs):
    return [
        (job.id, job.priority, tuple(job.depends_on), job.payload) for job in jobs
    ]


if __name__ == "__main__":
    unittest.main()
