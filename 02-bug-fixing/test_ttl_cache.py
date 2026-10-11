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

    def test_falsy_values_returned(self):
        cache = TTLCache(5, 10, self.clock)
        test_cases = [
            ("zero", 0),
            ("false", False),
            ("none", None),
            ("empty_str", ""),
            ("empty_list", []),
            ("empty_dict", {}),
        ]
        for key, value in test_cases:
            cache.put(key, value)
            self.assertEqual(cache.get(key), value)

    def test_missing_key_raises_key_error(self):
        cache = TTLCache(2, 10, self.clock)
        with self.assertRaises(KeyError):
            cache.get("nonexistent")

    def test_invalid_parameters_raise_value_error(self):
        with self.assertRaises(ValueError):
            TTLCache(0, 10, self.clock)
        with self.assertRaises(ValueError):
            TTLCache(-1, 10, self.clock)
        with self.assertRaises(ValueError):
            TTLCache(2, 0, self.clock)
        with self.assertRaises(ValueError):
            TTLCache(2, -5, self.clock)

    def test_valid_boundary_parameters(self):
        cache = TTLCache(1, 0.001, self.clock)
        self.assertEqual(cache.max_size, 1)
        self.assertEqual(cache.ttl_seconds, 0.001)

    def test_ttl_expiration_just_before_and_at_boundary(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 9.999
        self.assertEqual(cache.get("a"), "A")
        self.clock.now += 0.001  # age == 10.0
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_get_does_not_refresh_ttl(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 5
        self.assertEqual(cache.get("a"), "A")  # accesses at t=105
        self.clock.now += 5  # now t=110, age is 10 >= 10
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_put_updates_existing_key(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        self.clock.now += 5
        # Update existing key 'a': should update value, timestamp (t=105), and recency
        cache.put("a", "A_updated")
        self.assertEqual(cache.get("a"), "A_updated")
        self.assertEqual(len(cache), 2)

        # Advance to t=112: 'b' age is 12 (expired), 'a' age is 7 (live)
        self.clock.now += 7
        cache.put("c", "C")  # 'b' should be removed as expired, 'a' remains
        self.assertEqual(cache.get("a"), "A_updated")
        self.assertEqual(cache.get("c"), "C")
        with self.assertRaises(KeyError):
            cache.get("b")

    def test_expired_entries_removed_before_capacity_enforcement(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")  # t=100
        self.clock.now += 5
        cache.put("b", "B")  # t=105
        self.clock.now += 1
        cache.get("a")       # t=106, LRU order is now [b, a]

        # Advance to t=110: 'a' age is 10 (expired), 'b' age is 5 (live)
        self.clock.now += 4
        # Adding 'c' triggers capacity check. 'a' is expired and must be removed
        # instead of evicting the least recently used live entry ('b')
        cache.put("c", "C")
        self.assertEqual(cache.get("b"), "B")
        self.assertEqual(cache.get("c"), "C")
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_capacity_eviction_removes_least_recently_used_live_entry(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")  # t=100
        self.clock.now += 1
        cache.put("b", "B")  # t=101
        self.clock.now += 1  # t=102: both live
        cache.put("c", "C")  # capacity full, 'a' is LRU live entry -> evicted
        with self.assertRaises(KeyError):
            cache.get("a")
        self.assertEqual(cache.get("b"), "B")
        self.assertEqual(cache.get("c"), "C")

    def test_put_existing_key_does_not_evict_other_keys(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("b", "B_new")
        self.assertEqual(cache.get("a"), "A")
        self.assertEqual(cache.get("b"), "B_new")
        self.assertEqual(len(cache), 2)

    def test_default_clock_instantiation(self):
        cache = TTLCache(2, 10)
        cache.put("x", 42)
        self.assertEqual(cache.get("x"), 42)


if __name__ == "__main__":
    unittest.main()

