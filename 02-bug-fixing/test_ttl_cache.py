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

    def test_get_returns_falsy_values(self):
        cache = TTLCache(3, 10, self.clock)
        cache.put("zero", 0)
        cache.put("false", False)
        cache.put("none", None)
        self.assertEqual(cache.get("zero"), 0)
        self.assertIs(cache.get("false"), False)
        self.assertIsNone(cache.get("none"))

    def test_get_missing_key_raises(self):
        cache = TTLCache(2, 10, self.clock)
        with self.assertRaises(KeyError):
            cache.get("missing")

    def test_get_expired_raises(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 11
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_get_does_not_refresh_ttl(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 5
        self.assertEqual(cache.get("a"), "A")
        self.clock.now += 5
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_put_updates_existing_key_value_and_ttl(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 9
        cache.put("a", "A2")
        self.clock.now += 9
        self.assertEqual(cache.get("a"), "A2")
        self.assertEqual(len(cache), 1)

    def test_put_updates_existing_key_recency(self):
        cache = TTLCache(2, 100, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("a", "A2")
        cache.put("c", "C")
        with self.assertRaises(KeyError):
            cache.get("b")
        self.assertEqual(cache.get("a"), "A2")

    def test_expired_removed_before_capacity_eviction(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 11
        cache.put("b", "B")
        self.clock.now += 0.5
        cache.put("c", "C")
        with self.assertRaises(KeyError):
            cache.get("a")
        self.assertEqual(cache.get("b"), "B")
        self.assertEqual(cache.get("c"), "C")
        self.assertEqual(len(cache), 2)

    def test_eviction_removes_lru_live_entry(self):
        cache = TTLCache(2, 100, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.get("a")
        cache.put("c", "C")
        with self.assertRaises(KeyError):
            cache.get("b")
        self.assertEqual(cache.get("a"), "A")
        self.assertEqual(cache.get("c"), "C")

    def test_invalid_max_size_raises(self):
        with self.assertRaises(ValueError):
            TTLCache(0, 10, self.clock)
        with self.assertRaises(ValueError):
            TTLCache(-1, 10, self.clock)

    def test_invalid_ttl_raises(self):
        with self.assertRaises(ValueError):
            TTLCache(2, 0, self.clock)
        with self.assertRaises(ValueError):
            TTLCache(2, -5, self.clock)


if __name__ == "__main__":
    unittest.main()

