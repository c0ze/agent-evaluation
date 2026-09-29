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

    def put(self, key, value):
        now = self.clock()
        # LRU order can differ from expiration order after reads or updates.
        expired_keys = [
            stored_key
            for stored_key, (_, created) in self._items.items()
            if now - created >= self.ttl_seconds
        ]
        for expired_key in expired_keys:
            del self._items[expired_key]

        self._items[key] = (value, now)
        self._items.move_to_end(key)
        if len(self._items) > self.max_size:
            self._items.popitem(last=False)

    def get(self, key):
        value, created = self._items[key]
        if self.clock() - created >= self.ttl_seconds:
            del self._items[key]
            raise KeyError(key)
        self._items.move_to_end(key)
        return value

    def __len__(self):
        return len(self._items)
