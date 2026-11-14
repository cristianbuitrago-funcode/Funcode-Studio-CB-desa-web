"""Ajustes de la aplicación guardados en SQLite. Nunca contienen secretos."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel
from sqlalchemy.orm import Session

from fwa.config import default_projects_dir
from fwa.db.models import Setting
from fwa.security.paths import validate_workspace_dir

Theme = Literal["dark", "light"]


class AppSettings(BaseModel):
    projects_dir: str
    theme: Theme = "dark"


class AppSettingsUpdate(BaseModel):
    projects_dir: str | None = None
    theme: Theme | None = None


class SettingsService:
    def __init__(self, session: Session, *, data_dir: Path) -> None:
        self._session = session
        self._data_dir = data_dir

    def get(self) -> AppSettings:
        stored: dict[str, Any] = {row.key: row.value for row in self._session.query(Setting)}
        stored.setdefault("projects_dir", str(default_projects_dir()))
        return AppSettings.model_validate(stored)

    def update(self, changes: AppSettingsUpdate) -> AppSettings:
        values = changes.model_dump(exclude_none=True)
        if "projects_dir" in values:
            values["projects_dir"] = str(
                validate_workspace_dir(values["projects_dir"], forbidden=(self._data_dir,))
            )
        for key, value in values.items():
            row = self._session.get(Setting, key)
            if row is None:
                self._session.add(Setting(key=key, value=value))
            else:
                row.value = value
        self._session.flush()
        return self.get()
