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

    def test_get_missing_key_raises_key_error(self):
        cache = TTLCache(2, 10, self.clock)
        with self.assertRaises(KeyError):
            cache.get("missing")

    def test_get_returns_falsy_values(self):
        cache = TTLCache(8, 10, self.clock)
        values = [0, 0.0, False, None, "", [], {}]
        for key, value in enumerate(values):
            cache.put(key, value)
        for key, value in enumerate(values):
            with self.subTest(value=value):
                self.assertIs(cache.get(key), value)

    def test_expired_falsy_value_raises_key_error(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", None)
        self.clock.now += 10
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_ttl_uses_injected_clock(self):
        self.clock.now = 0.0
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now = 9.5
        self.assertEqual(cache.get("a"), "A")
        self.clock.now = 10.0
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_get_does_not_refresh_ttl(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 6
        self.assertEqual(cache.get("a"), "A")
        self.clock.now += 4
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_put_existing_key_updates_value(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "old")
        cache.put("a", "new")
        self.assertEqual(cache.get("a"), "new")
        self.assertEqual(len(cache), 1)

    def test_put_existing_key_refreshes_timestamp(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 8
        cache.put("a", "A2")
        self.clock.now += 8  # 8s since re-put, 16s since first put
        self.assertEqual(cache.get("a"), "A2")
        self.clock.now += 2  # 10s since re-put
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_put_existing_key_refreshes_recency(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("a", "A2")  # "a" becomes most recently used
        cache.put("c", "C")  # must evict "b", not "a"
        with self.assertRaises(KeyError):
            cache.get("b")
        self.assertEqual(cache.get("a"), "A2")
        self.assertEqual(cache.get("c"), "C")

    def test_put_existing_key_at_capacity_does_not_evict_other_keys(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("b", "B2")
        self.assertEqual(cache.get("a"), "A")
        self.assertEqual(cache.get("b"), "B2")
        self.assertEqual(len(cache), 2)

    def test_expired_entries_are_purged_before_capacity_eviction(self):
        cache = TTLCache(2, 10, self.clock)
        self.clock.now = 100.0
        cache.put("expired", "E")
        self.clock.now = 105.0
        cache.put("live", "L")
        self.clock.now = 109.0
        self.assertEqual(cache.get("expired"), "E")  # now LRU order: live, expired
        self.clock.now = 110.0  # "expired" is 10s old, "live" is 5s old
        cache.put("new", "N")  # must drop the expired entry, not "live"
        self.assertEqual(cache.get("live"), "L")
        self.assertEqual(cache.get("new"), "N")
        self.assertEqual(len(cache), 2)

    def test_capacity_evicts_least_recently_used_live_entry(self):
        cache = TTLCache(3, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("c", "C")
        cache.get("a")  # LRU order: b, c, a
        cache.put("d", "D")  # evicts "b"
        with self.assertRaises(KeyError):
            cache.get("b")
        self.assertEqual(cache.get("a"), "A")
        self.assertEqual(cache.get("c"), "C")
        self.assertEqual(cache.get("d"), "D")

    def test_max_size_one_keeps_only_latest_entry(self):
        cache = TTLCache(1, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        with self.assertRaises(KeyError):
            cache.get("a")
        self.assertEqual(cache.get("b"), "B")

    def test_rejects_max_size_below_one(self):
        for max_size in (0, -1):
            with self.subTest(max_size=max_size):
                with self.assertRaises(ValueError):
                    TTLCache(max_size, 10, self.clock)

    def test_rejects_non_positive_ttl(self):
        for ttl_seconds in (0, -1, -0.5):
            with self.subTest(ttl_seconds=ttl_seconds):
                with self.assertRaises(ValueError):
                    TTLCache(2, ttl_seconds, self.clock)

    def test_accepts_minimal_valid_arguments(self):
        cache = TTLCache(1, 0.001, self.clock)
        cache.put("a", "A")
        self.assertEqual(cache.get("a"), "A")


if __name__ == "__main__":
    unittest.main()
