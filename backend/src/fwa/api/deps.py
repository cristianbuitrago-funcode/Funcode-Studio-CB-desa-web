"""Dependencias de las rutas: unidad de trabajo con sesión y servicios."""

from __future__ import annotations

from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from fwa.config import Settings
from fwa.orchestrator.task_store import TaskStore
from fwa.services.events import EventService
from fwa.services.projects import ProjectService
from fwa.services.settings import SettingsService
from fwa.services.system import SystemService


class UnitOfWork:
    """Agrupa una transacción. Los eventos se difunden solo después de confirmarla."""

    def __init__(self, request: Request) -> None:
        state = request.app.state
        self.settings: Settings = state.settings
        self.session: Session = state.session_factory()
        self.events = EventService(self.session, state.broadcaster)
        self.app_settings = SettingsService(self.session, data_dir=self.settings.resolved_data_dir)
        self.projects = ProjectService(
            self.session, settings=self.settings, app_settings=self.app_settings, events=self.events
        )
        self.tasks = TaskStore(self.session)

    def commit(self) -> None:
        self.session.commit()
        self.events.publish_pending()

    def close(self) -> None:
        self.session.close()


def get_uow(request: Request) -> Iterator[UnitOfWork]:
    uow = UnitOfWork(request)
    try:
        yield uow
    finally:
        uow.close()


def get_system_service(request: Request) -> SystemService:
    service: SystemService = request.app.state.system_service
    return service


Uow = Annotated[UnitOfWork, Depends(get_uow)]
System = Annotated[SystemService, Depends(get_system_service)]
