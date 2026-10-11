# Task 02 — Bug fixing: TTL/LRU cache

## Root causes

1. **Falsy values rejected by `get`.** `get` contained `if not value: raise KeyError(key)`,
   so legitimately stored values such as `0`, `False` and `None` could never be read back.
2. **Wrong clock in `put`.** Timestamps were recorded with `time.time()` while `get` compared
   against the injected `clock`, making TTL behavior inconsistent/untestable.
3. **Wrong expiry comparison.** `get` used `>` instead of `>=`, so entries survived exactly
   at `age == ttl_seconds` instead of expiring at the boundary.
4. **No LRU recency maintenance.** `get` never moved the entry to the most-recently-used end
   (`OrderedDict.move_to_end`), and `put` on an existing key kept its original insertion
   position and timestamp, so eviction order and TTL refresh on update were broken.
5. **No expired-entry purge before capacity enforcement.** `put` evicted the oldest entry
   purely by position without first removing expired entries, so live entries could be
   evicted while dead ones occupied capacity.
6. **`put` on an existing key triggered eviction.** The capacity check ran before checking
   whether the key already existed, so an update could evict an unrelated entry.
7. **Missing argument validation.** `max_size < 1` and `ttl_seconds <= 0` were accepted
   silently instead of raising `ValueError`.

## Fixes

- Constructor now raises `ValueError` for `max_size < 1` or `ttl_seconds <= 0`.
- `put` records timestamps with the injected `clock`; updating an existing key replaces the
  value and timestamp and moves it to the MRU end without any eviction.
- `put` (new key) purges expired entries via `_purge_expired()` before enforcing capacity,
  then evicts the LRU entry (`popitem(last=False)`) only if still full.
- `get` raises `KeyError` only for missing keys or entries whose
  `clock() - created >= ttl_seconds` (expired entries are deleted on access), returns any
  stored value including falsy ones, and calls `move_to_end` to refresh recency without
  touching the TTL timestamp.
- Public API (`__init__`, `put`, `get`, `__len__`) is unchanged.

## Regression tests added (test_ttl_cache.py)

- `test_get_returns_falsy_values` — `0`, `False`, `None` round-trip through `get`.
- `test_uses_injected_clock` — expiry follows the injected clock, boundary inclusive.
- `test_get_refreshes_lru_but_not_ttl` — a `get` mid-life does not extend the TTL.
- `test_put_updates_value_timestamp_and_recency` — update resets value, TTL and LRU order.
- `test_put_existing_key_does_not_evict` — update never evicts other entries.
- `test_expired_removed_before_capacity_eviction` — purge happens before eviction.
- `test_expired_purge_preserves_live_lru_order` — live entries survive the purge.
- `test_capacity_evicts_lru_live_entry` — eviction picks the least recently used live entry.
- `test_invalid_arguments_raise_value_error` — `max_size < 1`, `ttl_seconds <= 0`.
- `test_missing_key_raises_key_error` — absent keys raise `KeyError`.

## Exact test result

```
$ python3 -m unittest test_ttl_cache -v
test_capacity_evicts_lru_live_entry (test_ttl_cache.TTLCacheTests.test_capacity_evicts_lru_live_entry) ... ok
test_expired_purge_preserves_live_lru_order (test_ttl_cache.TTLCacheTests.test_expired_purge_preserves_live_lru_order) ... ok
test_expired_removed_before_capacity_eviction (test_ttl_cache.TTLCacheTests.test_expired_removed_before_capacity_eviction) ... ok
test_expires_at_boundary (test_ttl_cache.TTLCacheTests.test_expires_at_boundary) ... ok
test_get_refreshes_lru (test_ttl_cache.TTLCacheTests.test_get_refreshes_lru) ... ok
test_get_refreshes_lru_but_not_ttl (test_ttl_cache.TTLCacheTests.test_get_refreshes_lru_but_not_ttl) ... ok
test_get_returns_falsy_values (test_ttl_cache.TTLCacheTests.test_get_returns_falsy_values) ... ok
test_invalid_arguments_raise_value_error (test_ttl_cache.TTLCacheTests.test_invalid_arguments_raise_value_error) ... ok
test_missing_key_raises_key_error (test_ttl_cache.TTLCacheTests.test_missing_key_raises_key_error) ... ok
test_put_existing_key_does_not_evict (test_ttl_cache.TTLCacheTests.test_put_existing_key_does_not_evict) ... ok
test_put_updates_value_timestamp_and_recency (test_ttl_cache.TTLCacheTests.test_put_updates_value_timestamp_and_recency) ... ok
test_round_trip (test_ttl_cache.TTLCacheTests.test_round_trip) ... ok
test_uses_injected_clock (test_ttl_cache.TTLCacheTests.test_uses_injected_clock) ... ok

----------------------------------------------------------------------
Ran 13 tests in 0.002s

OK
```
