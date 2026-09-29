# Task 02 — Bug fixing: TTL/LRU cache

`ttl_cache.py` is a deliberately faulty implementation. Fix it without changing
the public API and add regression tests.

Required behavior:

- `get(key)` returns the stored value, including falsy values such as `0`, `False`
  and `None`; it raises `KeyError` only for missing or expired entries.
- TTL uses the injected monotonic `clock` and expires at `age >= ttl_seconds`.
- A successful `get` refreshes LRU recency but does not refresh TTL.
- `put` updates an existing key's value, timestamp and recency.
- Before enforcing capacity, expired entries are removed.
- Capacity eviction removes the least recently used live entry.
- `max_size < 1` and `ttl_seconds <= 0` raise `ValueError`.

Run the tests. Write `RESPONSE.md` with the root causes, fixes, regression cases,
and exact test result. Work only in this directory.

