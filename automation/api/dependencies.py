from fastapi import Header, HTTPException
from redis.asyncio import Redis

from .config import get_settings

_redis: Redis | None = None


async def get_redis() -> Redis:
    global _redis
    if _redis is None:
        _redis = Redis.from_url(get_settings().redis_url, decode_responses=True)
    return _redis


async def verify_api_key(authorization: str | None = Header(default=None)) -> None:
    settings = get_settings()
    if not settings.automation_api_key:
        return
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    token = authorization.removeprefix("Bearer ").strip()
    if token != settings.automation_api_key:
        raise HTTPException(status_code=403, detail="Invalid API key")
