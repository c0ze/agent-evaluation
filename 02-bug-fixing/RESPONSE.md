# TTL/LRU cache bug fix

All deliverables are complete: the cache is fixed without changing its public
API, regression tests are added, and the local test suite passes. All repository
work stayed within `02-bug-fixing`; no network was used.

## Root causes and fixes

- `get` treated falsy values as absent. Removed the truthiness check so stored
  values, including `0`, `False`, and `None`, are returned unchanged. Missing
  keys still raise `KeyError`.
- `put` used wall-clock `time.time()` while `get` used the injected monotonic
  clock. Both operations now use `self.clock()`, with one clock sample per put.
- Expiration used `age > ttl_seconds`, leaving entries alive at the boundary.
  Expiration now uses `age >= ttl_seconds`; an expired get removes the entry
  and raises `KeyError` with the requested key.
- Successful reads never updated recency. `get` now moves a live entry to the
  end of the ordered dictionary without changing its insertion timestamp.
- Updates could evict an unrelated entry at full capacity and did not reliably
  refresh recency. `put` now replaces the value and timestamp, moves the key to
  the most recent position, and evicts only if the resulting size exceeds
  capacity.
- Capacity enforcement did not remove expired entries first. Each put removes
  every expired entry before capacity enforcement, including expired entries
  that were recently accessed. Any remaining eviction removes the least
  recently used live entry.
- The constructor accepted invalid limits. It now raises `ValueError` for
  `max_size < 1` or `ttl_seconds <= 0`.

## Regression coverage

The suite contains 19 tests (the original 3 plus 16 added tests), using an
injected fake clock with no sleeps:

- Round trips for truthy values and six falsy values; missing-key errors.
- Reads just before, exactly at, and after the TTL boundary; expired-entry
  removal and repeated missing reads.
- Reads refresh LRU recency while retaining the original TTL.
- Puts replace values without evicting unrelated live keys, refresh TTL and
  recency, and replace expired keys.
- An expired recently accessed entry is removed before a live LRU entry can
  be evicted; all expired entries are removed, including below capacity.
- Capacity-one eviction and multiple successive LRU evictions.
- Zero, negative, and fractional invalid limits.

The original suite reproduced two failures. With the new regressions and the
original implementation, the suite reported 16 failures and 7 errors (including
subtest results), confirming that the cases expose the defects.

## Exact final test result

Command, run from this directory:

```sh
python3 -m unittest discover -s . -p 'test_*.py' -v
```

All 19 named tests reported `ok`. The exact result footer was:

```text
----------------------------------------------------------------------
Ran 19 tests in 0.000s

OK
```

Exit code: `0`.
