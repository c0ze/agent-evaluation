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

    def test_falsy_values_are_returned(self):
        cache = TTLCache(4, 10, self.clock)
        cache.put("zero", 0)
        cache.put("false", False)
        cache.put("none", None)
        cache.put("empty", "")
        self.assertEqual(cache.get("zero"), 0)
        self.assertIs(cache.get("false"), False)
        self.assertIsNone(cache.get("none"))
        self.assertEqual(cache.get("empty"), "")

    def test_missing_key_raises_key_error(self):
        cache = TTLCache(2, 10, self.clock)
        with self.assertRaises(KeyError):
            cache.get("missing")

    def test_not_expired_just_before_boundary(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 9.999
        self.assertEqual(cache.get("a"), "A")

    def test_get_does_not_refresh_ttl(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 9
        self.assertEqual(cache.get("a"), "A")
        self.clock.now += 1
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_put_updates_value_timestamp_and_recency(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        self.clock.now += 9
        cache.put("a", "A2")
        self.assertEqual(len(cache), 2)
        # Recency: "a" is now most recent, so inserting "c" evicts "b".
        cache.put("c", "C")
        with self.assertRaises(KeyError):
            cache.get("b")
        self.assertEqual(cache.get("a"), "A2")
        # Timestamp: 9s after the update (18s after first put) still live.
        self.clock.now += 9
        self.assertEqual(cache.get("a"), "A2")
        self.clock.now += 1
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_put_update_when_full_does_not_evict_other_key(self):
        cache = TTLCache(2, 100, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("a", "A2")
        self.assertEqual(len(cache), 2)
        self.assertEqual(cache.get("b"), "B")
        self.assertEqual(cache.get("a"), "A2")

    def test_expired_entries_removed_before_capacity_eviction(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")  # t=100
        self.clock.now += 5
        cache.put("b", "B")  # t=105
        cache.get("a")  # "a" most-recent, "b" is LRU
        self.clock.now += 5  # t=110: "a" expired (age 10), "b" live (age 5)
        cache.put("c", "C")
        # Expired "a" must be pruned instead of evicting live LRU "b".
        self.assertEqual(cache.get("b"), "B")
        self.assertEqual(cache.get("c"), "C")
        with self.assertRaises(KeyError):
            cache.get("a")
        self.assertEqual(len(cache), 2)

    def test_capacity_eviction_removes_lru_live_entry(self):
        cache = TTLCache(2, 100, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("c", "C")
        with self.assertRaises(KeyError):
            cache.get("a")
        self.assertEqual(cache.get("b"), "B")
        self.assertEqual(cache.get("c"), "C")

    def test_invalid_max_size_raises_value_error(self):
        for bad in (0, -1):
            with self.subTest(max_size=bad):
                with self.assertRaises(ValueError):
                    TTLCache(bad, 10, self.clock)

    def test_invalid_ttl_raises_value_error(self):
        for bad in (0, -1):
            with self.subTest(ttl_seconds=bad):
                with self.assertRaises(ValueError):
                    TTLCache(2, bad, self.clock)


if __name__ == "__main__":
    unittest.main()

