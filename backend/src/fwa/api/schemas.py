"""Modelos de respuesta de la API."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict

from fwa.orchestrator.states import TaskStatus
from fwa.services.projects import ProjectStatus


class HealthOut(BaseModel):
    status: str
    app: str
    version: str


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    slug: str
    description: str
    directory: str
    status: ProjectStatus
    git_initialized: bool
    last_valid_checkpoint: str | None
    created_at: datetime
    updated_at: datetime


class ProjectDetailOut(ProjectOut):
    # Falso si la carpeta fue movida o borrada fuera de la aplicación.
    directory_exists: bool


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    kind: str
    engine: str | None
    title: str
    status: TaskStatus
    resumable: bool
    attempts: int
    error: str | None
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: str | None
    kind: str
    actor: str
    message: str
    payload: dict[str, Any]
    created_at: datetime


class ErrorBody(BaseModel):
    code: str
    message: str
    details: dict[str, Any] = {}


class ErrorOut(BaseModel):
    error: ErrorBody


class ShutdownOut(BaseModel):
    status: str
