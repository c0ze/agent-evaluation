# RESPONSE — Task 02: TTL/LRU cache bug fixing

## Root causes

1. **`get` conflated falsy values with missing keys** (`ttl_cache.py:19`).
   `if not value: raise KeyError(key)` treated `0`, `False`, `None`, `""` and `[]` as
   absent, so perfectly valid live entries could never be read. The check has nothing
   to do with key membership — presence was already established by the dict lookup.
   Fix: lookup `key not in self._items` for membership and never inspect truthiness
   of the stored value.

2. **`get` used a strict `>` for TTL comparison** (`ttl_cache.py:21`).
   `self.clock() - created > self.ttl_seconds` kept an entry alive when
   `age == ttl_seconds`, contradicting the required `age >= ttl_seconds` rule.
   Fix: `_is_expired()` returns `self.clock() - created >= self.ttl_seconds`.

3. **`get` never refreshed LRU recency** (`ttl_cache.py:17-23`).
   The value was returned without `self._items.move_to_end(key)`, so a frequently
   read key could be evicted ahead of a cold one. Fix: `move_to_end(key)` on a
   successful read (TTL deliberately untouched, so reads never extend expiry).

4. **`put` timestamped with `time.time()` instead of the injected clock**
   (`ttl_cache.py:15`). TTL bookkeeping bypassed the injectable `self.clock()`,
   which made expiry untestable and broke the "TTL uses the injected monotonic
   clock" contract. Fix: `self.clock()`.

5. **`put` evicted before purging, and evicted on overwrites**
   (`ttl_cache.py:13-14`). `if len(...) >= self.max_size: popitem()` fired
   unconditionally, so (a) inserting a 3rd key into a full cache evicted a live
   LRU entry even when the *first* key was already expired and should have been
   reclaimed, and (b) re-`put`ting an existing key evicted an innocent third
   entry before overwriting. Fix: `_purge_expired()` first, then only evict when
   the key is genuinely new (`key not in self._items and len(...) >= max_size`).

6. **`get` left expired entries in the dict.** Raising `KeyError` without deleting
   the entry meant a dead entry still occupied a slot and was counted by
   `__len__`. Fix: delete the expired entry before raising `KeyError`.

7. **No constructor validation.** `max_size < 1` or `ttl_seconds <= 0` produced a
   cache that evicted every write ("cache that always misses") or expired entries
   instantly. Fix: raise `ValueError` for both in `__init__`.

Public API (`__init__(max_size, ttl_seconds, clock=time.monotonic)`, `put`, `get`,
`__len__`) is unchanged.

## Regression cases added

| Test | Catches |
| --- | --- |
| `test_falsy_values_are_returned` | `0`, `False`, `None`, `""`, `[]` stored and read back |
| `test_missing_key_raises_key_error` | genuine absence still raises `KeyError` |
| `test_expires_at_boundary` | `age == ttl_seconds` expires (boundary, plus one tick under/over) |
| `test_ttl_uses_injected_clock` | expiry follows `clock`, not wall clock; strictly-fresh entry survives |
| `test_get_does_not_refresh_ttl` | a successful `get` refreshes recency only, not the timestamp |
| `test_get_refreshes_lru` | read makes the key newest, so the cold one is evicted |
| `test_put_updates_existing_key` | overwrite updates value + timestamp, no eviction, no extra entry |
| `test_put_updates_recency` | overwrite refreshes recency (protected from eviction) |
| `test_expired_entries_removed_before_eviction` | expired entry reclaimed before capacity is enforced |
| `test_all_expired_entries_do_not_evict_new_put` | fully-expired cache takes a new `put` without data loss |
| `test_evicts_lru_live_entry` | the least recently used **live** entry is the one evicted |
| `test_expired_entry_is_removed` | expired entry is dropped from storage / `__len__` on read |
| `test_len_reports_stored_entries` | `len` tracks live stored entries |
| `test_invalid_max_size_raises_value_error` | `max_size` of `0` and `-1` rejected |
| `test_invalid_ttl_seconds_raises_value_error` | `ttl_seconds` of `0` and `-5` rejected |

## Exact test result

```
$ python3 -m unittest test_ttl_cache
................
----------------------------------------------------------------------
Ran 16 tests in 0.002s

OK
```

16 tests, 0 failures, 0 errors, exit status 0.
