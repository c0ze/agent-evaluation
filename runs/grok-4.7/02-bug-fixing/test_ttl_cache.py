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

    def test_missing_key_raises_keyerror(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        with self.assertRaises(KeyError):
            cache.get("missing")
        self.assertEqual(len(cache), 1)
        self.assertEqual(cache.get("a"), "A")

    def test_expired_falsy_value_raises_keyerror(self):
        cache = TTLCache(3, 10, self.clock)
        cache.put("zero", 0)
        cache.put("false", False)
        cache.put("none", None)
        self.clock.now += 10
        for key in ("zero", "false", "none"):
            with self.assertRaises(KeyError):
                cache.get(key)
        self.assertEqual(len(cache), 0)

    def test_entry_live_until_ttl(self):
        cache = TTLCache(1, 10, self.clock)
        cache.put("a", 0)
        self.clock.now += 9
        self.assertEqual(cache.get("a"), 0)

    def test_get_does_not_refresh_ttl(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        self.clock.now += 9
        self.assertEqual(cache.get("a"), "A")
        cache.put("c", "C")
        with self.assertRaises(KeyError):
            cache.get("b")
        self.clock.now += 1
        with self.assertRaises(KeyError):
            cache.get("a")
        self.assertEqual(cache.get("c"), "C")

    def test_put_updates_value_without_evicting(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("b", "B2")
        self.assertEqual(cache.get("a"), "A")
        self.assertEqual(cache.get("b"), "B2")
        self.assertEqual(len(cache), 2)

    def test_put_refreshes_timestamp_of_existing_key_only(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        self.clock.now += 9
        cache.put("a", "A2")
        self.clock.now += 1
        with self.assertRaises(KeyError):
            cache.get("b")
        self.assertEqual(cache.get("a"), "A2")
        self.clock.now += 9
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_put_refreshes_recency(self):
        cache = TTLCache(3, 30, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("c", "C")
        cache.put("b", "B2")
        cache.put("d", "D")
        cache.put("e", "E")
        self.assertEqual(cache.get("b"), "B2")
        self.assertEqual(cache.get("d"), "D")
        self.assertEqual(cache.get("e"), "E")
        with self.assertRaises(KeyError):
            cache.get("a")
        with self.assertRaises(KeyError):
            cache.get("c")

    def test_put_replaces_expired_key_without_evicting_live_neighbor(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        self.clock.now += 5
        cache.put("b", "B")
        self.clock.now += 2
        self.assertEqual(cache.get("a"), "A")
        self.clock.now += 4
        cache.put("a", "A2")
        self.assertEqual(cache.get("a"), "A2")
        self.assertEqual(cache.get("b"), "B")

    def test_expired_entries_removed_before_capacity_eviction(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        self.clock.now += 5
        cache.put("b", "B2")
        self.clock.now += 2
        self.assertEqual(cache.get("a"), "A")
        self.clock.now += 4
        cache.put("c", "C")
        with self.assertRaises(KeyError):
            cache.get("a")
        self.assertEqual(cache.get("b"), "B2")
        self.assertEqual(cache.get("c"), "C")
        self.assertEqual(len(cache), 2)

    def test_all_expired_entries_free_capacity(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        self.clock.now += 10
        cache.put("c", "C")
        self.assertEqual(len(cache), 1)
        self.assertEqual(cache.get("c"), "C")
        cache.put("d", "D")
        self.assertEqual(cache.get("c"), "C")
        self.assertEqual(cache.get("d"), "D")
        self.assertEqual(len(cache), 2)
        with self.assertRaises(KeyError):
            cache.get("a")
        with self.assertRaises(KeyError):
            cache.get("b")

    def test_evicts_least_recently_used_live_entry(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("c", "C")
        self.assertEqual(len(cache), 2)
        with self.assertRaises(KeyError):
            cache.get("a")
        self.assertEqual(cache.get("b"), "B")
        self.assertEqual(cache.get("c"), "C")

    def test_capacity_one_update_does_not_drop_key(self):
        cache = TTLCache(1, 10, self.clock)
        cache.put("a", "A")
        cache.put("a", "A2")
        self.assertEqual(cache.get("a"), "A2")
        cache.put("b", "B")
        with self.assertRaises(KeyError):
            cache.get("a")
        self.assertEqual(cache.get("b"), "B")

    def test_rejects_invalid_max_size(self):
        for max_size in (0, 0.5, -1):
            with self.assertRaises(ValueError):
                TTLCache(max_size, 10, self.clock)

    def test_rejects_invalid_ttl(self):
        for ttl_seconds in (0, -0.01, -10):
            with self.assertRaises(ValueError):
                TTLCache(2, ttl_seconds, self.clock)


if __name__ == "__main__":
    unittest.main()

