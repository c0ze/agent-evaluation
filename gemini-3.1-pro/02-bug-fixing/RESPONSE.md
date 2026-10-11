# Response — Bug Fixing: TTL/LRU Cache

## 1. Root Causes

1. **Incorrect Clock Usage on Insertion (`time.time()` vs `self.clock()`)**:
   In `TTLCache.put()`, items were stored with `time.time()` instead of `self.clock()`. When custom clocks or monotonic clocks were injected, calculating expiration via `self.clock() - created` resulted in invalid ages (often negative or wildly inaccurate values), breaking TTL expiration.

2. **Expiration Boundary Condition (`>` vs `>=`)**:
   In `TTLCache.get()`, expiration checked `self.clock() - created > self.ttl_seconds`. The specification requires items to expire at `age >= ttl_seconds`. Items at the exact boundary (`age == ttl_seconds`) failed to expire.

3. **Rejection of Falsy Values**:
   In `TTLCache.get()`, the check `if not value: raise KeyError(key)` caused legitimate stored falsy values (e.g. `0`, `False`, `None`, `""`, `[]`, `{}`) to incorrectly raise `KeyError`.

4. **Failure to Refresh LRU Recency on `get()`**:
   In `TTLCache.get()`, accessing an entry did not update its position in the internal `OrderedDict`. As a result, items read frequently remained at their insertion position and were prematurely evicted as the least recently used entries.

5. **Existing Keys in `put()` Triggering Unnecessary Eviction and Failing to Update Recency**:
   In `TTLCache.put()`, capacity was checked before verifying whether `key` was already present in `self._items`. If the cache was full, updating an existing key evicted the LRU item even though cache size did not grow. Furthermore, reassigning an existing key in `OrderedDict` without `move_to_end()` failed to update the key's recency to MRU.

6. **Capacity Eviction Without Prior Expired Entry Removal**:
   `TTLCache.put()` performed `popitem(last=False)` directly upon reaching capacity without first removing expired entries. This caused active, unexpired entries to be evicted even when expired entries were present in the cache.

7. **Missing Constructor Parameter Validation**:
   `TTLCache.__init__()` did not validate `max_size` and `ttl_seconds`. Parameters violating `max_size < 1` or `ttl_seconds <= 0` were silently accepted instead of raising `ValueError`.

---

## 2. Fixes

1. **Constructor Validation**:
   Added validation in `__init__`:
   ```python
   if max_size < 1:
       raise ValueError(f"max_size must be >= 1, got {max_size}")
   if ttl_seconds <= 0:
       raise ValueError(f"ttl_seconds must be > 0, got {ttl_seconds}")
   ```

2. **Injected Clock & Boundary Checks**:
   Used `now = self.clock()` in `put()` when recording item creation timestamps. In `get()`, expired entries are identified using `self.clock() - created >= self.ttl_seconds`, deleted from `self._items`, and a `KeyError` is raised.

3. **Falsy Values Handling**:
   Removed `if not value: raise KeyError(key)` from `get()`, checking instead `if key not in self._items:` so all valid values (including `0`, `False`, `None`) are returned properly.

4. **LRU Recency Refresh on `get()`**:
   Called `self._items.move_to_end(key)` on successful `get()`. Stored timestamps remain untouched, preserving TTL while refreshing LRU recency.

5. **`put()` Existing Key Handling**:
   When `key in self._items`, `put()` updates `self._items[key] = (value, now)` and calls `self._items.move_to_end(key)`, returning immediately without evicting any entries.

6. **Expired Entries Removal Before Capacity Eviction**:
   Implemented `_purge_expired(now)` to delete all entries with `now - created >= self.ttl_seconds`. When adding a new key at capacity (`len(self._items) >= self.max_size`), `_purge_expired(now)` is invoked first. Only if `len(self._items) >= self.max_size` remains true is the LRU live entry evicted via `self._items.popitem(last=False)`.

---

## 3. Regression Test Cases Added

The following regression test cases were added to `test_ttl_cache.py`:

- `test_falsy_values_returned`: Verifies that `0`, `False`, `None`, `""`, `[]`, and `{}` are stored and retrieved without raising `KeyError`.
- `test_missing_key_raises_key_error`: Verifies that querying nonexistent keys raises `KeyError`.
- `test_invalid_parameters_raise_value_error`: Verifies that `max_size < 1` (`0`, `-1`) and `ttl_seconds <= 0` (`0`, `-5`) raise `ValueError`.
- `test_valid_boundary_parameters`: Verifies that boundary inputs (`max_size=1`, `ttl_seconds=0.001`) initialize correctly.
- `test_ttl_expiration_just_before_and_at_boundary`: Verifies entry is valid at `age = 9.999` and expires at `age = 10.0` for `ttl_seconds = 10`.
- `test_get_does_not_refresh_ttl`: Verifies that `get()` updates LRU recency without resetting or extending TTL.
- `test_put_updates_existing_key`: Verifies that updating an existing key updates its value, resets its TTL timestamp, and refreshes recency without evicting other entries.
- `test_expired_entries_removed_before_capacity_enforcement`: Verifies that when capacity is reached, expired entries are removed first so live entries are not evicted.
- `test_capacity_eviction_removes_least_recently_used_live_entry`: Verifies that when all entries are live and capacity is reached, the least recently used live entry is evicted.
- `test_put_existing_key_does_not_evict_other_keys`: Verifies that updating an existing key at full capacity does not evict another key.
- `test_default_clock_instantiation`: Verifies instantiation and basic operations using default `time.monotonic`.

---

## 4. Exact Test Result

Command:
```bash
python3 -m unittest -v test_ttl_cache.py
```

Output:
```
test_capacity_eviction_removes_least_recently_used_live_entry (test_ttl_cache.TTLCacheTests.test_capacity_eviction_removes_least_recently_used_live_entry) ... ok
test_default_clock_instantiation (test_ttl_cache.TTLCacheTests.test_default_clock_instantiation) ... ok
test_expired_entries_removed_before_capacity_enforcement (test_ttl_cache.TTLCacheTests.test_expired_entries_removed_before_capacity_enforcement) ... ok
test_expires_at_boundary (test_ttl_cache.TTLCacheTests.test_expires_at_boundary) ... ok
test_falsy_values_returned (test_ttl_cache.TTLCacheTests.test_falsy_values_returned) ... ok
test_get_does_not_refresh_ttl (test_ttl_cache.TTLCacheTests.test_get_does_not_refresh_ttl) ... ok
test_get_refreshes_lru (test_ttl_cache.TTLCacheTests.test_get_refreshes_lru) ... ok
test_invalid_parameters_raise_value_error (test_ttl_cache.TTLCacheTests.test_invalid_parameters_raise_value_error) ... ok
test_missing_key_raises_key_error (test_ttl_cache.TTLCacheTests.test_missing_key_raises_key_error) ... ok
test_put_existing_key_does_not_evict_other_keys (test_ttl_cache.TTLCacheTests.test_put_existing_key_does_not_evict_other_keys) ... ok
test_put_updates_existing_key (test_ttl_cache.TTLCacheTests.test_put_updates_existing_key) ... ok
test_round_trip (test_ttl_cache.TTLCacheTests.test_round_trip) ... ok
test_ttl_expiration_just_before_and_at_boundary (test_ttl_cache.TTLCacheTests.test_ttl_expiration_just_before_and_at_boundary) ... ok
test_valid_boundary_parameters (test_ttl_cache.TTLCacheTests.test_valid_boundary_parameters) ... ok

----------------------------------------------------------------------
Ran 14 tests in 0.001s

OK
```
