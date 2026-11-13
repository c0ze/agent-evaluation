import time
import unittest

from ttl_cache import TTLCache


class Clock:
    def __init__(self):
        self.now = 100.0

    def __call__(self):
        return self.now


class TTLCacheTests(unittest.TestCase):
    def setUp(self):
        self.clock = Clock()

    def test_round_trip(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.assertEqual(cache.get("a"), "A")

    def test_expires_at_boundary(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 10
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_get_refreshes_lru(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.get("a")
        cache.put("c", "C")
        with self.assertRaises(KeyError):
            cache.get("b")

    def test_falsy_values_and_missing_key(self):
        cache = TTLCache(5, 10, self.clock)
        cache.put("zero", 0)
        cache.put("false", False)
        cache.put("none", None)
        cache.put("empty_str", "")
        cache.put("empty_list", [])

        self.assertEqual(cache.get("zero"), 0)
        self.assertIs(cache.get("false"), False)
        self.assertIsNone(cache.get("none"))
        self.assertEqual(cache.get("empty_str"), "")
        self.assertEqual(cache.get("empty_list"), [])
        with self.assertRaises(KeyError):
            cache.get("missing")

    def test_live_before_boundary_and_removed_on_expired_get(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 9.999
        self.assertEqual(cache.get("a"), "A")
        self.clock.now += 0.001
        with self.assertRaises(KeyError):
            cache.get("a")
        self.assertEqual(len(cache), 0)

    def test_default_monotonic_clock(self):
        cache = TTLCache(2, 10)
        self.assertIs(cache.clock, time.monotonic)
        cache.put("a", "A")
        self.assertEqual(cache.get("a"), "A")

    def test_get_refreshes_lru_without_refreshing_ttl(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 6
        self.assertEqual(cache.get("a"), "A")
        self.clock.now += 4
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_put_updates_existing_value_timestamp_and_recency(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A1")
        self.clock.now += 5
        cache.put("b", "B")
        self.clock.now += 1  # t=106
        cache.put("a", "A2")

        self.assertEqual(len(cache), 2)
        # Updating "a" refreshed its recency so "b" is now LRU and gets evicted.
        cache.put("c", "C")
        with self.assertRaises(KeyError):
            cache.get("b")
        self.assertEqual(cache.get("a"), "A2")
        self.assertEqual(cache.get("c"), "C")

        # Updating "a" at t=106 also refreshed its TTL to expire at t=116.
        self.clock.now = 115.0
        self.assertEqual(cache.get("a"), "A2")
        self.clock.now = 116.0
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_purges_expired_entries_before_capacity_eviction(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 5
        cache.put("b", "B")
        self.clock.now += 1  # t=106: "a" becomes MRU, "b" becomes LRU
        self.assertEqual(cache.get("a"), "A")

        self.clock.now = 110.0  # "a" expired (age 10), "b" still live (age 5)
        cache.put("c", "C")

        self.assertEqual(len(cache), 2)
        with self.assertRaises(KeyError):
            cache.get("a")
        self.assertEqual(cache.get("b"), "B")
        self.assertEqual(cache.get("c"), "C")

    def test_put_replaces_expired_key_without_evicting_live_entry(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A1")
        self.clock.now += 5
        cache.put("b", "B")

        self.clock.now = 110.0  # "a" expired, "b" live
        cache.put("a", "A2")

        self.assertEqual(len(cache), 2)
        self.assertEqual(cache.get("a"), "A2")
        self.assertEqual(cache.get("b"), "B")

    def test_capacity_evicts_least_recently_used_live_entry(self):
        cache = TTLCache(3, 20, self.clock)
        cache.put("a", 1)
        cache.put("b", 2)
        cache.put("c", 3)
        self.assertEqual(cache.get("a"), 1)
        cache.put("b", 20)
        cache.put("d", 4)

        with self.assertRaises(KeyError):
            cache.get("c")
        self.assertEqual(cache.get("a"), 1)
        self.assertEqual(cache.get("b"), 20)
        self.assertEqual(cache.get("d"), 4)
        self.assertEqual(len(cache), 3)

    def test_len_excludes_expired_entries(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", 1)
        self.clock.now += 5
        cache.put("b", 2)
        self.assertEqual(len(cache), 2)
        self.clock.now += 5
        self.assertEqual(len(cache), 1)
        self.clock.now += 5
        self.assertEqual(len(cache), 0)

    def test_invalid_arguments_raise_value_error(self):
        for bad_size in (0, -1, -10):
            with self.subTest(max_size=bad_size):
                with self.assertRaises(ValueError):
                    TTLCache(bad_size, 10, self.clock)

        for bad_ttl in (0, -1, -0.5):
            with self.subTest(ttl_seconds=bad_ttl):
                with self.assertRaises(ValueError):
                    TTLCache(1, bad_ttl, self.clock)

        cache = TTLCache(1, 0.001, self.clock)
        cache.put("k", "v")
        self.assertEqual(cache.get("k"), "v")


if __name__ == "__main__":
    unittest.main()

