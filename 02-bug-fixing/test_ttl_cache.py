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
        cache = TTLCache(4, 10, self.clock)
        cache.put("zero", 0)
        cache.put("false", False)
        cache.put("none", None)
        cache.put("empty", "")
        self.assertEqual(cache.get("zero"), 0)
        self.assertIs(cache.get("false"), False)
        self.assertIsNone(cache.get("none"))
        self.assertEqual(cache.get("empty"), "")

    def test_get_missing_key_raises_key_error(self):
        cache = TTLCache(2, 10, self.clock)
        with self.assertRaises(KeyError):
            cache.get("missing")

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
        cache.put("a", "A1")
        self.clock.now += 2
        cache.put("b", "B")
        self.clock.now += 3
        cache.put("a", "A2")
        self.assertEqual(len(cache), 2)

        self.clock.now += 1
        cache.put("c", "C")
        with self.assertRaises(KeyError):
            cache.get("b")
        self.assertEqual(cache.get("c"), "C")

        self.clock.now += 6
        self.assertEqual(cache.get("a"), "A2")

    def test_expired_entries_removed_before_capacity_eviction(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 5
        cache.put("b", "B")
        self.clock.now += 1
        cache.get("a")

        self.clock.now += 4
        cache.put("c", "C")
        self.assertEqual(cache.get("b"), "B")
        self.assertEqual(cache.get("c"), "C")
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_invalid_arguments_raise_value_error(self):
        for bad_size in (0, -1):
            with self.subTest(max_size=bad_size):
                with self.assertRaises(ValueError):
                    TTLCache(bad_size, 10, self.clock)
        for bad_ttl in (0, -0.5, -10):
            with self.subTest(ttl_seconds=bad_ttl):
                with self.assertRaises(ValueError):
                    TTLCache(2, bad_ttl, self.clock)


if __name__ == "__main__":
    unittest.main()
