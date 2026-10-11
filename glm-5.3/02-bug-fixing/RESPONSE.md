# Task 02 — Response: TTL/LRU cache bug fixing

## Root causes (in the original `ttl_cache.py`)

1. **TTL ignored the injected clock.** `put` stored `time.time()` as the entry
   timestamp instead of `self.clock()`, so expiry was computed against the real
   wall clock rather than the injected monotonic clock (and mixed time bases).
2. **Falsy values treated as missing.** `get` raised `KeyError` whenever
   `not value` was true, so stored values `0`, `False`, `None`, `""`, etc. could
   never be read back.
3. **Off-by-one expiry boundary.** `get` expired entries only when
   `age > ttl_seconds`; the spec requires expiry at `age >= ttl_seconds`.
4. **`get` did not refresh LRU recency.** There was no `move_to_end` on a
   successful `get`, so recency tracked insertion order only, and capacity
   eviction removed the wrong entry.
5. **`put` did not update recency for existing keys**, and blindly evicted the
   oldest entry whenever `len >= max_size`, even when the key already existed
   (where no capacity pressure is created).
6. **No purge of expired entries before capacity enforcement.** Dead entries
   consumed capacity and could cause eviction of live entries.
7. **No argument validation.** `max_size < 1` and `ttl_seconds <= 0` were
   accepted silently instead of raising `ValueError`.

## Fixes

- `put` now stamps entries with `self.clock()`, refreshes an existing key's
  value/timestamp/recency in place without eviction, and — only when inserting
  a *new* key — first purges all expired entries (`age >= ttl_seconds`), then
  evicts the least recently *used* live entry via `popitem(last=False)` if the
  cache is still at capacity, and finally moves the key to the end.
- `get` raises `KeyError` only for missing or expired entries (never for falsy
  values), uses `age >= ttl_seconds` for expiry, deletes the entry when it is
  found expired, and refreshes recency (`move_to_end`) on success without
  touching the stored timestamp (TTL is not refreshed by `get`).
- `__init__` validates `max_size >= 1` and `ttl_seconds > 0`, raising
  `ValueError` otherwise. The public API (`put`, `get`, `__len__`, constructor
  signature) is unchanged.

## Regression cases added (`TTLCacheRegressionTests` in `test_ttl_cache.py`)

- `test_get_returns_falsy_values` — `0`, `False`, `None`, `""` round-trip.
- `test_get_missing_key_raises_key_error` — missing key raises `KeyError`.
- `test_ttl_uses_injected_clock` — expiry driven by the injected clock; live at
  `age 9`, expired at `age 10 == ttl`.
- `test_get_refreshes_recency` — a `get` makes an entry survive LRU eviction.
- `test_get_does_not_refresh_ttl` — entry expires relative to its `put` time
  even after a recent successful `get`.
- `test_put_updates_value_timestamp_and_recency` — re-`put` resets the TTL
  window (live at 9s after update despite 14s since first put) and the value.
- `test_put_existing_refreshes_recency_for_eviction` — re-`put` moves a key to
  most-recent, so the other entry is evicted.
- `test_put_existing_at_capacity_does_not_evict` — updating an existing key at
  capacity evicts nothing.
- `test_capacity_evicts_lru_live_entry` — at capacity with all live entries,
  the least recently used one is evicted.
- `test_expired_entries_purged_before_capacity_eviction` — fully expired cache
  makes room for a new key without evicting anything.
- `test_purge_keeps_live_entry_despite_expired_recency` — an expired entry that
  is most-recent is purged, while an older *live* entry survives eviction.
- `test_len_tracks_entries` — `len` counts distinct keys, not re-puts.
- `test_invalid_arguments_raise_value_error` — `max_size < 1` and
  `ttl_seconds <= 0` raise `ValueError`.

## Test result (exact)

Command: `python3 -m unittest -v test_ttl_cache` (Python 3.14.7)

```
Ran 16 tests in 0.003s

OK
```

All 16 tests pass: the 3 original tests (which failed 2/3 before the fix) plus
13 regression tests.