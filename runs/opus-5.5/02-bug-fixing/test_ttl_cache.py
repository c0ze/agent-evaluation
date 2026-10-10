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

    # --- Regression tests ---

    def test_falsy_values_are_returned(self):
        cache = TTLCache(5, 10, self.clock)
        for key, value in [("zero", 0), ("false", False), ("none", None),
                           ("empty", ""), ("list", [])]:
            cache.put(key, value)
        self.assertEqual(cache.get("zero"), 0)
        self.assertIs(cache.get("false"), False)
        self.assertIsNone(cache.get("none"))
        self.assertEqual(cache.get("empty"), "")
        self.assertEqual(cache.get("list"), [])

    def test_missing_key_raises_key_error(self):
        cache = TTLCache(2, 10, self.clock)
        with self.assertRaises(KeyError):
            cache.get("missing")

    def test_live_just_before_boundary(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 9.999
        self.assertEqual(cache.get("a"), "A")

    def test_uses_injected_clock_not_wall_clock(self):
        # Clock values far from time.time()/time.monotonic() must still work.
        self.clock.now = 0.0
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.assertEqual(cache.get("a"), "A")
        self.clock.now = 10.0
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_expired_get_removes_entry(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 10
        with self.assertRaises(KeyError):
            cache.get("a")
        self.assertEqual(len(cache), 0)

    def test_get_does_not_refresh_ttl(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 6
        self.assertEqual(cache.get("a"), "A")
        self.clock.now += 4  # 10s after put, only 4s after get
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_put_existing_updates_value_and_timestamp(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 6
        cache.put("a", "A2")
        self.clock.now += 6  # 12s after first put, 6s after update
        self.assertEqual(cache.get("a"), "A2")
        self.assertEqual(len(cache), 1)

    def test_put_existing_refreshes_recency_without_eviction(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("a", "A2")  # full cache, existing key: must not evict
        self.assertEqual(len(cache), 2)
        self.assertEqual(cache.get("b"), "B")
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("a", "A2")  # "a" is now most recent, "b" is LRU
        cache.put("c", "C")
        with self.assertRaises(KeyError):
            cache.get("b")
        self.assertEqual(cache.get("a"), "A2")
        self.assertEqual(cache.get("c"), "C")

    def test_put_existing_on_full_cache_does_not_evict_other_key(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("b", "B2")  # updating MRU key must not evict LRU "a"
        self.assertEqual(len(cache), 2)
        self.assertEqual(cache.get("a"), "A")
        self.assertEqual(cache.get("b"), "B2")

    def test_evicts_least_recently_used_without_get(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("c", "C")
        with self.assertRaises(KeyError):
            cache.get("a")
        self.assertEqual(cache.get("b"), "B")
        self.assertEqual(cache.get("c"), "C")

    def test_get_refreshes_lru_keeps_refreshed_key(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.get("a")
        cache.put("c", "C")
        self.assertEqual(cache.get("a"), "A")
        self.assertEqual(cache.get("c"), "C")

    def test_expired_entries_purged_before_capacity_eviction(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("old", "O")      # t=100, expires at t=110
        self.clock.now += 5
        cache.put("live", "L")     # t=105
        cache.get("old")           # "old" is now MRU but will expire first
        self.clock.now += 5        # t=110: "old" expired, "live" alive
        cache.put("new", "N")
        # The expired entry is dropped; the live LRU entry must survive.
        self.assertEqual(cache.get("live"), "L")
        self.assertEqual(cache.get("new"), "N")
        self.assertEqual(len(cache), 2)

    def test_all_expired_entries_purged_on_put(self):
        cache = TTLCache(3, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("c", "C")
        self.clock.now += 10
        cache.put("d", "D")
        self.assertEqual(len(cache), 1)
        self.assertEqual(cache.get("d"), "D")

    def test_invalid_max_size(self):
        for size in (0, -1):
            with self.assertRaises(ValueError):
                TTLCache(size, 10, self.clock)

    def test_invalid_ttl(self):
        for ttl in (0, -1, -0.5):
            with self.assertRaises(ValueError):
                TTLCache(2, ttl, self.clock)

    def test_minimum_valid_parameters(self):
        cache = TTLCache(1, 0.5, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        with self.assertRaises(KeyError):
            cache.get("a")
        self.assertEqual(cache.get("b"), "B")


if __name__ == "__main__":
    unittest.main()

