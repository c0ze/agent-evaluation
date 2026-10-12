# Bug Fix Report: TTL/LRU Cache

## Root Causes

1. **Falsy values rejected**: `get(key)` used `if not value:` which incorrectly treated `0`, `False`, `None` as missing entries.

2. **Wrong clock in `put`**: Used `time.time()` instead of the injected `clock` for timestamps, breaking testability and TTL accuracy.

3. **TTL boundary off-by-one**: Used `>` instead of `>=` for expiration check, causing entries to live one tick longer than specified.

4. **No LRU refresh on `get`**: Successful `get` did not move the key to end of `OrderedDict`, breaking LRU recency.

5. **`put` didn't update existing keys**: Failed to update value, timestamp, and recency for existing keys.

6. **No expired cleanup before capacity enforcement**: `put` evicted LRU entry without first removing expired entries, wasting capacity.

7. **Missing input validation**: No `ValueError` for `max_size < 1` or `ttl_seconds <= 0`.

## Fixes Applied (`ttl_cache.py`)

- Added validation in `__init__` for `max_size >= 1` and `ttl_seconds > 0`.
- Added `_remove_expired()` helper called at start of `put()`.
- `put()` now updates value, timestamp (using `self.clock()`), and moves existing keys to end.
- `get()` checks key existence first, then TTL with `>=`, deletes expired entry on miss, moves key to end on hit, returns value (including falsy).
- `put()` uses `self.clock()` for new entry timestamps.
- Capacity eviction only triggers after expired cleanup.

## Regression Tests Added (`test_ttl_cache.py`)

| Test | Covers |
|------|--------|
| `test_get_returns_falsy_values` | Bug 1: `0`, `False`, `None` returned correctly |
| `test_ttl_uses_injected_clock` | Bug 2: TTL respects injected clock |
| `test_expires_at_boundary` | Bug 3: Expiration at exact `ttl_seconds` |
| `test_get_refreshes_lru` | Bug 4: `get` refreshes LRU recency |
| `test_put_updates_existing_key` | Bug 5: `put` updates value/timestamp/recency |
| `test_put_refreshes_recency_of_existing_key` | Bug 5: `put` updates recency for existing key |
| `test_expired_entries_removed_before_capacity_enforcement` | Bug 6: Expired cleaned before eviction |
| `test_max_size_less_than_one_raises` | Bug 7: Validation for `max_size` |
| `test_ttl_seconds_less_than_or_equal_zero_raises` | Bug 7: Validation for `ttl_seconds` |
| `test_get_does_not_refresh_ttl` | TTL not refreshed on `get` |
| `test_get_missing_key_raises_keyerror` | Missing key behavior |
| `test_len_reflects_live_entries` | `__len__` reflects live entries after cleanup |

## Test Result

```
Ran 14 tests in 0.016s

OK
```

All 14 tests pass, including the 3 original tests and 11 new regression tests.