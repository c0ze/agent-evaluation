# Task 02 — TTL/LRU cache bug fixing

Public API was not changed: `TTLCache(max_size, ttl_seconds, clock=time.monotonic)`,
`put(key, value)`, `get(key)`, and `__len__`.

## Root causes and fixes

1. **Wrong clock in `put`**
   - Root cause: `put` stored `time.time()` (wall time) while `get` compared it
     against the injected `self.clock()` (monotonic / fake test clock). Ages were
     computed across two different time bases (e.g. fake clock at `100.0` vs a
     wall timestamp), so entries effectively never expired with an injected clock.
   - Fix: `put` now stores `now = self.clock()`.

2. **Falsy values rejected in `get`**
   - Root cause: `if not value: raise KeyError(key)` treated stored `0`, `False`,
     `None`, `""`, etc. as missing.
   - Fix: removed the truthiness check. `get` raises `KeyError` only when the key
     is absent or the entry is expired, and otherwise returns the stored value as-is.

3. **Wrong expiry boundary**
   - Root cause: expiry used `age > ttl_seconds`, so an entry at exactly
     `age == ttl_seconds` was incorrectly still live.
   - Fix: expiry is `now - created >= ttl_seconds` (via `_is_expired`).

4. **`get` did not refresh LRU recency**
   - Root cause: `get` returned the value without reordering the `OrderedDict`.
   - Fix: a successful `get` calls `self._items.move_to_end(key)` and does not
     touch the stored timestamp, so recency is refreshed but TTL is not.

5. **`put` on an existing key did not update recency and could evict spuriously**
   - Root cause: `OrderedDict.__setitem__` on an existing key keeps its old
     position, so recency was not refreshed. Also the capacity check
     (`len >= max_size`) ran before the insert unconditionally, so updating an
     existing key in a full cache evicted the LRU entry even though the size
     would not grow.
   - Fix: after pruning, if the key already exists, `put` updates its
     `(value, now)` timestamp, calls `move_to_end(key)`, and returns without
     any eviction.

6. **Expired entries were not removed before capacity enforcement**
   - Root cause: `put` evicted the LRU entry whenever the cache was full, even
     if some other entry was already expired — a live LRU entry could be evicted
     while an expired entry was retained.
   - Fix: `put` first calls `_prune_expired(now)` to remove every entry with
     `age >= ttl_seconds`, then evicts `popitem(last=False)` (least recently
     used live entry) only while still at/over capacity for a new key.

7. **No argument validation**
   - Root cause: `__init__` accepted any `max_size` / `ttl_seconds`.
   - Fix: `max_size < 1` raises `ValueError`; `ttl_seconds <= 0` raises `ValueError`.

8. **Expired entries lingered (cleanup)**
   - Fix: an expired entry is deleted when `get` finds it expired, and `__len__`
     prunes expired entries before counting, so length reflects live entries.

## Regression cases added

Added to `test_ttl_cache.py` (original 3 tests kept unchanged; 10 new tests):

- `test_falsy_values_are_returned` — `0`, `False`, `None`, `""` round-trip.
- `test_missing_key_raises_key_error` — absent key raises `KeyError`.
- `test_not_expired_just_before_boundary` — age `9.999` with TTL `10` is live
  (complements the existing `test_expires_at_boundary` at exactly age `10`).
- `test_get_does_not_refresh_ttl` — `get` at age 9, then expiry at original age 10.
- `test_put_updates_value_timestamp_and_recency` — re-`put` changes value, resets
  TTL (live 9s after update / 18s after first insert, expired at 10s after update),
  and makes the key most-recent so a later insert evicts the other key.
- `test_put_update_when_full_does_not_evict_other_key` — updating a key in a full
  cache keeps both keys and `len == 2`.
- `test_expired_entries_removed_before_capacity_eviction` — expired most-recent
  entry is pruned instead of evicting the live LRU entry when inserting into a full cache.
- `test_capacity_eviction_removes_lru_live_entry` — plain LRU eviction.
- `test_invalid_max_size_raises_value_error` — `max_size` of `0` and `-1`.
- `test_invalid_ttl_raises_value_error` — `ttl_seconds` of `0` and `-1`.

## Test results

Before the fix:

```text
$ python3 -m unittest -v
Ran 3 tests in 0.003s
FAILED (failures=2)
```

After the fix (exact result):

```text
$ python3 -m unittest -v
test_capacity_eviction_removes_lru_live_entry (test_ttl_cache.TTLCacheTests.test_capacity_eviction_removes_lru_live_entry) ... ok
test_expired_entries_removed_before_capacity_eviction (test_ttl_cache.TTLCacheTests.test_expired_entries_removed_before_capacity_eviction) ... ok
test_expires_at_boundary (test_ttl_cache.TTLCacheTests.test_expires_at_boundary) ... ok
test_falsy_values_are_returned (test_ttl_cache.TTLCacheTests.test_falsy_values_are_returned) ... ok
test_get_does_not_refresh_ttl (test_ttl_cache.TTLCacheTests.test_get_does_not_refresh_ttl) ... ok
test_get_refreshes_lru (test_ttl_cache.TTLCacheTests.test_get_refreshes_lru) ... ok
test_invalid_max_size_raises_value_error (test_ttl_cache.TTLCacheTests.test_invalid_max_size_raises_value_error) ... ok
test_invalid_ttl_raises_value_error (test_ttl_cache.TTLCacheTests.test_invalid_ttl_raises_value_error) ... ok
test_missing_key_raises_key_error (test_ttl_cache.TTLCacheTests.test_missing_key_raises_key_error) ... ok
test_not_expired_just_before_boundary (test_ttl_cache.TTLCacheTests.test_not_expired_just_before_boundary) ... ok
test_put_update_when_full_does_not_evict_other_key (test_ttl_cache.TTLCacheTests.test_put_update_when_full_does_not_evict_other_key) ... ok
test_put_updates_value_timestamp_and_recency (test_ttl_cache.TTLCacheTests.test_put_updates_value_timestamp_and_recency) ... ok
test_round_trip (test_ttl_cache.TTLCacheTests.test_round_trip) ... ok

----------------------------------------------------------------------
Ran 13 tests in 0.001s

OK
```
