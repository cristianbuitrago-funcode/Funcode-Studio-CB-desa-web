"""Validación de rutas del sistema de archivos.

Toda ruta que llegue de la interfaz, de un modelo de IA o de un proyecto
generado debe pasar por estas funciones antes de tocar el disco.
"""

from __future__ import annotations

import re
import unicodedata
from pathlib import Path, PurePath

from fwa.errors import UnsafePathError

# Nombres reservados por Windows; no pueden usarse como nombre de carpeta.
_WINDOWS_RESERVED = {
    "con", "prn", "aux", "nul",
    *(f"com{i}" for i in range(1, 10)),
    *(f"lpt{i}" for i in range(1, 10)),
}  # fmt: skip
_MAX_SLUG = 60


def slugify(name: str) -> str:
    """Convierte un nombre libre en un nombre de carpeta válido en Windows, macOS y Linux."""
    normalized = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-z0-9]+", "-", normalized.lower()).strip("-")[:_MAX_SLUG].strip("-")
    if not slug:
        slug = "proyecto"
    if slug in _WINDOWS_RESERVED:
        slug = f"proyecto-{slug}"
    return slug


def resolve_within(root: Path, relative: str | PurePath) -> Path:
    """Resuelve ``relative`` dentro de ``root`` y garantiza que no sale de él.

    Rechaza rutas absolutas, componentes ``..`` y enlaces simbólicos que
    apunten fuera de la carpeta raíz.
    """
    candidate = PurePath(relative)
    text = str(relative)
    if (
        candidate.is_absolute()
        or text.startswith(("/", "\\"))
        or re.match(r"^[A-Za-z]:", text)
        or "\x00" in text
    ):
        raise UnsafePathError("La ruta debe ser relativa a la carpeta del proyecto.")
    if any(part == ".." for part in re.split(r"[\\/]", text)):
        raise UnsafePathError("La ruta no puede contener «..».")
    root_resolved = root.resolve()
    resolved = (root_resolved / candidate).resolve()
    if resolved != root_resolved and root_resolved not in resolved.parents:
        raise UnsafePathError("La ruta queda fuera de la carpeta del proyecto.")
    return resolved


def validate_workspace_dir(raw: str, *, forbidden: tuple[Path, ...] = ()) -> Path:
    """Valida el directorio de trabajo elegido por el usuario (donde se crean proyectos)."""
    text = raw.strip()
    if not text or "\x00" in text:
        raise UnsafePathError("Indica un directorio de trabajo.")
    path = Path(text).expanduser()
    if not path.is_absolute():
        raise UnsafePathError("El directorio de trabajo debe ser una ruta absoluta.")
    resolved = path.resolve()
    if resolved.exists() and not resolved.is_dir():
        raise UnsafePathError("La ruta indicada existe pero no es una carpeta.")
    for blocked in forbidden:
        blocked_resolved = blocked.resolve()
        if resolved == blocked_resolved or blocked_resolved in resolved.parents:
            raise UnsafePathError(
                "Ese directorio está reservado para los datos internos de la aplicación."
            )
    return resolved


def assert_safe_to_delete(target: Path, *, protected: tuple[Path, ...] = ()) -> Path:
    """Comprueba que ``target`` es una carpeta de proyecto razonable antes de borrarla."""
    if target.is_symlink():
        raise UnsafePathError("La carpeta del proyecto es un enlace simbólico; no se eliminará.")
    resolved = target.resolve()
    if not resolved.is_dir():
        raise UnsafePathError("La carpeta del proyecto no existe.")
    home = Path.home().resolve()
    blocked = {home, Path(resolved.anchor), *(p.resolve() for p in protected)}
    # Tampoco se borra ninguna carpeta que contenga el directorio personal o uno protegido.
    if resolved in blocked or any(resolved in p.parents for p in blocked):
        raise UnsafePathError("Esa carpeta está protegida y no se eliminará.")
    if len(resolved.parts) < 3:
        raise UnsafePathError("La carpeta está demasiado cerca de la raíz del disco.")
    return resolved
