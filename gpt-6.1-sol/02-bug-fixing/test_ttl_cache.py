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

    def test_falsy_values_round_trip(self):
        for value in (0, False, None, "", [], {}):
            with self.subTest(value=value):
                cache = TTLCache(1, 10, self.clock)
                cache.put("a", value)
                self.assertIs(cache.get("a"), value)

    def test_missing_key_raises_key_error(self):
        cache = TTLCache(2, 10, self.clock)
        with self.assertRaises(KeyError) as raised:
            cache.get("missing")
        self.assertEqual(raised.exception.args, ("missing",))

    def test_live_just_before_expiry(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 9.999
        self.assertEqual(cache.get("a"), "A")

    def test_expires_at_boundary(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 10
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_expires_after_boundary(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 11
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_expired_get_removes_entry(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 10
        with self.assertRaises(KeyError) as raised:
            cache.get("a")
        self.assertEqual(raised.exception.args, ("a",))
        self.assertEqual(len(cache), 0)
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
        self.assertEqual(len(cache), 2)

    def test_get_does_not_refresh_ttl(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 9
        self.assertEqual(cache.get("a"), "A")
        self.clock.now += 1
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_put_updates_value_without_evicting_another_key(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("b", "updated")
        self.assertEqual(cache.get("b"), "updated")
        self.assertEqual(cache.get("a"), "A")
        self.assertEqual(len(cache), 2)

    def test_put_refreshes_ttl(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 9
        cache.put("a", "updated")
        self.clock.now += 1
        self.assertEqual(cache.get("a"), "updated")
        self.clock.now += 9
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_put_refreshes_lru(self):
        cache = TTLCache(3, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("c", "C")
        cache.put("b", "updated")
        cache.put("d", "D")
        with self.assertRaises(KeyError):
            cache.get("a")
        cache.put("e", "E")
        with self.assertRaises(KeyError):
            cache.get("c")
        self.assertEqual(cache.get("b"), "updated")
        self.assertEqual(cache.get("d"), "D")
        self.assertEqual(cache.get("e"), "E")
        self.assertEqual(len(cache), 3)

    def test_expired_recent_entry_is_removed_before_capacity_eviction(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("old", "OLD")
        self.clock.now += 5
        cache.put("live", "LIVE")
        cache.get("old")
        self.clock.now += 5
        cache.put("new", "NEW")
        self.assertEqual(cache.get("live"), "LIVE")
        self.assertEqual(cache.get("new"), "NEW")
        with self.assertRaises(KeyError):
            cache.get("old")
        self.assertEqual(len(cache), 2)

    def test_put_removes_all_expired_entries(self):
        cache = TTLCache(3, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("c", "C")
        self.clock.now += 10
        cache.put("d", "D")
        self.assertEqual(len(cache), 1)
        self.assertEqual(cache.get("d"), "D")
        for key in ("a", "b", "c"):
            with self.subTest(key=key), self.assertRaises(KeyError):
                cache.get(key)

    def test_put_removes_expired_entries_below_capacity(self):
        cache = TTLCache(3, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 10
        cache.put("b", "B")
        self.assertEqual(len(cache), 1)
        self.assertEqual(cache.get("b"), "B")

    def test_put_replaces_expired_key(self):
        cache = TTLCache(1, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 10
        cache.put("a", "updated")
        self.assertEqual(cache.get("a"), "updated")
        self.assertEqual(len(cache), 1)
        self.clock.now += 10
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_capacity_one_evicts_previous_live_entry(self):
        cache = TTLCache(1, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        with self.assertRaises(KeyError):
            cache.get("a")
        self.assertEqual(cache.get("b"), "B")
        self.assertEqual(len(cache), 1)

    def test_invalid_max_size(self):
        for max_size in (0, -1, 0.5):
            with self.subTest(max_size=max_size), self.assertRaises(ValueError):
                TTLCache(max_size, 10, self.clock)

    def test_invalid_ttl(self):
        for ttl_seconds in (0, -1, -0.5):
            with self.subTest(ttl_seconds=ttl_seconds), self.assertRaises(ValueError):
                TTLCache(2, ttl_seconds, self.clock)


if __name__ == "__main__":
    unittest.main()
