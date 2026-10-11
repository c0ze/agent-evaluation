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
        self.assertEqual(cache.get("false"), False)
        self.assertEqual(cache.get("none"), None)

    def test_ttl_uses_injected_clock(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.assertEqual(cache.get("a"), "A")
        self.clock.now += 5
        self.assertEqual(cache.get("a"), "A")
        self.clock.now += 6
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_put_updates_existing_key(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 5
        cache.put("a", "B")
        self.assertEqual(cache.get("a"), "B")
        self.clock.now += 5
        self.assertEqual(cache.get("a"), "B")

    def test_put_refreshes_recency_of_existing_key(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("a", "A_updated")
        cache.put("c", "C")
        with self.assertRaises(KeyError):
            cache.get("b")
        self.assertEqual(cache.get("a"), "A_updated")

    def test_expired_entries_removed_before_capacity_enforcement(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        self.clock.now += 15
        cache.put("c", "C")
        self.assertEqual(cache.get("c"), "C")
        self.assertEqual(len(cache), 1)

    def test_capacity_eviction_removes_lru_live_entry(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.get("a")
        cache.put("c", "C")
        with self.assertRaises(KeyError):
            cache.get("b")
        self.assertEqual(cache.get("a"), "A")
        self.assertEqual(cache.get("c"), "C")

    def test_max_size_less_than_one_raises(self):
        with self.assertRaises(ValueError):
            TTLCache(0, 10, self.clock)
        with self.assertRaises(ValueError):
            TTLCache(-1, 10, self.clock)

    def test_ttl_seconds_less_than_or_equal_zero_raises(self):
        with self.assertRaises(ValueError):
            TTLCache(2, 0, self.clock)
        with self.assertRaises(ValueError):
            TTLCache(2, -1, self.clock)

    def test_get_does_not_refresh_ttl(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 5
        cache.get("a")
        self.clock.now += 6
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_get_missing_key_raises_keyerror(self):
        cache = TTLCache(2, 10, self.clock)
        with self.assertRaises(KeyError):
            cache.get("missing")

    def test_len_reflects_live_entries(self):
        cache = TTLCache(3, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        self.assertEqual(len(cache), 2)
        self.clock.now += 15
        self.assertEqual(len(cache), 2)
        with self.assertRaises(KeyError):
            cache.get("a")
        self.assertEqual(len(cache), 1)
        with self.assertRaises(KeyError):
            cache.get("b")
        self.assertEqual(len(cache), 0)


if __name__ == "__main__":
    unittest.main()