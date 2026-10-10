# Task 02 - TTL/LRU cache bug fixing

Files changed: `ttl_cache.py` (fixes) and `test_ttl_cache.py` (3 original tests kept,
22 regression tests added). The public API is unchanged: `TTLCache(max_size,
ttl_seconds, clock=time.monotonic)`, `put`, `get`, `__len__`.

## Root causes and fixes

| # | Root cause in the original | Fix |
|---|---|---|
| 1 | `get` used `if not value: raise KeyError`, so falsy values (`0`, `False`, `None`, `""`, ...) were reported as missing. | Removed the truthiness check. `get` raises `KeyError` only if the key is absent (the dict lookup) or the entry is expired. |
| 2 | `put` stamped entries with `time.time()` instead of the injected `clock`, while `get` compared against `self.clock()`. The two used different time bases, so TTL was wrong for any injected clock (and for the default monotonic clock). | `put` reads `self.clock()` once and uses it for both expiry purging and the entry timestamp. |
| 3 | Expiry test was `age > ttl_seconds`, so an entry at exactly `ttl_seconds` old was still returned. | Expiry is `age >= ttl_seconds` (`_is_expired`). An expired entry hit by `get` is also deleted, then `KeyError` is raised. |
| 4 | `get` never refreshed LRU recency (no `move_to_end`), so it behaved like FIFO. | A successful `get` calls `move_to_end(key)`. It does not touch the stored timestamp, so TTL is not refreshed. |
| 5 | `put` on an existing key did not move it to the MRU position. Worse, at capacity it evicted the LRU entry even though overwriting an existing key needs no new slot, so an unrelated live entry was lost. | For an existing key, `put` deletes the old entry and re-inserts `(value, now)` at the MRU end without evicting. Value, timestamp and recency are all updated. |
| 6 | `put` did not remove expired entries before enforcing capacity, so a live entry could be evicted while dead entries stayed in the cache. | `put` first calls `_purge_expired(now)`. It scans every entry, because LRU order is not timestamp order (`get` reorders without changing the timestamp). Only if the cache is still full does it evict LRU entries (`while len >= max_size: popitem(last=False)`), and these are live entries. |
| 7 | No argument validation. | `__init__` raises `ValueError` if `max_size < 1` or `ttl_seconds <= 0`. |

Design note: `__len__` is unchanged and returns the number of stored entries. This can
include entries that have expired but have not yet been purged, because purging happens
on `put` and on an expired `get`. The task did not specify `len` semantics for expired
entries, so I did not change them.

## Regression cases (`RegressionTests` in `test_ttl_cache.py`)

- Falsy values (`0`, `False`, `None`, `""`, `[]`, `0.0`) round-trip with the correct value and type.
- A falsy value still expires.
- Missing key raises `KeyError`.
- Boundary: alive just before the TTL (age 9.999 of 10), expired just after (10.001), and an expired `get` removes the entry.
- `put` uses the injected clock, not wall time.
- `get` does not refresh the TTL (put, +6, get, +4 gives `KeyError`).
- `put` on an existing key updates the value, updates the timestamp (new TTL window) and updates recency.
- `put` on an existing key in a full cache does not evict another entry.
- Capacity evicts the LRU entry, and `get` changes which entry is the victim.
- Expired entries are removed before capacity is enforced (a live entry survives).
- An expired entry that is not first in LRU order is purged.
- Eviction picks the LRU live entry when nothing is expired, and `max_size == 1` works.
- `ValueError` for `max_size` of 0, -1 and -100, and for `ttl_seconds` of 0, -1 and -0.5. Minimal valid arguments and the default clock work.

Mutation check: I ran the same 25-test file against the original faulty
`ttl_cache.py` (copied to a scratch directory outside the task directory). It failed
with 11 failures and 2 errors, which confirms the tests detect the bugs. The rest
passed against the original, some of them by accident.

## Test result

Command: `python3 -m unittest` (Python 3.11.15), run in this directory.

```
.........................
----------------------------------------------------------------------
Ran 25 tests in 0.001s

OK
```

25 tests, 0 failures, 0 errors.
