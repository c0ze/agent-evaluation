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


class TTLCacheRegressionTests(unittest.TestCase):
    def setUp(self):
        self.clock = Clock()

    def test_falsy_values_are_returned(self):
        cache = TTLCache(5, 10, self.clock)
        for key, value in (("zero", 0), ("false", False), ("none", None), ("empty", "")):
            cache.put(key, value)
        for key, value in (("zero", 0), ("false", False), ("none", None), ("empty", "")):
            self.assertIs(cache.get(key), value)

    def test_missing_key_raises_key_error(self):
        cache = TTLCache(2, 10, self.clock)
        with self.assertRaises(KeyError):
            cache.get("missing")

    def test_ttl_uses_injected_clock_at_boundary(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 9.999
        self.assertEqual(cache.get("a"), "A")
        self.clock.now += 0.001  # age is now exactly 10 == ttl
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_get_refreshes_lru_but_not_ttl(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 5
        cache.get("a")
        self.clock.now += 5  # age is now exactly 10 == ttl since put, not since get
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_put_updates_value_timestamp_and_recency(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        self.clock.now += 5
        cache.put("a", "NEW")  # refresh timestamp and make "a" most recent
        self.clock.now += 6  # "b" is now 11s old, "a" is 6s old
        self.assertEqual(cache.get("a"), "NEW")
        with self.assertRaises(KeyError):
            cache.get("b")

    def test_put_updates_existing_key_without_growing(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", 1)
        cache.put("a", 2)
        self.assertEqual(len(cache), 1)
        self.assertEqual(cache.get("a"), 2)

    def test_expired_entries_removed_before_capacity_eviction(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        self.clock.now += 10  # both entries expired
        cache.put("c", "C")
        self.assertEqual(cache.get("c"), "C")
        with self.assertRaises(KeyError):
            cache.get("a")
        with self.assertRaises(KeyError):
            cache.get("b")

    def test_expired_lru_freed_instead_of_evicting_live_lru(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 5
        cache.put("b", "B")
        cache.get("a")  # "a" is most recent, "b" is LRU but still live
        self.clock.now += 6  # "a" is 11s old (expired), "b" is 6s old (live)
        cache.put("c", "C")  # should purge expired "a", keep live "b"
        self.assertEqual(cache.get("b"), "B")
        self.assertEqual(cache.get("c"), "C")

    def test_capacity_eviction_removes_live_lru(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.get("a")  # "b" is now least recently used
        cache.put("c", "C")
        self.assertEqual(cache.get("a"), "A")
        self.assertEqual(cache.get("c"), "C")
        with self.assertRaises(KeyError):
            cache.get("b")

    def test_invalid_construction_raises_value_error(self):
        for max_size in (0, -1):
            with self.assertRaises(ValueError):
                TTLCache(max_size, 10, self.clock)
        for ttl in (0, -1):
            with self.assertRaises(ValueError):
                TTLCache(2, ttl, self.clock)


if __name__ == "__main__":
    unittest.main()

