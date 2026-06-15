import logging
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .routers import ai, formats, health, ir, jobs, programs, sketches

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="PLCAutoPilot Automation API",
        version="1.0.0",
        description="FastAPI service for PLC generation, sketch analysis, and Claude AI jobs.",
    )

    origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def add_request_id(request: Request, call_next):
        request_id = request.headers.get("X-Request-Id", str(uuid.uuid4()))
        response = await call_next(request)
        response.headers["X-Request-Id"] = request_id
        return response

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        logger.exception("Unhandled error")
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": str(exc),
                    "requestId": request.headers.get("X-Request-Id"),
                }
            },
        )

    app.include_router(health.router)
    app.include_router(formats.router)
    app.include_router(ir.router)
    app.include_router(jobs.router)
    app.include_router(sketches.router)
    app.include_router(programs.router)
    app.include_router(ai.router)

    return app


app = create_app()
