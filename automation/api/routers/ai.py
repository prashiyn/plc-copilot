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


class CopilotChatRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    messages: list[dict[str, Any]]
    mode: str = "generate"
    uploaded_images: list[dict[str, Any]] = Field(default_factory=list, alias="uploadedImages")
    max_tokens: int = Field(default=4096, alias="maxTokens")


class EngineerChatRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    messages: list[dict[str, Any]]
    engineer_type: str = Field(default="general-expert", alias="engineerType")
    conversation_context: dict[str, Any] = Field(default_factory=dict, alias="conversationContext")
    max_tokens: int = Field(default=4096, alias="maxTokens")


class ApplicationGenerateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    requirements: str
    application_type: str | None = Field(default=None, alias="applicationType")
    platform: str = "schneider"
    controller: str | None = None
    io_count: str | None = Field(default=None, alias="ioCount")
    safety_level: str = Field(default="standard", alias="safetyLevel")
    max_tokens: int = Field(default=8192, alias="maxTokens")


class LibrarySearchRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    query: str
    platform: str = "schneider"
    application_type: str | None = Field(default=None, alias="applicationType")
    requirements: list[str] = Field(default_factory=list)
    generate_custom: bool = Field(default=False, alias="generateCustom")
    max_tokens: int = Field(default=6144, alias="maxTokens")


class CodeOptimizeRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    code: str
    platform: str = "schneider"
    optimization_goals: list[str] = Field(default_factory=list, alias="optimizationGoals")
    current_issues: str = Field(default="", alias="currentIssues")
    max_tokens: int = Field(default=8192, alias="maxTokens")


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


@router.post("/copilot/chat")
async def ai_copilot_chat(body: CopilotChatRequest, redis: Redis = Depends(get_redis)):
    return await _enqueue(
        redis,
        "ai.copilot.chat",
        {
            "messages": body.messages,
            "mode": body.mode,
            "uploadedImages": body.uploaded_images,
            "maxTokens": body.max_tokens,
        },
    )


@router.post("/engineer/chat")
async def ai_engineer_chat(body: EngineerChatRequest, redis: Redis = Depends(get_redis)):
    return await _enqueue(
        redis,
        "ai.engineer.chat",
        {
            "messages": body.messages,
            "engineerType": body.engineer_type,
            "conversationContext": body.conversation_context,
            "maxTokens": body.max_tokens,
        },
    )


@router.post("/application/generate")
async def ai_application_generate(body: ApplicationGenerateRequest, redis: Redis = Depends(get_redis)):
    return await _enqueue(
        redis,
        "ai.application.generate",
        {
            "requirements": body.requirements,
            "applicationType": body.application_type,
            "platform": body.platform,
            "controller": body.controller,
            "ioCount": body.io_count,
            "safetyLevel": body.safety_level,
            "maxTokens": body.max_tokens,
        },
    )


@router.post("/library/search")
async def ai_library_search(body: LibrarySearchRequest, redis: Redis = Depends(get_redis)):
    return await _enqueue(
        redis,
        "ai.library.search",
        {
            "query": body.query,
            "platform": body.platform,
            "applicationType": body.application_type,
            "requirements": body.requirements,
            "generateCustom": body.generate_custom,
            "maxTokens": body.max_tokens,
        },
    )


@router.post("/code/optimize")
async def ai_code_optimize(body: CodeOptimizeRequest, redis: Redis = Depends(get_redis)):
    return await _enqueue(
        redis,
        "ai.code.optimize",
        {
            "code": body.code,
            "platform": body.platform,
            "optimizationGoals": body.optimization_goals,
            "currentIssues": body.current_issues,
            "maxTokens": body.max_tokens,
        },
    )
