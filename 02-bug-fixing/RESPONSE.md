# TTL/LRU cache bug fix

## Root causes and fixes

- `put` recorded wall-clock timestamps while `get` measured age with the injected monotonic clock. Both methods now use the injected clock, and an entry expires when its age reaches the TTL.
- `get` treated falsy values as missing and left the access order unchanged. Live lookups return the stored value and move the key to the most recently used position while preserving its timestamp. A lookup that encounters an expired entry removes it and raises `KeyError`.
- `put` evicted an entry whenever the cache was full, even during an update, and ignored expired entries. It now removes all expired entries before checking capacity, evicts the least recently used live entry only when a new key needs space, and records a fresh value, timestamp, and recency on every write.
- The constructor accepted invalid limits. It now raises `ValueError` for capacities below one and TTLs of zero or less.

## Regression coverage

- Round-trip and missing-key behavior, including successful reads of `0`, `False`, and `None`.
- Expiry at the exact TTL boundary and expiry after a successful read just before the boundary.
- LRU eviction after a read and after an update in a full cache.
- Replacement of the stored value and renewal of the TTL on update.
- Removal of multiple expired, recently used entries before eviction, preserving the older live entry.
- Rejection of negative, zero, and fractional capacities below one and of negative and zero TTLs.

## Test result

`python3 -B -m unittest -v` exited with status 0. Every test reported `ok`.

```text
----------------------------------------------------------------------
Ran 11 tests in 0.001s

OK
```
