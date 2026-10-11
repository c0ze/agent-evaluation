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

    def _remove_expired(self):
        now = self.clock()
        expired_keys = [
            key for key, (_, created) in self._items.items()
            if now - created >= self.ttl_seconds
        ]
        for key in expired_keys:
            del self._items[key]

    def put(self, key, value):
        self._remove_expired()
        now = self.clock()
        if key in self._items:
            self._items[key] = (value, now)
            self._items.move_to_end(key)
        else:
            if len(self._items) >= self.max_size:
                self._items.popitem(last=False)
            self._items[key] = (value, now)

    def get(self, key):
        if key not in self._items:
            raise KeyError(key)
        value, created = self._items[key]
        if self.clock() - created >= self.ttl_seconds:
            del self._items[key]
            raise KeyError(key)
        self._items.move_to_end(key)
        return value

    def __len__(self):
        return len(self._items)