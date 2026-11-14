"""Información del sistema que se muestra en la interfaz."""

from __future__ import annotations

import os
import platform
import sys
import time
from datetime import UTC, datetime

from pydantic import BaseModel

from fwa import APP_NAME, __version__
from fwa.config import Settings
from fwa.sandbox.detection import IsolationStatus, detect_isolation
from fwa.services.commands import run_tool

_STARTED_AT = datetime.now(UTC)
_CACHE_SECONDS = 30.0


class GitStatus(BaseModel):
    available: bool
    version: str | None = None


class SystemInfo(BaseModel):
    app_name: str
    app_version: str
    backend_pid: int
    backend_port: int
    backend_started_at: datetime
    dev_mode: bool
    packaged: bool
    os_name: str
    os_release: str
    os_version: str
    architecture: str
    python_version: str
    data_dir: str
    logs_dir: str
    database_path: str
    git: GitStatus
    isolation: IsolationStatus


class SystemService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._cached: tuple[float, GitStatus, IsolationStatus] | None = None

    def _probe(self, refresh: bool) -> tuple[GitStatus, IsolationStatus]:
        now = time.monotonic()
        if not refresh and self._cached and now - self._cached[0] < _CACHE_SECONDS:
            return self._cached[1], self._cached[2]
        git = run_tool("git", ["--version"])
        git_status = GitStatus(available=git.ok, version=git.output or None)
        isolation = detect_isolation()
        self._cached = (now, git_status, isolation)
        return git_status, isolation

    def info(self, *, refresh: bool = False) -> SystemInfo:
        git, isolation = self._probe(refresh)
        s = self._settings
        return SystemInfo(
            app_name=APP_NAME,
            app_version=__version__,
            backend_pid=os.getpid(),
            backend_port=s.port,
            backend_started_at=_STARTED_AT,
            dev_mode=s.dev,
            packaged=bool(getattr(sys, "frozen", False)),
            os_name=platform.system(),
            os_release=platform.release(),
            os_version=platform.version(),
            architecture=platform.machine(),
            python_version=platform.python_version(),
            data_dir=str(s.resolved_data_dir),
            logs_dir=str(s.logs_dir),
            database_path=str(s.database_path),
            git=git,
            isolation=isolation,
        )
