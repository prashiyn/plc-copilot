from fastapi import APIRouter, Depends
from redis.asyncio import Redis

from ..config import get_settings
from ..dependencies import get_redis, verify_api_key

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    return {"status": "ok"}


@router.get("/ready")
async def ready(redis: Redis = Depends(get_redis)):
    settings = get_settings()
    await redis.ping()
    ready = {"status": "ready", "redis": True}
    if not settings.anthropic_api_key:
        ready["anthropic"] = False
        ready["warning"] = "ANTHROPIC_API_KEY not set — AI/sketch jobs will fail"
    else:
        ready["anthropic"] = True
    return ready
