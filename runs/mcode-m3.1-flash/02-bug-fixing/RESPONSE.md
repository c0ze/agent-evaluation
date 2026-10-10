# Task 02 — Bug fixing: TTL/LRU cache

Files changed: `ttl_cache.py` (fix), `test_ttl_cache.py` (regression suite), plus this
report. No other file in the directory or repository was touched, and no network was used.

## Baseline: the faulty implementation

Running the shipped suite against the original `ttl_cache.py` gave:

```
Ran 3 tests in 0.001s
FAILED (failures=2)
FAIL: test_expires_at_boundary  — AssertionError: KeyError not raised
FAIL: test_get_refreshes_lru   — AssertionError: KeyError not raised
```

## Root causes and fixes

**1. Falsy values were treated as cache misses.**
`get` did `if not value: raise KeyError(key)`, so `0`, `False`, `None`, `""` and `[]`
all raised `KeyError` even though they were stored.
*Fix:* the falsy check is deleted. The `self._items[key]` lookup is now the only source
of `KeyError`, so the exception is raised only for a missing key or an expired entry.

**2. The TTL timestamp came from the wall clock instead of the injected `clock`.**
`put` stored `time.time()` while `get` compared against `self.clock()`. The two time
bases were unrelated, so ages were meaningless (typically hugely negative) and entries
never expired on an injected clock.
*Fix:* `put` stamps with `now = self.clock()`; the default `clock` remains
`time.monotonic`.

**3. Off-by-one at the expiry boundary.** `get` used `age > ttl_seconds`, so an entry
survived at `age == ttl_seconds`.
*Fix:* the comparison is now `age >= ttl_seconds`, both in `get` and in the purge.

**4. A successful `get` never refreshed LRU recency.** Nothing moved the key to the
back of the `OrderedDict`, so `put` always evicted the genuinely least recently used
entry's neighbour instead of the LRU one.
*Fix:* `get` calls `self._items.move_to_end(key)` — recency only, the stored timestamp
(and therefore the TTL deadline) is deliberately left untouched.

**5. `put` evicted before checking whether the key already existed.** The capacity
check ran unconditionally, so overwriting an existing key at full capacity evicted the
oldest entry first and could silently destroy an unrelated live value.
*Fix:* an existing key is updated in place (value, timestamp, then `move_to_end`) and
returns early; the capacity eviction only applies to genuinely new keys.

**6. Expired entries were never removed.** Dead entries occupied capacity slots, so
eviction could discard a live value while stale ones were kept, and nothing was ever
reclaimed.
*Fix:* a new private `_purge_expired(now)` helper drops every entry with
`age >= ttl_seconds`; `put` calls it **before** the capacity check, so eviction always
removes the least recently used *live* entry. `_purge_expired` is a new private method
only — the public API (`__init__`, `put`, `get`, `__len__`, and the `max_size`,
`ttl_seconds`, `clock` attributes) is unchanged.

**7. No argument validation.** `max_size < 1` and `ttl_seconds <= 0` silently created
a broken cache.
*Fix:* `__init__` raises `ValueError` for both.

## Regression tests

The three original tests are kept unchanged. Nineteen tests were added, covering each
required behavior: missing key raises `KeyError`; falsy values (`0`, `False`, `None`,
`""`, `[]`) round-trip and stay retrievable; TTL follows the injected clock and is
inclusive at the boundary (`9.999` live, `10.0` expired); `get` refreshes recency but
not the TTL, including across repeated gets; `put` updates an existing key's value,
timestamp *and* recency, and never evicts on overwrite; expired entries are purged
before capacity is enforced; capacity evicts the least recently used live entry and is
never exceeded; `max_size < 1` and `ttl_seconds <= 0` raise `ValueError` while valid
boundary arguments are accepted.

Each new test was validated by replaying the whole suite against a verbatim copy of the
original faulty implementation: **12 of the 22 test methods fail on the buggy code**
(17 failure records counting `subTest` expansions), so the tests genuinely detect the
defects rather than merely passing. The 10 that pass on both implementations are guard
cases (`test_round_trip`, `test_missing_key_raises_keyerror`,
`test_valid_boundary_arguments_are_accepted`, `test_capacity_is_never_exceeded`,
`test_purge_frees_room_without_losing_live_entries`, and three `put`-update tests that
the original code satisfied by accident).

## Exact test result

```
$ python3 -m unittest -v test_ttl_cache
...
----------------------------------------------------------------------
Ran 22 tests in 0.000s

OK
```

Exit status 0 — 22 tests, 22 passed, 0 failures, 0 errors. Python 3.14.3.
