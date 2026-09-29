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
        with self.assertRaises(KeyError) as error:
            cache.get("missing")
        self.assertEqual(error.exception.args, ("missing",))

    def test_live_just_before_expiration(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 9.999
        self.assertEqual(cache.get("a"), "A")

    def test_expires_at_boundary(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 10
        with self.assertRaises(KeyError) as error:
            cache.get("a")
        self.assertEqual(error.exception.args, ("a",))

    def test_expires_after_boundary(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 11
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

    def test_put_updates_value_and_timestamp(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "old")
        self.clock.now += 6
        cache.put("a", "new")
        self.assertEqual(len(cache), 1)
        self.clock.now += 4
        self.assertEqual(cache.get("a"), "new")
        self.clock.now += 6
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_put_existing_key_at_capacity_preserves_other_entries(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("b", "updated")
        self.assertEqual(len(cache), 2)
        self.assertEqual(cache.get("a"), "A")
        self.assertEqual(cache.get("b"), "updated")

    def test_put_refreshes_lru(self):
        cache = TTLCache(3, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("a", "updated")
        cache.put("c", "C")
        cache.put("d", "D")
        with self.assertRaises(KeyError):
            cache.get("b")
        self.assertEqual(cache.get("a"), "updated")
        self.assertEqual(cache.get("c"), "C")
        self.assertEqual(cache.get("d"), "D")

    def test_capacity_evicts_oldest_without_reads(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("c", "C")
        with self.assertRaises(KeyError):
            cache.get("a")
        self.assertEqual(cache.get("b"), "B")
        self.assertEqual(cache.get("c"), "C")

    def test_expired_mru_is_removed_before_live_lru(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("expired", "old")
        self.clock.now += 6
        cache.put("live", "keep")
        cache.get("expired")
        self.clock.now += 4
        cache.put("new", "new")
        self.assertEqual(cache.get("live"), "keep")
        self.assertEqual(cache.get("new"), "new")
        self.assertEqual(len(cache), 2)
        with self.assertRaises(KeyError):
            cache.get("expired")

    def test_put_removes_all_expired_entries_below_capacity(self):
        cache = TTLCache(4, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        self.clock.now += 10
        cache.put("c", "C")
        self.assertEqual(len(cache), 1)
        self.assertEqual(cache.get("c"), "C")
        for key in ("a", "b"):
            with self.subTest(key=key), self.assertRaises(KeyError):
                cache.get(key)

    def test_put_replaces_expired_key_with_fresh_ttl(self):
        cache = TTLCache(1, 10, self.clock)
        cache.put("a", "old")
        self.clock.now += 10
        cache.put("a", "new")
        self.clock.now += 9
        self.assertEqual(cache.get("a"), "new")
        self.assertEqual(len(cache), 1)
        self.clock.now += 1
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_single_entry_capacity(self):
        cache = TTLCache(1, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        self.assertEqual(len(cache), 1)
        with self.assertRaises(KeyError):
            cache.get("a")
        self.assertEqual(cache.get("b"), "B")

    def test_rejects_invalid_capacity(self):
        for max_size in (0, -1, -10, 0.5):
            with self.subTest(max_size=max_size), self.assertRaises(ValueError):
                TTLCache(max_size, 10, self.clock)

    def test_rejects_nonpositive_ttl(self):
        for ttl_seconds in (0, -1, -0.5):
            with self.subTest(ttl_seconds=ttl_seconds), self.assertRaises(ValueError):
                TTLCache(2, ttl_seconds, self.clock)


if __name__ == "__main__":
    unittest.main()
