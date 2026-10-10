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


class RegressionTests(unittest.TestCase):
    def setUp(self):
        self.clock = Clock()

    # --- falsy values -----------------------------------------------------

    def test_falsy_values_are_returned(self):
        cache = TTLCache(10, 10, self.clock)
        falsy = {"zero": 0, "false": False, "none": None, "empty": "",
                 "list": [], "float": 0.0}
        for key, value in falsy.items():
            cache.put(key, value)
        for key, value in falsy.items():
            got = cache.get(key)
            self.assertEqual(got, value)
            self.assertIs(type(got), type(value))

    def test_falsy_value_still_expires(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", 0)
        self.clock.now += 10
        with self.assertRaises(KeyError):
            cache.get("a")

    # --- missing / expired ------------------------------------------------

    def test_missing_key_raises_keyerror(self):
        cache = TTLCache(2, 10, self.clock)
        with self.assertRaises(KeyError):
            cache.get("nope")

    def test_alive_just_before_boundary(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 9.999
        self.assertEqual(cache.get("a"), "A")

    def test_expired_after_boundary(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 10.001
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_expired_get_removes_entry(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 10
        with self.assertRaises(KeyError):
            cache.get("a")
        self.assertEqual(len(cache), 0)

    # --- injected clock ---------------------------------------------------

    def test_put_uses_injected_clock_not_wall_time(self):
        # The old code stamped entries with time.time(), which is ~1.7e9,
        # so with a fake clock near 100 nothing ever looked expired.
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 50
        with self.assertRaises(KeyError):
            cache.get("a")

    # --- TTL is not refreshed by get -------------------------------------

    def test_get_does_not_refresh_ttl(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 6
        self.assertEqual(cache.get("a"), "A")
        self.clock.now += 4  # age is now 10 from the original put
        with self.assertRaises(KeyError):
            cache.get("a")

    # --- put on existing key ----------------------------------------------

    def test_put_existing_updates_value(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A1")
        cache.put("a", "A2")
        self.assertEqual(cache.get("a"), "A2")
        self.assertEqual(len(cache), 1)

    def test_put_existing_refreshes_timestamp(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A1")
        self.clock.now += 8
        cache.put("a", "A2")
        self.clock.now += 8  # 16 since first put, 8 since second
        self.assertEqual(cache.get("a"), "A2")
        self.clock.now += 2  # 10 since second put
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_put_existing_refreshes_recency(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("a", "A2")  # a is now most recent
        cache.put("c", "C")   # must evict b, not a
        self.assertEqual(cache.get("a"), "A2")
        self.assertEqual(cache.get("c"), "C")
        with self.assertRaises(KeyError):
            cache.get("b")

    def test_put_existing_at_capacity_does_not_evict_others(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("b", "B2")  # full cache, but key already present
        self.assertEqual(len(cache), 2)
        self.assertEqual(cache.get("a"), "A")
        self.assertEqual(cache.get("b"), "B2")

    # --- capacity and eviction --------------------------------------------

    def test_capacity_evicts_least_recently_used(self):
        cache = TTLCache(3, 10, self.clock)
        cache.put("a", 1)
        cache.put("b", 2)
        cache.put("c", 3)
        cache.put("d", 4)
        self.assertEqual(len(cache), 3)
        with self.assertRaises(KeyError):
            cache.get("a")
        self.assertEqual([cache.get(k) for k in "bcd"], [2, 3, 4])

    def test_get_refresh_changes_eviction_victim(self):
        cache = TTLCache(3, 10, self.clock)
        cache.put("a", 1)
        cache.put("b", 2)
        cache.put("c", 3)
        cache.get("a")
        cache.get("b")
        cache.put("d", 4)  # c is now the LRU
        with self.assertRaises(KeyError):
            cache.get("c")
        self.assertEqual(cache.get("a"), 1)
        self.assertEqual(cache.get("b"), 2)
        self.assertEqual(cache.get("d"), 4)

    def test_expired_entries_removed_before_capacity_eviction(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")           # t=100, will expire
        self.clock.now += 5
        cache.put("b", "B")           # t=105, live afterwards
        cache.get("a")                # a is now MRU but still older in time
        self.clock.now += 5           # t=110: a expired (age 10), b live (age 5)
        cache.put("c", "C")           # room exists once a is purged
        self.assertEqual(cache.get("b"), "B")  # b must NOT have been evicted
        self.assertEqual(cache.get("c"), "C")
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_expired_lru_purged_even_when_not_first_in_order(self):
        cache = TTLCache(3, 10, self.clock)
        cache.put("a", 1)             # t=100
        self.clock.now += 3
        cache.put("b", 2)             # t=103
        self.clock.now += 3
        cache.put("c", 3)             # t=106
        cache.get("a")                # order: b, c, a
        self.clock.now += 4           # t=110: a expired, b (7) and c (4) live
        cache.put("d", 4)
        self.assertEqual(len(cache), 3)
        self.assertEqual(cache.get("b"), 2)
        self.assertEqual(cache.get("c"), 3)
        self.assertEqual(cache.get("d"), 4)

    def test_eviction_removes_lru_live_entry_when_none_expired(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 1
        cache.put("b", "B")
        self.clock.now += 1
        cache.put("c", "C")
        with self.assertRaises(KeyError):
            cache.get("a")
        self.assertEqual(cache.get("b"), "B")
        self.assertEqual(cache.get("c"), "C")

    def test_max_size_one(self):
        cache = TTLCache(1, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        self.assertEqual(len(cache), 1)
        with self.assertRaises(KeyError):
            cache.get("a")
        self.assertEqual(cache.get("b"), "B")

    # --- constructor validation -------------------------------------------

    def test_invalid_max_size(self):
        for bad in (0, -1, -100):
            with self.assertRaises(ValueError):
                TTLCache(bad, 10, self.clock)

    def test_invalid_ttl(self):
        for bad in (0, -1, -0.5):
            with self.assertRaises(ValueError):
                TTLCache(2, bad, self.clock)

    def test_minimal_valid_arguments(self):
        cache = TTLCache(1, 0.001, self.clock)
        cache.put("a", "A")
        self.assertEqual(cache.get("a"), "A")

    def test_default_clock_is_usable(self):
        cache = TTLCache(2, 60)
        cache.put("a", 0)
        self.assertEqual(cache.get("a"), 0)


if __name__ == "__main__":
    unittest.main()
