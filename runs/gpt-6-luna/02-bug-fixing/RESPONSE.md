# TTL/LRU cache fix

## Root causes

- `put` timestamped entries with `time.time()` instead of the injected monotonic clock, so deterministic clocks and TTL comparisons were inconsistent.
- `get` rejected every falsy value and expired entries only when age was greater than the TTL, leaving entries alive at the expiration boundary.
- Successful reads did not move entries to the most-recently-used position. Writes evicted before checking for expired entries and evicted even when updating an existing key.
- The constructor accepted capacities below one and nonpositive TTLs.

## Fixes

- Validate `max_size >= 1` and `ttl_seconds > 0`, raising `ValueError` otherwise.
- Use the injected clock for writes and expire entries when `now - created >= ttl_seconds`.
- Preserve and return falsy values; raise `KeyError` for missing or expired entries. A successful read moves the key to the end of the LRU order without changing its timestamp.
- Before a write enforces capacity, remove all expired entries. Updating an existing key replaces its value and timestamp and moves it to the most-recently-used position; a new key evicts the least-recently-used remaining live entry only when needed.

## Regression cases

- Falsy values (`0`, `False`, and `None`) round-trip, while a missing key raises `KeyError`.
- Expiration occurs at the exact TTL boundary, and a successful `get` refreshes recency without extending TTL.
- A `get` and an update by `put` protect a key from LRU eviction. Updating also replaces its value and resets its TTL timestamp.
- `put` removes expired entries before evicting a live entry for capacity.
- Zero and negative capacities and TTLs raise `ValueError`.

## Test result

Command: `python3 -m unittest -v`

Exact result:

```text
test_expires_at_boundary (test_ttl_cache.TTLCacheTests.test_expires_at_boundary) ... ok
test_get_refreshes_lru (test_ttl_cache.TTLCacheTests.test_get_refreshes_lru) ... ok
test_get_refreshes_recency_without_refreshing_ttl (test_ttl_cache.TTLCacheTests.test_get_refreshes_recency_without_refreshing_ttl) ... ok
test_get_returns_falsy_values (test_ttl_cache.TTLCacheTests.test_get_returns_falsy_values) ... ok
test_invalid_capacity_and_ttl_raise_value_error (test_ttl_cache.TTLCacheTests.test_invalid_capacity_and_ttl_raise_value_error) ... ok
test_missing_key_raises_key_error (test_ttl_cache.TTLCacheTests.test_missing_key_raises_key_error) ... ok
test_put_removes_expired_entries_before_capacity_eviction (test_ttl_cache.TTLCacheTests.test_put_removes_expired_entries_before_capacity_eviction) ... ok
test_put_updates_value_timestamp_and_recency (test_ttl_cache.TTLCacheTests.test_put_updates_value_timestamp_and_recency) ... ok
test_round_trip (test_ttl_cache.TTLCacheTests.test_round_trip) ... ok

----------------------------------------------------------------------
Ran 9 tests in 0.000s

OK
```
