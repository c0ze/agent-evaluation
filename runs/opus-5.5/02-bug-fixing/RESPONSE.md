# Task 02: TTL/LRU cache bug fix

The public API is unchanged: `TTLCache(max_size, ttl_seconds, clock=time.monotonic)`,
`put(key, value)`, `get(key)` and `__len__`.

## Root causes and fixes

| # | Bug (original code) | Effect | Fix |
|---|---|---|---|
| 1 | `put` stamped entries with `time.time()`, but `get` compared against `self.clock()` | The wall-clock and monotonic/injected clocks have unrelated origins, so ages came out wrong. With the test clock (~100) the age was hugely negative and nothing ever expired. | `put` and `get` both use `self.clock()`. |
| 2 | `get` did `if not value: raise KeyError` | Falsy values (`0`, `False`, `None`, `""`, `[]`) looked like missing entries. | Removed the truthiness check. `KeyError` now comes only from a missing key or from expiry. |
| 3 | The expiry test was `age > ttl_seconds` | An entry was still returned at exactly `age == ttl_seconds`. | Now `age >= ttl_seconds`, in the helper `_is_expired`. |
| 4 | `get` never updated recency | Eviction was FIFO (by insertion order), not LRU. | A successful `get` calls `move_to_end(key)`. It does not change the timestamp, so TTL is not refreshed. |
| 5 | `put` checked capacity before checking whether the key already existed | Updating a key in a full cache evicted another live key for no reason. Recency was also not refreshed, because assigning to an existing `OrderedDict` key keeps its position. | If the key exists, `move_to_end` is called and there is no eviction. The value and timestamp are then overwritten. |
| 6 | Expired entries were never purged before eviction | A live LRU entry could be evicted while expired entries still used up capacity. | `put` first calls `_purge_expired(now)`, then evicts LRU entries (`popitem(last=False)`) until there is room. |
| 7 | Constructor arguments were not validated | `max_size=0` caused `put` to fail on an empty dict, and `ttl<=0` was accepted. | `max_size < 1` and `ttl_seconds <= 0` raise `ValueError`. |
| 8 | An expired entry found by `get` was left in place | Expired entries stayed around and were counted by `len()`. | `get` deletes an expired entry before raising `KeyError`. |

## Regression cases added (`test_ttl_cache.py`)

The 3 original tests were kept and 16 were added:

- `test_falsy_values_are_returned`: `0`, `False`, `None`, `""` and `[]` round-trip (bug 2).
- `test_missing_key_raises_key_error`
- `test_live_just_before_boundary` / `test_expires_at_boundary` (original test): age 9.999 is live and age 10 is expired (bug 3).
- `test_uses_injected_clock_not_wall_clock`: the clock starts at 0 and expiry follows the injected clock only (bug 1).
- `test_expired_get_removes_entry`: `len()` is 0 after an expired `get` (bug 8).
- `test_get_does_not_refresh_ttl`: a `get` at t+6 does not extend life past t+10 (bug 4, TTL side).
- `test_get_refreshes_lru_keeps_refreshed_key`: the refreshed key and the new key both survive (bug 4).
- `test_put_existing_updates_value_and_timestamp`: a re-put at t+6 is still live at t+12 with the new value, and `len` is 1 (bug 5).
- `test_put_existing_refreshes_recency_without_eviction`: re-putting the LRU key makes the other key the LRU (bug 5).
- `test_put_existing_on_full_cache_does_not_evict_other_key`: re-putting the MRU key in a full cache keeps the LRU key (bug 5).
- `test_evicts_least_recently_used_without_get`
- `test_expired_entries_purged_before_capacity_eviction`: an expired entry that is MRU is purged, and the live LRU entry survives (bug 6).
- `test_all_expired_entries_purged_on_put`: all expired entries are dropped, and `len` is 1 (bug 6).
- `test_invalid_max_size` (0, -1) and `test_invalid_ttl` (0, -1, -0.5) (bug 7).
- `test_minimum_valid_parameters`: `max_size=1` and a fractional TTL are accepted.

### How the tests were checked

- **Against the original `ttl_cache.py`** (from `git show HEAD`): 9 failures and 2 errors out of 19 tests.
  - Some new tests pass on the original only because two of its bugs cancel out. For example, FIFO eviction hides the missing expired-purge.
- **Against deliberately broken versions of the fixed code:** each of these was caught by at least one test:
  - removing the purge
  - using `>` instead of `>=`
  - removing `move_to_end` in `put`
  - evicting even on an update
  - letting `get` refresh the TTL
  - not deleting an expired entry in `get`
- **The one gap that turned up:** evicting on an update was first missed. `test_put_existing_on_full_cache_does_not_evict_other_key` was added to close it.

## Design note

`len()` returns the number of stored entries. An expired entry is removed either on the next `put` (the purge) or when `get` touches it, so it can be counted until then. The task does not ask for any other behavior here, so `__len__` was not changed.

## Exact test result

```
$ python3 -m unittest -v      # Python 3.11.15, in 02-bug-fixing/
...
----------------------------------------------------------------------
Ran 19 tests in 0.001s

OK
```
