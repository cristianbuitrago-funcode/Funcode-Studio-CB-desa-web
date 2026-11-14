"""Ejecución de herramientas del sistema con argumentos fijos y tiempo límite.

Solo se usa para herramientas de confianza (git, docker, podman). Nunca para
ejecutar código de proyectos generados: eso corresponde a ``fwa.sandbox``.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class CommandResult:
    found: bool
    ok: bool
    output: str


def run_tool(
    name: str, args: list[str], *, cwd: Path | None = None, timeout: float = 6.0
) -> CommandResult:
    executable = shutil.which(name)
    if executable is None:
        return CommandResult(found=False, ok=False, output="")
    flags = 0x08000000 if sys.platform == "win32" else 0  # CREATE_NO_WINDOW
    try:
        completed = subprocess.run(  # noqa: S603 - ejecutable resuelto y argumentos fijos
            [executable, *args],
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
            stdin=subprocess.DEVNULL,
            creationflags=flags,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        return CommandResult(found=True, ok=False, output=str(exc))
    output = (completed.stdout or completed.stderr or "").strip()
    return CommandResult(found=True, ok=completed.returncode == 0, output=output)
