# Bug fixing: TTL/LRU cache — Response

## Root causes

1. **Wrong clock in `put`**: `put` stored `time.time()` (wall clock) while `get` compared against the injected `self.clock()` (monotonic/fake clock). Ages were computed across two different epochs, so entries effectively never expired with an injected clock.
2. **Expiry boundary off by one**: `get` used `age > ttl_seconds` instead of `age >= ttl_seconds`, so an entry aged exactly `ttl_seconds` was still returned.
3. **Falsy values rejected**: `get` contained `if not value: raise KeyError(key)`, so stored `0`, `False`, `None`, and `""` were incorrectly reported as missing.
4. **`get` did not refresh LRU recency**: `get` returned the value without moving the key to the most-recently-used end of the `OrderedDict`, so a recently read entry could be evicted next.
5. **`put` on an existing key evicted and did not refresh recency**: `put` unconditionally evicted the LRU entry when at capacity — even when merely updating an existing key — and assigning to an existing `OrderedDict` key does not change its position, so the updated key kept its old recency. (Its timestamp was also stored with the wrong clock, per cause 1.)
6. **Expired entries not purged before capacity enforcement**: `put` evicted the LRU entry without first removing expired entries, so a live LRU entry could be evicted while expired entries still occupied capacity.
7. **No argument validation**: the constructor accepted `max_size < 1` and `ttl_seconds <= 0` without raising `ValueError`.

## Fixes (`ttl_cache.py`, public API unchanged)

- Constructor now raises `ValueError` for `max_size < 1` and for `ttl_seconds <= 0`.
- Added a `_purge_expired(now)` helper that deletes every entry with `now - created >= ttl_seconds`.
- `put` now timestamps with `self.clock()`, purges expired entries before enforcing capacity, updates an existing key's value/timestamp and moves it to most-recently-used without evicting, and otherwise evicts least-recently-used live entries (`popitem(last=False)`) until there is room.
- `get` now raises `KeyError` only for missing or expired keys (deleting the expired entry), uses `age >= ttl_seconds`, moves a successful hit to most-recently-used, does not touch the stored timestamp (so TTL is not refreshed), and returns the value as stored, including falsy values.
- `__len__` purges expired entries before counting, so it reports live entries.

## Regression cases (added to `test_ttl_cache.py`)

The 3 pre-existing tests were kept; 10 regression tests were added:

- `test_falsy_values_are_returned` — `0`, `False`, `None`, `""` round-trip through `get`.
- `test_missing_key_raises_key_error` — `KeyError` only for an absent key.
- `test_expired_entry_raises_and_is_removed` — expired `get` raises `KeyError` and `len` drops to 0.
- `test_get_does_not_refresh_ttl` — a hit at age 6 does not prevent expiry at age 11 with TTL 10.
- `test_put_updates_value_timestamp_and_recency` — re-`put` replaces the value, restarts TTL, and makes the key most-recently-used so the other entry is evicted.
- `test_put_existing_key_does_not_evict` — updating at capacity keeps both entries (`len == 2`).
- `test_expired_entries_removed_before_capacity_eviction` — expired MRU entry is purged so the live LRU entry survives an insert at capacity.
- `test_capacity_evicts_lru_live_entry` — plain LRU eviction among live entries.
- `test_invalid_max_size_raises_value_error` — `max_size` of `0` and `-1`.
- `test_invalid_ttl_raises_value_error` — `ttl_seconds` of `0` and `-5`.

Before the fix, the pre-existing suite failed 2 of 3 tests (`test_expires_at_boundary` and `test_get_refreshes_lru`: `AssertionError: KeyError not raised`), confirming causes 1, 2, and 4.

## Exact test result

Command (run in this directory):

```
python3 -m unittest -v
```

Output:

```
test_capacity_evicts_lru_live_entry (test_ttl_cache.TTLCacheTests.test_capacity_evicts_lru_live_entry) ... ok
test_expired_entries_removed_before_capacity_eviction (test_ttl_cache.TTLCacheTests.test_expired_entries_removed_before_capacity_eviction) ... ok
test_expired_entry_raises_and_is_removed (test_ttl_cache.TTLCacheTests.test_expired_entry_raises_and_is_removed) ... ok
test_expires_at_boundary (test_ttl_cache.TTLCacheTests.test_expires_at_boundary) ... ok
test_falsy_values_are_returned (test_ttl_cache.TTLCacheTests.test_falsy_values_are_returned) ... ok
test_get_does_not_refresh_ttl (test_ttl_cache.TTLCacheTests.test_get_does_not_refresh_ttl) ... ok
test_get_refreshes_lru (test_ttl_cache.TTLCacheTests.test_get_refreshes_lru) ... ok
test_invalid_max_size_raises_value_error (test_ttl_cache.TTLCacheTests.test_invalid_max_size_raises_value_error) ... ok
test_invalid_ttl_raises_value_error (test_ttl_cache.TTLCacheTests.test_invalid_ttl_raises_value_error) ... ok
test_missing_key_raises_key_error (test_ttl_cache.TTLCacheTests.test_missing_key_raises_key_error) ... ok
test_put_existing_key_does_not_evict (test_ttl_cache.TTLCacheTests.test_put_existing_key_does_not_evict) ... ok
test_put_updates_value_timestamp_and_recency (test_ttl_cache.TTLCacheTests.test_put_updates_value_timestamp_and_recency) ... ok
test_round_trip (test_ttl_cache.TTLCacheTests.test_round_trip) ... ok

----------------------------------------------------------------------
Ran 13 tests in 0.000s

OK
```

All 13 tests pass (3 pre-existing + 10 new regression tests).
