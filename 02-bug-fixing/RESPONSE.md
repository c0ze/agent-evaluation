# TTL/LRU cache repair

## Root causes and fixes

- `put` used wall time while `get` used the injected clock. Both now use the injected clock, and entries expire when their age reaches the TTL. The old strict comparison kept entries valid at the boundary.
- `get` treated every falsy value as a miss. Dictionary lookup now handles missing keys. A read removes an expired entry and raises `KeyError`, or returns the stored value and moves the live key to the most recently used position. The write timestamp stays intact on a read.
- `put` evicted the first key whenever the cache was full, even on an overwrite or when another entry had expired. It now removes expired entries, writes the value and timestamp, and marks the key most recently used. It evicts the least recently used live key only if the resulting size exceeds capacity.
- The constructor accepted invalid bounds. It now raises `ValueError` for `max_size < 1` or `ttl_seconds <= 0`.

## Regression cases

The tests use a controllable clock to check a read just before expiry and a miss at the exact boundary. They cover round trips for ordinary values, `0`, `False`, and `None`, plus lookup of a missing key. Separate cases verify that reads and overwrites refresh LRU order, and that an overwrite at capacity refreshes the value and TTL while preserving the other live entry.

The cleanup case makes two older entries more recently used than two younger ones. When both older entries expire, inserting a new key removes both and preserves the younger entries. Constructor tests cover zero and negative values for each bound.

## Test result

`python3 -B -m unittest -v` exited with status 0.

```text
Ran 9 tests in 0.001s

OK
```
