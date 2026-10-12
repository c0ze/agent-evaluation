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
        cache = TTLCache(10, 10, self.clock)
        for value in (0, False, None, "", [], 0.0):
            cache.put("k", value)
            self.assertIs(cache.get("k"), value)

    def test_missing_key_raises_key_error(self):
        cache = TTLCache(2, 10, self.clock)
        with self.assertRaises(KeyError):
            cache.get("nope")

    def test_alive_just_before_ttl_boundary(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 9.999
        self.assertEqual(cache.get("a"), "A")

    def test_expired_entry_is_removed_on_get(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 10
        with self.assertRaises(KeyError):
            cache.get("a")
        self.assertEqual(len(cache), 0)

    def test_get_refreshes_lru_but_not_ttl(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 6
        self.assertEqual(cache.get("a"), "A")
        self.clock.now += 4
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_put_updates_existing_value_and_ttl(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 6
        cache.put("a", "A2")
        self.clock.now += 6
        self.assertEqual(cache.get("a"), "A2")

    def test_put_updates_recency_of_existing_key(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("a", "A2")
        cache.put("c", "C")
        with self.assertRaises(KeyError):
            cache.get("b")
        self.assertEqual(cache.get("a"), "A2")
        self.assertEqual(cache.get("c"), "C")

    def test_put_does_not_evict_when_updating_at_capacity(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("b", "B2")
        self.assertEqual(cache.get("a"), "A")
        self.assertEqual(cache.get("b"), "B2")
        self.assertEqual(len(cache), 2)

    def test_expired_entries_removed_before_capacity_enforcement(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 10
        cache.put("b", "B")
        cache.put("c", "C")
        with self.assertRaises(KeyError):
            cache.get("a")
        self.assertEqual(cache.get("b"), "B")
        self.assertEqual(cache.get("c"), "C")

    def test_capacity_evicts_least_recently_used_live_entry(self):
        cache = TTLCache(3, 100, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("c", "C")
        cache.get("a")
        cache.put("d", "D")
        with self.assertRaises(KeyError):
            cache.get("b")
        for key, value in (("a", "A"), ("c", "C"), ("d", "D")):
            self.assertEqual(cache.get(key), value)

    def test_uses_injected_clock_not_wall_time(self):
        clock = Clock()
        clock.now = 0.0
        cache = TTLCache(2, 10, clock)
        cache.put("a", "A")
        self.assertEqual(cache.get("a"), "A")
        clock.now = 10.0
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_invalid_max_size_raises_value_error(self):
        for max_size in (0, -1):
            with self.assertRaises(ValueError):
                TTLCache(max_size, 10, self.clock)

    def test_invalid_ttl_raises_value_error(self):
        for ttl in (0, -1, -0.5):
            with self.assertRaises(ValueError):
                TTLCache(2, ttl, self.clock)

    def test_len_counts_only_live_entries(self):
        cache = TTLCache(3, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        self.assertEqual(len(cache), 2)
        self.clock.now += 10
        cache.put("c", "C")
        self.assertEqual(len(cache), 1)


if __name__ == "__main__":
    unittest.main()

