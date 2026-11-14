"""Gestión de proyectos: creación, consulta, edición y eliminación."""

from __future__ import annotations

import logging
import os
import shutil
import stat
from collections.abc import Callable
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from fwa.config import Settings
from fwa.db.models import Project
from fwa.errors import ConfirmationRequired, ConflictError, NotFoundError, OperationFailed
from fwa.security.paths import assert_safe_to_delete, slugify, validate_workspace_dir
from fwa.services.backups import backup_directory
from fwa.services.commands import run_tool
from fwa.services.events import EventService
from fwa.services.settings import SettingsService

logger = logging.getLogger(__name__)

ProjectStatus = Literal["draft", "in_progress", "completed", "failed", "archived"]
_MAX_SUFFIX = 50


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=20_000)
    # Directorio de trabajo donde se creará la carpeta del proyecto.
    # Si se omite, se usa el directorio de proyectos configurado.
    workspace_dir: str | None = None

    @field_validator("name")
    @classmethod
    def _clean_name(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if not cleaned:
            raise ValueError("El nombre no puede estar vacío.")
        return cleaned


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=20_000)

    @field_validator("name")
    @classmethod
    def _clean_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = " ".join(value.split())
        if not cleaned:
            raise ValueError("El nombre no puede estar vacío.")
        return cleaned


class ProjectDelete(BaseModel):
    # El usuario debe escribir el nombre exacto del proyecto para confirmar.
    confirm_name: str
    # Si es verdadero, también se borra la carpeta (previa copia de seguridad).
    delete_files: bool = False


class ProjectDeleteResult(BaseModel):
    id: str
    files_deleted: bool
    backup_path: str | None = None


def _make_writable_and_retry(func: Callable[..., Any], path: str, _exc: BaseException) -> None:
    # En Windows, Git marca archivos como de solo lectura y ``rmtree`` falla sin esto.
    os.chmod(path, stat.S_IWRITE)
    func(path)


class ProjectService:
    def __init__(
        self,
        session: Session,
        *,
        settings: Settings,
        app_settings: SettingsService,
        events: EventService,
    ) -> None:
        self._session = session
        self._settings = settings
        self._app_settings = app_settings
        self._events = events

    # ---- consulta -------------------------------------------------------

    def list(self) -> list[Project]:
        return list(self._session.scalars(select(Project).order_by(Project.updated_at.desc())))

    def get(self, project_id: str) -> Project:
        project = self._session.get(Project, project_id)
        if project is None:
            raise NotFoundError("El proyecto no existe.")
        return project

    # ---- creación -------------------------------------------------------

    def create(self, data: ProjectCreate) -> Project:
        workspace_raw = data.workspace_dir or self._app_settings.get().projects_dir
        workspace = validate_workspace_dir(
            workspace_raw, forbidden=(self._settings.resolved_data_dir,)
        )
        directory = self._reserve_directory(workspace, slugify(data.name))
        git_ok = False
        try:
            git = run_tool("git", ["init", "--quiet"], cwd=directory, timeout=15.0)
            git_ok = git.ok
            if git.found and not git.ok:
                logger.warning("No se pudo iniciar Git en el proyecto: %s", git.output)
            project = Project(
                name=data.name,
                slug=directory.name,
                description=data.description.strip(),
                directory=str(directory),
                git_initialized=git_ok,
            )
            self._session.add(project)
            self._session.flush()
        except Exception:
            # No dejar una carpeta huérfana si el registro no pudo guardarse.
            shutil.rmtree(directory, onexc=_make_writable_and_retry)
            raise
        self._events.record(
            "project.created",
            f"Proyecto «{project.name}» creado.",
            project_id=project.id,
            payload={"name": project.name, "directory": project.directory, "git": git_ok},
        )
        return project

    def _reserve_directory(self, workspace: Path, slug: str) -> Path:
        try:
            workspace.mkdir(parents=True, exist_ok=True)
        except OSError as exc:
            raise OperationFailed(
                "No se pudo crear el directorio de trabajo.", details={"reason": str(exc)}
            ) from exc
        for index in range(1, _MAX_SUFFIX + 1):
            candidate = workspace / (slug if index == 1 else f"{slug}-{index}")
            try:
                candidate.mkdir()
            except FileExistsError:
                continue
            except OSError as exc:
                raise OperationFailed(
                    "No se pudo crear la carpeta del proyecto.", details={"reason": str(exc)}
                ) from exc
            return candidate
        raise ConflictError("Ya existen demasiadas carpetas con ese nombre en el directorio.")

    # ---- edición --------------------------------------------------------

    def update(self, project_id: str, data: ProjectUpdate) -> Project:
        project = self.get(project_id)
        changes = data.model_dump(exclude_none=True)
        if not changes:
            return project
        for key, value in changes.items():
            setattr(project, key, value.strip() if key == "description" else value)
        self._session.flush()
        self._events.record(
            "project.updated",
            f"Proyecto «{project.name}» actualizado.",
            project_id=project.id,
            payload={"fields": sorted(changes)},
        )
        return project

    # ---- eliminación ----------------------------------------------------

    def delete(self, project_id: str, data: ProjectDelete) -> ProjectDeleteResult:
        project = self.get(project_id)
        if data.confirm_name.strip() != project.name:
            raise ConfirmationRequired(
                "Para eliminar el proyecto escribe su nombre exactamente como aparece."
            )
        backup: Path | None = None
        files_deleted = False
        directory = Path(project.directory)
        if data.delete_files and directory.exists():
            target = assert_safe_to_delete(
                directory,
                protected=(
                    self._settings.resolved_data_dir,
                    Path(self._app_settings.get().projects_dir),
                ),
            )
            try:
                backup = backup_directory(
                    target, self._settings.backups_dir, label=f"{project.slug}-{project.id[:8]}"
                )
                shutil.rmtree(target, onexc=_make_writable_and_retry)
            except OSError as exc:
                raise OperationFailed(
                    "No se pudieron eliminar los archivos del proyecto. "
                    "Cierra los programas que los estén usando e inténtalo de nuevo.",
                    details={"reason": str(exc), "backup_path": str(backup) if backup else None},
                ) from exc
            files_deleted = True
        name, pid = project.name, project.id
        self._session.delete(project)
        self._session.flush()
        self._events.record(
            "project.deleted",
            f"Proyecto «{name}» eliminado"
            + (" junto con sus archivos." if files_deleted else "; sus archivos se conservaron."),
            project_id=pid,
            payload={
                "name": name,
                "files_deleted": files_deleted,
                "backup_path": str(backup) if backup else None,
            },
        )
        return ProjectDeleteResult(
            id=pid, files_deleted=files_deleted, backup_path=str(backup) if backup else None
        )
