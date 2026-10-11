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
        self.assertEqual(cache.get("a"), "A")
        self.assertEqual(cache.get("c"), "C")

    def test_get_before_boundary(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 9.999
        self.assertEqual(cache.get("a"), "A")

    def test_get_missing_key_raises_key_error(self):
        cache = TTLCache(2, 10, self.clock)
        with self.assertRaises(KeyError):
            cache.get("nonexistent")

    def test_falsy_values_returned(self):
        falsy_cases = [0, False, None, "", [], {}, ()]
        cache = TTLCache(len(falsy_cases), 10, self.clock)
        for i, val in enumerate(falsy_cases):
            cache.put(f"key_{i}", val)
        for i, val in enumerate(falsy_cases):
            self.assertEqual(cache.get(f"key_{i}"), val)

    def test_get_does_not_refresh_ttl(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 6.0
        self.assertEqual(cache.get("a"), "A")  # Recency refreshed, but TTL should NOT be refreshed
        self.clock.now += 4.0  # Total age is now 10.0 >= 10.0
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_put_updates_existing_key_value(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "initial")
        cache.put("a", "updated")
        self.assertEqual(cache.get("a"), "updated")

    def test_put_updates_existing_key_timestamp(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "v1")  # created at 100.0
        self.clock.now += 8.0  # at 108.0
        cache.put("a", "v2")  # timestamp updated to 108.0
        self.clock.now += 5.0  # at 113.0 (age from first put is 13, but age from second is 5)
        self.assertEqual(cache.get("a"), "v2")
        self.clock.now += 5.0  # at 118.0 (age from second put is 10.0 >= 10.0)
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_put_updates_existing_key_recency(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        # 'a' is LRU. Updating 'a' via put should make 'b' LRU.
        cache.put("a", "A2")
        cache.put("c", "C")
        # 'b' should be evicted, 'a' and 'c' should remain
        with self.assertRaises(KeyError):
            cache.get("b")
        self.assertEqual(cache.get("a"), "A2")
        self.assertEqual(cache.get("c"), "C")

    def test_put_existing_key_does_not_exceed_capacity(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("b", "B_new")
        self.assertEqual(len(cache), 2)
        self.assertEqual(cache.get("a"), "A")
        self.assertEqual(cache.get("b"), "B_new")

    def test_expired_entries_removed_before_enforcing_capacity(self):
        # Cache max_size=2, ttl=10
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")  # t=100
        self.clock.now += 2.0  # t=102
        cache.put("b", "B")  # t=102
        self.clock.now += 2.0  # t=104
        cache.get("a")  # 'a' recency refreshed -> order is ['b', 'a'], so 'b' is LRU
        self.clock.now += 7.0  # t=111: 'a' age is 11 >= 10 (expired), 'b' age is 9 < 10 (live)

        # Before enforcing capacity, 'a' is removed because it's expired.
        # 'b' (which is live, even though it was the LRU entry) must NOT be evicted!
        cache.put("c", "C")
        self.assertEqual(cache.get("b"), "B")
        self.assertEqual(cache.get("c"), "C")
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_capacity_eviction_removes_lru_live_entry(self):
        cache = TTLCache(3, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("c", "C")
        cache.get("a")  # order becomes b, c, a
        cache.put("d", "D")  # evicts 'b'
        with self.assertRaises(KeyError):
            cache.get("b")
        self.assertEqual(cache.get("a"), "A")
        self.assertEqual(cache.get("c"), "C")
        self.assertEqual(cache.get("d"), "D")

    def test_invalid_max_size_raises_value_error(self):
        with self.assertRaises(ValueError):
            TTLCache(0, 10, self.clock)
        with self.assertRaises(ValueError):
            TTLCache(-1, 10, self.clock)

    def test_invalid_ttl_seconds_raises_value_error(self):
        with self.assertRaises(ValueError):
            TTLCache(2, 0, self.clock)
        with self.assertRaises(ValueError):
            TTLCache(2, -5, self.clock)

    def test_default_clock_used_when_none_provided(self):
        cache = TTLCache(2, 100)
        cache.put("a", "A")
        self.assertEqual(cache.get("a"), "A")

    def test_len_behavior(self):
        cache = TTLCache(2, 10, self.clock)
        self.assertEqual(len(cache), 0)
        cache.put("a", "A")
        self.assertEqual(len(cache), 1)
        self.clock.now += 10
        self.assertEqual(len(cache), 0)


if __name__ == "__main__":
    unittest.main()

