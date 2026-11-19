# Task 02 — Bug fixing: TTL/LRU cache

## Public API (unchanged)

`TTLCache(max_size, ttl_seconds, clock=time.monotonic)` with `put(key, value)`,
`get(key)`, `__len__()`. Only internals were changed.

## Root causes and fixes

1. **Wrong clock for timestamps.** `put` stored `time.time()` (wall clock) while
   `get` compared against `self.clock()` (the injected monotonic clock). The two
   time bases are unrelated, so TTL was meaningless (e.g. a fake clock starting
   at 100.0 made `clock() - created` a large negative-or-positive wall-clock
   offset). **Fix:** store `self.clock()` as the timestamp; `put` reads the clock
   once and uses that value for both purging and the new entry.

2. **Falsy values treated as missing.** `get` had `if not value: raise KeyError(key)`,
   which rejected `0`, `False`, `None`, `""`, `[]`, etc. **Fix:** removed the truthiness
   check entirely; `KeyError` is raised only by the `OrderedDict` lookup for a
   missing key, or explicitly on expiry.

3. **Off-by-one expiry boundary.** `clock() - created > ttl_seconds` used strict
   `>`, so an entry at exactly `age == ttl_seconds` stayed alive. **Fix:** use
   `>=` so entries expire at `age >= ttl_seconds`. Expired entries are deleted
   from `_items` on access, so `len()` reflects only live entries.

4. **No validation.** `max_size < 1` and `ttl_seconds <= 0` were accepted. **Fix:**
   `__init__` raises `ValueError` for those.

5. **`get` did not refresh LRU recency.** A successful `get` never touched the
   `OrderedDict` order, so capacity eviction could not honour recent reads.
   **Fix:** `get` now calls `self._items.move_to_end(key)` on a hit. It deliberately
   does **not** update the stored timestamp, so a read never extends TTL.

6. **`put` on an existing key was wrong in two ways.** Reassigning
   `self._items[key] = ...` in an `OrderedDict` keeps the original position (so
   recency was not refreshed), and the capacity check `len >= max_size` ran even
   for an overwrite — evicting a live LRU entry unnecessarily. **Fix:** `put`
   handles an existing key first — update `(value, now)`, `move_to_end(key)`, and
   return without any eviction. For a new key, capacity is enforced only after
   the expired purge, and eviction uses `popitem(last=False)` (least recently
   used live entry).

7. **Expired entries were not purged before enforcing capacity.** With a full
   cache, `put` blindly evicted the LRU slot to make room, even when the slots
   were occupied by expired entries — potentially evicting a still-live entry
   while keeping expired ones. **Fix:** `_purge_expired(now)` removes every entry
   whose `now - created >= ttl_seconds` at the start of `put`, before the
   capacity check.

## Regression cases added (`test_ttl_cache.py`)

The 3 original tests are kept. 16 more were added:

- `test_falsy_values_are_returned` — `0`, `False`, `None`, `""`, `[]` round-trip.
- `test_missing_key_raises_keyerror` — only a genuinely absent key raises.
- `test_ttl_uses_injected_clock` — TTL is driven solely by the injected clock.
- `test_just_before_expiry_is_live` — `age < ttl` is still valid.
- `test_expired_entry_removed_from_len` — expired entry deleted on access.
- `test_get_does_not_refresh_ttl` — a read refreshes recency but not TTL.
- `test_get_refreshes_recency_for_eviction` — a read protects the key from eviction.
- `test_put_updates_value`, `test_put_refreshes_timestamp`,
  `test_put_updates_recency_and_does_not_evict` — `put` updates value, timestamp
  and recency for an existing key without evicting.
- `test_expired_removed_before_capacity` — expired entries purged before capacity.
- `test_eviction_removes_least_recently_used_live_entry` — LRU (not FIFO) eviction.
- `test_expired_mru_purged_without_evicting_live_lru` — an expired *most-recently-
  used* entry must be purged rather than evicting a live LRU entry (the key
  scenario that the "purge before capacity" rule protects against).
- `test_invalid_max_size`, `test_invalid_ttl`, `test_valid_boundaries_accepted` —
  constructor validation.

## Exact test result

Command (run inside `02-bug-fixing`):

```
python -m unittest -v test_ttl_cache
```

Result:

```
Ran 19 tests in 0.001s

OK
```

`python -m unittest` (discovery) also reports `Ran 19 tests ... OK`.
`pytest` is not installed in this environment (`No module named pytest`), so the
unittest-native runner was used.

## Deliverables

- `ttl_cache.py` — fixed implementation, public API unchanged.
- `test_ttl_cache.py` — original 3 tests + 16 regression tests (19 total).
- `RESPONSE.md` — this file.
