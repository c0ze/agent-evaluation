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

    # --- regression tests for the additional bugs in the original code ---

    def test_get_returns_falsy_zero(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("zero", 0)
        self.assertEqual(cache.get("zero"), 0)

    def test_get_returns_falsy_false(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("flag", False)
        self.assertEqual(cache.get("flag"), False)

    def test_get_returns_none(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("nothing", None)
        self.assertIsNone(cache.get("nothing"))

    def test_put_uses_injected_clock(self):
        # If put used time.time() instead of the injected clock, advancing the
        # mock clock would have no effect on the recorded timestamp.
        cache = TTLCache(2, 100, self.clock)
        self.clock.now = 1000.0
        cache.put("k", "v")
        # Advance only 10s; entry should still be live.
        self.clock.now = 1010.0
        self.assertEqual(cache.get("k"), "v")
        # Advance to the boundary; entry should now be expired.
        self.clock.now = 1100.0
        with self.assertRaises(KeyError):
            cache.get("k")

    def test_get_does_not_refresh_ttl(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now = 105.0
        # Successful get should not extend the TTL.
        self.assertEqual(cache.get("a"), "A")
        self.clock.now = 110.0
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_put_updates_existing_key_value_and_recency(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A1")
        cache.put("b", "B")
        # Updating "a" must refresh its recency so it survives a later insert.
        self.clock.now = 105.0
        cache.put("a", "A2")
        cache.put("c", "C")
        self.assertEqual(cache.get("a"), "A2")
        with self.assertRaises(KeyError):
            cache.get("b")

    def test_put_purges_expired_before_evicting(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now = 100.0  # advance so "a" expires but keep going
        # Advance far enough that "a" is dead, then insert "b" and "c".
        cache.put("b", "B")
        cache.put("c", "C")
        # "a" should have been purged; "b" and "c" should be live.
        with self.assertRaises(KeyError):
            cache.get("a")
        self.assertEqual(cache.get("b"), "B")
        self.assertEqual(cache.get("c"), "C")

    def test_capacity_eviction_drops_lru(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("c", "C")  # forces eviction of "a"
        with self.assertRaises(KeyError):
            cache.get("a")
        self.assertEqual(cache.get("b"), "B")
        self.assertEqual(cache.get("c"), "C")

    def test_invalid_max_size(self):
        with self.assertRaises(ValueError):
            TTLCache(0, 10)
        with self.assertRaises(ValueError):
            TTLCache(-1, 10)

    def test_invalid_ttl(self):
        with self.assertRaises(ValueError):
            TTLCache(2, 0)
        with self.assertRaises(ValueError):
            TTLCache(2, -1)

    def test_get_missing_key(self):
        cache = TTLCache(2, 10, self.clock)
        with self.assertRaises(KeyError):
            cache.get("missing")

    def test_expired_get_removes_entry(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now = 110.0
        with self.assertRaises(KeyError):
            cache.get("a")
        # The expired entry should have been evicted.
        self.assertEqual(len(cache), 0)
        # And it must not occupy capacity.
        cache.put("b", "B")
        cache.put("c", "C")
        self.assertEqual(len(cache), 2)


if __name__ == "__main__":
    unittest.main()