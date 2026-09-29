import unittest

from ttl_cache import TTLCache


class Clock:
    def __init__(self):
        self.now = 100.0

    def __call__(self):
        return self.now


class TTLCacheRegressionTests(unittest.TestCase):
    def setUp(self):
        self.clock = Clock()

    def test_falsy_values_returned(self):
        for falsy in (0, False, None, "", [], {}):
            cache = TTLCache(4, 10, self.clock)
            cache.put("k", falsy)
            self.assertEqual(cache.get("k"), falsy)

    def test_missing_key_raises(self):
        cache = TTLCache(2, 10, self.clock)
        with self.assertRaises(KeyError):
            cache.get("nope")

    def test_uses_injected_clock_not_wall_time(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 9.999
        self.assertEqual(cache.get("a"), "A")
        self.clock.now += 0.001  # age == ttl -> expired
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_get_does_not_refresh_ttl(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 6
        self.assertEqual(cache.get("a"), "A")  # refreshes recency only
        self.clock.now += 4  # age 10 since put -> expired despite recent get
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_put_updates_value_timestamp_and_recency(self):
        cache = TTLCache(2, 100, self.clock)
        cache.put("a", "A1")
        cache.put("b", "B")
        self.clock.now += 5
        cache.put("a", "A2")  # 'a' now most recent with fresh timestamp
        self.assertEqual(cache.get("a"), "A2")
        cache.put("c", "C")  # must evict 'b' (LRU), not updated 'a'
        with self.assertRaises(KeyError):
            cache.get("b")
        self.assertEqual(cache.get("a"), "A2")
        self.assertEqual(cache.get("c"), "C")

    def test_put_refreshes_timestamp(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A1")
        self.clock.now += 8
        cache.put("a", "A2")  # new timestamp at t=108
        self.clock.now += 8  # age 8 since update -> live
        self.assertEqual(cache.get("a"), "A2")
        self.clock.now += 2  # age 10 -> expired
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_expired_purged_before_capacity_eviction(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        self.clock.now += 10  # both expired
        cache.put("c", "C")  # purge frees room; no live eviction needed
        self.assertEqual(cache.get("c"), "C")
        with self.assertRaises(KeyError):
            cache.get("a")
        with self.assertRaises(KeyError):
            cache.get("b")

    def test_capacity_evicts_lru_live_entry(self):
        cache = TTLCache(2, 100, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("c", "C")  # evicts LRU 'a'
        with self.assertRaises(KeyError):
            cache.get("a")
        self.assertEqual(cache.get("b"), "B")
        self.assertEqual(cache.get("c"), "C")

    def test_expired_get_removes_entry(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 10
        with self.assertRaises(KeyError):
            cache.get("a")
        self.assertEqual(len(cache), 0)

    def test_invalid_args(self):
        with self.assertRaises(ValueError):
            TTLCache(0, 10, self.clock)
        with self.assertRaises(ValueError):
            TTLCache(-1, 10, self.clock)
        with self.assertRaises(ValueError):
            TTLCache(2, 0, self.clock)
        with self.assertRaises(ValueError):
            TTLCache(2, -5, self.clock)


if __name__ == "__main__":
    unittest.main()
