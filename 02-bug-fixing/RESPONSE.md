# Response — TTL/LRU cache bug fixes

## Root causes found in `ttl_cache.py`

1. **Falsy values treated as misses.** `get` did `if not value: raise KeyError(key)`, so stored values such as `0`, `False`, `None`, `""` and empty containers were reported as missing (`ttl_cache.py:19`).
2. **TTL ignored the injected clock.** `put` recorded `time.time()` instead of `self.clock()`, so expiry was measured against wall-clock time while `get` compared against the injected monotonic clock (`ttl_cache.py:15`).
3. **Off-by-one at the TTL boundary.** `get` used `>` (`age > ttl_seconds`) instead of `>=`, so an entry was still returned at exactly `ttl_seconds` old (`ttl_cache.py:21`).
4. **`get` did not refresh LRU recency.** Successful reads never moved the key to the most-recent end, so frequently read keys were evicted first (`ttl_cache.py:18-23`).
5. **`put` evicted before updating an existing key.** The capacity check ran unconditionally, so updating a key in a full cache evicted the LRU entry (possibly the key being updated) instead of just updating in place (`ttl_cache.py:13-15`). It also did not move the updated key to the most-recent position.
6. **Expired entries were not reclaimed before capacity enforcement.** Capacity eviction operated on the raw dict, so expired-but-still-stored entries could push out live entries (`ttl_cache.py:13-14`).
7. **No constructor validation.** `max_size < 1` and `ttl_seconds <= 0` were accepted, producing a cache that could never hold anything or entries that were born expired (`ttl_cache.py:6-10`).

## Fixes applied (public API unchanged)

- Added constructor validation raising `ValueError` for `max_size < 1` and `ttl_seconds <= 0`.
- Added `_is_expired(created)` using `self.clock() - created >= self.ttl_seconds`.
- Added `_purge_expired()` which deletes every expired entry; `put` calls it before enforcing capacity.
- `put`:
  - stamps with `self.clock()`;
  - if the key already exists, deletes and re-inserts it (new value, new timestamp, most-recent position) and returns without any eviction;
  - otherwise purges expired entries, then evicts from the front (`popitem(last=False)`, the least recently used live entry) until there is room, then inserts.
- `get`:
  - raises `KeyError` when the key is absent;
  - explicitly handles expiry (`>=` boundary), deleting the expired entry and raising `KeyError`;
  - returns the value unchanged (no truthiness check), so falsy values work;
  - on a successful hit moves the key to the end (`move_to_end`), refreshing LRU recency but leaving the stored timestamp untouched, so TTL is not refreshed.

## Regression tests added (`test_ttl_cache.py`)

The three original tests are kept; twelve cases were added:

| Test | Behavior covered |
| --- | --- |
| `test_round_trip` | basic put/get |
| `test_missing_key_raises` | absent key raises `KeyError` |
| `test_falsy_values_are_returned` | `0`, `False`, `None`, `""`, `[]`, `{}`, `()` all returned |
| `test_expires_at_boundary` | expiry at exactly `age == ttl_seconds` |
| `test_alive_just_before_boundary` | just under the TTL is still alive |
| `test_ttl_uses_injected_clock` | fake clock at t=100 is not confused with wall time |
| `test_get_does_not_refresh_ttl` | reads do not extend lifetime |
| `test_expired_get_evicts_entry` | an expired hit removes the entry |
| `test_get_refreshes_lru` | read key survives a subsequent insert |
| `test_evicts_least_recently_used_live_entry` | LRU victim is correct |
| `test_put_updates_value_timestamp_and_recency` | update refreshes value, timestamp, recency |
| `test_put_existing_key_at_capacity_does_not_evict` | in-place update at capacity evicts nothing |
| `test_expired_entries_purged_before_capacity` | expiries reclaimed before eviction |
| `test_invalid_max_size` | `0` and `-1` raise `ValueError` |
| `test_invalid_ttl` | `0`, `-1`, `-0.5` raise `ValueError` |

## Exact test result

Command (run from this directory):

```
python3 -m unittest discover -s . -t . -p 'test_*.py' -v
```

Output:

```
test_alive_just_before_boundary (test_ttl_cache.TTLCacheTests.test_alive_just_before_boundary) ... ok
test_evicts_least_recently_used_live_entry (test_ttl_cache.TTLCacheTests.test_evicts_least_recently_used_live_entry) ... ok
test_expired_entries_purged_before_capacity (test_ttl_cache.TTLCacheTests.test_expired_entries_purged_before_capacity) ... ok
test_expired_get_evicts_entry (test_ttl_cache.TTLCacheTests.test_expired_get_evicts_entry) ... ok
test_expires_at_boundary (test_ttl_cache.TTLCacheTests.test_expires_at_boundary) ... ok
test_falsy_values_are_returned (test_ttl_cache.TTLCacheTests.test_falsy_values_are_returned) ... ok
test_get_does_not_refresh_ttl (test_ttl_cache.TTLCacheTests.test_get_does_not_refresh_ttl) ... ok
test_get_refreshes_lru (test_ttl_cache.TTLCacheTests.test_get_refreshes_lru) ... ok
test_invalid_max_size (test_ttl_cache.TTLCacheTests.test_invalid_max_size) ... ok
test_invalid_ttl (test_ttl_cache.TTLCacheTests.test_invalid_ttl) ... ok
test_missing_key_raises (test_ttl_cache.TTLCacheTests.test_missing_key_raises) ... ok
test_put_existing_key_at_capacity_does_not_evict (test_ttl_cache.TTLCacheTests.test_put_existing_key_at_capacity_does_not_evict) ... ok
test_put_updates_value_timestamp_and_recency (test_ttl_cache.TTLCacheTests.test_put_updates_value_timestamp_and_recency) ... ok
test_round_trip (test_ttl_cache.TTLCacheTests.test_round_trip) ... ok
test_ttl_uses_injected_clock (test_ttl_cache.TTLCacheTests.test_ttl_uses_injected_clock) ... ok

----------------------------------------------------------------------
Ran 15 tests in 0.001s

OK
```

15 tests run, 15 passed, 0 failures, 0 errors.
