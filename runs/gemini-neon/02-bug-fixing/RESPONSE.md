# Task 02 — TTL/LRU Cache Bug Fix Summary

## Root Causes

The original implementation in `ttl_cache.py` had the following defects:

1. **Missing constructor validation (`__init__`)**: `max_size < 1` and `ttl_seconds <= 0` were accepted without raising `ValueError`.
2. **Wrong clock used on write (`put`)**: `put()` timestamped entries with `time.time()` instead of `self.clock()`, ignoring the injected monotonic clock (and mixing wall-clock timestamps with `time.monotonic` reads in `get()`).
3. **Off-by-one expiration boundary (`get`)**: Expiration checked `self.clock() - created > self.ttl_seconds` instead of `>=`, leaving entries alive at `age == ttl_seconds`.
4. **Falsy values rejected (`get`)**: `if not value: raise KeyError(key)` erroneously treated valid falsy values (`0`, `False`, `None`, `""`, `[]`, `{}`) as missing keys.
5. **Stale expired entries retained (`get`, `put`, `__len__`)**: Expired entries were not deleted when detected in `get()`, were not purged in `put()` prior to enforcing capacity (which could evict live entries while expired ones remained), and were still counted by `__len__()`.
6. **LRU recency not updated on `get`**: A successful `get()` did not call `self._items.move_to_end(key)`.
7. **Faulty update of existing keys (`put`)**: Updating an existing key did not refresh its recency in the `OrderedDict`, and checking `len(self._items) >= self.max_size` unconditionally evicted an entry even when overwriting an already-present key at capacity.

## Fixes

Without changing the public API of `TTLCache` (`__init__`, `put`, `get`, `__len__`, and attributes `max_size`, `ttl_seconds`, `clock`):

- Added validation in `__init__` to raise `ValueError` when `max_size < 1` or `not (ttl_seconds > 0)` (covering `<= 0` and `NaN`).
- Added private helpers `_is_expired(created, now)` using `now - created >= self.ttl_seconds` and `_purge_expired(now)` to remove all expired entries across `self._items` (necessary because LRU reordering decouples recency order from creation-time order).
- Updated `put(key, value)` to capture `now = self.clock()`, purge expired entries first, update value/timestamp and call `move_to_end(key)` in place if `key` already exists (avoiding spurious eviction), and otherwise evict the least recently used live entry (`popitem(last=False)`) while at capacity before inserting `(value, now)`.
- Updated `get(key)` to remove the falsy-value check, delete and raise `KeyError(key)` if expired, and call `move_to_end(key)` on cache hit without altering the stored `created` timestamp.
- Updated `__len__()` to purge expired entries before returning the count of live entries.

## Regression Cases Added (`test_ttl_cache.py`)

Preserved the 3 existing tests (`test_round_trip`, `test_expires_at_boundary`, `test_get_refreshes_lru`) and added 13 regression tests:

- `test_falsy_values_are_returned`: Verifies `0`, `False`, `None`, `""`, `[]`, and `{}` are returned intact.
- `test_missing_key_raises_key_error`: Verifies `KeyError` on absent keys.
- `test_live_before_ttl_and_expires_at_and_after_ttl`: Verifies live just before TTL, expiration at exact boundary, and removal from cache length.
- `test_uses_injected_clock_and_defaults_to_monotonic`: Verifies default `time.monotonic` clock and injected clock starting at `0.0`.
- `test_get_does_not_refresh_ttl`: Verifies successful `get()` does not extend TTL.
- `test_put_existing_key_at_capacity_does_not_evict`: Verifies updating a key at full capacity does not evict another live key.
- `test_put_existing_key_refreshes_recency`: Verifies updating an existing key moves it to most-recently-used.
- `test_put_existing_key_refreshes_ttl`: Verifies updating an existing key resets its TTL timestamp.
- `test_expired_entries_removed_before_capacity_eviction`: Verifies an expired MRU entry is purged before capacity checks so a live LRU entry is not evicted.
- `test_capacity_eviction_removes_lru_live_entry`: Verifies LRU eviction order among live entries.
- `test_max_size_one`: Verifies updating and evicting with `max_size=1`.
- `test_len_excludes_expired_entries`: Verifies `len(cache)` reflects only live entries.
- `test_invalid_constructor_arguments`: Verifies `ValueError` for `max_size < 1` (`0`, `-1`, `-100`) and `ttl_seconds <= 0` or `NaN` (`0`, `0.0`, `-1`, `-0.01`, `nan`).

## Exact Test Result

Command run in `02-bug-fixing`:

```text
python3 -m unittest -v
```

Output:

```text
test_capacity_eviction_removes_lru_live_entry (test_ttl_cache.TTLCacheTests.test_capacity_eviction_removes_lru_live_entry) ... ok
test_expired_entries_removed_before_capacity_eviction (test_ttl_cache.TTLCacheTests.test_expired_entries_removed_before_capacity_eviction) ... ok
test_expires_at_boundary (test_ttl_cache.TTLCacheTests.test_expires_at_boundary) ... ok
test_falsy_values_are_returned (test_ttl_cache.TTLCacheTests.test_falsy_values_are_returned) ... ok
test_get_does_not_refresh_ttl (test_ttl_cache.TTLCacheTests.test_get_does_not_refresh_ttl) ... ok
test_get_refreshes_lru (test_ttl_cache.TTLCacheTests.test_get_refreshes_lru) ... ok
test_invalid_constructor_arguments (test_ttl_cache.TTLCacheTests.test_invalid_constructor_arguments) ... ok
test_len_excludes_expired_entries (test_ttl_cache.TTLCacheTests.test_len_excludes_expired_entries) ... ok
test_live_before_ttl_and_expires_at_and_after_ttl (test_ttl_cache.TTLCacheTests.test_live_before_ttl_and_expires_at_and_after_ttl) ... ok
test_max_size_one (test_ttl_cache.TTLCacheTests.test_max_size_one) ... ok
test_missing_key_raises_key_error (test_ttl_cache.TTLCacheTests.test_missing_key_raises_key_error) ... ok
test_put_existing_key_at_capacity_does_not_evict (test_ttl_cache.TTLCacheTests.test_put_existing_key_at_capacity_does_not_evict) ... ok
test_put_existing_key_refreshes_recency (test_ttl_cache.TTLCacheTests.test_put_existing_key_refreshes_recency) ... ok
test_put_existing_key_refreshes_ttl (test_ttl_cache.TTLCacheTests.test_put_existing_key_refreshes_ttl) ... ok
test_round_trip (test_ttl_cache.TTLCacheTests.test_round_trip) ... ok
test_uses_injected_clock_and_defaults_to_monotonic (test_ttl_cache.TTLCacheTests.test_uses_injected_clock_and_defaults_to_monotonic) ... ok

----------------------------------------------------------------------
Ran 16 tests in 0.001s

OK
```
