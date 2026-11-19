import time
import unittest

from ttl_cache import TTLCache


class Clock:
    def __init__(self, start=100.0):
        self.now = start

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
        self.assertEqual(cache.get("a"), "A")
        self.assertEqual(cache.get("c"), "C")

    def test_falsy_values_are_returned(self):
        cache = TTLCache(6, 10, self.clock)
        cache.put("zero", 0)
        cache.put("false", False)
        cache.put("none", None)
        cache.put("empty_str", "")
        cache.put("empty_list", [])
        cache.put("empty_dict", {})

        self.assertEqual(cache.get("zero"), 0)
        self.assertIs(cache.get("false"), False)
        self.assertIsNone(cache.get("none"))
        self.assertEqual(cache.get("empty_str"), "")
        self.assertEqual(cache.get("empty_list"), [])
        self.assertEqual(cache.get("empty_dict"), {})

    def test_missing_key_raises_key_error(self):
        cache = TTLCache(2, 10, self.clock)
        with self.assertRaises(KeyError):
            cache.get("missing")

    def test_live_before_ttl_and_expires_at_and_after_ttl(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 9.999
        self.assertEqual(cache.get("a"), "A")
        self.clock.now += 0.001
        with self.assertRaises(KeyError):
            cache.get("a")
        self.assertEqual(len(cache), 0)

    def test_uses_injected_clock_and_defaults_to_monotonic(self):
        default_cache = TTLCache(2, 10)
        self.assertIs(default_cache.clock, time.monotonic)

        zero_clock = Clock(start=0.0)
        cache = TTLCache(2, 5, zero_clock)
        cache.put("k", "v")
        zero_clock.now = 4.5
        self.assertEqual(cache.get("k"), "v")
        zero_clock.now = 5.0
        with self.assertRaises(KeyError):
            cache.get("k")

    def test_get_does_not_refresh_ttl(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 8
        self.assertEqual(cache.get("a"), "A")
        self.clock.now += 2
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_put_existing_key_at_capacity_does_not_evict(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("b", "B2")
        self.assertEqual(len(cache), 2)
        self.assertEqual(cache.get("a"), "A")
        self.assertEqual(cache.get("b"), "B2")

    def test_put_existing_key_refreshes_recency(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A1")
        cache.put("b", "B1")
        cache.put("a", "A2")
        cache.put("c", "C1")
        with self.assertRaises(KeyError):
            cache.get("b")
        self.assertEqual(cache.get("a"), "A2")
        self.assertEqual(cache.get("c"), "C1")

    def test_put_existing_key_refreshes_ttl(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A1")
        self.clock.now += 6
        cache.put("a", "A2")
        self.clock.now += 5  # t=111: past original expiry (110), before new (116)
        self.assertEqual(cache.get("a"), "A2")
        self.clock.now += 5  # t=116: exact new expiry boundary
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_expired_entries_removed_before_capacity_eviction(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")  # expires at 110
        self.clock.now += 5
        cache.put("b", "B")  # expires at 115
        self.clock.now += 3
        self.assertEqual(cache.get("a"), "A")  # "a" becomes MRU; "b" is LRU
        self.clock.now += 2  # t=110: "a" is expired, "b" is still live
        cache.put("c", "C")
        self.assertEqual(len(cache), 2)
        self.assertEqual(cache.get("b"), "B")
        self.assertEqual(cache.get("c"), "C")
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_capacity_eviction_removes_lru_live_entry(self):
        cache = TTLCache(3, 10, self.clock)
        cache.put("a", 1)
        cache.put("b", 2)
        cache.put("c", 3)
        cache.get("a")
        cache.get("b")
        cache.put("d", 4)
        with self.assertRaises(KeyError):
            cache.get("c")
        self.assertEqual(cache.get("a"), 1)
        self.assertEqual(cache.get("b"), 2)
        self.assertEqual(cache.get("d"), 4)

    def test_max_size_one(self):
        cache = TTLCache(1, 10, self.clock)
        cache.put("a", "A1")
        cache.put("a", "A2")
        self.assertEqual(cache.get("a"), "A2")
        cache.put("b", "B")
        with self.assertRaises(KeyError):
            cache.get("a")
        self.assertEqual(cache.get("b"), "B")

    def test_len_excludes_expired_entries(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 5
        cache.put("b", "B")
        self.clock.now += 5  # t=110: "a" expired, "b" live
        self.assertEqual(len(cache), 1)
        self.clock.now += 5  # t=115: both expired
        self.assertEqual(len(cache), 0)

    def test_invalid_constructor_arguments(self):
        for bad_max_size in (0, -1, -100):
            with self.subTest(max_size=bad_max_size):
                with self.assertRaises(ValueError):
                    TTLCache(bad_max_size, 10, self.clock)

        for bad_ttl in (0, 0.0, -1, -0.01, float("nan")):
            with self.subTest(ttl_seconds=bad_ttl):
                with self.assertRaises(ValueError):
                    TTLCache(2, bad_ttl, self.clock)


if __name__ == "__main__":
    unittest.main()

