# Task 02 — Bug fixing: TTL/LRU cache

## Root causes and fixes

All changes are contained in `ttl_cache.py`; the public API
(`TTLCache(max_size, ttl_seconds, clock=time.monotonic)`, `put`, `get`, `__len__`)
is unchanged.

1. **`get` rejected falsy values** — `if not value: raise KeyError(key)` conflated
   "no value" with "falsy value", so `0`, `False`, `None` and `""` were reported as
   misses. Removed the check; a `KeyError` is now raised only by the lookup itself
   (missing key) or by expiry.

2. **TTL ignored the injected clock** — `put` stamped entries with `time.time()`
   while `get` compared against `self.clock()`. The wall-clock stamp and the
   monotonic/fake clock live on different epochs, so TTL math was meaningless and
   untestable. `put` now stamps with `self.clock()`.

3. **Wrong expiry boundary** — `self.clock() - created > self.ttl_seconds` kept an
   entry alive at exactly `age == ttl_seconds`. The spec requires expiry at
   `age >= ttl_seconds`; changed to `>=`.

4. **`get` did not refresh LRU recency** — a successful read left the key at its old
   position in the `OrderedDict`, so the next `put` could evict a key that had just
   been used. Added `self._items.move_to_end(key)` after the expiry check.

5. **`get` did not refresh TTL** — correct, and now explicitly preserved: only the
   recency moves, the stored timestamp is untouched (previously TTL refresh was
   masked by bug 2, since the timestamp was not even on the same clock).

6. **`put` evicted before purging expired entries** — capacity was enforced against
   stale entries, evicting live data while dead entries still occupied slots.
   `put` now calls `_purge_expired()` first, then enforces capacity.

7. **`put` evicted on update of an existing key** — `len(self._items) >= max_size`
   dropped the LRU entry even when the key being written was already present, so a
   full-cache update silently lost another entry. The existing key is now deleted
   first (also moving it to the most-recent position), so updates never evict.

8. **`put` did not refresh recency on update** — re-assigning an existing
   `OrderedDict` key keeps its original position. The delete-then-insert above fixes
   this, so `put` updates value, timestamp and recency as required.

9. **Missing constructor validation** — `max_size < 1` and `ttl_seconds <= 0` now
   raise `ValueError`; previously a `max_size` of 0 made every `put` useless and a
   non-positive TTL either expired everything instantly or never expired.

Expired entries are also dropped from the dict when `get` observes them, so a
`len()` reading never counts dead entries.

## Regression cases added (`test_ttl_cache.py`)

The three original tests are kept; nine were added:

| Test | Guards |
| --- | --- |
| `test_falsy_values_are_returned` | `0`, `False`, `None` round-trip (bug 1) |
| `test_missing_key_raises_key_error` | `KeyError` only for absent keys |
| `test_alive_just_before_ttl_boundary` | entry alive at `ttl - epsilon` (bug 3) |
| `test_expires_at_boundary` (existing) | expired exactly at `age == ttl` (bug 3) |
| `test_get_does_not_refresh_ttl` | repeated `get` does not extend lifetime |
| `test_get_refreshes_lru` (existing) | read refreshes recency (bug 4) |
| `test_put_updates_value_timestamp_and_recency` | update refreshes value + TTL + recency, no eviction (bugs 7, 8) |
| `test_expired_entries_purged_before_capacity_eviction` | dead entries freed before capacity enforced (bug 6) |
| `test_capacity_evicts_least_recently_used_live_entry` | LRU victim chosen among live entries (bugs 4, 6) |
| `test_invalid_configuration_raises_value_error` | `ValueError` for `max_size` 0/-1 and `ttl_seconds` 0/-5 (bug 9) |
| `test_default_clock_is_monotonic` | default `clock` stays `time.monotonic` |

## Test result

```
$ python3 -m unittest -v test_ttl_cache
test_alive_just_before_ttl_boundary ... ok
test_capacity_evicts_least_recently_used_live_entry ... ok
test_default_clock_is_monotonic ... ok
test_expired_entries_purged_before_capacity_eviction ... ok
test_expires_at_boundary ... ok
test_falsy_values_are_returned ... ok
test_get_does_not_refresh_ttl ... ok
test_get_refreshes_lru ... ok
test_invalid_configuration_raises_value_error ... ok
test_missing_key_raises_key_error ... ok
test_put_updates_value_timestamp_and_recency ... ok
test_round_trip ... ok

----------------------------------------------------------------------
Ran 12 tests in 0.001s

OK
```

12 tests, all passing (12 passed, 0 failed).
