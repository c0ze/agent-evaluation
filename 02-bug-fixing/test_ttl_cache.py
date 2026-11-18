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

    def test_falsy_values(self):
        cache = TTLCache(1, 10, self.clock)
        for value in (0, False, None):
            with self.subTest(value=value):
                cache.put("a", value)
                self.assertIs(cache.get("a"), value)

    def test_missing_key(self):
        cache = TTLCache(1, 10, self.clock)
        with self.assertRaises(KeyError):
            cache.get("missing")

    def test_expires_at_boundary(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 9
        self.assertEqual(cache.get("a"), "A")
        self.clock.now += 1
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
        self.assertEqual(cache.get("a"), "A")
        self.assertEqual(cache.get("c"), "C")

    def test_update_at_capacity_refreshes_value_and_ttl(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        self.clock.now += 9
        cache.put("b", "updated")
        self.assertEqual(cache.get("a"), "A")
        self.clock.now += 1
        self.assertEqual(cache.get("b"), "updated")
        self.clock.now += 9
        with self.assertRaises(KeyError):
            cache.get("b")

    def test_update_refreshes_lru(self):
        cache = TTLCache(3, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("a", "updated")
        cache.put("c", "C")
        cache.put("d", "D")
        with self.assertRaises(KeyError):
            cache.get("b")
        self.assertEqual(cache.get("a"), "updated")

    def test_put_purges_all_expired_entries_before_eviction(self):
        cache = TTLCache(4, 10, self.clock)
        cache.put("old1", 1)
        cache.put("old2", 2)
        self.clock.now += 5
        cache.put("live1", 3)
        cache.put("live2", 4)
        cache.get("old1")
        cache.get("old2")
        self.clock.now += 5
        cache.put("new", 5)
        self.assertEqual(len(cache), 3)
        self.assertEqual(cache.get("live1"), 3)
        self.assertEqual(cache.get("live2"), 4)
        self.assertEqual(cache.get("new"), 5)

    def test_invalid_bounds(self):
        for size, ttl in ((0, 10), (-1, 10), (1, 0), (1, -1)):
            with self.subTest(size=size, ttl=ttl):
                with self.assertRaises(ValueError):
                    TTLCache(size, ttl, self.clock)


if __name__ == "__main__":
    unittest.main()

