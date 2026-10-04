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

    def _purge_expired(self, now):
        """Drop every entry whose age is >= ttl_seconds. Expired entries are
        always the oldest ones (TTL is uniform and recency never changes the
        timestamp), but scan the whole map so ordering is never load-bearing."""
        expired = [k for k, (_, created) in self._items.items()
                   if now - created >= self.ttl_seconds]
        for key in expired:
            del self._items[key]

    def put(self, key, value):
        now = self.clock()
        # Reclaim expired entries before considering capacity, so eviction
        # never discards a live value while dead ones occupy space.
        self._purge_expired(now)
        if key in self._items:
            # Overwrite in place: new value, new timestamp, new recency.
            self._items[key] = (value, now)
            self._items.move_to_end(key)
            return
        if len(self._items) >= self.max_size:
            # Evict the least recently used live entry.
            self._items.popitem(last=False)
        self._items[key] = (value, now)

    def get(self, key):
        value, created = self._items[key]  # KeyError only when the key is absent
        if self.clock() - created >= self.ttl_seconds:
            raise KeyError(key)
        # Recency refresh only: the stored timestamp (and therefore the TTL
        # deadline) is left untouched.
        self._items.move_to_end(key)
        return value

    def __len__(self):
        return len(self._items)
