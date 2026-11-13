# Task 02 — TTL/LRU cache: fixes and regression tests

`ttl_cache.py` had eight defects. All are fixed, the public API is unchanged
(`TTLCache(max_size, ttl_seconds, clock=time.monotonic)`, `put`, `get`,
`__len__`, and the `max_size` / `ttl_seconds` / `clock` attributes), and the
suite passes: 37 tests, 0 failures.

## Root causes and fixes

| # | Root cause in the original | Effect | Fix |
|---|---|---|---|
| 1 | `get` ran `if not value: raise KeyError` | Stored `0`, `False`, `None`, `""`, `[]` were reported as missing | Removed the truthiness check; only a missing or expired entry raises |
| 2 | `put` stamped entries with `time.time()` while `get` compared against `self.clock()` | The two readings came from unrelated clocks, so the age was meaningless; with the test clock at 100.0 the age was hugely negative and nothing ever expired | `put` reads `self.clock()` once and stores that |
| 3 | Expiry test was `age > ttl_seconds` | An entry was still served at exactly `age == ttl_seconds` | Changed to `age >= ttl_seconds`, in one helper used by `get`, `put` and `__len__` |
| 4 | `get` never touched the ordering | Eviction was FIFO by insertion, not LRU | A successful `get` calls `move_to_end(key)`; the timestamp is left alone, so TTL is not refreshed |
| 5 | `put` evicted whenever the cache was full, before checking whether the key was already present | Updating an existing key in a full cache dropped an unrelated entry | Eviction runs only when the key is new |
| 6 | Assigning to an existing `OrderedDict` key keeps its old position | An updated key kept its old recency and could be evicted next | `put` calls `move_to_end(key)` on update, and rewrites value and timestamp |
| 7 | `put` never removed expired entries | A live entry could be evicted while a dead one kept its slot | `put` purges every expired entry first, then evicts the least recently used survivor if still full |
| 8 | The constructor accepted any arguments | `max_size=0` or a non-positive TTL built an unusable cache | `max_size < 1` and `ttl_seconds <= 0` raise `ValueError` |

Bug 2 hid bug 3 and bug 7: until timestamps came from the injected clock, no
entry could expire in a test at all.

## Decisions the task left open

- **`len()` counts live entries only.** It purges expired entries before
  counting. The original counted whatever was stored; the task does not specify
  this, and reporting dead entries seemed the worse reading.
- **An expired `get` deletes the entry** before raising `KeyError`, and does not
  refresh its recency.
- **NaN is rejected** for both constructor arguments (the checks are written as
  `not max_size >= 1` and `not ttl_seconds > 0`). A fractional `max_size` such
  as `1.5` is still accepted, as before.
- **The purge scans every entry**, so `put` and `len()` are O(n). The ordering
  is by recency, not by age, so there is no cheaper way to find expired entries
  without a second index. I kept the scan because it stays correct even if an
  injected clock misbehaves; a second insertion-ordered index would make it
  amortised O(1) if that matters.
- The class is not thread-safe, as it was not before.

## Regression cases

The three original tests are kept unchanged; 34 were added, in
`test_ttl_cache.py`.

- **Falsy values (bug 1):** `0`, `False`, `None`, `""`, `[]`, `{}`, `0.0` round
  trip with their type preserved; a stored `None` is distinguished from a
  missing key; falsy keys work.
- **TTL (bugs 2, 3):** live at `ttl - 0.001`, expired at exactly `ttl` and at
  `ttl + 0.001`; timestamp is the injected clock's reading; a clock starting at
  0 works; fractional TTL; repeated `get` calls do not extend the TTL; an
  expired `get` keeps raising, drops the entry and does not refresh recency;
  `KeyError` carries the key.
- **Update via `put` (bugs 5, 6):** value replaced; updating either the newest
  or the oldest key in a full cache evicts nothing; update refreshes recency
  and timestamp; `put` on an expired key revives it; single-slot update.
- **Eviction (bugs 4, 7):** least recently used goes first; a read entry
  survives the next `put`; eviction order follows a mixed access sequence; an
  expired entry is removed in preference to a live least-recently-used one;
  all expired entries are purged on `put`, below capacity and on update too;
  `max_size=1`; size never exceeds `max_size` over 50 inserts; `len()` counts
  live entries only.
- **Validation (bug 8):** `max_size` of `0`, `-1`, `-100`, `0.5`, NaN and
  `ttl_seconds` of `0`, `0.0`, `-1`, `-0.001`, NaN raise `ValueError`; the
  smallest valid arguments are accepted; public attributes and the default
  `time.monotonic` clock are intact.

To confirm the tests detect the defects, I ran the new suite against a copy of
the original file: 22 of the 37 tests failed (26 failures and 10 errors,
counting subtests). The 15 that passed there cover behaviour the original
already had right, or got right by accident.

## Test result

Before the fix, the original three tests:

```
Ran 3 tests in 0.001s

FAILED (failures=2)
```

After the fix, `python3 -m unittest` in this directory (Python 3.14.9; pytest is
not installed, so the suite uses `unittest`):

```
.....................................
----------------------------------------------------------------------
Ran 37 tests in 0.002s

OK
```
