# Response — Task 02: TTL/LRU cache bug fix

Public API unchanged: `TTLCache(max_size, ttl_seconds, clock)`, `put`, `get`, `__len__`.

## Root causes and fixes (`ttl_cache.py`)

1. **Falsy values rejected** — `get` raised `KeyError` when `not value`,
   so `0`, `False`, `""`, and `None` could never be read back.
   Fix: removed the truthiness check; `KeyError` is raised only by the
   dict lookup (missing key) or by the expiry check.
2. **Wrong clock for timestamps** — `put` stamped entries with `time.time()`
   (wall clock) while `get` compared against the injected monotonic `clock`,
   making TTL comparisons meaningless under a fake clock.
   Fix: `put` stamps with `self.clock()`.
3. **Off-by-one TTL boundary** — expiry used `age > ttl_seconds`, so an entry
   was still live at exactly `age == ttl_seconds`.
   Fix: expiry is `age >= ttl_seconds` (shared `_is_expired` helper).
4. **`get` did not refresh LRU recency** — no `move_to_end`, so reads never
   protected entries from eviction.
   Fix: successful `get` calls `move_to_end(key)` without touching the
   timestamp (TTL is not refreshed).
5. **`put` mishandled existing keys** — reassigning an existing key in an
   `OrderedDict` keeps its original position (stale recency), and the
   `len >= max_size` check counted the key itself, wrongly evicting another
   entry when the cache was full.
   Fix: existing keys are deleted and re-inserted with the new value and a
   fresh timestamp, with no eviction.
6. **Expired entries not purged before capacity enforcement** — a full cache
   holding expired entries evicted the LRU entry (possibly live) instead of
   reclaiming dead slots.
   Fix: `put` of a new key purges all expired entries first, then evicts the
   LRU live entry only if still at capacity.
7. **Missing argument validation** — `max_size < 1` and `ttl_seconds <= 0`
   were silently accepted.
   Fix: `__init__` raises `ValueError` for both.
8. **Expired entries lingered after `get`** — an expired `get` raised but left
   the dead entry in the map.
   Fix: expired entries are deleted before raising `KeyError`.

## Regression cases (`test_ttl_cache.py`, `TTLCacheRegressionTests`)

- `test_falsy_values_returned`: `0`, `False`, `None` round-trip via `get`.
- `test_missing_key_raises`: unknown key raises `KeyError`.
- `test_ttl_uses_injected_clock`: live at age 9.999, expired at age 10.
- `test_get_does_not_refresh_ttl`: `get` at age 6 does not extend the
  age-10 deadline measured from `put`.
- `test_put_updates_value_timestamp_and_recency`: re-`put` changes the value
  and makes the key most-recently-used (the other key is evicted next).
- `test_put_refreshes_ttl_of_existing_key`: re-`put` restarts the TTL window.
- `test_put_existing_key_does_not_evict`: updating a key in a full cache
  evicts nothing.
- `test_expired_purged_before_capacity_eviction`: two expired slots are
  reclaimed with no live eviction and `len` stays 2.
- `test_expired_entry_does_not_cause_live_eviction`: one expired + one live
  entry plus a new `put` keeps the live entry.
- `test_capacity_evicts_lru_live_entry`: plain overflow evicts the LRU key.
- `test_invalid_args_raise_value_error`: `max_size` 0/-1 and `ttl_seconds`
  0/-5 raise `ValueError`.

## Test result

Command: `python3 -m unittest test_ttl_cache -v` (in this directory)

```
Ran 14 tests in 0.001s

OK
```

All 14 tests pass (3 pre-existing + 11 new). Sanity check: the same suite
run against the original implementation yields `FAILED (failures=6, errors=1)`,
confirming the new tests capture the reported bugs.
