"""Configuración del backend, leída de variables de entorno ``FWA_*``."""

from __future__ import annotations

import os
import sys
from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

# El backend solo escucha en loopback. No es configurable a propósito.
LOOPBACK_HOST = "127.0.0.1"

# Orígenes desde los que la interfaz empaquetada de Tauri realiza peticiones.
TAURI_ORIGINS = (
    "tauri://localhost",  # macOS y Linux
    "http://tauri.localhost",  # Windows (WebView2)
    "https://tauri.localhost",
)
DEV_ORIGINS = ("http://localhost:1420", "http://127.0.0.1:1420")

_VENDOR_DIR = "Funcode Studio CB"
_APP_DIR = "Funcode Web Architect"


def default_data_dir() -> Path:
    """Directorio de datos de la aplicación según el sistema operativo."""
    home = Path.home()
    if sys.platform == "win32":
        base = Path(os.environ.get("LOCALAPPDATA") or home / "AppData" / "Local")
    elif sys.platform == "darwin":
        base = home / "Library" / "Application Support"
    else:
        base = Path(os.environ.get("XDG_DATA_HOME") or home / ".local" / "share")
    return base / _VENDOR_DIR / _APP_DIR


def default_projects_dir() -> Path:
    """Directorio sugerido para proyectos; el usuario puede cambiarlo."""
    home = Path.home()
    documents = home / "Documents"
    base = documents if documents.is_dir() else home
    return base / _APP_DIR / "Proyectos"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="FWA_", extra="ignore")

    port: int = 8765
    session_token: SecretStr | None = None
    data_dir: Path | None = None
    dev: bool = False
    # Orígenes adicionales separados por comas (solo para desarrollo y pruebas).
    extra_origins: str = ""
    # Si es verdadero, el backend se apaga cuando se cierra su entrada estándar
    # (la mantiene abierta la aplicación de escritorio mientras vive).
    watch_stdin: bool = False

    @property
    def resolved_data_dir(self) -> Path:
        return (self.data_dir or default_data_dir()).expanduser().resolve()

    @property
    def database_path(self) -> Path:
        return self.resolved_data_dir / "fwa.sqlite3"

    @property
    def logs_dir(self) -> Path:
        return self.resolved_data_dir / "logs"

    @property
    def backups_dir(self) -> Path:
        return self.resolved_data_dir / "backups"

    @property
    def allowed_origins(self) -> list[str]:
        origins = list(TAURI_ORIGINS)
        if self.dev:
            origins.extend(DEV_ORIGINS)
        origins.extend(o.strip() for o in self.extra_origins.split(",") if o.strip())
        return origins

    @property
    def allowed_hosts(self) -> list[str]:
        return [f"{LOOPBACK_HOST}:{self.port}", f"localhost:{self.port}"]
