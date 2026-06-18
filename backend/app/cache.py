import time
import threading
from typing import Any, Generic, TypeVar

T = TypeVar("T")


class TTLEntry(Generic[T]):
    def __init__(self, value: T, ttl: int):
        self.value = value
        self.expires_at = time.monotonic() + ttl

    def is_expired(self) -> bool:
        return time.monotonic() > self.expires_at


class TTLCache:
    def __init__(self):
        self._store: dict[str, TTLEntry] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> Any | None:
        with self._lock:
            entry = self._store.get(key)
            if entry is None or entry.is_expired():
                return None
            return entry.value

    def set(self, key: str, value: Any, ttl: int) -> None:
        with self._lock:
            self._store[key] = TTLEntry(value, ttl)

    def get_stale(self, key: str) -> Any | None:
        """Return value even if expired (used as last-known-good fallback)."""
        with self._lock:
            entry = self._store.get(key)
            return entry.value if entry else None


cache = TTLCache()
