import time
from typing import Any


# Simple in-memory cache with TTL
_cache: dict[str, dict] = {}


def get_from_cache(key: str) -> Any | None:
    """Return cached value if it exists and hasn't expired."""
    if key not in _cache:
        return None

    entry = _cache[key]
    if time.time() - entry["timestamp"] > entry["ttl"]:
        # Expired - remove it
        del _cache[key]
        return None

    return entry["value"]


def set_in_cache(key: str, value: Any, ttl: int = 300):
    """Store a value in cache with TTL in seconds."""
    _cache[key] = {
        "value": value,
        "timestamp": time.time(),
        "ttl": ttl,
    }


def clear_cache():
    """Clear the entire cache."""
    _cache.clear()


def get_cache_stats() -> dict:
    """Return basic cache statistics."""
    now = time.time()
    total = len(_cache)
    expired = 0

    for key, entry in _cache.items():
        if now - entry["timestamp"] > entry["ttl"]:
            expired += 1

    return {
        "total_entries": total,
        "expired_entries": expired,
        "active_entries": total - expired,
    }
