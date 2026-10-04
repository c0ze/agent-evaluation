# Task 02 — Bug fixing: TTL/LRU cache

## Root causes in the original `ttl_cache.py`

1. **`put` ignored the injected clock.** Line 15 recorded timestamps with
   `time.time()` instead of `self.clock()`. Tests that advanced a mocked
   monotonic clock could not influence expiry, so the cache effectively could
   not be tested deterministically.

2. **`get` rejected falsy values.** Lines 19–20 raised `KeyError` for any
   `not value`, so `0`, `False`, `None`, and `""` could not be stored or
   retrieved even though the spec says `get` must return them.

3. **TTL boundary used `>` rather than `>=`.** Line 21 compared
   `clock() - created > ttl_seconds`. The spec is "expires at
   `age >= ttl_seconds`," so an entry whose age exactly equals `ttl_seconds`
   must be considered expired. This is what made
   `test_expires_at_boundary` fail.

4. **Successful `get` did not refresh LRU recency.** `get` never touched
   the `OrderedDict`'s order, so `test_get_refreshes_lru` could not pass:
   after `get("a")` the order stayed `[a, b]` and `put("c")` evicted `a`.

6. **Constructor did not enforce `ValueError` for `max_size < 1` or
   `ttl_seconds <= 0`.** Both were silently accepted, leaving the cache in
   a broken state (e.g. `max_size = 0` makes `put` evict whatever was just
   written).

7. **`put` did not purge expired entries before enforcing capacity.** It
   evicted the LRU even when dead entries were taking up slots, which both
   wastes work and risks evicting a live entry when an expired one should
   have been dropped first.

8. **`get` of an expired key did not remove that key.** The dead entry
   continued to occupy capacity and could shadow fresher entries on later
   inserts.

## Fixes

- `put` now uses `self.clock()` for the timestamp, so the injected clock
  drives both reads and writes.
- The TTL comparison is `age >= ttl_seconds`, matching the spec boundary.
- `get` no longer inspects the value; it only checks presence, expiry, and
  recency. Expired entries are deleted from the `OrderedDict` and a
  `KeyError` is raised. A successful `get` calls `move_to_end(key)` to
  refresh LRU recency but leaves the original timestamp untouched, so TTL
  is not extended.
- `put` first calls `_purge_expired()` so capacity enforcement runs
  against live entries only. If the key already exists, `put` updates the
  tuple in place and `move_to_end(key)` so recency is refreshed without
  evicting a different live entry.
- `__init__` validates `max_size >= 1` and `ttl_seconds > 0`, raising
  `ValueError` for violations.

The public API (`__init__`, `put`, `get`, `__len__`) is unchanged.

## Regression cases added to `test_ttl_cache.py`

- `test_get_returns_falsy_zero` — `get` returns `0`, not `KeyError`.
- `test_get_returns_falsy_false` — `get` returns `False`, not `KeyError`.
- `test_get_returns_none` — `get` returns `None`, not `KeyError`.
- `test_put_uses_injected_clock` — advancing only the mocked clock must
  drive expiry.
- `test_get_does_not_refresh_ttl` — a successful `get` must not extend
  the entry's lifetime.
- `test_put_updates_existing_key_value_and_recency` — overwriting an
  existing key must refresh its recency so a subsequent insert does not
  evict it.
- `test_put_purges_expired_before_evicting` — inserting into a full
  cache must drop dead entries before evicting a live one.
- `test_capacity_eviction_drops_lru` — LRU insertion order drives which
  live entry is evicted.
- `test_invalid_max_size` / `test_invalid_ttl` — `ValueError` is raised
  for invalid constructor arguments.
- `test_get_missing_key` — `get` raises `KeyError` for absent keys.
- `test_expired_get_removes_entry` — expired entries are evicted from
  the cache on `get` and do not occupy capacity.

## Exact test result

```
test_capacity_eviction_drops_lru (test_ttl_cache.TTLCacheTests.test_capacity_eviction_drops_lru) ... ok
test_expired_get_removes_entry (test_ttl_cache.TTLCacheTests.test_expired_get_removes_entry) ... ok
test_expires_at_boundary (test_ttl_cache.TTLCacheTests.test_expires_at_boundary) ... ok
test_get_does_not_refresh_ttl (test_ttl_cache.TTLCacheTests.test_get_does_not_refresh_ttl) ... ok
test_get_missing_key (test_ttl_cache.TTLCacheTests.test_get_missing_key) ... ok
test_get_refreshes_lru (test_ttl_cache.TTLCacheTests.test_get_refreshes_lru) ... ok
test_get_returns_falsy_false (test_ttl_cache.TTLCacheTests.test_get_returns_falsy_false) ... ok
test_get_returns_falsy_zero (test_ttl_cache.TTLCacheTests.test_get_returns_falsy_zero) ... ok
test_get_returns_none (test_ttl_cache.TTLCacheTests.test_get_returns_none) ... ok
test_invalid_max_size (test_ttl_cache.TTLCacheTests.test_invalid_max_size) ... ok
test_invalid_ttl (test_ttl_cache.TTLCacheTests.test_invalid_ttl) ... ok
test_put_purges_expired_before_evicting (test_ttl_cache.TTLCacheTests.test_put_purges_expired_before_evicting) ... ok
test_put_updates_existing_key_value_and_recency (test_ttl_cache.TTLCacheTests.test_put_updates_existing_key_value_and_recency) ... ok
test_put_uses_injected_clock (test_ttl_cache.TTLCacheTests.test_put_uses_injected_clock) ... ok
test_round_trip (test_ttl_cache.TTLCacheTests.test_round_trip) ... ok

----------------------------------------------------------------------
Ran 15 tests in 0.000s

OK
```

All 15 tests pass (3 original + 12 new regression tests).