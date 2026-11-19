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

    # --- basic behavior -------------------------------------------------
    def test_round_trip(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.assertEqual(cache.get("a"), "A")

    def test_missing_key_raises(self):
        cache = TTLCache(2, 10, self.clock)
        with self.assertRaises(KeyError):
            cache.get("nope")

    def test_falsy_values_are_returned(self):
        cache = TTLCache(8, 10, self.clock)
        for i, value in enumerate([0, False, None, "", [], {}, ()]):
            cache.put(("k", i), value)
            self.assertEqual(cache.get(("k", i)), value)

    # --- TTL ------------------------------------------------------------
    def test_expires_at_boundary(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 10
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_alive_just_before_boundary(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 9.999
        self.assertEqual(cache.get("a"), "A")

    def test_ttl_uses_injected_clock(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        # The fake clock starts at 100; a wall-clock timestamp would already
        # look ancient and expire the entry immediately.
        self.assertEqual(cache.get("a"), "A")

    def test_get_does_not_refresh_ttl(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 6
        self.assertEqual(cache.get("a"), "A")
        self.clock.now += 5  # total age 11 >= ttl
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_expired_get_evicts_entry(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 10
        with self.assertRaises(KeyError):
            cache.get("a")
        self.assertEqual(len(cache), 0)

    # --- LRU ------------------------------------------------------------
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

    def test_evicts_least_recently_used_live_entry(self):
        cache = TTLCache(3, 100, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("c", "C")
        cache.put("d", "D")  # evicts "a"
        with self.assertRaises(KeyError):
            cache.get("a")
        self.assertEqual(len(cache), 3)
        for key, expected in (("b", "B"), ("c", "C"), ("d", "D")):
            self.assertEqual(cache.get(key), expected)

    # --- put semantics --------------------------------------------------
    def test_put_updates_value_timestamp_and_recency(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        self.clock.now += 6
        cache.put("a", "A2")  # update: value, timestamp, recency
        self.assertEqual(cache.get("a"), "A2")

        # Timestamp was refreshed, so it is alive 4s after the original put...
        self.clock.now += 4  # t=110, age 4 since update
        self.assertEqual(cache.get("a"), "A2")
        # ...and only expires a full ttl after the update (t=116).
        self.clock.now += 6
        with self.assertRaises(KeyError):
            cache.get("a")

        # And "a" was the most recent, so "b" is the eviction victim.
        cache2 = TTLCache(2, 10, self.clock)
        cache2.put("a", "A")
        cache2.put("b", "B")
        cache2.put("a", "A2")
        cache2.put("c", "C")
        with self.assertRaises(KeyError):
            cache2.get("b")
        self.assertEqual(cache2.get("a"), "A2")
        self.assertEqual(cache2.get("c"), "C")

    def test_put_existing_key_at_capacity_does_not_evict(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("a", "A2")  # must not evict "b"
        self.assertEqual(len(cache), 2)
        self.assertEqual(cache.get("a"), "A2")
        self.assertEqual(cache.get("b"), "B")

    def test_expired_entries_purged_before_capacity(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 10  # "a" expires
        cache.put("b", "B")
        cache.put("c", "C")  # capacity 2: if "a" not purged, a live entry dies
        self.assertEqual(len(cache), 2)
        self.assertEqual(cache.get("b"), "B")
        self.assertEqual(cache.get("c"), "C")

    # --- validation -----------------------------------------------------
    def test_invalid_max_size(self):
        for bad in (0, -1):
            with self.assertRaises(ValueError):
                TTLCache(bad, 10, self.clock)

    def test_invalid_ttl(self):
        for bad in (0, -1, -0.5):
            with self.assertRaises(ValueError):
                TTLCache(2, bad, self.clock)


if __name__ == "__main__":
    unittest.main()
