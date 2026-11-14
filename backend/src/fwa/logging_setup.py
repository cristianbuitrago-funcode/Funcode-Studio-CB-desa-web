"""Registro de eventos del backend: consola y archivo rotativo, con redacción de secretos."""

from __future__ import annotations

import logging
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path

from fwa.security.redaction import RedactingFilter

_FORMAT = "%(asctime)s %(levelname)s %(name)s: %(message)s"


def configure_logging(logs_dir: Path, *, debug: bool = False) -> None:
    logs_dir.mkdir(parents=True, exist_ok=True)
    root = logging.getLogger()
    root.setLevel(logging.DEBUG if debug else logging.INFO)
    for handler in list(root.handlers):
        if getattr(handler, "_fwa", False):
            root.removeHandler(handler)
            handler.close()

    handlers: list[logging.Handler] = [
        RotatingFileHandler(
            logs_dir / "backend.log", maxBytes=2_000_000, backupCount=3, encoding="utf-8"
        )
    ]
    if sys.stderr is not None:
        handlers.append(logging.StreamHandler(sys.stderr))
    for handler in handlers:
        handler.setFormatter(logging.Formatter(_FORMAT))
        handler.addFilter(RedactingFilter())
        handler._fwa = True  # type: ignore[attr-defined]
        root.addHandler(handler)
