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

    # --- regression tests ---

    def test_falsy_values_are_returned(self):
        cache = TTLCache(3, 10, self.clock)
        for key, value in (("zero", 0), ("false", False), ("none", None)):
            cache.put(key, value)
            self.assertIs(cache.get(key), value)

    def test_missing_key_raises_key_error(self):
        cache = TTLCache(2, 10, self.clock)
        with self.assertRaises(KeyError):
            cache.get("nope")

    def test_alive_just_before_ttl_boundary(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 9.999
        self.assertEqual(cache.get("a"), "A")

    def test_get_does_not_refresh_ttl(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 9.5
        self.assertEqual(cache.get("a"), "A")
        self.clock.now += 0.5  # age is now exactly ttl_seconds
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_put_updates_value_timestamp_and_recency(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        self.clock.now += 5
        cache.put("a", "A2")  # refresh: a is now newest and not expired
        self.clock.now += 5  # a is age 5, b is age 10 (expired)
        self.assertEqual(cache.get("a"), "A2")
        cache.put("c", "C")  # expired b is purged first, so b goes, not a
        self.assertEqual(cache.get("a"), "A2")
        with self.assertRaises(KeyError):
            cache.get("b")

    def test_expired_entries_purged_before_capacity_eviction(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 10  # a is expired
        cache.put("b", "B")
        cache.put("c", "C")  # only 1 live entry, so nothing live is evicted
        self.assertEqual(cache.get("b"), "B")
        self.assertEqual(cache.get("c"), "C")

    def test_capacity_evicts_least_recently_used_live_entry(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.get("a")  # recency: b (oldest), a (newest)
        cache.put("c", "C")  # evicts b
        self.assertEqual(cache.get("a"), "A")
        self.assertEqual(cache.get("c"), "C")
        with self.assertRaises(KeyError):
            cache.get("b")
        self.assertEqual(len(cache), 2)

    def test_invalid_configuration_raises_value_error(self):
        with self.assertRaises(ValueError):
            TTLCache(0, 10, self.clock)
        with self.assertRaises(ValueError):
            TTLCache(-1, 10, self.clock)
        with self.assertRaises(ValueError):
            TTLCache(2, 0, self.clock)
        with self.assertRaises(ValueError):
            TTLCache(2, -5, self.clock)

    def test_default_clock_is_monotonic(self):
        import time as time_module
        self.assertIs(TTLCache(1, 1).clock, time_module.monotonic)


if __name__ == "__main__":
    unittest.main()
