import importlib.util
import sys
import unittest
from pathlib import Path


if len(sys.argv) < 2:
    raise SystemExit("usage: test_code_tasks.py AGENT")

AGENT = sys.argv.pop(1)
ROOT = Path(__file__).resolve().parents[1] / AGENT


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


jobqueue = load(f"{AGENT}_jobqueue", ROOT / "01-feature-building" / "jobqueue.py")
ttl_cache = load(f"{AGENT}_ttl_cache", ROOT / "02-bug-fixing" / "ttl_cache.py")


class FakeClock:
    def __init__(self):
        self.now = 10.0

    def __call__(self):
        return self.now


class SchedulerContract(unittest.TestCase):
    def test_empty_and_generator(self):
        self.assertEqual(jobqueue.plan_jobs([]), [])
        jobs = (x for x in [jobqueue.Job("a"), jobqueue.Job("b", 1)])
        self.assertEqual(jobqueue.plan_jobs(jobs), ["b", "a"])

    def test_dynamic_ready_priority(self):
        jobs = [
            jobqueue.Job("a", 1),
            jobqueue.Job("b", 100, ("a",)),
            jobqueue.Job("c", 50),
        ]
        self.assertEqual(jobqueue.plan_jobs(jobs), ["c", "a", "b"])

    def test_duplicate_and_empty_ids(self):
        for jobs in ([jobqueue.Job("a"), jobqueue.Job("a")], [jobqueue.Job("")]):
            with self.assertRaises(jobqueue.ScheduleError):
                jobqueue.plan_jobs(jobs)

    def test_unknown_and_cycle_diagnostics(self):
        with self.assertRaises(jobqueue.ScheduleError):
            jobqueue.plan_jobs([jobqueue.Job("a", depends_on=("missing",))])
        with self.assertRaises(jobqueue.ScheduleError) as caught:
            jobqueue.plan_jobs([
                jobqueue.Job("a", depends_on=("b",)),
                jobqueue.Job("b", depends_on=("a",)),
            ])
        self.assertIn("a", str(caught.exception).lower())
        self.assertIn("b", str(caught.exception).lower())

    def test_input_not_mutated(self):
        deps = ("a",)
        jobs = [jobqueue.Job("a"), jobqueue.Job("b", depends_on=deps)]
        before = list(jobs)
        jobqueue.plan_jobs(jobs)
        self.assertEqual(jobs, before)
        self.assertIs(jobs[1].depends_on, deps)


class CacheContract(unittest.TestCase):
    def test_constructor_validation(self):
        clock = FakeClock()
        for size, ttl in [(0, 1), (-1, 1), (1, 0), (1, -1)]:
            with self.assertRaises(ValueError):
                ttl_cache.TTLCache(size, ttl, clock)

    def test_falsy_values(self):
        clock = FakeClock()
        cache = ttl_cache.TTLCache(3, 5, clock)
        for key, value in [("zero", 0), ("false", False), ("none", None)]:
            cache.put(key, value)
            self.assertIs(cache.get(key), value)

    def test_expiry_boundary_removes_entry(self):
        clock = FakeClock()
        cache = ttl_cache.TTLCache(2, 5, clock)
        cache.put("a", 1)
        clock.now += 5
        with self.assertRaises(KeyError):
            cache.get("a")
        self.assertEqual(len(cache), 0)

    def test_get_changes_lru_without_refreshing_ttl(self):
        clock = FakeClock()
        cache = ttl_cache.TTLCache(2, 5, clock)
        cache.put("a", 1)
        clock.now += 2
        cache.put("b", 2)
        cache.get("a")
        cache.put("c", 3)
        with self.assertRaises(KeyError):
            cache.get("b")
        clock.now += 3
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_update_refreshes_value_timestamp_and_recency(self):
        clock = FakeClock()
        cache = ttl_cache.TTLCache(2, 5, clock)
        cache.put("a", 1)
        cache.put("b", 2)
        clock.now += 4
        cache.put("a", 9)
        cache.put("c", 3)
        self.assertEqual(cache.get("a"), 9)
        with self.assertRaises(KeyError):
            cache.get("b")
        clock.now += 4
        self.assertEqual(cache.get("a"), 9)

    def test_expired_removed_before_capacity(self):
        clock = FakeClock()
        cache = ttl_cache.TTLCache(2, 3, clock)
        cache.put("old", 1)
        clock.now += 2
        cache.put("live", 2)
        clock.now += 2
        cache.put("new", 3)
        self.assertEqual(cache.get("live"), 2)
        self.assertEqual(cache.get("new"), 3)


if __name__ == "__main__":
    unittest.main(verbosity=2)

