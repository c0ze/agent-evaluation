# TTL/LRU cache fixes

Public API is unchanged: `TTLCache(max_size, ttl_seconds, clock=time.monotonic)`, `put`, `get`, and `__len__`.

## Root causes

- `get` treated every falsy stored value as a miss (`if not value`), so a present entry whose value was `0`, `False`, `None`, or `""` raised `KeyError`.
- New timestamps were taken from `time.time()`, so the injected monotonic clock did not control TTL. Expiry also used `age > ttl_seconds`, so an entry whose age was exactly `ttl_seconds` was still returned.
- A successful `get` did not move the key to the most-recent end of the `OrderedDict`, so a later insert evicted the oldest insertion rather than the least recently used live key.
- On a full cache, `put` always dropped the oldest entry before writing. Replacing a key that was already present could therefore evict a different live key. The replacement also kept the key's previous position, so the write did not become most recent, and the wall-clock timestamp meant the write did not refresh TTL on the injected clock.
- `put` enforced `max_size` while expired entries still occupied slots. Because a read updates recency and leaves the original timestamp in place, the expired entry can sit at the most-recent end while an older live entry sits at the least-recent end. Dropping that oldest entry evicted a live key and left the expired one behind.
- The constructor accepted `max_size < 1` and `ttl_seconds <= 0`.

## Fixes

- The constructor raises `ValueError` when `max_size < 1` or `ttl_seconds <= 0`.
- Each entry is stored as `(value, clock())`.
- `get` returns the stored value for every present, unexpired key. A missing key raises `KeyError`. A key with `age >= ttl_seconds` is removed and raises `KeyError`. A successful read moves that key to most-recently used and does not change its timestamp.
- `put` reads the clock once, removes every expired entry, then updates an existing live key's value, timestamp, and recency. A new key is inserted only after that purge; if the cache is still full, the least recently used remaining entry is evicted.

## Regression cases

- `test_get_returns_falsy_values`: `get` returns `0`, `False`, `None`, and `""`.
- `test_missing_key_raises_keyerror`: an unknown key raises `KeyError` and does not change cache size.
- `test_expired_falsy_value_raises_keyerror`: expired `0`, `False`, and `None` raise `KeyError` and are removed.
- `test_entry_live_until_ttl`: age 9 with TTL 10 still returns the value (including `0`).
- `test_expires_at_boundary`: age equal to `ttl_seconds` raises `KeyError` on the injected clock.
- `test_get_does_not_refresh_ttl`: a successful read keeps the key over a newer one for LRU purposes, and the key still expires from its original `put` time.
- `test_get_refreshes_lru`: after `get("a")` on a full cache, inserting `c` evicts `b`.
- `test_put_updates_value_without_evicting`: replacing `b` on a full cache keeps `a` and returns the new value.
- `test_put_refreshes_timestamp_of_existing_key_only`: replacing `a` extends only `a`; `b` expires on its original timestamp, and `a` expires `ttl_seconds` after the replacement.
- `test_put_refreshes_recency`: replacing a middle key makes it the newest, so later inserts evict the untouched older keys (`a` and `c`) and keep the replacement (`b`).
- `test_put_replaces_expired_key_without_evicting_live_neighbor`: writing an expired key refreshes it and leaves the live neighbor in place.
- `test_expired_entries_removed_before_capacity_eviction`: the expired most-recent key is dropped, and the live least-recent key is kept, when a new key is inserted into a full cache.
- `test_all_expired_entries_free_capacity`: a full cache of expired entries is cleared before the new key is stored, so a second new key also fits.
- `test_evicts_least_recently_used_live_entry`: with two live entries, the third insert evicts the oldest and the cache length stays at `max_size`.
- `test_capacity_one_update_does_not_drop_key`: a same-key `put` at `max_size` 1 keeps that key; a different key then replaces it.
- `test_rejects_invalid_max_size`: `0`, `0.5`, and `-1` raise `ValueError`.
- `test_rejects_invalid_ttl`: `0`, `-0.01`, and `-10` raise `ValueError`.
- `test_round_trip`: a normal put/get still returns the stored value.

## Test result

Command (task directory, Python 3.14.5):

`python3 -m unittest -v test_ttl_cache.py`

Exit code: 0

```
test_all_expired_entries_free_capacity (test_ttl_cache.TTLCacheTests.test_all_expired_entries_free_capacity) ... ok
test_capacity_one_update_does_not_drop_key (test_ttl_cache.TTLCacheTests.test_capacity_one_update_does_not_drop_key) ... ok
test_entry_live_until_ttl (test_ttl_cache.TTLCacheTests.test_entry_live_until_ttl) ... ok
test_evicts_least_recently_used_live_entry (test_ttl_cache.TTLCacheTests.test_evicts_least_recently_used_live_entry) ... ok
test_expired_entries_removed_before_capacity_eviction (test_ttl_cache.TTLCacheTests.test_expired_entries_removed_before_capacity_eviction) ... ok
test_expired_falsy_value_raises_keyerror (test_ttl_cache.TTLCacheTests.test_expired_falsy_value_raises_keyerror) ... ok
test_expires_at_boundary (test_ttl_cache.TTLCacheTests.test_expires_at_boundary) ... ok
test_get_does_not_refresh_ttl (test_ttl_cache.TTLCacheTests.test_get_does_not_refresh_ttl) ... ok
test_get_refreshes_lru (test_ttl_cache.TTLCacheTests.test_get_refreshes_lru) ... ok
test_get_returns_falsy_values (test_ttl_cache.TTLCacheTests.test_get_returns_falsy_values) ... ok
test_missing_key_raises_keyerror (test_ttl_cache.TTLCacheTests.test_missing_key_raises_keyerror) ... ok
test_put_refreshes_recency (test_ttl_cache.TTLCacheTests.test_put_refreshes_recency) ... ok
test_put_refreshes_timestamp_of_existing_key_only (test_ttl_cache.TTLCacheTests.test_put_refreshes_timestamp_of_existing_key_only) ... ok
test_put_replaces_expired_key_without_evicting_live_neighbor (test_ttl_cache.TTLCacheTests.test_put_replaces_expired_key_without_evicting_live_neighbor) ... ok
test_put_updates_value_without_evicting (test_ttl_cache.TTLCacheTests.test_put_updates_value_without_evicting) ... ok
test_rejects_invalid_max_size (test_ttl_cache.TTLCacheTests.test_rejects_invalid_max_size) ... ok
test_rejects_invalid_ttl (test_ttl_cache.TTLCacheTests.test_rejects_invalid_ttl) ... ok
test_round_trip (test_ttl_cache.TTLCacheTests.test_round_trip) ... ok

----------------------------------------------------------------------
Ran 18 tests in 0.000s

OK
```
