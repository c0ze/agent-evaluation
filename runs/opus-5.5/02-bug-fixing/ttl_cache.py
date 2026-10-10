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
        # key -> (value, created_at); order is LRU (first) to MRU (last).
        self._items = OrderedDict()

    def _is_expired(self, created, now):
        return now - created >= self.ttl_seconds

    def _purge_expired(self, now):
        expired = [k for k, (_, created) in self._items.items()
                   if self._is_expired(created, now)]
        for k in expired:
            del self._items[k]

    def put(self, key, value):
        now = self.clock()
        self._purge_expired(now)
        if key in self._items:
            # Updating an existing key never needs an eviction.
            self._items.move_to_end(key)
        else:
            while len(self._items) >= self.max_size:
                self._items.popitem(last=False)
        self._items[key] = (value, now)

    def get(self, key):
        value, created = self._items[key]
        if self._is_expired(created, self.clock()):
            del self._items[key]
            raise KeyError(key)
        self._items.move_to_end(key)
        return value

    def __len__(self):
        return len(self._items)
