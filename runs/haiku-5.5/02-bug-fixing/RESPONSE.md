# Response: TTL/LRU cache bug fixes

Files changed: `ttl_cache.py` (fixed), `test_ttl_cache.py` (15 regression tests added;
the 3 original tests are unchanged). The public API (`TTLCache(max_size, ttl_seconds, clock)`,
`put`, `get`, `__len__`) is unchanged.

## Root causes

1. **Wall clock used for timestamps (`put`).** `put` stored `time.time()` while `get`
   measured age with the injected `self.clock()`. Mixing the two clocks produces a
   hugely negative age, so entries never expire. This also ignored the injected clock.
2. **Falsy values reported as missing (`get`).** `if not value: raise KeyError` treated
   `0`, `False`, `None`, `""`, `[]`, `{}` as absent.
3. **Off-by-one at the TTL boundary (`get`).** The check was `age > ttl_seconds`, so an
   entry was still live at `age == ttl_seconds`. The spec requires `age >= ttl_seconds`.
4. **Reads did not refresh recency (`get`).** No `move_to_end`, so eviction was
   effectively insertion-order (FIFO), not LRU.
5. **Updating an existing key could evict another entry (`put`).** The capacity check ran
   before checking whether the key already existed. At capacity, `put("b", ...)` on an
   existing `b` evicted the oldest entry. Also, assigning to an existing `OrderedDict` key
   keeps its position, so `put` never refreshed recency.
6. **Expired entries were never purged (`put`).** They kept occupying capacity slots, so
   live entries could be evicted while dead ones remained. Once recency is fixed, this
   violates "evict the LRU *live* entry".
7. **No argument validation (`__init__`).** `max_size=0` made `put` call `popitem` on an
   empty dict and raise an unrelated `KeyError`. `ttl_seconds <= 0` was accepted silently.

## Fixes

| Root cause | Fix in `ttl_cache.py` |
|---|---|
| 1 | `put` stores `self.clock()`; all age checks use the same clock. |
| 2 | `get` returns the stored value whenever the entry exists and is live; the falsy check is removed. |
| 3 | `_is_expired` uses `now - created >= self.ttl_seconds`. |
| 4 | `get` calls `move_to_end(key)` after the liveness check; it does not touch the timestamp. |
| 5 | `put` checks `key in self._items` first: an existing key is moved to the MRU end and overwritten, with no eviction. Only a new key triggers capacity eviction. |
| 6 | `put` calls `_purge_expired(now)` before any capacity decision. |
| 7 | `__init__` raises `ValueError` for `max_size < 1` and `ttl_seconds <= 0`. |

`put` order: purge expired → if existing key, move to MRU → else evict LRU while full →
store `(value, now)`. Because the purge runs first, every eviction candidate is live.

## Regression cases

Result on the **original** code (`TTLCache` before the fix), using the new test file:

| Test | Covers | Original code |
|---|---|---|
| `test_round_trip` (existing) | basic put/get | pass |
| `test_expires_at_boundary` (existing) | root cause 1, 3 | **fail** |
| `test_get_refreshes_lru` (existing) | root cause 4 | **fail** |
| `test_get_missing_key_raises_key_error` | `KeyError` for missing key | pass (guard) |
| `test_get_returns_falsy_values` | root cause 2 (0, 0.0, False, None, "", [], {}) | **error** (7 subtests) |
| `test_expired_falsy_value_raises_key_error` | expiry still applies to falsy values | pass (guard) |
| `test_ttl_uses_injected_clock` | root cause 1 | **fail** |
| `test_get_does_not_refresh_ttl` | `get` leaves TTL unchanged | **fail** |
| `test_put_existing_key_updates_value` | `put` overwrites value | pass (guard) |
| `test_put_existing_key_refreshes_timestamp` | `put` resets age | **fail** |
| `test_put_existing_key_refreshes_recency` | `put` marks key MRU | pass (see note) |
| `test_put_existing_key_at_capacity_does_not_evict_other_keys` | root cause 5 | **error** |
| `test_expired_entries_are_purged_before_capacity_eviction` | root cause 6 | pass (see note) |
| `test_capacity_evicts_least_recently_used_live_entry` | LRU eviction order | **fail** |
| `test_max_size_one_keeps_only_latest_entry` | boundary `max_size=1` | pass (guard) |
| `test_rejects_max_size_below_one` | root cause 7 (0, -1) | **fail** (2 subtests) |
| `test_rejects_non_positive_ttl` | root cause 7 (0, -1, -0.5) | **fail** (3 subtests) |
| `test_accepts_minimal_valid_arguments` | smallest valid config still works | pass (guard) |

"Guard" means the test pins correct behavior that the original already had, so it protects
against a future regression rather than reproducing a bug.

**Notes on tests that pass on the original.** `test_expired_entries_are_purged_before_capacity_eviction`
and `test_put_existing_key_refreshes_recency` pass on the original only by coincidence: the
original never refreshes recency, so the expired entry happens to be the oldest. They are
meaningful for the fixed code, and I checked them against deliberately broken variants
(below).

**Mutation checks.** I ran the new tests against three in-memory variants of the fixed class
(nothing was written to disk):

- `put` without the expired purge → `test_expired_entries_are_purged_before_capacity_eviction` errors (the live entry is evicted).
- `get` that also refreshes the TTL → `test_get_does_not_refresh_ttl`, `test_put_existing_key_refreshes_timestamp`, `test_ttl_uses_injected_clock` fail, and the purge test errors.
- `put` on an existing key that does not move it to MRU → `test_put_existing_key_refreshes_recency` fails.

## Test results

Commands run from this directory: `python3 -B -m unittest -v`

Baseline, original code and original tests:

```
Ran 3 tests in 0.003s

FAILED (failures=2)
```
(`test_expires_at_boundary` and `test_get_refreshes_lru` failed.)

New tests against the original code: `FAILED (failures=11, errors=8)` across 18 test methods
(subtests count separately).

Final, fixed code and all 18 tests:

```
test_accepts_minimal_valid_arguments (test_ttl_cache.TTLCacheTests.test_accepts_minimal_valid_arguments) ... ok
test_capacity_evicts_least_recently_used_live_entry (test_ttl_cache.TTLCacheTests.test_capacity_evicts_least_recently_used_live_entry) ... ok
test_expired_entries_are_purged_before_capacity_eviction (test_ttl_cache.TTLCacheTests.test_expired_entries_are_purged_before_capacity_eviction) ... ok
test_expired_falsy_value_raises_key_error (test_ttl_cache.TTLCacheTests.test_expired_falsy_value_raises_key_error) ... ok
test_expires_at_boundary (test_ttl_cache.TTLCacheTests.test_expires_at_boundary) ... ok
test_get_does_not_refresh_ttl (test_ttl_cache.TTLCacheTests.test_get_does_not_refresh_ttl) ... ok
test_get_missing_key_raises_key_error (test_ttl_cache.TTLCacheTests.test_get_missing_key_raises_key_error) ... ok
test_get_refreshes_lru (test_ttl_cache.TTLCacheTests.test_get_refreshes_lru) ... ok
test_get_returns_falsy_values (test_ttl_cache.TTLCacheTests.test_get_returns_falsy_values) ... ok
test_max_size_one_keeps_only_latest_entry (test_ttl_cache.TTLCacheTests.test_max_size_one_keeps_only_latest_entry) ... ok
test_put_existing_key_at_capacity_does_not_evict_other_keys (test_ttl_cache.TTLCacheTests.test_put_existing_key_at_capacity_does_not_evict_other_keys) ... ok
test_put_existing_key_refreshes_recency (test_ttl_cache.TTLCacheTests.test_put_existing_key_refreshes_recency) ... ok
test_put_existing_key_refreshes_timestamp (test_ttl_cache.TTLCacheTests.test_put_existing_key_refreshes_timestamp) ... ok
test_put_existing_key_updates_value (test_ttl_cache.TTLCacheTests.test_put_existing_key_updates_value) ... ok
test_rejects_max_size_below_one (test_ttl_cache.TTLCacheTests.test_rejects_max_size_below_one) ... ok
test_rejects_non_positive_ttl (test_ttl_cache.TTLCacheTests.test_rejects_non_positive_ttl) ... ok
test_round_trip (test_ttl_cache.TTLCacheTests.test_round_trip) ... ok
test_ttl_uses_injected_clock (test_ttl_cache.TTLCacheTests.test_ttl_uses_injected_clock) ... ok

----------------------------------------------------------------------
Ran 18 tests in 0.003s

OK
```

Exit code 0.

## Design decisions and open points

- **Purge on every `put`, not only when at capacity.** This keeps `len()` close to the number
  of live entries after each write. The cost is an O(n) scan per `put`, because recency order
  is not expiry order. That is fine for a small cache; a heap or per-entry expiry index would
  be needed for large ones.
- **`__len__` is unchanged** and returns the stored count. Between writes it can include
  expired entries that no `put` has purged yet. The spec does not define `len()` for expired
  entries, and changing it would alter the API, so I left it alone. Flagging it in case you want
  `len()` to count only live entries.
- **`get` on an expired key raises `KeyError` but does not delete the entry.** It is removed on
  the next `put`.
- **Error message text** for the `ValueError`s was chosen by me; the spec only requires the
  exception type.
