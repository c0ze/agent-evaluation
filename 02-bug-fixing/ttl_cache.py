import time
from collections import OrderedDict


class TTLCache:
    """Bounded cache with per-entry TTL and least-recently-used eviction.

    ``_items`` is ordered from least to most recently used. Each value is a
    ``(value, stored_at)`` pair, where ``stored_at`` is a reading of the
    injected ``clock``. An entry is expired once ``clock() - stored_at`` reaches
    ``ttl_seconds``.
    """

    def __init__(self, max_size, ttl_seconds, clock=time.monotonic):
        # Written as negated comparisons so that NaN is rejected as well.
        if not max_size >= 1:
            raise ValueError(f"max_size must be >= 1, got {max_size!r}")
        if not ttl_seconds > 0:
            raise ValueError(f"ttl_seconds must be > 0, got {ttl_seconds!r}")
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        self.clock = clock
        self._items = OrderedDict()

    def _is_expired(self, stored_at, now):
        return now - stored_at >= self.ttl_seconds

    def _purge_expired(self, now):
        expired = [
            key
            for key, (_, stored_at) in self._items.items()
            if self._is_expired(stored_at, now)
        ]
        for key in expired:
            del self._items[key]

    def put(self, key, value):
        now = self.clock()
        # Expired entries go first, so they never cost a live entry its slot.
        self._purge_expired(now)
        if key in self._items:
            # Updating in place needs no eviction; only recency changes.
            self._items.move_to_end(key)
        else:
            while len(self._items) >= self.max_size:
                self._items.popitem(last=False)
        self._items[key] = (value, now)

    def get(self, key):
        value, stored_at = self._items[key]
        if self._is_expired(stored_at, self.clock()):
            del self._items[key]
            raise KeyError(key)
        # Refresh recency only; the timestamp, and so the TTL, is untouched.
        self._items.move_to_end(key)
        return value

    def __len__(self):
        self._purge_expired(self.clock())
        return len(self._items)
