from typing import Any

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from redis.asyncio import Redis

from ..dependencies import get_redis, verify_api_key
from ..jobs.store import JobStore

router = APIRouter(prefix="/v1/ai", tags=["ai"], dependencies=[Depends(verify_api_key)])


class ChatMessage(BaseModel):
    role: str
    content: str | list[dict[str, Any]]


class ChatJobRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    system: str | None = None
    messages: list[ChatMessage]
    max_tokens: int = Field(default=4096, alias="maxTokens")
    model: str | None = None


class JsonJobRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    system: str
    prompt: str
    max_tokens: int = Field(default=3072, alias="maxTokens")
    model: str | None = None


class M221GenerateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    description: str
    plc_model: str = Field(default="TM221CE16T", alias="plcModel")


class RecommendPlcRequest(BaseModel):
    model_config = ConfigDict(extra="allow")


class RecommendSolutionRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    project_description: str = Field(alias="projectDescription")
    criteria: str = "balanced"
    constraints: dict[str, Any] | None = None


class RectifyErrorRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    program_code: str = Field(alias="programCode")
    platform: str
    error_message: str = Field(alias="errorMessage")
    plc_model: str = Field(alias="plcModel")
    error_screenshot: str | None = Field(default=None, alias="errorScreenshot")


async def _enqueue(redis: Redis, job_type: str, payload: dict) -> JSONResponse:
    store = JobStore(redis)
    job_id = await store.enqueue(job_type, payload)
    return JSONResponse(status_code=202, content={"jobId": job_id, "status": "queued"})


@router.post("/chat")
async def ai_chat(body: ChatJobRequest, redis: Redis = Depends(get_redis)):
    messages = [{"role": m.role, "content": m.content} for m in body.messages]
    return await _enqueue(
        redis,
        "ai.chat",
        {
            "system": body.system,
            "messages": messages,
            "maxTokens": body.max_tokens,
            "model": body.model,
        },
    )


@router.post("/json")
async def ai_json(body: JsonJobRequest, redis: Redis = Depends(get_redis)):
    return await _enqueue(
        redis,
        "ai.json",
        {
            "system": body.system,
            "prompt": body.prompt,
            "maxTokens": body.max_tokens,
            "model": body.model,
        },
    )


@router.post("/m221/generate")
async def ai_m221_generate(body: M221GenerateRequest, redis: Redis = Depends(get_redis)):
    return await _enqueue(
        redis,
        "ai.m221.generate",
        {"description": body.description, "plcModel": body.plc_model},
    )


@router.post("/recommend-plc")
async def ai_recommend_plc(body: RecommendPlcRequest, redis: Redis = Depends(get_redis)):
    return await _enqueue(redis, "ai.recommend.plc", body.model_dump())


@router.post("/recommend-solution")
async def ai_recommend_solution(body: RecommendSolutionRequest, redis: Redis = Depends(get_redis)):
    return await _enqueue(
        redis,
        "ai.recommend.solution",
        {
            "projectDescription": body.project_description,
            "criteria": body.criteria,
            "constraints": body.constraints,
        },
    )


@router.post("/rectify-error")
async def ai_rectify_error(body: RectifyErrorRequest, redis: Redis = Depends(get_redis)):
    return await _enqueue(
        redis,
        "ai.rectify.error",
        {
            "programCode": body.program_code,
            "platform": body.platform,
            "errorMessage": body.error_message,
            "plcModel": body.plc_model,
            "errorScreenshot": body.error_screenshot,
        },
    )
