import json
import uuid
from datetime import datetime, timezone
from typing import Any

from redis.asyncio import Redis

from ..config import get_settings

QUEUE_KEY = "automation:jobs:queue"


def _job_key(job_id: str) -> str:
    return f"automation:job:{job_id}"


class JobStore:
    def __init__(self, redis: Redis):
        self.redis = redis
        self.settings = get_settings()

    async def enqueue(self, job_type: str, payload: dict[str, Any]) -> str:
        job_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        await self.redis.hset(
            _job_key(job_id),
            mapping={
                "id": job_id,
                "type": job_type,
                "status": "queued",
                "payload": json.dumps(payload),
                "result": "",
                "error": "",
                "created_at": now,
                "updated_at": now,
            },
        )
        await self.redis.expire(_job_key(job_id), self.settings.job_ttl_seconds)
        await self.redis.lpush(QUEUE_KEY, job_id)
        return job_id

    async def get(self, job_id: str) -> dict[str, Any] | None:
        data = await self.redis.hgetall(_job_key(job_id))
        if not data:
            return None
        result: dict[str, Any] = {
            "id": data.get("id", job_id),
            "type": data.get("type", ""),
            "status": data.get("status", "unknown"),
            "createdAt": data.get("created_at"),
            "updatedAt": data.get("updated_at"),
        }
        if data.get("error"):
            result["error"] = json.loads(data["error"]) if data["error"].startswith("{") else {"message": data["error"]}
        if data.get("result"):
            try:
                result["result"] = json.loads(data["result"])
            except json.JSONDecodeError:
                result["result"] = data["result"]
        return result

    async def mark_running(self, job_id: str) -> None:
        await self._set_status(job_id, "running")

    async def mark_completed(self, job_id: str, result: Any) -> None:
        await self.redis.hset(
            _job_key(job_id),
            mapping={
                "status": "completed",
                "result": json.dumps(result) if not isinstance(result, str) else json.dumps({"value": result}),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
        )

    async def mark_failed(self, job_id: str, code: str, message: str, details: dict | None = None) -> None:
        await self.redis.hset(
            _job_key(job_id),
            mapping={
                "status": "failed",
                "error": json.dumps({"code": code, "message": message, "details": details or {}}),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
        )

    async def _set_status(self, job_id: str, status: str) -> None:
        await self.redis.hset(
            _job_key(job_id),
            mapping={"status": status, "updated_at": datetime.now(timezone.utc).isoformat()},
        )

    async def dequeue(self, timeout: int = 5) -> str | None:
        item = await self.redis.brpop(QUEUE_KEY, timeout=timeout)
        if not item:
            return None
        return item[1]

    async def get_payload(self, job_id: str) -> dict[str, Any]:
        raw = await self.redis.hget(_job_key(job_id), "payload")
        return json.loads(raw) if raw else {}
