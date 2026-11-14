"""Copias de seguridad de proyectos en archivos ZIP."""

from __future__ import annotations

import zipfile
from datetime import UTC, datetime
from pathlib import Path


def backup_directory(source: Path, backups_dir: Path, *, label: str) -> Path:
    """Comprime ``source`` en ``backups_dir`` y devuelve la ruta del archivo creado."""
    backups_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(UTC).strftime("%Y%m%d-%H%M%S")
    target = backups_dir / f"{label}-{stamp}.zip"
    counter = 1
    while target.exists():
        counter += 1
        target = backups_dir / f"{label}-{stamp}-{counter}.zip"
    with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(source.rglob("*")):
            if path.is_symlink():
                continue  # No se siguen enlaces que puedan apuntar fuera del proyecto.
            archive.write(path, path.relative_to(source).as_posix())
    return target
