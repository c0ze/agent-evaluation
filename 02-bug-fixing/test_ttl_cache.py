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


class FalsyValueTests(unittest.TestCase):
    """get() used to treat any falsy stored value as a miss."""

    def setUp(self):
        self.clock = Clock()

    def test_falsy_values_are_returned(self):
        for value in (0, False, None, "", [], {}, 0.0):
            with self.subTest(value=value):
                cache = TTLCache(2, 10, self.clock)
                cache.put("k", value)
                result = cache.get("k")
                self.assertEqual(result, value)
                self.assertIs(type(result), type(value))

    def test_none_is_distinguished_from_missing(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("k", None)
        self.assertIsNone(cache.get("k"))
        with self.assertRaises(KeyError):
            cache.get("other")

    def test_falsy_key_round_trips(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put(0, "zero")
        cache.put("", "empty")
        self.assertEqual(cache.get(0), "zero")
        self.assertEqual(cache.get(""), "empty")


class TTLTests(unittest.TestCase):
    """put() used to stamp entries with time.time() instead of the clock, and
    get() used to expire at age > ttl rather than age >= ttl."""

    def setUp(self):
        self.clock = Clock()

    def test_missing_key_raises(self):
        cache = TTLCache(2, 10, self.clock)
        with self.assertRaises(KeyError):
            cache.get("nope")

    def test_live_just_before_boundary(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 9.999
        self.assertEqual(cache.get("a"), "A")

    def test_expired_past_boundary(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 10.001
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_uses_injected_clock_not_wall_clock(self):
        # The fake clock reads 100.0, nowhere near the wall clock, so a
        # timestamp taken from time.time() makes the age hugely negative and
        # the entry would never expire.
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.assertEqual(cache._items["a"][1], 100.0)
        self.clock.now += 1_000_000
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_clock_is_read_per_call(self):
        # A clock near zero also shows time.time() is not involved.
        self.clock.now = 0.0
        cache = TTLCache(2, 5, self.clock)
        cache.put("a", "A")
        self.clock.now = 4.0
        self.assertEqual(cache.get("a"), "A")
        self.clock.now = 5.0
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_fractional_ttl(self):
        cache = TTLCache(2, 0.5, self.clock)
        cache.put("a", "A")
        self.clock.now += 0.25
        self.assertEqual(cache.get("a"), "A")
        self.clock.now += 0.25
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_get_does_not_refresh_ttl(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        for _ in range(9):
            self.clock.now += 1
            self.assertEqual(cache.get("a"), "A")
        self.clock.now += 1
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_expired_get_keeps_raising_and_drops_entry(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 10
        with self.assertRaises(KeyError):
            cache.get("a")
        with self.assertRaises(KeyError):
            cache.get("a")
        self.assertNotIn("a", cache._items)

    def test_expired_get_does_not_refresh_recency(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 5
        cache.put("b", "B")
        self.clock.now += 5
        with self.assertRaises(KeyError):
            cache.get("a")
        cache.put("c", "C")
        cache.put("d", "D")
        with self.assertRaises(KeyError):
            cache.get("b")
        self.assertEqual(cache.get("c"), "C")
        self.assertEqual(cache.get("d"), "D")

    def test_key_error_carries_the_key(self):
        cache = TTLCache(2, 10, self.clock)
        with self.assertRaises(KeyError) as missing:
            cache.get("gone")
        self.assertEqual(missing.exception.args, ("gone",))
        cache.put("old", "x")
        self.clock.now += 10
        with self.assertRaises(KeyError) as expired:
            cache.get("old")
        self.assertEqual(expired.exception.args, ("old",))


class PutUpdateTests(unittest.TestCase):
    """put() on an existing key used to evict an unrelated entry when the cache
    was full, and left the key at its old recency position."""

    def setUp(self):
        self.clock = Clock()

    def test_update_replaces_value(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A1")
        cache.put("a", "A2")
        self.assertEqual(cache.get("a"), "A2")
        self.assertEqual(len(cache), 1)

    def test_update_at_capacity_evicts_nothing(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("b", "B2")
        self.assertEqual(len(cache), 2)
        self.assertEqual(cache.get("a"), "A")
        self.assertEqual(cache.get("b"), "B2")

    def test_update_of_lru_key_at_capacity_evicts_nothing(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("a", "A2")
        self.assertEqual(len(cache), 2)
        self.assertEqual(cache.get("a"), "A2")
        self.assertEqual(cache.get("b"), "B")

    def test_update_refreshes_recency(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("a", "A2")
        cache.put("c", "C")
        with self.assertRaises(KeyError):
            cache.get("b")
        self.assertEqual(cache.get("a"), "A2")
        self.assertEqual(cache.get("c"), "C")

    def test_update_refreshes_timestamp(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 6
        cache.put("a", "A2")
        self.clock.now += 6
        self.assertEqual(cache.get("a"), "A2")
        self.clock.now += 4
        with self.assertRaises(KeyError):
            cache.get("a")

    def test_put_revives_expired_key(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 10
        cache.put("a", "A2")
        self.assertEqual(cache.get("a"), "A2")
        self.assertEqual(len(cache), 1)
        self.clock.now += 9
        self.assertEqual(cache.get("a"), "A2")

    def test_single_slot_update(self):
        cache = TTLCache(1, 10, self.clock)
        cache.put("a", "A")
        cache.put("a", "A2")
        self.assertEqual(cache.get("a"), "A2")
        self.assertEqual(len(cache), 1)


class EvictionTests(unittest.TestCase):
    """put() used to evict whenever the cache was full, without first dropping
    expired entries, so a live entry could be lost while a dead one stayed."""

    def setUp(self):
        self.clock = Clock()

    def test_evicts_least_recently_used(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.put("c", "C")
        with self.assertRaises(KeyError):
            cache.get("a")
        self.assertEqual(cache.get("b"), "B")
        self.assertEqual(cache.get("c"), "C")
        self.assertEqual(len(cache), 2)

    def test_get_then_put_keeps_the_read_entry(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        cache.get("a")
        cache.put("c", "C")
        self.assertEqual(cache.get("a"), "A")
        self.assertEqual(cache.get("c"), "C")

    def test_eviction_order_follows_access_sequence(self):
        cache = TTLCache(3, 10, self.clock)
        for key in "abc":
            cache.put(key, key.upper())
        cache.get("a")
        cache.get("b")
        cache.put("d", "D")  # evicts c
        cache.put("e", "E")  # evicts a
        for gone in "ca":
            with self.assertRaises(KeyError):
                cache.get(gone)
        for key in "bde":
            self.assertEqual(cache.get(key), key.upper())

    def test_expired_entry_is_removed_before_live_lru(self):
        # "a" is the least recently used but still live; "b" is newer in
        # recency but expired. The slot must come from "b".
        cache = TTLCache(2, 10, self.clock)
        cache.put("b", "B")
        self.clock.now += 6
        cache.put("a", "A")
        cache.get("b")  # b is now most recently used
        self.clock.now += 4  # b is 10 old (expired), a is 4 old
        cache.put("c", "C")
        self.assertEqual(cache.get("a"), "A")
        self.assertEqual(cache.get("c"), "C")
        with self.assertRaises(KeyError):
            cache.get("b")
        self.assertEqual(len(cache), 2)

    def test_all_expired_entries_are_purged_on_put(self):
        cache = TTLCache(3, 10, self.clock)
        for key in "abc":
            cache.put(key, key)
        self.clock.now += 10
        cache.put("d", "D")
        self.assertEqual(list(cache._items), ["d"])
        self.assertEqual(len(cache), 1)

    def test_purge_runs_below_capacity_too(self):
        cache = TTLCache(5, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 10
        cache.put("b", "B")
        self.assertEqual(list(cache._items), ["b"])

    def test_update_does_not_spare_other_expired_entries(self):
        cache = TTLCache(2, 10, self.clock)
        cache.put("a", "A")
        self.clock.now += 5
        cache.put("b", "B")
        self.clock.now += 5
        cache.put("b", "B2")
        self.assertEqual(list(cache._items), ["b"])

    def test_single_slot_cache(self):
        cache = TTLCache(1, 10, self.clock)
        cache.put("a", "A")
        cache.put("b", "B")
        with self.assertRaises(KeyError):
            cache.get("a")
        self.assertEqual(cache.get("b"), "B")
        self.assertEqual(len(cache), 1)

    def test_never_exceeds_max_size(self):
        cache = TTLCache(3, 10, self.clock)
        for i in range(50):
            cache.put(i, i)
            self.assertLessEqual(len(cache), 3)
        self.assertEqual(list(cache._items), [47, 48, 49])

    def test_len_counts_only_live_entries(self):
        cache = TTLCache(3, 10, self.clock)
        self.assertEqual(len(cache), 0)
        cache.put("a", "A")
        self.clock.now += 5
        cache.put("b", "B")
        self.assertEqual(len(cache), 2)
        self.clock.now += 5
        self.assertEqual(len(cache), 1)
        self.clock.now += 5
        self.assertEqual(len(cache), 0)


class ValidationTests(unittest.TestCase):
    """The constructor used to accept any max_size and ttl_seconds."""

    def test_rejects_max_size_below_one(self):
        for max_size in (0, -1, -100, 0.5, float("nan")):
            with self.subTest(max_size=max_size):
                with self.assertRaises(ValueError):
                    TTLCache(max_size, 10)

    def test_rejects_non_positive_ttl(self):
        for ttl in (0, 0.0, -1, -0.001, float("nan")):
            with self.subTest(ttl=ttl):
                with self.assertRaises(ValueError):
                    TTLCache(2, ttl)

    def test_accepts_smallest_valid_arguments(self):
        cache = TTLCache(1, 0.001)
        self.assertEqual(cache.max_size, 1)
        self.assertEqual(cache.ttl_seconds, 0.001)

    def test_public_attributes_and_default_clock(self):
        import time

        cache = TTLCache(4, 30)
        self.assertEqual(cache.max_size, 4)
        self.assertEqual(cache.ttl_seconds, 30)
        self.assertIs(cache.clock, time.monotonic)
        cache.put("a", 0)
        self.assertEqual(cache.get("a"), 0)
        self.assertEqual(len(cache), 1)


if __name__ == "__main__":
    unittest.main()
