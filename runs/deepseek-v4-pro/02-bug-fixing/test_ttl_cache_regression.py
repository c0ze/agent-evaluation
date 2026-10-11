import unittest

from ttl_cache import TTLCache


class Clock:
    def __init__(self):
        self.now = 100.0

    def __call__(self):
        return self.now


class TTLCacheRegressionTests(unittest.TestCase):
    def setUp(self):
        self.clock = Clock()

    def test_constructor_rejects_bad_args(self):
        with self.assertRaises(ValueError):
            TTLCache(0, 10, self.clock)
        with self.assertRaises(ValueError):
            TTLCache(1, 0, self.clock)
        with self.assertRaises(ValueError):
            TTLCache(1, -5, self.clock)

    def test_falsy_values_are_returned(self):
        cache = TTLCache(3, 10, self.clock)
        cache.put("zero", 0)
        cache.put("false", False)
        cache.put("none", None)
        self.assertIs(cache.get("zero"), 0)
        self.assertIs(cache.get("false"), False)
        self.assertIsNone(cache.get("none"))

    def test_missing_key_raises_keyerror(self):
        cache = TTLCache(2, 10, self.clock)
        with self.assertRaises(KeyError):
            cache.get("missing")

    def test_expires_at_ttl_boundary(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 9
        self.assertEqual(cache.get("a"), "A")
        self.clock.now += 1
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_get_does_not_refresh_ttl(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 6
        self.assertEqual(cache.get("a"), "A")
        self.clock.now += 5
        # 11s since creation: still expired even though get happened at 6s.
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_put_updates_value_timestamp_recency(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "old")
        self.clock.now += 9
        cache.put("a", "new")
        self.clock.now += 9
        self.assertEqual(cache.get("a"), "new")

    def test_put_evicts_expired_before_capacity(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        self.clock.now += 11
        cache.put("c", "C")
        self.assertEqual(cache.get("c"), "C")
        with self.assertRaises(KeyError):
            cache.get("a")
        with self.assertRaises(KeyError):
            cache.get("b")

    def test_capacity_evicts_lru(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.get("a")
        cache.put("c", "C")
        with self.assertRaises(KeyError):
            cache.get("b")
        self.assertEqual(cache.get("a"), "A")
        self.assertEqual(cache.get("c"), "C")

    def test_put_existing_key_does_not_evict(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("a", "A2")
        self.assertEqual(cache.get("a"), "A2")
        self.assertEqual(cache.get("b"), "B")

    def test_len_reflects_entries(self):
        cache = TTLCache(2, 10, self.clock)
        self.assertEqual(len(cache), 0)
        cache.put("a", "A")
        self.assertEqual(len(cache), 1)


if __name__ == "__main__":
    unittest.main()
