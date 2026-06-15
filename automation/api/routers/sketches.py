import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from redis.asyncio import Redis

from ..config import get_settings
from ..dependencies import get_redis, verify_api_key
from ..jobs.store import JobStore

router = APIRouter(prefix="/v1/sketches", tags=["sketches"], dependencies=[Depends(verify_api_key)])


async def _save_upload(file: UploadFile) -> str:
    settings = get_settings()
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    ext = Path(file.filename or "upload.jpg").suffix or ".jpg"
    dest = upload_dir / f"{uuid.uuid4()}{ext}"
    content = await file.read()
    max_bytes = settings.max_upload_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(status_code=400, detail=f"File exceeds {settings.max_upload_mb}MB limit")
    dest.write_bytes(content)
    return str(dest)


@router.post("/analyze")
async def analyze_sketch(
    platform: str = Form(default="schneider"),
    image: UploadFile = File(...),
    redis: Redis = Depends(get_redis),
):
    image_path = await _save_upload(image)
    store = JobStore(redis)
    job_id = await store.enqueue("sketch.analyze", {"imagePath": image_path, "platform": platform})
    return JSONResponse(status_code=202, content={"jobId": job_id, "status": "queued"})


@router.post("/generate")
async def generate_from_sketch(
    platform: str = Form(default="schneider"),
    project_name: str = Form(default="SketchProject"),
    controller: str = Form(default="TM221CE24R"),
    image: UploadFile = File(...),
    redis: Redis = Depends(get_redis),
):
    if platform not in ("schneider", "rockwell"):
        raise HTTPException(
            status_code=422,
            detail="Sketch generation supports schneider and rockwell platforms",
        )

    image_path = await _save_upload(image)
    store = JobStore(redis)
    job_id = await store.enqueue(
        "sketch.generate",
        {
            "imagePath": image_path,
            "projectName": project_name,
            "controller": controller,
            "platform": platform,
        },
    )
    return JSONResponse(status_code=202, content={"jobId": job_id, "status": "queued"})
