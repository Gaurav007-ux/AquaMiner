"""
AquaYantra — Redis connection manager.

Provides an async Redis client with graceful fallback when Redis is disabled.
"""

from __future__ import annotations

from typing import Any

import redis.asyncio as aioredis

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger("redis")

_pool: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis | None:
    """Return the shared Redis client, or None if Redis is disabled."""
    global _pool
    if not settings.REDIS_ENABLED:
        return None
    if _pool is None:
        _pool = aioredis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            max_connections=20,
        )
        logger.info("redis_connected", url=settings.REDIS_URL)
    return _pool


async def close_redis() -> None:
    """Close the Redis connection pool."""
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
        logger.info("redis_closed")


class RedisCache:
    """Simple async cache wrapper around Redis with in-memory fallback."""

    def __init__(self) -> None:
        self._memory: dict[str, Any] = {}

    async def get(self, key: str) -> Any | None:
        client = await get_redis()
        if client:
            return await client.get(key)
        return self._memory.get(key)

    async def set(self, key: str, value: Any, ttl: int = 300) -> None:
        client = await get_redis()
        if client:
            await client.set(key, value, ex=ttl)
        else:
            self._memory[key] = value

    async def delete(self, key: str) -> None:
        client = await get_redis()
        if client:
            await client.delete(key)
        else:
            self._memory.pop(key, None)

    async def publish(self, channel: str, message: str) -> None:
        client = await get_redis()
        if client:
            await client.publish(channel, message)


redis_cache = RedisCache()
