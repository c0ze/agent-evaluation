# Task 02 — Bug fixing: TTL/LRU cache

## Root causes

1. **Falsy values treated as missing** — `get` contained `if not value: raise KeyError(key)`,
   so stored values `0`, `False`, and `None` raised `KeyError` instead of being returned.
2. **Wrong clock in `put`** — entries were timestamped with `time.time()` (wall clock) while
   expiry checks used the injected monotonic `clock`, so TTL behavior depended on the system
   clock and could never be controlled or tested.
3. **Off-by-one TTL comparison** — expiry used `age > ttl_seconds` instead of
   `age >= ttl_seconds`, so entries lived one instant longer than specified.
4. **No LRU refresh on `get`** — `get` never called `move_to_end`, so reads did not count
   as "use" and eviction order ignored actual access recency.
5. **`put` did not update recency of existing keys** — assigning to an existing
   `OrderedDict` key keeps its original position, so re-`put` of a key did not mark it
   most-recently-used. It also never removed expired entries before enforcing capacity,
   so a full cache of expired entries would evict live... rather, it would evict the LRU
   entry even when expired entries could have been purged first.
6. **No constructor validation** — `max_size < 1` and `ttl_seconds <= 0` were accepted
   silently instead of raising `ValueError`.

## Fixes (ttl_cache.py)

- Removed the `if not value` check in `get`; `KeyError` now comes only from a missing key
  (implicit dict lookup) or an expired entry (which is also lazily deleted).
- `put` now timestamps with `self.clock()`.
- Expiry checks use `self.clock() - created >= self.ttl_seconds` in both `get` and the
  new `_remove_expired` helper.
- `get` calls `self._items.move_to_end(key)` on success, refreshing LRU recency without
  touching the stored timestamp (TTL is not refreshed).
- `put` deletes an existing key first (so updating never triggers self-eviction), purges
  expired entries via `_remove_expired()` before enforcing capacity, evicts the LRU entry
  (`popitem(last=False)`) only if still at capacity, and re-inserts with a fresh
  timestamp — updating value, TTL, and recency.
- `__init__` raises `ValueError` for `max_size < 1` and `ttl_seconds <= 0`.

The public API (`TTLCache(max_size, ttl_seconds, clock=...)`, `put`, `get`, `len`) is
unchanged.

## Regression tests added (test_ttl_cache.py)

- `test_get_returns_falsy_values` — `0`, `False`, `None` round-trip through the cache.
- `test_get_missing_key_raises` — missing key raises `KeyError`.
- `test_get_expired_raises` — entry past TTL raises `KeyError`.
- `test_get_does_not_refresh_ttl` — a successful `get` at t+5 does not extend life past
  t+10 (boundary expiry still enforced).
- `test_put_updates_existing_key_value_and_ttl` — re-`put` updates value and restarts TTL;
  cache size stays 1.
- `test_put_updates_existing_key_recency` — re-`put` makes the key most-recently-used.
- `test_expired_removed_before_capacity_eviction` — expired entries are purged before
  capacity eviction, so live entries survive.
- `test_eviction_removes_lru_live_entry` — capacity eviction removes the least recently
  used live entry.
- `test_invalid_max_size_raises` — `max_size` of 0 and -1 raise `ValueError`.
- `test_invalid_ttl_raises` — `ttl_seconds` of 0 and -5 raise `ValueError`.

## Test result

Command: `python3 -m unittest test_ttl_cache -v`

```
Ran 13 tests in 0.007s

OK
```

All 13 tests pass (3 pre-existing + 10 new regression tests).
