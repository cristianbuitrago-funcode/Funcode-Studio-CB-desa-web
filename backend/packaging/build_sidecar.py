"""Empaqueta el backend en un único ejecutable para incluirlo en la aplicación de escritorio.

Uso (desde la carpeta ``backend``)::

    uv run python packaging/build_sidecar.py

Genera ``desktop/src-tauri/binaries/fwa-backend-<plataforma>[.exe]``, que es el
nombre que Tauri espera para un ejecutable externo. Debe ejecutarse en el mismo
sistema operativo para el que se compila la aplicación: PyInstaller no compila
de forma cruzada.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
BINARIES = BACKEND.parent / "desktop" / "src-tauri" / "binaries"
NAME = "fwa-backend"


def target_triple() -> str:
    """Plataforma de destino según Rust (p. ej. ``x86_64-pc-windows-msvc``)."""
    if len(sys.argv) > 1:
        return sys.argv[1]
    output = subprocess.run(  # noqa: S603
        ["rustc", "-vV"],  # noqa: S607
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    for line in output.splitlines():
        if line.startswith("host:"):
            return line.split(":", 1)[1].strip()
    raise RuntimeError("No se pudo determinar la plataforma con «rustc -vV».")


def main() -> None:
    triple = target_triple()
    work = BACKEND / "build"
    dist = BACKEND / "dist"
    migrations = BACKEND / "src" / "fwa" / "db" / "migrations"
    subprocess.run(  # noqa: S603
        [
            sys.executable,
            "-m",
            "PyInstaller",
            "--noconfirm",
            "--clean",
            "--onefile",
            "--console",
            "--name",
            NAME,
            "--paths",
            str(BACKEND / "src"),
            "--distpath",
            str(dist),
            "--workpath",
            str(work),
            "--specpath",
            str(work),
            # Las migraciones son archivos de datos: Alembic las lee del disco.
            "--add-data",
            f"{migrations}{os.pathsep}fwa/db/migrations",
            "--collect-submodules",
            "uvicorn",
            "--hidden-import",
            "sqlalchemy.dialects.sqlite",
            str(BACKEND / "packaging" / "entry.py"),
        ],
        check=True,
        cwd=BACKEND,
    )
    suffix = ".exe" if sys.platform == "win32" else ""
    built = dist / f"{NAME}{suffix}"
    BINARIES.mkdir(parents=True, exist_ok=True)
    target = BINARIES / f"{NAME}-{triple}{suffix}"
    shutil.copy2(built, target)
    print(f"Backend empaquetado: {target} ({target.stat().st_size / 1_048_576:.1f} MB)")


if __name__ == "__main__":
    main()
