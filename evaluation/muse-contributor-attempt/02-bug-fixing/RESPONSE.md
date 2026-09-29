# Task 02 — TTL/LRU cache: RESPONSE

## Root causes (7 defects in original `ttl_cache.py`)

1. **Falsy values rejected:** `get` used `if not value: raise KeyError`, so stored
   `0`, `False`, `None`, `""`, etc. raised `KeyError` instead of returning.
2. **Wrong clock:** `put` stamped entries with `time.time()` while `get` compared
   against the injected monotonic `self.clock()`, so TTL was computed from two
   unrelated clocks.
3. **Off-by-one TTL boundary:** `get` expired on `age > ttl_seconds`; required
   behavior is expiry at `age >= ttl_seconds`.
4. **No LRU refresh on `get`:** successful `get` never called `move_to_end`, so
   recency order was insert-only.
5. **`put` mishandled existing keys:** it evicted the LRU entry even when the key
   already existed, never refreshed the timestamp, and `OrderedDict.__setitem__`
   on an existing key does not move it to the most-recent end.
6. **No expired-entry purge before capacity check:** `put` evicted the LRU entry
   (possibly live) while expired entries occupied slots.
7. **No argument validation:** `max_size < 1` and `ttl_seconds <= 0` were accepted
   instead of raising `ValueError`.

## Fixes (public API unchanged: `TTLCache(max_size, ttl_seconds, clock)`, `put`, `get`, `__len__`)

- `__init__` raises `ValueError` for `max_size < 1` and `ttl_seconds <= 0`.
- `put` stamps with `self.clock()`; purges all expired entries first; if the key
  exists it is deleted then re-inserted (fresh value, timestamp, MRU position);
  otherwise evicts LRU (`popitem(last=False)`) only if still at capacity.
- `get` checks membership (`KeyError` if missing), expires on
  `now - created >= ttl_seconds` (deleting the entry, then `KeyError`), and on a
  hit calls `move_to_end(key)` without touching the timestamp (recency without
  TTL refresh).

## Regression cases (new `test_ttl_cache_regression.py`, 10 tests)

- Falsy values (`0`, `False`, `None`, `""`, `[]`, `{}`) round-trip via `get`.
- Missing key raises `KeyError`.
- Injected-clock TTL: live at age 9.999, expired at age 10 (also proves wall-clock
  independence).
- `get` does not refresh TTL (put at t, get at t+6, expired at t+10).
- `put` updates value/timestamp/recency (update makes key MRU; next insert evicts
  the other key).
- `put` refreshes timestamp (re-put at t+8 extends life to t+18).
- Expired entries purged before capacity enforcement (2 expired + 1 insert, no
  live eviction).
- Capacity eviction removes LRU live entry.
- Expired `get` removes the entry (`len` drops to 0).
- `ValueError` for `max_size` 0/-1 and `ttl_seconds` 0/negative.

## Exact test result

Command: `python -m unittest discover -v` (run in this directory)

```
test_expires_at_boundary (test_ttl_cache.TTLCacheTests.test_expires_at_boundary) ... ok
test_get_refreshes_lru (test_ttl_cache.TTLCacheTests.test_get_refreshes_lru) ... ok
test_round_trip (test_ttl_cache.TTLCacheTests.test_round_trip) ... ok
test_capacity_evicts_lru_live_entry (test_ttl_cache_regression.TTLCacheRegressionTests.test_capacity_evicts_lru_live_entry) ... ok
test_expired_get_removes_entry (test_ttl_cache_regression.TTLCacheRegressionTests.test_expired_get_removes_entry) ... ok
test_expired_purged_before_capacity_eviction (test_ttl_cache_regression.TTLCacheRegressionTests.test_expired_purged_before_capacity_eviction) ... ok
test_falsy_values_returned (test_ttl_cache_regression.TTLCacheRegressionTests.test_falsy_values_returned) ... ok
test_get_does_not_refresh_ttl (test_ttl_cache_regression.TTLCacheRegressionTests.test_get_does_not_refresh_ttl) ... ok
test_invalid_args (test_ttl_cache_regression.TTLCacheRegressionTests.test_invalid_args) ... ok
test_missing_key_raises (test_ttl_cache_regression.TTLCacheRegressionTests.test_missing_key_raises) ... ok
test_put_refreshes_timestamp (test_ttl_cache_regression.TTLCacheRegressionTests.test_put_refreshes_timestamp) ... ok
test_put_updates_value_timestamp_and_recency (test_ttl_cache_regression.TTLCacheRegressionTests.test_put_updates_value_timestamp_and_recency (test_ttl_cache_regression.TTLCacheRegressionTests.test_put_updates_value_timestamp_and_recency) ... ok
test_uses_injected_clock_not_wall_time (test_ttl_cache_regression.TTLCacheRegressionTests.test_uses_injected_clock_not_wall_time) ... ok

----------------------------------------------------------------------
Ran 13 tests in 0.000s

OK
```
