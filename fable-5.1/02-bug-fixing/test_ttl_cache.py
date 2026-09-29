import unittest
from unittest import mock

import ttl_cache
from ttl_cache import TTLCache


class Clock:
    def __init__(self):
        self.now = 100.0

    def __call__(self):
        return self.now


class TTLCacheTests(unittest.TestCase):
    def setUp(self):
        self.clock = Clock()

    # --- original tests -------------------------------------------------

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

    # --- regression: falsy values and missing keys ----------------------

    def test_falsy_values_are_returned(self):
        cache = TTLCache(10, 10, self.clock)
        falsy = {"zero": 0, "false": False, "none": None, "empty": "", "list": []}
        for key, value in falsy.items():
            cache.put(key, value)
        for key, value in falsy.items():
            with self.subTest(key=key):
                self.assertEqual(cache.get(key), value)
        self.assertIs(cache.get("false"), False)
        self.assertIsNone(cache.get("none"))

    def test_missing_key_raises_key_error(self):
        cache = TTLCache(2, 10, self.clock)
        with self.assertRaises(KeyError):
            cache.get("missing")

    # --- regression: TTL uses the injected clock only -------------------

    def test_uses_injected_clock_not_wall_clock(self):
        class NoTimeModule:
            @staticmethod
            def time():
                raise AssertionError("time.time() must not be used")

            @staticmethod
            def monotonic():
                raise AssertionError("time.monotonic() must not be used when a clock is injected")

        cache = TTLCache(2, 10, self.clock)
        with mock.patch.object(ttl_cache, "time", NoTimeModule):
            cache.put("a", "A")
            self.clock.now += 9
            self.assertEqual(cache.get("a"), "A")
            self.clock.now += 1
            with self.assertRaises(KeyError):
                cache.get("a")
            self.assertEqual(len(cache), 0)

    def test_live_just_before_ttl(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 9.999
        self.assertEqual(cache.get("a"), "A")

    def test_fractional_ttl(self):
        cache = TTLCache(2, 0.5, self.clock)
        cache.put("a", "A")
        self.clock.now += 0.25
        self.assertEqual(cache.get("a"), "A")
        self.clock.now += 0.25
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_expired_get_purges_entry(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 10
        with self.assertRaises(KeyError):
            cache.get("a")
        self.assertEqual(len(cache), 0)
        self.assertNotIn("a", cache._items)

    # --- regression: get refreshes recency, not TTL ---------------------

    def test_get_does_not_refresh_ttl(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 6
        self.assertEqual(cache.get("a"), "A")
        self.clock.now += 4  # age is 10 since put, only 4 since the last get
        with self.assertRaises(KeyError):
            cache.get("a")

    # --- regression: put on an existing key -----------------------------

    def test_put_updates_value(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", 1)
        cache.put("a", 2)
        self.assertEqual(cache.get("a"), 2)
        self.assertEqual(len(cache), 1)

    def test_put_refreshes_ttl(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A1")
        self.clock.now += 6
        cache.put("a", "A2")
        self.clock.now += 6  # 12s since first put, 6s since the update
        self.assertEqual(cache.get("a"), "A2")
        self.clock.now += 4  # 10s since the update
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_put_refreshes_lru(self):
        # Cache is not full when "a" is updated, so only recency is at play:
        # the original code left "a" in its old (LRU) slot in this case.
        cache = TTLCache(3, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("a", "A2")  # "a" becomes most recently used
        cache.put("c", "C")
        cache.put("d", "D")  # evicts "b", the least recently used
        self.assertEqual(cache.get("a"), "A2")
        self.assertEqual(cache.get("c"), "C")
        self.assertEqual(cache.get("d"), "D")
        with self.assertRaises(KeyError):
            cache.get("b")

    def test_put_existing_key_when_full_does_not_evict(self):
        # Update the most recently used key: the original code evicted the
        # unrelated LRU entry "a" to make room for a key that already had a slot.
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("b", "B2")
        self.assertEqual(len(cache), 2)
        self.assertEqual(cache.get("a"), "A")
        self.assertEqual(cache.get("b"), "B2")
        # And the same when the updated key is the LRU one.
        cache.put("a", "A2")
        self.assertEqual(len(cache), 2)
        self.assertEqual(cache.get("a"), "A2")
        self.assertEqual(cache.get("b"), "B2")

    def test_put_on_expired_key_reinserts(self):
        cache = TTLCache(1, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 10
        cache.put("a", "A2")
        self.assertEqual(cache.get("a"), "A2")
        self.assertEqual(len(cache), 1)

    # --- regression: expired entries are removed before capacity ---------

    def test_expired_entries_removed_before_capacity_enforced(self):
        cache = TTLCache(2, 10, self.clock)
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

    def test_expired_mru_entry_is_purged_instead_of_evicting_live_lru(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")  # stored at t=100
        cache.put("b", "B")  # stored at t=100
        self.clock.now += 5
        cache.put("b", "B2")  # "b" stored at t=105
        cache.get("a")  # "a" is now most recently used but still stamped t=100
        self.clock.now += 5  # t=110: "a" expired (age 10), "b" live (age 5)
        cache.put("c", "C")
        # The live LRU entry "b" must survive; the expired MRU entry "a" goes.
        self.assertEqual(cache.get("b"), "B2")
        self.assertEqual(cache.get("c"), "C")
        with self.assertRaises(KeyError):
            cache.get("a")
        self.assertEqual(len(cache), 2)

    # --- regression: capacity eviction is LRU ---------------------------

    def test_capacity_evicts_least_recently_used(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("c", "C")
        with self.assertRaises(KeyError):
            cache.get("a")
        self.assertEqual(cache.get("b"), "B")
        self.assertEqual(cache.get("c"), "C")
        self.assertEqual(len(cache), 2)

    def test_capacity_one(self):
        cache = TTLCache(1, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        self.assertEqual(len(cache), 1)
        self.assertEqual(cache.get("b"), "B")
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_len_never_exceeds_max_size(self):
        cache = TTLCache(3, 10, self.clock)
        for i in range(20):
            cache.put(i, i)
            self.assertLessEqual(len(cache), 3)
        self.assertEqual(sorted(cache._items), [17, 18, 19])

    # --- regression: len excludes expired entries -----------------------

    def test_len_excludes_expired(self):
        cache = TTLCache(3, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 5
        cache.put("b", "B")
        self.assertEqual(len(cache), 2)
        self.clock.now += 5  # "a" expired, "b" live
        self.assertEqual(len(cache), 1)
        self.clock.now += 5  # both expired
        self.assertEqual(len(cache), 0)

    # --- regression: constructor validation -----------------------------

    def test_invalid_max_size_raises(self):
        for bad in (0, -1):
            with self.subTest(max_size=bad):
                with self.assertRaises(ValueError):
                    TTLCache(bad, 10, self.clock)

    def test_invalid_ttl_raises(self):
        for bad in (0, -1, -0.5):
            with self.subTest(ttl_seconds=bad):
                with self.assertRaises(ValueError):
                    TTLCache(2, bad, self.clock)

    def test_valid_boundaries_accepted(self):
        TTLCache(1, 0.001, self.clock)
        TTLCache(1, 1, self.clock)

    def test_default_clock_round_trip(self):
        cache = TTLCache(2, 60)
        cache.put("a", "A")
        self.assertEqual(cache.get("a"), "A")


if __name__ == "__main__":
    unittest.main()
