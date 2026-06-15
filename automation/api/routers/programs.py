import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from redis.asyncio import Redis

from ..config import get_settings
from ..dependencies import get_redis, verify_api_key
from ..jobs.store import JobStore
from ..schemas.m221 import M221BuildRequest, M221GenerateRequest
from ..schemas.programs import PlcopenGenerateRequest, ProgramGenerateRequest

router = APIRouter(prefix="/v1/programs", tags=["programs"], dependencies=[Depends(verify_api_key)])


async def _save_upload(file: UploadFile) -> str:
    settings = get_settings()
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    ext = Path(file.filename or "upload.bin").suffix or ".bin"
    dest = upload_dir / f"{uuid.uuid4()}{ext}"
    content = await file.read()
    max_bytes = settings.max_upload_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(status_code=400, detail=f"File exceeds {settings.max_upload_mb}MB limit")
    dest.write_bytes(content)
    return str(dest)


@router.post("/generate")
async def generate_program(body: ProgramGenerateRequest, redis: Redis = Depends(get_redis)):
    store = JobStore(redis)
    job_id = await store.enqueue("program.generate", body.model_dump())
    return JSONResponse(status_code=202, content={"jobId": job_id, "status": "queued"})


@router.post("/plcopen")
async def generate_plcopen(body: PlcopenGenerateRequest, redis: Redis = Depends(get_redis)):
    store = JobStore(redis)
    job_id = await store.enqueue("program.plcopen", body.model_dump())
    return JSONResponse(status_code=202, content={"jobId": job_id, "status": "queued"})


@router.post("/parse")
async def parse_program(file: UploadFile = File(...), redis: Redis = Depends(get_redis)):
    file_path = await _save_upload(file)
    store = JobStore(redis)
    job_id = await store.enqueue("program.parse", {"filePath": file_path})
    return JSONResponse(status_code=202, content={"jobId": job_id, "status": "queued"})


@router.post("/m221/build")
async def build_m221_program(body: M221BuildRequest, redis: Redis = Depends(get_redis)):
    store = JobStore(redis)
    job_id = await store.enqueue(
        "program.m221.build",
        {
            "programData": body.programData,
            "plcModel": body.plcModel,
            "projectName": body.projectName,
        },
    )
    return JSONResponse(status_code=202, content={"jobId": job_id, "status": "queued"})


@router.post("/m221/generate")
async def generate_m221_program(body: M221GenerateRequest, redis: Redis = Depends(get_redis)):
    store = JobStore(redis)
    job_id = await store.enqueue(
        "program.m221.generate",
        {
            "description": body.description,
            "plcModel": body.plcModel,
            "projectName": body.projectName,
        },
    )
    return JSONResponse(status_code=202, content={"jobId": job_id, "status": "queued"})
