# Task 02 — Bug Fixing: TTL/LRU Cache Response

## 1. Root Causes

1. **Clock Injection and Monotonic Mismatch in `put`**:
   `put` recorded timestamps using `time.time()` (wall-clock) instead of `self.clock()` (injected monotonic clock). This caused expiration calculations in `get` (which evaluated `self.clock() - created`) to compute negative or erroneous durations when an injected clock was provided.

2. **Incorrect Expiration Boundary Condition**:
   `get` checked `self.clock() - created > self.ttl_seconds`. The specification requires expiration at `age >= ttl_seconds`. Consequently, entries at the exact expiration boundary (`age == ttl_seconds`) failed to expire.

3. **Falsy Values Rejected in `get`**:
   `get` included `if not value: raise KeyError(key)`, causing legitimate stored falsy values (`0`, `False`, `None`, empty string, empty containers) to erroneously raise `KeyError`.

4. **Missing LRU Recency Refresh on `get`**:
   A successful `get` did not update key recency in `self._items` via `move_to_end(key)`. The accessed entry remained at its original position, leading to premature eviction under subsequent `put` calls.

5. **Improper Existing Key Updates in `put`**:
   When `put` updated an existing key:
   - `OrderedDict` does not update the position on key assignment, so the key's recency was not refreshed.
   - If `len(self._items) >= self.max_size`, `put` blindly popped an item even though updating an existing key does not increase dictionary size.

6. **Capacity Eviction Without Expired Entry Removal**:
   `put` performed capacity eviction by popping the oldest item before checking or removing expired items. This could evict a live item while expired items remained in the cache.

7. **Missing Constructor Validation**:
   `TTLCache.__init__` did not validate `max_size` or `ttl_seconds`, failing to raise `ValueError` when `max_size < 1` or `ttl_seconds <= 0`.

---

## 2. Fixes

1. **Parameter Validation**:
   Added checks in `__init__`:
   - `if max_size < 1: raise ValueError(...)`
   - `if ttl_seconds <= 0: raise ValueError(...)`

2. **Consistent Clock & Expiration**:
   - `put` now records `now = self.clock()` as the creation timestamp.
   - Expiration condition updated to `now - created >= self.ttl_seconds`.
   - Expired items accessed in `get` are deleted from `_items` before raising `KeyError`.

3. **Support for Falsy Values**:
   Removed `if not value:` check in `get`. `KeyError` is raised only when a key is absent or expired.

4. **Recency Maintenance**:
   - `get`: Calls `self._items.move_to_end(key)` upon successful retrieval without modifying the timestamp.
   - `put`: Updates `(value, now)` and calls `self._items.move_to_end(key)` for existing keys immediately, without evicting any items.

5. **Expired Entry Removal Prior to Eviction**:
   Implemented helper method `_purge_expired(now)`. When adding a new key at capacity (`len(self._items) >= self.max_size`), `_purge_expired` purges expired entries first. If capacity is still saturated, `popitem(last=False)` removes the least recently used live entry.

6. **Accurate Length Counting**:
   `__len__` invokes `_purge_expired()` so `len(cache)` reflects only unexpired, accessible entries.

---

## 3. Regression Cases

The following test suite in `test_ttl_cache.py` verifies all requirements:

- `test_round_trip`: Verifies insertion and retrieval of a key-value pair.
- `test_expires_at_boundary`: Verifies that an entry expires at the exact boundary `age == ttl_seconds`.
- `test_get_refreshes_lru`: Verifies that a successful `get` refreshes LRU recency, protecting the accessed key from capacity eviction.
- `test_get_before_boundary`: Verifies that an entry remains valid just before the expiration threshold (`age < ttl_seconds`).
- `test_get_missing_key_raises_key_error`: Verifies that querying a non-existent key raises `KeyError`.
- `test_falsy_values_returned`: Verifies that falsy values (`0`, `False`, `None`, `""`, `[]`, `{}`, `()`) are stored and returned without raising `KeyError`.
- `test_get_does_not_refresh_ttl`: Verifies that calling `get` does not reset the entry's creation timestamp or prolong its TTL.
- `test_put_updates_existing_key_value`: Verifies that re-putting an existing key updates its value.
- `test_put_updates_existing_key_timestamp`: Verifies that re-putting an existing key resets its TTL timestamp.
- `test_put_updates_existing_key_recency`: Verifies that re-putting an existing key updates its recency to MRU.
- `test_put_existing_key_does_not_exceed_capacity`: Verifies that updating an existing key at capacity does not evict other entries.
- `test_expired_entries_removed_before_enforcing_capacity`: Verifies that expired entries are purged prior to capacity enforcement, ensuring an LRU live entry is preserved when an expired entry can be discarded instead.
- `test_capacity_eviction_removes_lru_live_entry`: Verifies that when all entries are live, capacity eviction evicts the least recently used entry.
- `test_invalid_max_size_raises_value_error`: Verifies that `max_size < 1` (e.g. `0`, `-1`) raises `ValueError`.
- `test_invalid_ttl_seconds_raises_value_error`: Verifies that `ttl_seconds <= 0` (e.g. `0`, `-5`) raises `ValueError`.
- `test_default_clock_used_when_none_provided`: Verifies that omitting the `clock` argument defaults to `time.monotonic`.
- `test_len_behavior`: Verifies that `len(cache)` reflects live entries and excludes expired items.

---

## 4. Exact Test Result

```
test_capacity_eviction_removes_lru_live_entry (test_ttl_cache.TTLCacheTests.test_capacity_eviction_removes_lru_live_entry) ... ok
test_default_clock_used_when_none_provided (test_ttl_cache.TTLCacheTests.test_default_clock_used_when_none_provided) ... ok
test_expired_entries_removed_before_enforcing_capacity (test_ttl_cache.TTLCacheTests.test_expired_entries_removed_before_enforcing_capacity) ... ok
test_expires_at_boundary (test_ttl_cache.TTLCacheTests.test_expires_at_boundary) ... ok
test_falsy_values_returned (test_ttl_cache.TTLCacheTests.test_falsy_values_returned) ... ok
test_get_before_boundary (test_ttl_cache.TTLCacheTests.test_get_before_boundary) ... ok
test_get_does_not_refresh_ttl (test_ttl_cache.TTLCacheTests.test_get_does_not_refresh_ttl) ... ok
test_get_missing_key_raises_key_error (test_ttl_cache.TTLCacheTests.test_get_missing_key_raises_key_error) ... ok
test_get_refreshes_lru (test_ttl_cache.TTLCacheTests.test_get_refreshes_lru) ... ok
test_invalid_max_size_raises_value_error (test_ttl_cache.TTLCacheTests.test_invalid_max_size_raises_value_error) ... ok
test_invalid_ttl_seconds_raises_value_error (test_ttl_cache.TTLCacheTests.test_invalid_ttl_seconds_raises_value_error) ... ok
test_len_behavior (test_ttl_cache.TTLCacheTests.test_len_behavior) ... ok
test_put_existing_key_does_not_exceed_capacity (test_ttl_cache.TTLCacheTests.test_put_existing_key_does_not_exceed_capacity) ... ok
test_put_updates_existing_key_recency (test_ttl_cache.TTLCacheTests.test_put_updates_existing_key_recency) ... ok
test_put_updates_existing_key_timestamp (test_ttl_cache.TTLCacheTests.test_put_updates_existing_key_timestamp) ... ok
test_put_updates_existing_key_value (test_ttl_cache.TTLCacheTests.test_put_updates_existing_key_value) ... ok
test_round_trip (test_ttl_cache.TTLCacheTests.test_round_trip) ... ok

----------------------------------------------------------------------
Ran 17 tests in 0.002s

OK
```
