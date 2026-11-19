# Task 02 — TTL/LRU Cache Fix

## Root causes and fixes

1. **Falsy values treated as missing.** `get` used `if not value:` and raised
   `KeyError` for `0`, `False`, `None`, `""`, etc. Replaced with an explicit
   membership check (`if key not in self._items`) so only missing or expired
   entries raise; stored values are returned unchanged.

2. **Wrong clock for timestamps.** `put` stamped entries with `time.time()`
   (wall clock) instead of the injected monotonic `clock`. TTL is now computed
   from `self.clock()` consistently in both `put` and `get`.

3. **Wrong TTL comparison.** `get` used `>` so an entry was still live at
   `age == ttl_seconds`. Requirement is expiry at `age >= ttl_seconds`, so the
   comparison was changed to `>=` (via `_expired`).

4. **`get` did not refresh LRU recency.** Returning a value left the entry's
   position unchanged in the `OrderedDict`. Added `self._items.move_to_end(key)`
   on a successful `get`. TTL is intentionally *not* refreshed — the original
   `created` timestamp is preserved.

5. **Expired entries were not purged before capacity eviction.** `put` evicted
   `popitem(last=False)` immediately whenever full, which could discard a live
   LRU entry even when expired entries were present. Added `_purge_expired()`
   (using the injected clock and the `>=` rule) before checking capacity.

6. **`put` on an existing key evicted an unrelated entry.** The old code checked
   capacity before considering whether the key already existed, so updating an
   existing key could evict another key and grow the cache. Now `put` first
   updates the value/timestamp of an existing key in place and moves it to the
   end (updating recency); capacity handling only runs for new keys.

7. **Expired entries lingered in the cache on `get`.** On detecting expiry,
   `get` now deletes the expired entry before raising `KeyError`, keeping
   `__len__` and subsequent operations accurate.

8. **No constructor validation.** Added `ValueError` for `max_size < 1` and
   `ttl_seconds <= 0`.

The public API (`TTLCache(max_size, ttl_seconds, clock=time.monotonic)`, `put`,
`get`, `__len__`) is unchanged.

## Regression cases added

- `test_falsy_values_are_returned` — 0, False, None and "" are returned by identity.
- `test_missing_key_raises_key_error` — missing key raises `KeyError`.
- `test_ttl_uses_injected_clock_at_boundary` — age 9.999 is live, exactly 10 is expired.
- `test_get_refreshes_lru_but_not_ttl` — a get does not restart the TTL clock.
- `test_put_updates_value_timestamp_and_recency` — updating refreshes value, timestamp and recency.
- `test_put_updates_existing_key_without_growing` — in-place update does not change length.
- `test_expired_entries_removed_before_capacity_eviction` — expired entries purged before eviction.
- `test_expired_lru_freed_instead_of_evicting_live_lru` — a live entry is kept when an expired one can be purged.
- `test_capacity_eviction_removes_live_lru` — least recently used live entry evicted.
- `test_invalid_construction_raises_value_error` — invalid `max_size` / `ttl_seconds` rejected.

(The three original tests were kept unchanged.)

## Exact test result

Command: `python3 -m unittest -v test_ttl_cache`

```
Ran 13 tests in 0.001s

OK
```

All 13 tests passed.
