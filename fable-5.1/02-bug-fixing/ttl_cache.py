import time
from collections import OrderedDict


class TTLCache:
    """Bounded LRU cache whose entries also expire ``ttl_seconds`` after they
    were stored.

    ``clock`` is a zero-argument callable returning seconds from a monotonic
    source. It is the *only* time source the cache uses, which keeps behaviour
    deterministic under test and immune to wall-clock jumps.
    """

    def __init__(self, max_size, ttl_seconds, clock=time.monotonic):
        if max_size < 1:
            raise ValueError(f"max_size must be >= 1, got {max_size!r}")
        if ttl_seconds <= 0:
            raise ValueError(f"ttl_seconds must be > 0, got {ttl_seconds!r}")
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        self.clock = clock
        # key -> (value, stored_at), ordered from least to most recently used.
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
        # Free slots held by dead entries before deciding whether to evict.
        self._purge_expired(now)
        if key in self._items:
            # Existing live key: new value, fresh TTL, most recently used.
            # It already owns a slot, so nothing else is evicted.
            self._items[key] = (value, now)
            self._items.move_to_end(key)
            return
        if len(self._items) >= self.max_size:
            # Evict the least recently used live entry.
            self._items.popitem(last=False)
        self._items[key] = (value, now)

    def get(self, key):
        value, stored_at = self._items[key]  # KeyError for a missing key
        if self._is_expired(stored_at, self.clock()):
            del self._items[key]
            raise KeyError(key)
        # A hit refreshes recency only; the stored timestamp is untouched, so
        # the TTL keeps counting from when the value was put.
        self._items.move_to_end(key)
        return value

    def __len__(self):
        self._purge_expired(self.clock())
        return len(self._items)
