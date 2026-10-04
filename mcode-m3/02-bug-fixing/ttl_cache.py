import time
from collections import OrderedDict


class TTLCache:
    def __init__(self, max_size, ttl_seconds, clock=time.monotonic):
        if max_size < 1:
            raise ValueError("max_size must be >= 1")
        if ttl_seconds <= 0:
            raise ValueError("ttl_seconds must be > 0")
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        self.clock = clock
        self._items = OrderedDict()

    def _is_expired(self, created):
        return self.clock() - created >= self.ttl_seconds

    def _purge_expired(self):
        expired = [k for k, (_, t) in self._items.items() if self._is_expired(t)]
        for k in expired:
            del self._items[k]

    def put(self, key, value):
        # Remove expired entries before checking capacity.
        self._purge_expired()
        if key in self._items:
            # Updating an existing key: refresh value, timestamp, and recency
            # without evicting any other entry.
            self._items[key] = (value, self.clock())
            self._items.move_to_end(key)
            return
        if len(self._items) >= self.max_size:
            self._items.popitem(last=False)
        self._items[key] = (value, self.clock())

    def get(self, key):
        if key not in self._items:
            raise KeyError(key)
        value, created = self._items[key]
        if self._is_expired(created):
            del self._items[key]
            raise KeyError(key)
        # Successful get refreshes LRU recency but leaves the timestamp alone.
        self._items.move_to_end(key)
        return value

    def __len__(self):
        return len(self._items)