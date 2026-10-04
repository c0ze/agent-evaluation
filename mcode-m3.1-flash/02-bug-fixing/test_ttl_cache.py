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

    # --- missing keys -----------------------------------------------------
    def test_missing_key_raises_keyerror(self):
        cache = TTLCache(2, 10, self.clock)
        with self.assertRaises(KeyError):
            cache.get("nope")

    # --- falsy values are real values, not misses -------------------------
    def test_falsy_values_round_trip(self):
        falsy = {"zero": 0, "false": False, "none": None, "empty": "", "list": []}
        cache = TTLCache(len(falsy), 10, self.clock)  # exactly fits
        for key, value in falsy.items():
            cache.put(key, value)
        self.assertEqual(len(cache), len(falsy))
        for key, value in falsy.items():
            self.assertIs(cache.get(key), value)

    def test_falsy_value_survives_past_a_live_update(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", 0)
        self.clock.now += 5
        self.assertEqual(cache.get("a"), 0)
        self.clock.now += 4
        self.assertEqual(cache.get("a"), 0)

    # --- TTL uses the injected monotonic clock ---------------------------
    def test_ttl_uses_injected_clock_not_wall_clock(self):
        # Injected clock reports a small offset value; a wall-clock based
        # implementation would compute a bogus (huge negative) age here.
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.assertEqual(cache.get("a"), "A")
        self.clock.now += 9.999
        self.assertEqual(cache.get("a"), "A")
        self.clock.now += 0.001
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_ttl_boundary_is_inclusive(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 9.999
        self.assertEqual(cache.get("a"), "A")
        self.clock.now += 0.001  # age == ttl exactly
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_expired_entry_is_not_returned_after_long_idle(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 1_000_000
        with self.assertRaises(KeyError):
            cache.get("a")

    # --- get refreshes recency, never the TTL ----------------------------
    def test_get_does_not_refresh_ttl(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 5
        self.assertEqual(cache.get("a"), "A")  # recency refreshed
        self.clock.now += 5  # total age is 10 == ttl
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_repeated_gets_do_not_extend_lifetime(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 4
        self.assertEqual(cache.get("a"), "A")
        self.clock.now += 4
        self.assertEqual(cache.get("a"), "A")
        self.clock.now += 2  # age is 10 == ttl, despite two recency refreshes
        with self.assertRaises(KeyError):
            cache.get("a")

    # --- put overwrites value, timestamp and recency ----------------------
    def test_put_updates_existing_key_value(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("a", "A2")
        self.assertEqual(cache.get("a"), "A2")
        self.assertEqual(len(cache), 1)

    def test_put_updates_existing_key_timestamp(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 5
        cache.put("a", "A2")
        self.clock.now += 6  # 6 < 10 after the rewrite, 11 since the first put
        self.assertEqual(cache.get("a"), "A2")

    def test_put_updates_existing_key_recency(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("a", "A2")  # 'a' is now the most recently used
        cache.put("c", "C")
        with self.assertRaises(KeyError):
            cache.get("b")
        self.assertEqual(cache.get("a"), "A2")
        self.assertEqual(cache.get("c"), "C")

    def test_put_on_existing_key_does_not_evict(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("a", "A2")  # must not evict anything
        self.assertEqual(len(cache), 2)
        self.assertEqual(cache.get("a"), "A2")
        self.assertEqual(cache.get("b"), "B")

    # --- capacity: purge expired first, then evict the LRU live entry -----
    def test_expired_entries_are_purged_before_capacity(self):
        cache = TTLCache(3, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        self.clock.now += 10  # both expired
        cache.put("c", "C")
        self.assertEqual(len(cache), 1)
        self.assertEqual(cache.get("c"), "C")
        with self.assertRaises(KeyError):
            cache.get("a")
        with self.assertRaises(KeyError):
            cache.get("b")

    def test_purge_frees_room_without_losing_live_entries(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 10  # 'a' expired
        cache.put("b", "B")
        cache.put("c", "C")  # 'a' is purged, so 'b' survives
        self.assertEqual(len(cache), 2)
        self.assertEqual(cache.get("b"), "B")
        self.assertEqual(cache.get("c"), "C")

    def test_capacity_evicts_least_recently_used_live_entry(self):
        cache = TTLCache(3, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("c", "C")
        cache.get("a")  # order: b, c, a
        cache.put("d", "D")
        self.assertEqual(len(cache), 3)
        with self.assertRaises(KeyError):
            cache.get("b")
        for key in ("c", "a", "d"):
            self.assertEqual(cache.get(key), key.upper())

    def test_capacity_is_never_exceeded(self):
        cache = TTLCache(1, 10, self.clock)
        for i in range(5):
            cache.put(i, i)
            self.assertLessEqual(len(cache), 1)
        self.assertEqual(cache.get(4), 4)
        with self.assertRaises(KeyError):
            cache.get(3)

    # --- constructor validation -------------------------------------------
    def test_invalid_max_size_raises_valueerror(self):
        for max_size in (0, -1, -100):
            with self.subTest(max_size=max_size):
                with self.assertRaises(ValueError):
                    TTLCache(max_size, 10, self.clock)

    def test_invalid_ttl_raises_valueerror(self):
        for ttl in (0, -0.001, -10):
            with self.subTest(ttl=ttl):
                with self.assertRaises(ValueError):
                    TTLCache(2, ttl, self.clock)

    def test_valid_boundary_arguments_are_accepted(self):
        self.assertEqual(len(TTLCache(1, 0.001, self.clock)), 0)


if __name__ == "__main__":
    unittest.main()
