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

    def test_falsy_values_returned(self):
        cache = TTLCache(4, 10, self.clock)
        cache.put("zero", 0)
        cache.put("false", False)
        cache.put("none", None)
        self.assertEqual(cache.get("zero"), 0)
        self.assertEqual(cache.get("false"), False)
        self.assertIsNone(cache.get("none"))

    def test_missing_key_raises(self):
        cache = TTLCache(2, 10, self.clock)
        with self.assertRaises(KeyError):
            cache.get("absent")

    def test_ttl_uses_injected_clock(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 9.999
        self.assertEqual(cache.get("a"), "A")
        self.clock.now += 0.001  # age == 10 -> expired
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_get_does_not_refresh_ttl(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 6
        self.assertEqual(cache.get("a"), "A")  # must not extend TTL
        self.clock.now += 4  # age == 10 from put
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_put_updates_value_timestamp_and_recency(self):
        cache = TTLCache(2, 100, self.clock)
        cache.put("a", "A1")
        cache.put("b", "B")
        cache.put("a", "A2")  # update: newest value, timestamp, recency
        self.assertEqual(cache.get("a"), "A2")
        cache.put("c", "C")  # "b" is now LRU, must be evicted
        with self.assertRaises(KeyError):
            cache.get("b")
        self.assertEqual(cache.get("a"), "A2")

    def test_put_refreshes_ttl_of_existing_key(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A1")
        self.clock.now += 8
        cache.put("a", "A2")  # new timestamp
        self.clock.now += 8  # age 8 from second put -> live
        self.assertEqual(cache.get("a"), "A2")
        self.clock.now += 2  # age 10 -> expired
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_put_existing_key_does_not_evict(self):
        cache = TTLCache(2, 100, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("a", "A2")  # full cache, existing key: no eviction
        self.assertEqual(cache.get("a"), "A2")
        self.assertEqual(cache.get("b"), "B")

    def test_expired_purged_before_capacity_eviction(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        self.clock.now += 10  # "a" and "b" both expired
        cache.put("c", "C")
        cache.put("d", "D")
        self.assertEqual(cache.get("c"), "C")
        self.assertEqual(cache.get("d"), "D")
        self.assertEqual(len(cache), 2)

    def test_expired_entry_does_not_cause_live_eviction(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 9
        cache.put("b", "B")  # "a" age 9, "b" age 0
        self.clock.now += 1  # "a" age 10 (expired), "b" age 1 (live)
        cache.put("c", "C")  # must purge "a", keep "b"
        with self.assertRaises(KeyError):
            cache.get("a")
        self.assertEqual(cache.get("b"), "B")
        self.assertEqual(cache.get("c"), "C")

    def test_capacity_evicts_lru_live_entry(self):
        cache = TTLCache(2, 100, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("c", "C")  # "a" is LRU live entry
        with self.assertRaises(KeyError):
            cache.get("a")
        self.assertEqual(cache.get("b"), "B")
        self.assertEqual(cache.get("c"), "C")

    def test_invalid_args_raise_value_error(self):
        with self.assertRaises(ValueError):
            TTLCache(0, 10, self.clock)
        with self.assertRaises(ValueError):
            TTLCache(-1, 10, self.clock)
        with self.assertRaises(ValueError):
            TTLCache(2, 0, self.clock)
        with self.assertRaises(ValueError):
            TTLCache(2, -5, self.clock)


if __name__ == "__main__":
    unittest.main()

