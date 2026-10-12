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
        cache = TTLCache(5, 10, self.clock)
        cache.put("zero", 0)
        cache.put("false", False)
        cache.put("none", None)
        cache.put("empty", "")
        cache.put("list", [])
        self.assertEqual(cache.get("zero"), 0)
        self.assertIs(cache.get("false"), False)
        self.assertIsNone(cache.get("none"))
        self.assertEqual(cache.get("empty"), "")
        self.assertEqual(cache.get("list"), [])

    def test_missing_key_raises_key_error(self):
        cache = TTLCache(2, 10, self.clock)
        with self.assertRaises(KeyError):
            cache.get("nope")

    def test_expired_entry_is_removed(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.assertEqual(len(cache), 1)
        self.clock.now += 9
        self.assertEqual(cache.get("a"), "A")
        self.clock.now += 1
        with self.assertRaises(KeyError):
            cache.get("a")
        self.assertEqual(len(cache), 0)

    def test_get_does_not_refresh_ttl(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 5
        self.assertEqual(cache.get("a"), "A")
        self.clock.now += 5
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_ttl_uses_injected_clock(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now = 105.0
        self.assertEqual(cache.get("a"), "A")
        self.clock.now = 109.999
        self.assertEqual(cache.get("a"), "A")
        self.clock.now = 110.0
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_put_updates_existing_key(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 5
        cache.put("a", "A2")
        self.assertEqual(cache.get("a"), "A2")
        self.assertEqual(len(cache), 1)
        self.clock.now += 5
        self.assertEqual(cache.get("a"), "A2")

    def test_put_updates_recency(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("a", "A2")
        cache.put("c", "C")
        self.assertEqual(cache.get("a"), "A2")
        with self.assertRaises(KeyError):
            cache.get("b")

    def test_expired_entries_removed_before_eviction(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        self.clock.now += 10
        cache.put("c", "C")
        self.assertEqual(cache.get("c"), "C")
        self.assertEqual(len(cache), 1)

    def test_all_expired_entries_do_not_evict_new_put(self):
        cache = TTLCache(3, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("c", "C")
        self.clock.now += 20
        cache.put("d", "D")
        self.assertEqual(cache.get("d"), "D")
        self.assertEqual(len(cache), 1)

    def test_evicts_lru_live_entry(self):
        cache = TTLCache(3, 100, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("c", "C")
        cache.get("a")
        cache.put("d", "D")
        self.assertEqual(cache.get("a"), "A")
        self.assertEqual(cache.get("d"), "D")
        self.assertEqual(len(cache), 3)
        with self.assertRaises(KeyError):
            cache.get("b")

    def test_len_reports_stored_entries(self):
        cache = TTLCache(2, 10, self.clock)
        self.assertEqual(len(cache), 0)
        cache.put("a", "A")
        cache.put("b", "B")
        self.assertEqual(len(cache), 2)

    def test_invalid_max_size_raises_value_error(self):
        with self.assertRaises(ValueError):
            TTLCache(0, 10, self.clock)
        with self.assertRaises(ValueError):
            TTLCache(-1, 10, self.clock)

    def test_invalid_ttl_seconds_raises_value_error(self):
        with self.assertRaises(ValueError):
            TTLCache(1, 0, self.clock)
        with self.assertRaises(ValueError):
            TTLCache(1, -5, self.clock)


if __name__ == "__main__":
    unittest.main()

