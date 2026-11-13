# Task 02 Response — TTL/LRU Cache Bug Fixes

## Root Causes

The original implementation in `ttl_cache.py` had seven bugs:

1. **Missing constructor validation (`__init__`)**: `max_size < 1` and `ttl_seconds <= 0` were accepted instead of raising `ValueError`.
2. **Mismatched clock source (`put`)**: `put` stored `time.time()` (wall-clock time) instead of `self.clock()`, causing `self.clock() - created` in `get` to compare incompatible time bases.
3. **Off-by-one expiration boundary and missing cleanup (`get`)**: `get` checked `self.clock() - created > self.ttl_seconds` instead of `>=`, so entries did not expire at `age == ttl_seconds`, and expired entries were left in `self._items`.
4. **Falsy value rejection (`get`)**: `if not value: raise KeyError(key)` caused valid stored falsy values (`0`, `False`, `None`, `""`, `[]`) to raise `KeyError`.
5. **Missing LRU recency update (`get`)**: `get` did not move accessed keys to the MRU position in `self._items`.
6. **Faulty `put` ordering, update, and capacity enforcement**: `put` ran `if len(self._items) >= self.max_size: self._items.popitem(last=False)` before removing expired entries and before checking whether `key` already existed, and did not call `move_to_end(key)` when updating an existing key.
7. **Expired entries counted in `__len__`**: `__len__` returned `len(self._items)` without removing expired entries first.

## Fixes

All changes were made in `ttl_cache.py` while preserving the public API (`TTLCache.__init__`, `put`, `get`, `__len__`):

- **`__init__(self, max_size, ttl_seconds, clock=time.monotonic)`**: Added validation raising `ValueError` when `max_size < 1` or `ttl_seconds <= 0`.
- **`_purge_expired(self, now)`**: Added a private helper that scans all entries in `self._items` and deletes every entry where `now - created >= self.ttl_seconds` (scanning all entries rather than breaking early, because `get` updates LRU order without updating `created`).
- **`put(self, key, value)`**: Reads `now = self.clock()`, calls `self._purge_expired(now)` first, updates existing keys in place with `(value, now)` and `self._items.move_to_end(key)` without evicting, and otherwise evicts the least recently used live entry (`self._items.popitem(last=False)`) only when `len(self._items) >= self.max_size` before inserting `(value, now)`.
- **`get(self, key)`**: Removed the `if not value:` check, checks `now - created >= self.ttl_seconds` using `now = self.clock()` (deleting the key and raising `KeyError(key)` if expired), and on a live hit calls `self._items.move_to_end(key)` without altering `created` before returning `value`.
- **`__len__(self)`**: Calls `self._purge_expired(self.clock())` before returning `len(self._items)`.

## Regression Cases

In `test_ttl_cache.py`, the 3 original tests (`test_round_trip`, `test_expires_at_boundary`, `test_get_refreshes_lru`) were retained and 10 regression tests were added:

- `test_falsy_values_and_missing_key`: Verifies `0`, `False`, `None`, `""`, and `[]` round-trip accurately while missing keys raise `KeyError`.
- `test_live_before_boundary_and_removed_on_expired_get`: Verifies an entry remains live just before `ttl_seconds`, expires at `age == ttl_seconds`, and is deleted so `len(cache) == 0`.
- `test_default_monotonic_clock`: Verifies `time.monotonic` is used as the default clock and works end-to-end.
- `test_get_refreshes_lru_without_refreshing_ttl`: Verifies `get` refreshes LRU recency without extending the entry's TTL.
- `test_put_updates_existing_value_timestamp_and_recency`: Verifies `put` on an existing key at full capacity updates value, timestamp, and LRU recency without evicting another live entry.
- `test_purges_expired_entries_before_capacity_eviction`: Verifies an expired entry (even if MRU after a prior `get`) is purged before enforcing capacity so live LRU entries are not evicted.
- `test_put_replaces_expired_key_without_evicting_live_entry`: Verifies re-inserting an expired key at capacity purges the expired entry and preserves live entries.
- `test_capacity_evicts_least_recently_used_live_entry`: Verifies capacity eviction removes the least recently used live entry after mixed `get` and `put` updates.
- `test_len_excludes_expired_entries`: Verifies `len(cache)` reflects only live entries as time advances.
- `test_invalid_arguments_raise_value_error`: Verifies `max_size < 1` (`0`, `-1`, `-10`) and `ttl_seconds <= 0` (`0`, `-1`, `-0.5`) raise `ValueError`, while valid boundary values work.

## Exact Test Result

Command run in `02-bug-fixing`:

```text
python3 -m unittest -v test_ttl_cache.py
```

Output:

```text
test_capacity_evicts_least_recently_used_live_entry (test_ttl_cache.TTLCacheTests.test_capacity_evicts_least_recently_used_live_entry) ... ok
test_default_monotonic_clock (test_ttl_cache.TTLCacheTests.test_default_monotonic_clock) ... ok
test_expires_at_boundary (test_ttl_cache.TTLCacheTests.test_expires_at_boundary) ... ok
test_falsy_values_and_missing_key (test_ttl_cache.TTLCacheTests.test_falsy_values_and_missing_key) ... ok
test_get_refreshes_lru (test_ttl_cache.TTLCacheTests.test_get_refreshes_lru) ... ok
test_get_refreshes_lru_without_refreshing_ttl (test_ttl_cache.TTLCacheTests.test_get_refreshes_lru_without_refreshing_ttl) ... ok
test_invalid_arguments_raise_value_error (test_ttl_cache.TTLCacheTests.test_invalid_arguments_raise_value_error) ... ok
test_len_excludes_expired_entries (test_ttl_cache.TTLCacheTests.test_len_excludes_expired_entries) ... ok
test_live_before_boundary_and_removed_on_expired_get (test_ttl_cache.TTLCacheTests.test_live_before_boundary_and_removed_on_expired_get) ... ok
test_purges_expired_entries_before_capacity_eviction (test_ttl_cache.TTLCacheTests.test_purges_expired_entries_before_capacity_eviction) ... ok
test_put_replaces_expired_key_without_evicting_live_entry (test_ttl_cache.TTLCacheTests.test_put_replaces_expired_key_without_evicting_live_entry) ... ok
test_put_updates_existing_value_timestamp_and_recency (test_ttl_cache.TTLCacheTests.test_put_updates_existing_value_timestamp_and_recency) ... ok
test_round_trip (test_ttl_cache.TTLCacheTests.test_round_trip) ... ok

----------------------------------------------------------------------
Ran 13 tests in 0.001s

OK
```
