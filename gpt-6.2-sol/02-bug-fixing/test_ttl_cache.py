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

    def test_get_returns_falsy_values(self):
        cache = TTLCache(3, 10, self.clock)
        values = {"zero": 0, "false": False, "none": None}
        for key, value in values.items():
            cache.put(key, value)
        for key, value in values.items():
            with self.subTest(key=key):
                self.assertIs(cache.get(key), value)

    def test_missing_key_raises(self):
        cache = TTLCache(1, 10, self.clock)
        with self.assertRaises(KeyError):
            cache.get("missing")

    def test_expires_at_boundary(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 10
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_get_does_not_extend_ttl(self):
        cache = TTLCache(1, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 9
        self.assertEqual(cache.get("a"), "A")
        self.clock.now += 2
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

    def test_put_updates_value_and_ttl(self):
        cache = TTLCache(1, 10, self.clock)
        cache.put("a", "old")
        self.clock.now += 5
        cache.put("a", "new")
        self.clock.now += 5
        self.assertEqual(cache.get("a"), "new")
        self.clock.now += 5
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_put_update_refreshes_lru_without_evicting(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("b", "updated B")
        self.assertEqual(len(cache), 2)

        cache.put("a", "updated A")
        self.assertEqual(len(cache), 2)
        cache.put("c", "C")

        with self.assertRaises(KeyError):
            cache.get("b")
        self.assertEqual(cache.get("a"), "updated A")
        self.assertEqual(cache.get("c"), "C")

    def test_put_purges_expired_entries_before_evicting(self):
        cache = TTLCache(3, 10, self.clock)
        cache.put("expired first", "A")
        cache.put("expired second", "B")
        self.clock.now += 5
        cache.put("live", "C")
        cache.get("expired first")
        cache.get("expired second")
        self.clock.now += 5

        cache.put("new", "D")

        self.assertEqual(len(cache), 2)
        self.assertEqual(cache.get("live"), "C")
        self.assertEqual(cache.get("new"), "D")
        for key in ("expired first", "expired second"):
            with self.subTest(key=key), self.assertRaises(KeyError):
                cache.get(key)

    def test_invalid_capacity_raises(self):
        for max_size in (-1, 0, 0.5):
            with self.subTest(max_size=max_size), self.assertRaises(ValueError):
                TTLCache(max_size, 10, self.clock)

    def test_nonpositive_ttl_raises(self):
        for ttl_seconds in (-1, 0):
            with self.subTest(ttl_seconds=ttl_seconds), self.assertRaises(ValueError):
                TTLCache(1, ttl_seconds, self.clock)


if __name__ == "__main__":
    unittest.main()

