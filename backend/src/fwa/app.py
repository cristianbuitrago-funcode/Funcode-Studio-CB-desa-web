"""Fábrica de la aplicación FastAPI."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from fwa import APP_NAME, __version__
from fwa.api.routes import activity, projects, system
from fwa.api.routes import settings as settings_routes
from fwa.config import Settings
from fwa.db.session import create_db_engine, create_session_factory, run_migrations
from fwa.errors import AppError
from fwa.logging_setup import configure_logging
from fwa.orchestrator.task_store import recover_interrupted_tasks
from fwa.security.local_auth import LocalAuthMiddleware
from fwa.security.redaction import redactor
from fwa.services.events import EventBroadcaster
from fwa.services.system import SystemService

logger = logging.getLogger("fwa")

API_PREFIX = "/api/v1"
MIN_TOKEN_LENGTH = 16


def _error(status: int, code: str, message: str, details: dict | None = None) -> JSONResponse:  # type: ignore[type-arg]
    return JSONResponse(
        status_code=status,
        content={"error": {"code": code, "message": message, "details": details or {}}},
    )


def create_app(
    settings: Settings, *, on_shutdown_request: Callable[[], None] | None = None
) -> FastAPI:
    if settings.session_token is None:
        raise RuntimeError("Falta el token de sesión (FWA_SESSION_TOKEN).")
    token = settings.session_token.get_secret_value()
    if len(token) < MIN_TOKEN_LENGTH:
        raise ValueError("El token de sesión es demasiado corto.")
    redactor.register(token)

    broadcaster = EventBroadcaster()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        configure_logging(settings.logs_dir, debug=settings.dev)
        engine = create_db_engine(settings.database_path)
        run_migrations(engine)
        app.state.engine = engine
        app.state.session_factory = create_session_factory(engine)
        with app.state.session_factory() as session:
            recovered = recover_interrupted_tasks(session)
            session.commit()
        if recovered:
            logger.info("Tareas marcadas como interrumpidas tras el reinicio: %d", recovered)
        broadcaster.bind_loop(asyncio.get_running_loop())
        logger.info(
            "Backend iniciado en el puerto %d (datos en %s)",
            settings.port,
            settings.resolved_data_dir,
        )
        try:
            yield
        finally:
            broadcaster.close()
            engine.dispose()
            logger.info("Backend detenido.")

    app = FastAPI(
        title=f"{APP_NAME} — API local",
        version=__version__,
        lifespan=lifespan,
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )
    app.state.settings = settings
    app.state.broadcaster = broadcaster
    app.state.system_service = SystemService(settings)

    def request_shutdown() -> None:
        broadcaster.close()
        if on_shutdown_request is not None:
            on_shutdown_request()

    app.state.request_shutdown = request_shutdown

    @app.exception_handler(AppError)
    async def _app_error(_request: Request, exc: AppError) -> JSONResponse:
        return _error(exc.status_code, exc.code, exc.message, exc.details)

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_request: Request, exc: RequestValidationError) -> JSONResponse:
        fields = [
            {"field": ".".join(str(p) for p in e["loc"][1:]), "message": e["msg"]}
            for e in exc.errors()
        ]
        return _error(
            422, "validation_error", "Los datos enviados no son válidos.", {"fields": fields}
        )

    @app.exception_handler(Exception)
    async def _unexpected(_request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Error no controlado: %s", exc)
        return _error(
            500, "internal_error", "Ocurrió un error interno. Revisa el registro del backend."
        )

    app.include_router(system.public_router)
    for router in (system.router, projects.router, settings_routes.router, activity.router):
        app.include_router(router, prefix=API_PREFIX)

    # El orden importa: CORS es la capa exterior para que también las respuestas
    # de rechazo lleven las cabeceras que la interfaz necesita para leerlas.
    app.add_middleware(
        LocalAuthMiddleware,
        token=token,
        allowed_hosts=settings.allowed_hosts,
        allowed_origins=settings.allowed_origins,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
        allow_credentials=False,
        max_age=600,
    )
    return app
