from fastapi import APIRouter, Depends, HTTPException
from redis.asyncio import Redis

from ..dependencies import get_redis, verify_api_key
from ..jobs.store import JobStore

router = APIRouter(prefix="/v1/jobs", tags=["jobs"], dependencies=[Depends(verify_api_key)])


@router.get("/{job_id}")
async def get_job(job_id: str, redis: Redis = Depends(get_redis)):
    store = JobStore(redis)
    job = await store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job
