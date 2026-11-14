from __future__ import annotations

from fastapi import APIRouter, Request

from fwa import APP_NAME, __version__
from fwa.api.deps import System
from fwa.api.schemas import HealthOut, ShutdownOut
from fwa.services.system import SystemInfo

public_router = APIRouter(tags=["sistema"])
router = APIRouter(prefix="/system", tags=["sistema"])


@public_router.get("/health", response_model=HealthOut)
def health() -> HealthOut:
    """Comprobación de vida. No requiere token y no revela información del equipo."""
    return HealthOut(status="ok", app=APP_NAME, version=__version__)


@router.get("/info", response_model=SystemInfo)
def system_info(system: System, refresh: bool = False) -> SystemInfo:
    return system.info(refresh=refresh)


@router.post("/shutdown", response_model=ShutdownOut, status_code=202)
def shutdown(request: Request) -> ShutdownOut:
    """Apagado controlado: cierra los flujos abiertos y detiene el servidor."""
    request.app.state.request_shutdown()
    return ShutdownOut(status="shutting_down")
