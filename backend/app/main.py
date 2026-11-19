"""ThirstCap FastAPI application entry point, CORS setup, and uniform error handlers."""

from __future__ import annotations

import asyncio
import os
import sys
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.errors import DomainError
from app.routers import health, plan


@asynccontextmanager
async def _lifespan(_app: FastAPI):
    """Warm live forecasts in the background. Startup does not wait on Open-Meteo."""
    task: asyncio.Task | None = None
    disabled = os.environ.get("THIRSTCAP_WEATHER_WARMUP", "1").strip().lower() in {"0", "false", "no"}
    if not disabled and "pytest" not in sys.modules:
        from app.services.weather import warm_live_forecasts

        task = asyncio.create_task(warm_live_forecasts())
    try:
        yield
    finally:
        if task is not None:
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version=settings.version,
        description="72-hour rolling-horizon MILP optimizer for data-center peak-day water capacity capping.",
        lifespan=_lifespan,
    )

    origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "Accept"],
    )

    @app.exception_handler(DomainError)
    async def handle_domain_error(_request: Request, exc: DomainError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": exc.code, "message": exc.message, "details": exc.details}},
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_request: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "validation_error",
                    "message": "Invalid request payload.",
                    "details": {"errors": exc.errors()},
                }
            },
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_error(_request: Request, exc: Exception) -> JSONResponse:
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "internal_error",
                    "message": "An unexpected server error occurred.",
                    "details": {"type": type(exc).__name__},
                }
            },
        )

    app.include_router(health.router)
    app.include_router(plan.router)
    return app


app = create_app()
