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

    def test_get_returns_falsy_values(self):
        cache = TTLCache(4, 10, self.clock)
        cache.put("zero", 0)
        cache.put("false", False)
        cache.put("none", None)
        self.assertEqual(cache.get("zero"), 0)
        self.assertIs(cache.get("false"), False)
        self.assertIsNone(cache.get("none"))

    def test_uses_injected_clock(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 9.999
        self.assertEqual(cache.get("a"), "A")
        self.clock.now += 0.001
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_get_refreshes_lru_but_not_ttl(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 5
        cache.get("a")  # refreshes recency, not the TTL timestamp
        self.clock.now += 5  # age == ttl_seconds
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_put_updates_value_timestamp_and_recency(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        self.clock.now += 5
        cache.put("a", "A2")  # update: new value, new timestamp, most-recent
        cache.put("c", "C")  # evicts LRU "b"
        self.assertEqual(cache.get("a"), "A2")
        with self.assertRaises(KeyError):
            cache.get("b")
        # updated timestamp: still alive after original ttl window
        self.clock.now += 6
        self.assertEqual(cache.get("a"), "A2")

    def test_put_existing_key_does_not_evict(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("a", "A2")  # update, should not evict anything
        self.assertEqual(len(cache), 2)
        self.assertEqual(cache.get("b"), "B")

    def test_expired_removed_before_capacity_eviction(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.get("b")  # make "a" the LRU
        self.clock.now += 10  # "a" now expired; "b" refreshed by get? no - get doesn't refresh TTL
        # both have original timestamps; "a" expired, "b" too (get doesn't refresh TTL)
        cache.put("c", "C")  # expired entries purged first, no live eviction needed
        self.assertEqual(cache.get("c"), "C")
        self.assertEqual(len(cache), 1)

    def test_expired_purge_preserves_live_lru_order(self):
        cache = TTLCache(2, 5, self.clock)
        cache.put("a", "A")
        self.clock.now += 5  # "a" expired
        cache.put("b", "B")
        self.clock.now += 1
        cache.put("c", "C")  # purge "a"; live "b" must survive capacity check
        self.assertEqual(cache.get("b"), "B")
        self.assertEqual(cache.get("c"), "C")
        self.assertEqual(len(cache), 2)

    def test_capacity_evicts_lru_live_entry(self):
        cache = TTLCache(3, 100, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("c", "C")
        cache.get("b")
        cache.get("c")
        cache.put("d", "D")  # evicts "a", the least recently used live entry
        with self.assertRaises(KeyError):
            cache.get("a")
        self.assertEqual(cache.get("b"), "B")
        self.assertEqual(cache.get("c"), "C")
        self.assertEqual(cache.get("d"), "D")

    def test_invalid_arguments_raise_value_error(self):
        with self.assertRaises(ValueError):
            TTLCache(0, 10, self.clock)
        with self.assertRaises(ValueError):
            TTLCache(-1, 10, self.clock)
        with self.assertRaises(ValueError):
            TTLCache(2, 0, self.clock)
        with self.assertRaises(ValueError):
            TTLCache(2, -5, self.clock)

    def test_missing_key_raises_key_error(self):
        cache = TTLCache(2, 10, self.clock)
        with self.assertRaises(KeyError):
            cache.get("nope")


if __name__ == "__main__":
    unittest.main()

