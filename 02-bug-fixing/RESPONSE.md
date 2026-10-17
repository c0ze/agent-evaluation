# Task 02 — TTL/LRU Cache Bug Analysis and Fixes

## 1. Root Causes

1. **Missing constructor argument validation**: `__init__` accepted non-positive capacities (`max_size < 1`) and non-positive TTLs (`ttl_seconds <= 0`) without raising `ValueError`.
2. **Wrong clock source in `put`**: `put` recorded entry creation time with `time.time()` instead of the injected `self.clock()`, causing mismatches against `self.clock()` in `get`.
3. **Off-by-one expiration boundary**: `get` checked `self.clock() - created > self.ttl_seconds` instead of `>= self.ttl_seconds`, failing to expire entries when `age == ttl_seconds`.
4. **Falsy values rejected in `get`**: `get` checked `if not value: raise KeyError(key)`, which erroneously raised `KeyError` for valid stored values such as `0`, `False`, `None`, and `""`.
5. **LRU recency not updated on `get`**: `get` returned the cached value without calling `self._items.move_to_end(key)`, leaving the entry in its old LRU position.
6. **Overwriting an existing key in `put` evicted live items and did not refresh recency**: When `len(self._items) >= self.max_size`, `put` unconditionally evicted the oldest entry even when updating an already-present key, and assigning to an existing key in `OrderedDict` did not move it to the most-recently-used end.
7. **Expired entries were not purged before enforcing capacity**: `put` evicted the least-recently-used item before removing expired items, allowing an expired entry to remain in the table while a live entry was evicted.

## 2. Fixes Applied

- **Constructor validation (`ttl_cache.py`)**: Added checks in `__init__` raising `ValueError` when `max_size < 1` or `ttl_seconds <= 0`.
- **Expiration purge helper (`_purge_expired`)**: Added `_purge_expired(now)` to scan `self._items` and delete any entry where `now - created >= self.ttl_seconds` (scanning all entries because `get` changes LRU order independently of creation timestamps).
- **Updated `put`**:
  - Uses `now = self.clock()`.
  - Calls `self._purge_expired(now)` first so expired items never trigger unnecessary evictions.
  - If `key` already exists, updates `(value, now)` and calls `self._items.move_to_end(key)` without evicting another entry.
  - Otherwise, evicts the least recently used live entry (`popitem(last=False)`) when at capacity and inserts `(value, now)`.
- **Updated `get` and `__len__`**:
  - `get` purges expired entries at `now = self.clock()`, raises `KeyError(key)` only if `key` is missing or expired, refreshes recency via `self._items.move_to_end(key)` without changing the creation timestamp, and returns `value` directly (preserving falsy values).
  - `__len__` purges expired entries before returning `len(self._items)`.

## 3. Regression Cases Added (`test_ttl_cache.py`)

- `test_get_returns_falsy_values`: Verifies `0`, `False`, `None`, and `""` round-trip through `put`/`get` without raising `KeyError`.
- `test_get_missing_key_raises_key_error`: Verifies `get` raises `KeyError` on unknown keys.
- `test_get_does_not_refresh_ttl`: Verifies accessing a key halfway through its TTL updates LRU order but still expires the key once total age reaches `ttl_seconds`.
- `test_put_updates_value_timestamp_and_recency`: Verifies `put` on an existing key in a full cache does not evict the other live entry, refreshes the key's LRU position so the older sibling is evicted next, and resets the key's TTL timestamp.
- `test_expired_entries_removed_before_capacity_eviction`: Verifies that when an MRU entry expires while an LRU entry is still live, a subsequent `put` purges the expired entry first and retains the live LRU entry.
- `test_invalid_arguments_raise_value_error`: Verifies `max_size < 1` (`0`, `-1`) and `ttl_seconds <= 0` (`0`, `-0.5`, `-10`) raise `ValueError`.

## 4. Exact Test Result

Running `python3 -m unittest -v test_ttl_cache.py`:

```text
test_expired_entries_removed_before_capacity_eviction (test_ttl_cache.TTLCacheTests.test_expired_entries_removed_before_capacity_eviction) ... ok
test_expires_at_boundary (test_ttl_cache.TTLCacheTests.test_expires_at_boundary) ... ok
test_get_does_not_refresh_ttl (test_ttl_cache.TTLCacheTests.test_get_does_not_refresh_ttl) ... ok
test_get_missing_key_raises_key_error (test_ttl_cache.TTLCacheTests.test_get_missing_key_raises_key_error) ... ok
test_get_refreshes_lru (test_ttl_cache.TTLCacheTests.test_get_refreshes_lru) ... ok
test_get_returns_falsy_values (test_ttl_cache.TTLCacheTests.test_get_returns_falsy_values) ... ok
test_invalid_arguments_raise_value_error (test_ttl_cache.TTLCacheTests.test_invalid_arguments_raise_value_error) ... ok
test_put_updates_value_timestamp_and_recency (test_ttl_cache.TTLCacheTests.test_put_updates_value_timestamp_and_recency) ... ok
test_round_trip (test_ttl_cache.TTLCacheTests.test_round_trip) ... ok

----------------------------------------------------------------------
Ran 9 tests in 0.000s

OK
