"""A small in-process TTL cache for connector-backed async endpoints.
NASA POWER, Open-Meteo, Tomorrow.io etc. are free/shared/rate-limited
services with no SLA — this stops an endpoint re-hitting them on every
request for the same arguments within the TTL window. Process-local
(resets on restart, not shared across instances) and argument-keyed —
adequate for a single-instance prototype, not a substitute for a real
cache (Redis) at production scale."""

import functools
import time
from typing import Awaitable, Callable, TypeVar

T = TypeVar("T")

_cache: dict[str, tuple[float, object]] = {}


def ttl_cache(seconds: int) -> Callable[[Callable[..., Awaitable[T]]], Callable[..., Awaitable[T]]]:
    def decorator(func: Callable[..., Awaitable[T]]) -> Callable[..., Awaitable[T]]:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            key = f"{func.__module__}.{func.__qualname__}:{args!r}:{sorted(kwargs.items())!r}"
            now = time.monotonic()
            cached = _cache.get(key)
            if cached is not None and now - cached[0] < seconds:
                return cached[1]
            value = await func(*args, **kwargs)
            _cache[key] = (now, value)
            return value

        return wrapper

    return decorator


def cache_stats() -> dict:
    """Exposed for the health/debug endpoint — how many distinct
    (function, args) entries are currently cached."""
    return {"entries": len(_cache)}


def clear_cache() -> None:
    _cache.clear()
