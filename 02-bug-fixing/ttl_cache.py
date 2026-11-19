import time
from collections import OrderedDict


class TTLCache:
    def __init__(self, max_size, ttl_seconds, clock=time.monotonic):
        if max_size < 1:
            raise ValueError("max_size must be at least 1")
        if ttl_seconds <= 0:
            raise ValueError("ttl_seconds must be positive")
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        self.clock = clock
        self._items = OrderedDict()

    def _is_expired(self, created):
        return self.clock() - created >= self.ttl_seconds

    def _purge_expired(self):
        for key in [k for k, (_, created) in self._items.items() if self._is_expired(created)]:
            del self._items[key]

    def put(self, key, value):
        now = self.clock()
        if key in self._items:
            # Refresh value, timestamp and recency without touching capacity.
            del self._items[key]
            self._items[key] = (value, now)
            return

        # Expired entries must be reclaimed before capacity is enforced.
        self._purge_expired()
        while len(self._items) >= self.max_size:
            self._items.popitem(last=False)
        self._items[key] = (value, now)

    def get(self, key):
        if key not in self._items:
            raise KeyError(key)
        value, created = self._items[key]
        if self._is_expired(created):
            del self._items[key]
            raise KeyError(key)
        self._items.move_to_end(key)
        return value

    def __len__(self):
        return len(self._items)
