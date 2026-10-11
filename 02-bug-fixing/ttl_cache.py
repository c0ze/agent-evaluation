import time
from collections import OrderedDict


class TTLCache:
    def __init__(self, max_size, ttl_seconds, clock=time.monotonic):
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        self.clock = clock
        self._items = OrderedDict()

    def put(self, key, value):
        if len(self._items) >= self.max_size:
            self._items.popitem(last=False)
        self._items[key] = (value, time.time())

    def get(self, key):
        value, created = self._items[key]
        if not value:
            raise KeyError(key)
        if self.clock() - created > self.ttl_seconds:
            raise KeyError(key)
        return value

    def __len__(self):
        return len(self._items)

