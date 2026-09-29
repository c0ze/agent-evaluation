# Task 02 — TTL/LRU cache bug fix

Files changed (all inside this directory):

- `ttl_cache.py` — fixed implementation, public API unchanged
  (`TTLCache(max_size, ttl_seconds, clock=time.monotonic)`, `put`, `get`, `__len__`,
  attributes `max_size`, `ttl_seconds`, `clock`, `_items`).
- `test_ttl_cache.py` — the three original tests kept verbatim, 22 regression tests added.

Baseline before the fix: `python3 -m unittest -v test_ttl_cache` ->
`Ran 3 tests ... FAILED (failures=2)` (`test_expires_at_boundary`, `test_get_refreshes_lru`).

## Root causes

| # | Where | Bug | Spec bullet violated |
|---|-------|-----|----------------------|
| 1 | `get` | `if not value: raise KeyError(key)` — any falsy stored value (`0`, `False`, `None`, `""`, `[]`) was reported as missing. | `get` returns falsy values |
| 2 | `put` | Timestamps were taken from wall-clock `time.time()`, but `get` compared them against the injected `self.clock()`. Two different time bases: with the test clock at 100.0 the age is hugely negative, so nothing ever expired; with the real default clock the comparison is between `monotonic()` and epoch seconds and is meaningless either way. | TTL uses the injected monotonic clock |
| 3 | `get` | Expiry test was `age > ttl_seconds`; an entry with `age == ttl_seconds` was still served. | expires at `age >= ttl_seconds` |
| 4 | `get` | Never called `move_to_end`, so the `OrderedDict` order stayed insertion order and eviction was FIFO, not LRU. | successful `get` refreshes recency |
| 5 | `put` | Re-assigning an existing key in an `OrderedDict` keeps its old position, so an update did not become most-recently-used. | `put` updates recency |
| 6 | `put` | Capacity check ran before looking at whether the key already existed, so updating a key in a full cache evicted an unrelated live entry (the key being updated already owned a slot). | `put` updates an existing key |
| 7 | `put` | Expired entries were never purged, so they kept occupying slots and a live LRU entry was evicted to make room while dead entries stayed. | expired entries removed before enforcing capacity; eviction removes the LRU *live* entry |
| 8 | `get` / `__len__` | An expired entry raised `KeyError` but stayed in `_items`, so it was counted by `len()` and still took up capacity. | (consequence of 7) |
| 9 | `__init__` | No validation: `TTLCache(0, ...)`, `TTLCache(-1, ...)`, `TTLCache(n, 0)`, `TTLCache(n, -1)` were accepted. | `max_size < 1` / `ttl_seconds <= 0` raise `ValueError` |

## Fixes

- `__init__`: raise `ValueError` for `max_size < 1` and for `ttl_seconds <= 0`.
- Single time source: every timestamp and every age check now uses `self.clock()`; `time` is only
  referenced for the `time.monotonic` default. Added private helpers `_is_expired(stored_at, now)`
  (`now - stored_at >= ttl_seconds`, i.e. `>=` at the boundary) and `_purge_expired(now)`.
- `put(key, value)`:
  1. read the clock once, purge every expired entry (this also drops the key itself if it had expired);
  2. if the key is still present it is live: overwrite `(value, now)` and `move_to_end` — value,
     timestamp and recency all refreshed, and nothing is evicted because no new slot is needed;
  3. otherwise, if the cache is at capacity, `popitem(last=False)` evicts the least recently used
     entry — which after the purge is guaranteed to be a live one — then insert at the MRU end.
- `get(key)`: `KeyError` propagates naturally for a missing key; an expired entry is deleted and
  re-raised as `KeyError`; a hit calls `move_to_end` (recency) but leaves the stored timestamp
  untouched (TTL is not refreshed). The falsy-value check is gone — the value is returned as stored.
- `__len__`: purges expired entries first, so `len(cache)` is the number of live entries and is
  consistent with what `get` would actually serve (same convention as `cachetools.TTLCache`).

Design note: because a `get` moves an entry to the MRU end *without* changing its timestamp, the
LRU order is not a timestamp order, so the purge has to scan all entries (O(n) per `put`/`len`).
That is the cost of the "recency is refreshed, TTL is not" rule and is fine at the sizes this
class is meant for; a heap keyed on expiry could make it O(log n) if ever needed, without changing
the public API.

## Regression cases added (`test_ttl_cache.py`)

All 22 new tests use the injected `Clock` (starting at 100.0) so time is fully deterministic.
"Fails on original" says whether the test catches the original faulty implementation (verified by
running the final suite against a copy of the original file: 15 failures + 8 errors, 25 tests).

| Test | Spec bullet | Fails on original |
|------|-------------|-------------------|
| `test_falsy_values_are_returned` | falsy values `0`, `False`, `None`, `""`, `[]` round-trip; identity checked for `False`/`None` | yes (bug 1) |
| `test_missing_key_raises_key_error` | `KeyError` only for missing keys | no (already correct) |
| `test_uses_injected_clock_not_wall_clock` | replaces the `time` module seen by `ttl_cache` with one whose `time()`/`monotonic()` raise; put/get/len must still work purely off the injected clock | yes (bug 2) |
| `test_live_just_before_ttl` | age 9.999 with ttl 10 is still live | no |
| `test_expires_at_boundary` (original) | age == ttl expires | yes (bugs 2, 3) |
| `test_fractional_ttl` | ttl 0.5: live at 0.25, expired at 0.5 | yes (bugs 2, 3) |
| `test_expired_get_purges_entry` | expired `get` raises and the entry is dropped (`len` 0, not in `_items`) | yes (bug 8) |
| `test_get_does_not_refresh_ttl` | put at 100, get at 106, get at 110 -> `KeyError` | yes (bugs 2, 3) |
| `test_get_refreshes_lru` (original) | a hit makes the entry MRU | yes (bug 4) |
| `test_put_updates_value` | second `put` replaces the value, `len` stays 1 | no |
| `test_put_refreshes_ttl` | put at 100, re-put at 106: live at 112, expired at 116 | yes (bug 2) |
| `test_put_refreshes_lru` | cache(3): a, b, a=A2, c, d -> `b` (not `a`) is evicted | yes (bug 5) |
| `test_put_existing_key_when_full_does_not_evict` | updating the MRU key `b` in a full cache(2) must not evict `a`; then the same for the LRU key | yes (bug 6) |
| `test_put_on_expired_key_reinserts` | re-putting an expired key in a cache(1) yields the new value, `len` 1 | no |
| `test_expired_entries_removed_before_capacity_enforced` | both entries expired, `put("c")` leaves only `c` | yes (bug 7) |
| `test_expired_mru_entry_is_purged_instead_of_evicting_live_lru` | `a` is MRU (via `get`) but expired, `b` is LRU but live; `put("c")` must drop `a` and keep `b` — the original evicted live `b` | yes (bug 7) |
| `test_capacity_evicts_least_recently_used` | cache(2): a, b, c -> `a` gone | no |
| `test_capacity_one` | cache(1): a, b -> only `b` | no |
| `test_len_never_exceeds_max_size` | 20 puts into cache(3): `len <= 3` throughout, last three keys survive | no |
| `test_len_excludes_expired` | `len` counts only live entries as time advances | yes (bug 8) |
| `test_invalid_max_size_raises` | `max_size` 0 and -1 -> `ValueError` | yes (bug 9) |
| `test_invalid_ttl_raises` | `ttl_seconds` 0, -1, -0.5 -> `ValueError` | yes (bug 9) |
| `test_valid_boundaries_accepted` | `max_size=1`, `ttl_seconds=0.001` / `1` accepted | no |
| `test_default_clock_round_trip` | constructor default `clock=time.monotonic` still works | no |

The tests marked "no" pass on the original by coincidence or because the behaviour was already
right; they pin the specified behaviour against future regressions.

## Exact test result

Command (run from this directory; `python3` is CPython 3.11.15):

```
$ python3 -m unittest -v test_ttl_cache
test_capacity_evicts_least_recently_used (test_ttl_cache.TTLCacheTests.test_capacity_evicts_least_recently_used) ... ok
test_capacity_one (test_ttl_cache.TTLCacheTests.test_capacity_one) ... ok
test_default_clock_round_trip (test_ttl_cache.TTLCacheTests.test_default_clock_round_trip) ... ok
test_expired_entries_removed_before_capacity_enforced (test_ttl_cache.TTLCacheTests.test_expired_entries_removed_before_capacity_enforced) ... ok
test_expired_get_purges_entry (test_ttl_cache.TTLCacheTests.test_expired_get_purges_entry) ... ok
test_expired_mru_entry_is_purged_instead_of_evicting_live_lru (test_ttl_cache.TTLCacheTests.test_expired_mru_entry_is_purged_instead_of_evicting_live_lru) ... ok
test_expires_at_boundary (test_ttl_cache.TTLCacheTests.test_expires_at_boundary) ... ok
test_falsy_values_are_returned (test_ttl_cache.TTLCacheTests.test_falsy_values_are_returned) ... ok
test_fractional_ttl (test_ttl_cache.TTLCacheTests.test_fractional_ttl) ... ok
test_get_does_not_refresh_ttl (test_ttl_cache.TTLCacheTests.test_get_does_not_refresh_ttl) ... ok
test_get_refreshes_lru (test_ttl_cache.TTLCacheTests.test_get_refreshes_lru) ... ok
test_invalid_max_size_raises (test_ttl_cache.TTLCacheTests.test_invalid_max_size_raises) ... ok
test_invalid_ttl_raises (test_ttl_cache.TTLCacheTests.test_invalid_ttl_raises) ... ok
test_len_excludes_expired (test_ttl_cache.TTLCacheTests.test_len_excludes_expired) ... ok
test_len_never_exceeds_max_size (test_ttl_cache.TTLCacheTests.test_len_never_exceeds_max_size) ... ok
test_live_just_before_ttl (test_ttl_cache.TTLCacheTests.test_live_just_before_ttl) ... ok
test_missing_key_raises_key_error (test_ttl_cache.TTLCacheTests.test_missing_key_raises_key_error) ... ok
test_put_existing_key_when_full_does_not_evict (test_ttl_cache.TTLCacheTests.test_put_existing_key_when_full_does_not_evict) ... ok
test_put_on_expired_key_reinserts (test_ttl_cache.TTLCacheTests.test_put_on_expired_key_reinserts) ... ok
test_put_refreshes_lru (test_ttl_cache.TTLCacheTests.test_put_refreshes_lru) ... ok
test_put_refreshes_ttl (test_ttl_cache.TTLCacheTests.test_put_refreshes_ttl) ... ok
test_put_updates_value (test_ttl_cache.TTLCacheTests.test_put_updates_value) ... ok
test_round_trip (test_ttl_cache.TTLCacheTests.test_round_trip) ... ok
test_uses_injected_clock_not_wall_clock (test_ttl_cache.TTLCacheTests.test_uses_injected_clock_not_wall_clock) ... ok
test_valid_boundaries_accepted (test_ttl_cache.TTLCacheTests.test_valid_boundaries_accepted) ... ok

----------------------------------------------------------------------
Ran 25 tests in 0.002s

OK
```

Exit status 0. Cross-checked with pytest 9.0.2 (`pytest -q -p no:cacheprovider test_ttl_cache.py`):
`25 passed, 10 subtests passed in 0.05s`, exit status 0.

For comparison, the same 25-test suite run against a copy of the original `ttl_cache.py`
(kept outside this directory) reports `FAILED (failures=15, errors=8)`.
