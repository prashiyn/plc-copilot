"""Background worker — consumes Redis job queue."""

import asyncio
import logging

from redis.asyncio import Redis

from .config import get_settings
from .jobs.store import JobStore
from .jobs.tasks import cleanup_job_files, process_job

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def run_worker() -> None:
    settings = get_settings()
    redis = Redis.from_url(settings.redis_url, decode_responses=True)
    store = JobStore(redis)
    logger.info("Automation worker started (redis=%s)", settings.redis_url)

    while True:
        job_id = await store.dequeue(timeout=5)
        if not job_id:
            continue
        logger.info("Processing job %s", job_id)
        payload = await store.get_payload(job_id)
        try:
            await process_job(redis, job_id)
        finally:
            cleanup_job_files(payload)


def main() -> None:
    asyncio.run(run_worker())


if __name__ == "__main__":
    main()
