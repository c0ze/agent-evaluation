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

    def _expired(self, created, now):
        return now - created >= self.ttl_seconds

    def _purge_expired(self):
        now = self.clock()
        stale = [k for k, (_, created) in self._items.items()
                 if self._expired(created, now)]
        for k in stale:
            del self._items[k]

    def put(self, key, value):
        self._purge_expired()
        if key not in self._items and len(self._items) >= self.max_size:
            self._items.popitem(last=False)
        self._items[key] = (value, self.clock())
        self._items.move_to_end(key)

    def get(self, key):
        value, created = self._items[key]
        if self._expired(created, self.clock()):
            del self._items[key]
            raise KeyError(key)
        self._items.move_to_end(key)
        return value

    def __len__(self):
        return len(self._items)
