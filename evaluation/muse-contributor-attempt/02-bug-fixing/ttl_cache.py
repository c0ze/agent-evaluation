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
        return (now - created) >= self.ttl_seconds

    def _purge_expired(self, now):
        for key in [k for k, (_, ts) in self._items.items()
                    if self._expired(ts, now)]:
            del self._items[key]

    def put(self, key, value):
        now = self.clock()
        self._purge_expired(now)
        if key in self._items:
            del self._items[key]
        elif len(self._items) >= self.max_size:
            self._items.popitem(last=False)
        self._items[key] = (value, now)

    def get(self, key):
        value, created = self._items[key]
        if self._expired(created, self.clock()):
            del self._items[key]
            raise KeyError(key)
        self._items.move_to_end(key)
        return value

    def __len__(self):
        return len(self._items)
