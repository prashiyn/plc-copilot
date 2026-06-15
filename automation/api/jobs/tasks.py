import logging
import os
from typing import Any

from redis.asyncio import Redis

from ..config import get_settings
from ..services.claude_ir_service import ClaudeIrService
from ..services.claude_service import ClaudeService
from ..services.ir_service import IrService
from ..services.m221_program_service import M221ProgramService
from ..services.program_service import ProgramService
from ..services.sketch_service import SketchService
from .store import JobStore

logger = logging.getLogger(__name__)


async def process_job(redis: Redis, job_id: str) -> None:
    store = JobStore(redis)
    job_type = await redis.hget(f"automation:job:{job_id}", "type")
    payload = await store.get_payload(job_id)

    await store.mark_running(job_id)

    try:
        result = await _dispatch(job_type or "", payload)
        await store.mark_completed(job_id, result)
    except Exception as exc:
        logger.exception("Job %s failed", job_id)
        await store.mark_failed(job_id, "JOB_FAILED", str(exc))


async def _dispatch(job_type: str, payload: dict[str, Any]) -> Any:
    if job_type == "sketch.analyze":
        service = SketchService()
        return service.analyze(payload["imagePath"], payload.get("platform", "schneider"))

    if job_type == "sketch.generate":
        service = SketchService()
        return service.generate_from_sketch(
            payload["imagePath"],
            payload["projectName"],
            payload.get("controller", "TM221CE24R"),
            payload.get("platform", "schneider"),
        )

    if job_type == "ai.chat":
        claude = ClaudeService()
        return claude.chat(
            system=payload.get("system"),
            messages=payload["messages"],
            max_tokens=payload.get("maxTokens", 4096),
            model=payload.get("model"),
        )

    if job_type == "ai.json":
        claude = ClaudeService()
        parsed = claude.ask_json(
            payload["system"],
            payload["prompt"],
            max_tokens=payload.get("maxTokens", 3072),
            model=payload.get("model"),
        )
        return {"data": parsed}

    if job_type == "ai.m221.generate":
        claude = ClaudeService()
        text = claude.generate_m221_program(payload["description"], payload.get("plcModel", "TM221CE16T"))
        return {"json": text}

    if job_type == "program.generate":
        service = ProgramService()
        return service.generate(payload)

    if job_type == "program.plcopen":
        service = ProgramService()
        return service.generate_plcopen(payload)

    if job_type == "program.parse":
        service = ProgramService()
        return service.parse(payload["filePath"])

    if job_type == "program.m221.build":
        service = M221ProgramService()
        return service.build_from_json(
            payload["programData"],
            payload.get("plcModel", "TM221CE16T"),
            payload.get("projectName"),
        )

    if job_type == "program.m221.generate":
        service = M221ProgramService()
        return service.generate_from_description(
            payload["description"],
            payload.get("plcModel", "TM221CE16T"),
            payload.get("projectName"),
        )

    if job_type == "program.ir.serialize":
        service = IrService()
        return service.serialize(payload["program"])

    if job_type == "program.ir.roundtrip":
        service = IrService()
        return service.roundtrip(payload["program"])

    if job_type == "program.claude_ir":
        service = ClaudeIrService()
        return service.generate_program_ir(
            payload["description"],
            vendor=payload.get("vendor", "schneider"),
            model=payload.get("model", "TM221CE24R"),
            project_name=payload.get("projectName"),
        )

    raise ValueError(f"Unknown job type: {job_type}")


def cleanup_job_files(payload: dict[str, Any]) -> None:
    for key in ("imagePath", "filePath"):
        path = payload.get(key)
        if path and os.path.isfile(path):
            try:
                os.remove(path)
            except OSError:
                pass
