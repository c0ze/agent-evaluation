# Task 02 — TTL/LRU cache: root causes, fixes, regressions

## Root causes and fixes (`ttl_cache.py`)

1. **Falsy values treated as missing.** `get()` had `if not value: raise KeyError(key)`, so
   stored `0`, `False`, `None`, `""` were reported as missing.
   *Fix:* removed the truthiness check; only absence from `_items` (natural `KeyError` from
   the dict lookup) or expiry raises `KeyError`.

2. **Wall clock used instead of the injected clock.** `put()` stored `time.time()` while
   `get()` compared against `self.clock()` (monotonic by default). Mixing two different time
   bases makes ages meaningless (and negative) whenever a fake clock is injected.
   *Fix:* every timestamp is now produced by `self.clock()`, so TTL and expiry are driven
   solely by the injected monotonic clock. `time` is kept only as the default clock source.

3. **Wrong expiry boundary.** `self.clock() - created > self.ttl_seconds` kept an entry alive
   exactly at `age == ttl_seconds`.
   *Fix:* `>=`, so an entry expires as soon as `age >= ttl_seconds`.

4. **`get()` did not refresh LRU recency.** A hit left the entry at its insertion position, so
   a still-frequently-used entry could be evicted.
   *Fix:* `self._items.move_to_end(key)` on a successful hit. The stored timestamp is
   untouched, so a hit refreshes recency but *not* TTL.

5. **Expired entries were never removed, and stale reads kept them alive.** `get()` raised but
   left the dead entry in the map, and capacity was enforced over dead entries too.
   *Fix:* an expired `get()` deletes the entry; `put()` calls `_purge_expired()` first, so
   expired entries are dropped *before* capacity is enforced and capacity eviction only ever
   removes the least recently used *live* entry.

6. **`put()` on an existing key did not refresh recency or timestamp.** Re-assigning into an
   `OrderedDict` keeps the key's original position, so an updated key could be evicted first
   and could keep an old (already nearly expired) creation time.
   *Fix:* existing keys are overwritten and then `move_to_end(key)`, giving a fresh timestamp
   and newest recency.

7. **No constructor validation.** Nonsensical `max_size`/`ttl_seconds` were accepted (a
   `max_size` of 0 evicted every entry immediately; a non-positive TTL expired instantly).
   *Fix:* `ValueError` for `max_size < 1` and for `ttl_seconds <= 0`.

The public API (`TTLCache(max_size, ttl_seconds, clock)`, `put`, `get`, `__len__`) is unchanged.

## Regression cases added (`test_ttl_cache.py`)

The three original tests are kept unchanged (`test_round_trip`, `test_expires_at_boundary`,
`test_get_refreshes_lru`). Added:

- `test_falsy_values_are_returned` — `0`, `False`, `None`, `""` round-trip and are returned
  identically (guards bug 1).
- `test_missing_key_raises_key_error` — `get` on an absent key raises `KeyError`.
- `test_uses_injected_clock_not_wall_clock` — with the fake clock, entry lives at age 4.999 and
  dies at age 5 (guards bug 2).
- `test_alive_strictly_before_ttl` — alive at `ttl - epsilon`.
- `test_expires_at_boundary` (pre-existing) — dead at exactly `ttl` (guards bug 3).
- `test_get_does_not_refresh_ttl` — a hit at t+5 does not extend life to t+15.
- `test_get_refreshes_lru` (pre-existing) + `test_capacity_evicts_least_recently_used_live_entry`
  — hits protect an entry from eviction; the true LRU live entry is the one dropped (bug 4).
- `test_put_updates_value_timestamp_and_recency` — refreshing an existing key updates value,
  timestamp (survives past the original deadline) and recency (bug 6).
- `test_expired_entries_purged_before_capacity_enforced` — with `max_size=2` holding two expired
  entries, inserting a third evicts nothing; `c` is readable (bug 5).
- `test_expired_entry_is_not_evicted_instead_of_live_entry` — an expired entry is purged rather
  than consuming the capacity slot of a live entry (bug 5).
- `test_expired_get_removes_entry` — an expired `get` deletes the entry (`len == 0`).
- `test_repeated_put_does_not_grow_beyond_max_size` — never exceeds `max_size`.
- `test_invalid_configuration` / `test_valid_configuration_boundary` — `ValueError` for
  `max_size` 0/-1 and `ttl_seconds` 0/-5; `TTLCache(1, 0.001)` is accepted (bug 7).

## Test result

```
$ python3 -m unittest -v test_ttl_cache.py   # from the task directory, Python 3
...
Ran 16 tests in 0.005s

OK
```

16 passed, 0 failed.
