# Task 02 — TTL/LRU cache bug fix

## Root causes

1. **Falsy values rejected** — `get` used `if not value: raise KeyError(key)`, so
   legitimate stored values `0`, `False`, `None`, `""`, `[]` were reported as
   missing. Truthiness has nothing to do with presence.
2. **Wrong clock in `put`** — entries were timestamped with `time.time()`
   (wall clock) while expiry was checked against the injected monotonic
   `clock()`. With a fake/injected clock the computed "age" is nonsense
   (typically hugely negative), so entries effectively never expired.
3. **Off-by-one at the TTL boundary** — expiry used `age > ttl_seconds`
   instead of the specified `age >= ttl_seconds`; an entry exactly `ttl`
   seconds old stayed alive.
4. **`get` never refreshed LRU recency** — the `OrderedDict` position was not
   updated (`move_to_end` missing), so reads did not protect entries from
   eviction.
5. **`put` evicted unconditionally at capacity** — `len >= max_size` triggered
   `popitem(last=False)` even when updating an existing key, evicting a live
   entry unnecessarily (and expired entries were never purged before the
   capacity check, so dead entries occupied slots and could cause eviction of
   live ones).
6. **`put` on an existing key did not move it to most-recent** — assigning
   `self._items[key] = ...` in an `OrderedDict` keeps the original position,
   so recency was stale after an update.
7. **No argument validation** — `max_size < 1` and `ttl_seconds <= 0` were
   silently accepted.
8. **Expired entries lingered** — an entry found expired by `get` stayed in the
   dict, and `__len__` counted expired entries as live.

## Fixes (in `ttl_cache.py`, public API unchanged)

- `__init__` raises `ValueError` for `max_size < 1` and `ttl_seconds <= 0`.
- `put` timestamps with the injected `self.clock()`; first purges expired
  entries, then, for an existing key, deletes and re-inserts it (refreshing
  value, timestamp and recency) without evicting; only a genuinely new key at
  capacity evicts the least recently used live entry via `popitem(last=False)`.
- `get` returns any stored value including falsy ones; raises `KeyError` only
  for missing keys or entries with `clock() - created >= ttl_seconds`
  (expired entries are deleted on access); on success calls
  `move_to_end(key)` to refresh LRU recency without touching the timestamp.
- `_purge_expired` helper removes all entries with `age >= ttl_seconds`.
- `__len__` purges expired entries first, so it counts only live entries
  (consistent with `get` treating expired as missing).

## Regression tests (added to `test_ttl_cache.py`, 14 new cases)

- `test_falsy_values_are_returned` — `0`, `False`, `None`, `""`, `[]`, `0.0`
  round-trip (identity-checked).
- `test_missing_key_raises_key_error` — absent key raises `KeyError`.
- `test_alive_just_before_ttl_boundary` — `age = 9.999 < 10` still returns.
- `test_expires_at_boundary` (pre-existing) — `age == ttl` expires (`>=`).
- `test_expired_entry_is_removed_on_get` — expired access deletes the entry
  (`len` drops to 0).
- `test_get_refreshes_lru_but_not_ttl` — read at t+6 keeps LRU order but the
  entry still expires at t+10 (TTL not refreshed by reads).
- `test_put_updates_existing_value_and_ttl` — re-put resets value and
  timestamp (alive at t+12 with ttl 10).
- `test_put_updates_recency_of_existing_key` — re-put makes the key
  most-recently-used; the other key is evicted next.
- `test_put_does_not_evict_when_updating_at_capacity` — updating an existing
  key at full capacity evicts nothing.
- `test_expired_entries_removed_before_capacity_enforcement` — expired entry
  is purged instead of forcing eviction of a live one.
- `test_capacity_evicts_least_recently_used_live_entry` — with max_size 3,
  after reading `a`, inserting `d` evicts LRU `b`.
- `test_uses_injected_clock_not_wall_time` — clock starting at 0.0 controls
  expiry (catches the `time.time()` bug).
- `test_invalid_max_size_raises_value_error` — `0` and `-1` rejected.
- `test_invalid_ttl_raises_value_error` — `0`, `-1`, `-0.5` rejected.
- `test_len_counts_only_live_entries` — `len` excludes expired entries.

Suite total: 17 tests (3 pre-existing kept unchanged + 14 new).

Cross-check: run against the original faulty implementation, the suite fails
11 tests (9 failures + 2 errors), confirming the new cases catch the bugs.

## Exact test result

Command: `python3 -m unittest -v` (Python 3.14.7, in this directory)

```
test_alive_just_before_ttl_boundary (test_ttl_cache.TTLCacheTests.test_alive_just_before_ttl_boundary) ... ok
test_capacity_evicts_least_recently_used_live_entry (test_ttl_cache.TTLCacheTests.test_capacity_evicts_least_recently_used_live_entry) ... ok
test_expired_entries_removed_before_capacity_enforcement (test_ttl_cache.TTLCacheTests.test_expired_entries_removed_before_capacity_enforcement) ... ok
test_expired_entry_is_removed_on_get (test_ttl_cache.TTLCacheTests.test_expired_entry_is_removed_on_get) ... ok
test_expires_at_boundary (test_ttl_cache.TTLCacheTests.test_expires_at_boundary) ... ok
test_falsy_values_are_returned (test_ttl_cache.TTLCacheTests.test_falsy_values_are_returned) ... ok
test_get_refreshes_lru (test_ttl_cache.TTLCacheTests.test_get_refreshes_lru) ... ok
test_get_refreshes_lru_but_not_ttl (test_ttl_cache.TTLCacheTests.test_get_refreshes_lru_but_not_ttl) ... ok
test_invalid_max_size_raises_value_error (test_ttl_cache.TTLCacheTests.test_invalid_max_size_raises_value_error) ... ok
test_invalid_ttl_raises_value_error (test_ttl_cache.TTLCacheTests.test_invalid_ttl_raises_value_error) ... ok
test_len_counts_only_live_entries (test_ttl_cache.TTLCacheTests.test_len_counts_only_live_entries) ... ok
test_missing_key_raises_key_error (test_ttl_cache.TTLCacheTests.test_missing_key_raises_key_error) ... ok
test_put_does_not_evict_when_updating_at_capacity (test_ttl_cache.TTLCacheTests.test_put_does_not_evict_when_updating_at_capacity) ... ok
test_put_updates_existing_value_and_ttl (test_ttl_cache.TTLCacheTests.test_put_updates_existing_value_and_ttl) ... ok
test_put_updates_recency_of_existing_key (test_ttl_cache.TTLCacheTests.test_put_updates_recency_of_existing_key) ... ok
test_round_trip (test_ttl_cache.TTLCacheTests.test_round_trip) ... ok
test_uses_injected_clock_not_wall_time (test_ttl_cache.TTLCacheTests.test_uses_injected_clock_not_wall_time) ... ok

----------------------------------------------------------------------
Ran 17 tests in 0.003s

OK
```
