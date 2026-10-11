# Task 02 — Bug fixing: TTL/LRU cache

## Root causes

1. **Wrong timestamp source in `put`** — used `time.time()` instead of the
   injected monotonic `self.clock()`, so TTL could never be tested/advanced by
   a fake clock.
2. **Falsy values rejected in `get`** — `if not value: raise KeyError(key)`
   wrongly treated `0`, `False`, and `None` as missing entries.
3. **Off-by-one TTL boundary** — expiry used `age > ttl_seconds` instead of
   `age >= ttl_seconds`.
4. **No LRU recency refresh on `get`** — a successful read did not move the
   entry to the MRU end of the `OrderedDict`.
5. **No expired-entry purging before capacity enforcement** — `put` could evict
   a live entry while expired entries still occupied capacity, and never removed
   expired entries at all.
6. **Incorrect eviction trigger** — `put` evicted on `len >= max_size` *before*
   inserting, which evicted even when updating an existing key or when there was
   free room, and never removed the actual LRU live entry when over capacity.
7. **No argument validation** — `max_size < 1` and `ttl_seconds <= 0` were
   accepted instead of raising `ValueError`.

## Fixes

Rewrote `ttl_cache.py` while preserving the public API (`TTLCache(max_size,
ttl_seconds, clock=...)`, `put`, `get`, `__len__`):

- Constructor validates `max_size` and `ttl_seconds`.
- `put` first `_purge_expired()`, then updates/replaces the key (deleting an
  existing key so value, timestamp, and recency all refresh), then evicts the
  LRU entry only when `len(self._items) > self.max_size`.
- `get` raises `KeyError` for missing keys and for entries whose
  `age >= ttl_seconds`, deletes expired entries, otherwise calls
  `move_to_end(key)` to refresh recency and returns the raw value (falsy values
  included).

## Regression cases

Added `test_ttl_cache_regression.py` covering:

- `max_size < 1` / `ttl_seconds <= 0` raise `ValueError`.
- Falsy values (`0`, `False`, `None`) are returned.
- Missing key raises `KeyError`.
- Exact expiry boundary (`age == ttl_seconds`) raises `KeyError`.
- Successful `get` refreshes recency but not TTL.
- `put` updates value, timestamp and recency.
- Expired entries are removed before capacity eviction.
- Capacity eviction removes the least recently used live entry.
- Updating an existing key does not evict another entry.
- `__len__` reflects current entries.

## Test result

```
Ran 13 tests in 0.004s

OK
```

(3 original tests in `test_ttl_cache.py` + 10 regression tests, all passing.)
