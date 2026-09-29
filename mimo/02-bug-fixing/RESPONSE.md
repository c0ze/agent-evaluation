# Response — Task 02: TTL/LRU cache bug fixes

## Root causes

1. **Falsy values treated as missing** — `get` used `if not value: raise KeyError`, so stored
   `0`, `False`, `None`, and `""` were wrongly rejected.
2. **Wall-clock timestamps** — `put` recorded `time.time()` instead of the injected `clock`,
   so TTL checks mixed two time bases and the boundary test could never expire entries.
3. **Off-by-one expiry** — comparison used `age > ttl_seconds`; spec requires expiry at
   `age >= ttl_seconds`.
4. **`get` did not refresh LRU recency** — successful gets left the entry at its old position,
   so the wrong item was later evicted under capacity pressure.
5. **`put` evicted before key-existence check** — updating an existing key while at capacity
   popped the LRU entry even though no growth occurred.
6. **`put` did not purge expired entries first** — dead entries counted against capacity and
   could force eviction of live entries.
7. **`put` did not move updated keys to the MRU position.**
8. **No constructor validation** — `max_size < 1` and `ttl_seconds <= 0` were accepted.

## Fixes (public API unchanged)

- `get` returns the stored value as-is (including falsy values); raises `KeyError` only for
  missing or expired keys (expired entry is also dropped from the map).
- All timestamps come from `self.clock()`; expiry is `now - created >= ttl_seconds`.
- Successful `get` calls `move_to_end` (LRU refresh) and never rewrites the timestamp
  (TTL is not extended).
- `put` purges expired entries, evicts the LRU live entry only when inserting a *new* key at
  capacity, then stores `(value, self.clock())` and `move_to_end`s the key (covers both
  insert and update recency/timestamp refresh).
- `__init__` raises `ValueError` for `max_size < 1` or `ttl_seconds <= 0`.

## Regression cases (test_ttl_cache_regression.py)

| Case | Behavior pinned |
|---|---|
| `test_get_returns_falsy_values` | `0`, `False`, `None`, `""` round-trip |
| `test_missing_key_raises_key_error` | missing key → `KeyError` |
| `test_expired_raises_key_error` | `age == ttl` → `KeyError` |
| `test_not_expired_just_before_boundary` | `age < ttl` still live |
| `test_ttl_uses_injected_clock` | expiry driven only by injected clock |
| `test_get_refreshes_lru_not_ttl` | get moves recency, does not extend TTL |
| `test_get_refreshes_lru_for_eviction` | get prevents the touched entry from being evicted |
| `test_put_updates_value_timestamp_and_recency` | put refreshes value, timestamp, and recency |
| `test_put_existing_key_at_capacity_does_not_evict` | update at capacity keeps all entries |
| `test_expired_removed_before_capacity` | expired entries purged before capacity logic |
| `test_capacity_evicts_lru_live_entry` | eviction picks least-recently-used live entry |
| `test_invalid_max_size` / `test_invalid_ttl` | `ValueError` on `max_size < 1`, `ttl_seconds <= 0` |

## Test result

```
Ran 16 tests in 0.001s

OK
```

(3 original tests in `test_ttl_cache.py` + 13 regression tests in
`test_ttl_cache_regression.py`, `python3 -m unittest test_ttl_cache test_ttl_cache_regression -v`.)
