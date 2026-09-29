# Task 02 — TTL/LRU Cache: Response

## Root causes (7 defects in original `ttl_cache.py`)

1. **Falsy values rejected:** `get` used `if not value: raise KeyError(key)`, so
   stored `0`, `False`, `None`, `""`, `[]`, `{}` raised `KeyError`.
2. **Wrong clock:** `put` stamped entries with `time.time()` while `get` compared
   against the injected monotonic `self.clock()`, so TTL was computed from two
   unrelated clocks.
3. **Off-by-one TTL:** `get` expired on `age > ttl_seconds`; spec requires
   expiry at `age >= ttl_seconds` (boundary counts as expired).
4. **No LRU refresh on `get`:** successful `get` never called
   `move_to_end`, so recency order was insert-only.
5. **`put` mishandled existing keys:** re-`put` of an existing key kept the old
   timestamp and position, and the `len >= max_size` check evicted an entry
   even when no new slot was needed.
6. **No expired-purge before eviction:** `put` evicted the LRU entry without
   first removing expired entries, so live entries could be evicted while dead
   ones occupied the cache.
7. **No argument validation:** `max_size < 1` and `ttl_seconds <= 0` were
   accepted instead of raising `ValueError`.

## Fixes (`ttl_cache.py`, public API unchanged)

- `__init__` raises `ValueError` for `max_size < 1` and `ttl_seconds <= 0`.
- `put` stamps with `self.clock()`; existing key is deleted and re-inserted
  (refreshes value, timestamp, recency) with no eviction; new keys first purge
  expired entries, then `popitem(last=False)` only if still full.
- `get` drops the truthiness check, expires on `age >= ttl_seconds`, deletes
  the expired entry before raising `KeyError`, and calls `move_to_end(key)` on
  success (refreshes recency, not TTL).

## Regression cases (`test_ttl_cache_regression.py`, 9 tests)

- Falsy values (`0`, `False`, `None`, `""`, `[]`, `{}`) round-trip via `get`.
- Missing key raises `KeyError`.
- TTL boundary: live at age 9.999, expired at age 10.
- `get` does not refresh TTL (put at t0, get at t0+9, expired at t0+10).
- `put` updates value, timestamp, and recency.
- Expired entries purged before capacity enforcement.
- Capacity eviction removes the LRU live entry.
- Re-`put` of an existing key does not evict.
- `TTLCache(0, …)`, `TTLCache(-1, …)`, `TTLCache(…, 0)`, `TTLCache(…, -5)`
  raise `ValueError`.

Supplied `test_ttl_cache.py` was left unmodified.

## Exact test result

Command: `python3 -m unittest discover -v` (in this directory)

```
test_expires_at_boundary (test_ttl_cache.TTLCacheTests.test_expires_at_boundary) ... ok
test_get_refreshes_lru (test_ttl_cache.TTLCacheTests.test_get_refreshes_lru) ... ok
test_round_trip (test_ttl_cache.TTLCacheTests.test_round_trip) ... ok
test_capacity_evicts_lru_live_entry (test_ttl_cache_regression.TTLCacheRegressionTests.test_capacity_evicts_lru_live_entry) ... ok
test_expired_removed_before_capacity (test_ttl_cache_regression.TTLCacheRegressionTests.test_expired_removed_before_capacity) ... ok
test_expires_at_boundary (test_ttl_cache_regression.TTLCacheRegressionTests.test_expires_at_boundary) ... ok
test_falsy_values_returned (test_ttl_cache_regression.TTLCacheRegressionTests.test_falsy_values_returned) ... ok
test_get_does_not_refresh_ttl (test_ttl_cache_regression.TTLCacheRegressionTests.test_get_does_not_refresh_ttl) ... ok
test_invalid_args_raise (test_ttl_cache_regression.TTLCacheRegressionTests.test_invalid_args_raise) ... ok
test_missing_key_raises (test_ttl_cache_regression.TTLCacheRegressionTests.test_missing_key_raises) ... ok
test_put_existing_key_does_not_evict (test_ttl_cache_regression.TTLCacheRegressionTests.test_put_existing_key_does_not_evict) ... ok
test_put_updates_value_timestamp_and_recency (test_ttl_cache_regression.TTLCacheRegressionTests.test_put_updates_value_timestamp_and_recency) ... ok

----------------------------------------------------------------------
Ran 12 tests in 0.000s

OK
```
