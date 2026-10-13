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

    def test_expired_entry_raises_and_is_removed(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 11
        with self.assertRaises(KeyError):
            cache.get("a")
        self.assertEqual(len(cache), 0)

    def test_get_does_not_refresh_ttl(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 6
        self.assertEqual(cache.get("a"), "A")
        self.clock.now += 5
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_put_updates_value_timestamp_and_recency(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        self.clock.now += 6
        cache.put("a", "A2")
        # "a" is now most recently used, so inserting "c" evicts "b".
        cache.put("c", "C")
        with self.assertRaises(KeyError):
            cache.get("b")
        self.assertEqual(cache.get("a"), "A2")
        # Timestamp was refreshed by the second put: 6s later still live
        # (12s after the original put would have expired).
        self.clock.now += 6
        self.assertEqual(cache.get("a"), "A2")

    def test_put_existing_key_does_not_evict(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("a", "A2")
        self.assertEqual(len(cache), 2)
        self.assertEqual(cache.get("b"), "B")
        self.assertEqual(cache.get("a"), "A2")

    def test_expired_entries_removed_before_capacity_eviction(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 6
        cache.put("b", "B")
        # Make "a" most recently used; "b" becomes the LRU live entry.
        self.assertEqual(cache.get("a"), "A")
        self.clock.now += 5
        # Now "a" is expired (age 11), "b" is live (age 5) but LRU.
        # Purging expired first must keep "b" when inserting "c".
        cache.put("c", "C")
        self.assertEqual(cache.get("b"), "B")
        self.assertEqual(cache.get("c"), "C")
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_capacity_evicts_lru_live_entry(self):
        cache = TTLCache(2, 100, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("c", "C")
        with self.assertRaises(KeyError):
            cache.get("a")
        self.assertEqual(cache.get("b"), "B")
        self.assertEqual(cache.get("c"), "C")

    def test_invalid_max_size_raises_value_error(self):
        with self.assertRaises(ValueError):
            TTLCache(0, 10, self.clock)
        with self.assertRaises(ValueError):
            TTLCache(-1, 10, self.clock)

    def test_invalid_ttl_raises_value_error(self):
        with self.assertRaises(ValueError):
            TTLCache(2, 0, self.clock)
        with self.assertRaises(ValueError):
            TTLCache(2, -5, self.clock)


if __name__ == "__main__":
    unittest.main()

