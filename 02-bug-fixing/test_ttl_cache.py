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

    # --- regression tests for the fixed defects ---

    def test_falsy_values_are_returned(self):
        cache = TTLCache(4, 10, self.clock)
        for key, value in (("zero", 0), ("false", False), ("none", None), ("empty", "")):
            cache.put(key, value)
            self.assertIs(cache.get(key), value)

    def test_missing_key_raises_key_error(self):
        cache = TTLCache(2, 10, self.clock)
        with self.assertRaises(KeyError):
            cache.get("missing")

    def test_uses_injected_clock_not_wall_clock(self):
        cache = TTLCache(2, 5, self.clock)
        cache.put("a", "A")
        self.clock.now += 4.999
        self.assertEqual(cache.get("a"), "A")
        self.clock.now += 0.001
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_alive_strictly_before_ttl(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 9.999
        self.assertEqual(cache.get("a"), "A")

    def test_get_does_not_refresh_ttl(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 5
        self.assertEqual(cache.get("a"), "A")
        self.clock.now += 5
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_put_updates_value_timestamp_and_recency(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        self.clock.now += 5
        cache.put("a", "A2")
        self.assertEqual(cache.get("a"), "A2")
        self.clock.now += 5
        self.assertEqual(cache.get("a"), "A2")  # timestamp refreshed
        cache.put("c", "C")
        with self.assertRaises(KeyError):  # recency refreshed, so "b" goes
            cache.get("b")
        self.assertEqual(cache.get("a"), "A2")

    def test_expired_entries_purged_before_capacity_enforced(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        self.clock.now += 10
        cache.put("c", "C")  # no eviction needed: a and b are expired
        self.assertEqual(cache.get("c"), "C")
        with self.assertRaises(KeyError):
            cache.get("a")
        with self.assertRaises(KeyError):
            cache.get("b")

    def test_capacity_evicts_least_recently_used_live_entry(self):
        cache = TTLCache(3, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("c", "C")
        cache.get("a")
        cache.get("c")
        cache.put("d", "D")
        with self.assertRaises(KeyError):
            cache.get("b")
        for key, value in (("a", "A"), ("c", "C"), ("d", "D")):
            self.assertEqual(cache.get(key), value)

    def test_expired_entry_is_not_evicted_instead_of_live_entry(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 10
        cache.put("b", "B")
        cache.put("c", "C")  # "a" already expired, so it is purged first
        self.assertEqual(cache.get("b"), "B")
        self.assertEqual(cache.get("c"), "C")

    def test_repeated_put_does_not_grow_beyond_max_size(self):
        cache = TTLCache(2, 10, self.clock)
        for i in range(10):
            cache.put("k%d" % i, i)
            self.assertLessEqual(len(cache), 2)

    def test_expired_get_removes_entry(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 10
        with self.assertRaises(KeyError):
            cache.get("a")
        self.assertEqual(len(cache), 0)

    def test_invalid_configuration(self):
        with self.assertRaises(ValueError):
            TTLCache(0, 10, self.clock)
        with self.assertRaises(ValueError):
            TTLCache(-1, 10, self.clock)
        with self.assertRaises(ValueError):
            TTLCache(2, 0, self.clock)
        with self.assertRaises(ValueError):
            TTLCache(2, -5, self.clock)

    def test_valid_configuration_boundary(self):
        cache = TTLCache(1, 0.001, self.clock)
        cache.put("a", "A")
        self.assertEqual(cache.get("a"), "A")


if __name__ == "__main__":
    unittest.main()
