from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from redis.asyncio import Redis

from ..dependencies import get_redis, verify_api_key
from ..ir.validator import IrValidationError
from ..jobs.store import JobStore
from ..schemas.ir import PatternName, PlcVendor
from ..services.claude_ir_service import ClaudeIrService
from ..services.ir_service import IrService

router = APIRouter(prefix="/v1/ir", tags=["ir"], dependencies=[Depends(verify_api_key)])


class IrProgramBody(BaseModel):
    program: dict[str, Any]


class IrPatternRequest(BaseModel):
    projectName: str = "MotorControl"
    vendor: str = "schneider"
    model: str = "TM221CE24R"
    numLights: int = Field(default=4, ge=2, le=8)
    delaySeconds: int = Field(default=3, ge=1, le=60)
    cycleSeconds: int = Field(default=5, ge=1, le=60)
    runSeconds: int = Field(default=5, ge=1, le=60)
    setpoint: float = Field(default=50.0, ge=0.0, le=1000.0)


class IrGenerateFromDescriptionRequest(BaseModel):
    description: str = Field(min_length=1)
    vendor: PlcVendor = "schneider"
    model: str = "TM221CE24R"
    projectName: str | None = None
    synthesisMode: Literal["constrained", "arbitrary"] = "constrained"


@router.get("/patterns")
async def list_ir_patterns():
    return {"patterns": IrService().list_patterns()}


@router.get("/schema")
async def get_ir_schema():
    return IrService().get_json_schema()


@router.post("/patterns/{pattern_name}")
async def get_pattern_ir(pattern_name: PatternName, body: IrPatternRequest):
    service = IrService()
    return service.get_pattern_ir(
        pattern_name,
        project_name=body.projectName,
        vendor=body.vendor,
        model=body.model,
        num_lights=body.numLights,
        delay_seconds=body.delaySeconds,
        cycle_seconds=body.cycleSeconds,
        run_seconds=body.runSeconds,
        setpoint=body.setpoint,
    )


@router.post("/validate")
async def validate_ir_program(body: IrProgramBody):
    try:
        return IrService().validate(body.program)
    except IrValidationError as exc:
        raise HTTPException(status_code=422, detail={"errors": exc.errors}) from exc


@router.post("/serialize")
async def serialize_ir_program(body: IrProgramBody, redis: Redis = Depends(get_redis)):
    store = JobStore(redis)
    job_id = await store.enqueue("program.ir.serialize", {"program": body.program})
    return JSONResponse(status_code=202, content={"jobId": job_id, "status": "queued"})


@router.post("/roundtrip")
async def roundtrip_ir_program(body: IrProgramBody, redis: Redis = Depends(get_redis)):
    store = JobStore(redis)
    job_id = await store.enqueue("program.ir.roundtrip", {"program": body.program})
    return JSONResponse(status_code=202, content={"jobId": job_id, "status": "queued"})


@router.post("/generate-from-description")
async def generate_ir_from_description(
    body: IrGenerateFromDescriptionRequest,
    redis: Redis = Depends(get_redis),
):
    store = JobStore(redis)
    job_id = await store.enqueue(
        "program.claude_ir",
        {
            "description": body.description,
            "vendor": body.vendor,
            "model": body.model,
            "projectName": body.projectName,
            "synthesisMode": body.synthesisMode,
        },
    )
    return JSONResponse(status_code=202, content={"jobId": job_id, "status": "queued"})
