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

    # --- regression: falsy values ---------------------------------------

    def test_falsy_values_are_returned(self):
        cache = TTLCache(8, 10, self.clock)
        for key, value in [("zero", 0), ("false", False), ("none", None),
                           ("empty", ""), ("emptylist", [])]:
            cache.put(key, value)
        self.assertEqual(cache.get("zero"), 0)
        self.assertIs(cache.get("false"), False)
        self.assertIsNone(cache.get("none"))
        self.assertEqual(cache.get("empty"), "")
        self.assertEqual(cache.get("emptylist"), [])

    def test_missing_key_raises_keyerror(self):
        cache = TTLCache(2, 10, self.clock)
        with self.assertRaises(KeyError):
            cache.get("missing")

    # --- regression: injected clock and TTL boundary ---------------------

    def test_ttl_uses_injected_clock(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        # wall clock is irrelevant; only the injected clock drives TTL
        self.clock.now += 9
        self.assertEqual(cache.get("a"), "A")
        self.clock.now += 1  # age == ttl
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_just_before_expiry_is_live(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 9.999
        self.assertEqual(cache.get("a"), "A")

    def test_expired_entry_removed_from_len(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 10
        with self.assertRaises(KeyError):
            cache.get("a")
        self.assertEqual(len(cache), 0)

    # --- regression: get refreshes LRU but not TTL ----------------------

    def test_get_does_not_refresh_ttl(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 7
        self.assertEqual(cache.get("a"), "A")  # refresh recency only
        self.clock.now += 3  # age still 10 from original insertion
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_get_refreshes_recency_for_eviction(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.get("a")  # a is now most recent
        cache.put("c", "C")  # must evict b, not a
        self.assertEqual(cache.get("a"), "A")
        with self.assertRaises(KeyError):
            cache.get("b")

    # --- regression: put on existing key -------------------------------

    def test_put_updates_value(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("a", "A2")
        self.assertEqual(cache.get("a"), "A2")

    def test_put_refreshes_timestamp(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 7
        cache.put("a", "A2")  # new timestamp at now+7
        self.clock.now += 7  # age 7 from the update, 14 from original
        self.assertEqual(cache.get("a"), "A2")

    def test_put_updates_recency_and_does_not_evict(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("a", "A2")  # a becomes most recent, no eviction
        self.assertEqual(len(cache), 2)
        cache.put("c", "C")  # evicts least-recently-used b
        self.assertEqual(cache.get("a"), "A2")
        with self.assertRaises(KeyError):
            cache.get("b")

    # --- regression: purge expired before capacity / LRU eviction -------

    def test_expired_removed_before_capacity(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        self.clock.now += 10  # both expired
        cache.put("c", "C")  # purge expired instead of evicting a live LRU
        self.assertEqual(cache.get("c"), "C")
        with self.assertRaises(KeyError):
            cache.get("a")
        with self.assertRaises(KeyError):
            cache.get("b")
        self.assertEqual(len(cache), 1)

    def test_eviction_removes_least_recently_used_live_entry(self):
        cache = TTLCache(3, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("c", "C")
        cache.get("a")
        cache.put("d", "D")  # b is the least recently used live entry
        with self.assertRaises(KeyError):
            cache.get("b")
        self.assertEqual(cache.get("a"), "A")
        self.assertEqual(cache.get("c"), "C")
        self.assertEqual(cache.get("d"), "D")

    def test_expired_mru_purged_without_evicting_live_lru(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")                 # ts=100
        self.clock.now += 2                 # 102
        cache.put("b", "B")                 # ts=102; order a, b
        self.clock.now += 2                 # 104
        cache.get("a")                      # refresh recency -> order b, a
        self.clock.now += 6                 # 110: a age=10 expired, b age=8 live
        # a is expired AND most-recently-used. Without purging expired first,
        # len==max_size triggers eviction of the LRU, which is the *live* b.
        cache.put("c", "C")
        with self.assertRaises(KeyError):
            cache.get("a")                  # expired entry removed
        self.assertEqual(cache.get("b"), "B")  # live LRU entry preserved
        self.assertEqual(cache.get("c"), "C")

    # --- regression: constructor validation -----------------------------

    def test_invalid_max_size(self):
        for size in (0, -1, -5):
            with self.assertRaises(ValueError):
                TTLCache(size, 10, self.clock)

    def test_invalid_ttl(self):
        for ttl in (0, -1, -0.5):
            with self.assertRaises(ValueError):
                TTLCache(2, ttl, self.clock)

    def test_valid_boundaries_accepted(self):
        TTLCache(1, 0.001, self.clock)


if __name__ == "__main__":
    unittest.main()
