from __future__ import annotations

from fastapi import APIRouter

from fwa.api.deps import Uow
from fwa.services.settings import AppSettings, AppSettingsUpdate

router = APIRouter(prefix="/settings", tags=["configuración"])


@router.get("", response_model=AppSettings)
def get_settings(uow: Uow) -> AppSettings:
    return uow.app_settings.get()


@router.patch("", response_model=AppSettings)
def update_settings(changes: AppSettingsUpdate, uow: Uow) -> AppSettings:
    updated = uow.app_settings.update(changes)
    uow.events.record(
        "settings.updated",
        "Configuración actualizada.",
        payload={"fields": sorted(changes.model_dump(exclude_none=True))},
    )
    uow.commit()
    return updated
