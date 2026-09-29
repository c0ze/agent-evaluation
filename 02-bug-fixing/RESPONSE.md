Completed every deliverable: fixed `ttl_cache.py` without changing the public
API, expanded `test_ttl_cache.py` from 3 to 18 tests, ran the tests locally, and
documented the results here. No network access was used.

Root causes and fixes:

- `put` used `time.time()` while `get` used the injected monotonic clock, making
  entry ages inconsistent. Both operations now use the injected clock; each
  `put` takes one timestamp for expiration cleanup and the stored value.
- `get` treated falsy values as absent. It now relies on dictionary lookup for
  missing keys and returns stored values unchanged, including `0`, `False`, and
  `None`.
- Expiration used `age > ttl_seconds`. It now uses `age >= ttl_seconds`, and an
  expired lookup removes the entry before raising `KeyError`.
- Successful reads did not refresh recency. They now move the key to the end of
  the ordered dictionary while preserving its insertion/update timestamp.
- `put` evicted before checking whether it was updating an existing key, and
  assignment alone did not refresh recency. It now stores the new value and
  timestamp, moves the key to the most recent position, and evicts only when
  the resulting size exceeds capacity.
- Capacity enforcement ignored expired entries. Every `put` now removes all
  expired entries before enforcing capacity, scanning the entire dictionary
  because LRU order can differ from expiration order. Any remaining eviction
  removes the least recently used live entry.
- Constructor arguments were not validated. `max_size < 1` and
  `ttl_seconds <= 0` now raise `ValueError`.

Regression cases use an injected, manually advanced clock without sleeping:

- Normal and falsy value round trips; missing-key errors.
- Reads just before, exactly at, and after the TTL boundary.
- Successful reads refresh LRU recency without extending TTL.
- Updates replace values, reset TTL, refresh recency, and preserve other entries
  when the cache is full; expired keys can be inserted again with a fresh TTL.
- Capacity eviction with and without reads, including a one-entry cache.
- An expired most recently used entry is removed before a live least recently
  used entry; all expired entries are purged even below capacity.
- Zero, negative, and sub-one capacities; zero and negative TTLs.

The original suite reproduced two failures out of three tests before the fix.
The expanded suite also ran against the faulty implementation and reported
`FAILED (failures=16, errors=6)` across 18 test methods, including subtest results.

Final command, run from this directory:

```sh
python3 -m unittest discover -s . -p 'test_*.py' -v
```

Exact final test summary:

```text
----------------------------------------------------------------------
Ran 18 tests in 0.000s

OK
```

Exit code: `0`. Every test passed.

Exact model ID: `gpt-6-astra`.
