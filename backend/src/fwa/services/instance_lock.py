"""Evita que dos backends usen el mismo directorio de datos a la vez.

Se mantiene un bloqueo exclusivo sobre un archivo durante la vida del proceso.
El sistema operativo lo libera aunque el proceso termine de forma abrupta.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import IO


class AlreadyRunningError(RuntimeError):
    pass


class InstanceLock:
    def __init__(self, data_dir: Path) -> None:
        self._path = data_dir / "backend.lock"
        self._handle: IO[str] | None = None

    def acquire(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        handle = open(self._path, "a+", encoding="utf-8")  # noqa: SIM115
        try:
            if sys.platform == "win32":
                import msvcrt

                handle.seek(0)
                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl

                fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError as exc:
            handle.close()
            raise AlreadyRunningError(
                "Ya hay un backend de Funcode Web Architect usando este directorio de datos."
            ) from exc
        handle.seek(0)
        handle.truncate()
        handle.write(str(os.getpid()))
        handle.flush()
        self._handle = handle

    def release(self) -> None:
        if self._handle is None:
            return
        try:
            if sys.platform == "win32":
                import msvcrt

                self._handle.seek(0)
                msvcrt.locking(self._handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                import fcntl

                fcntl.flock(self._handle.fileno(), fcntl.LOCK_UN)
        finally:
            self._handle.close()
            self._handle = None
