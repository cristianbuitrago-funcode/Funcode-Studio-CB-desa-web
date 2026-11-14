"""Exporta el contrato OpenAPI del backend a un archivo JSON.

Uso: uv run python scripts/export_openapi.py salida.json
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from pydantic import SecretStr

from fwa.app import create_app
from fwa.config import Settings


def main() -> None:
    target = Path(sys.argv[1])
    app = create_app(Settings(session_token=SecretStr("x" * 32)))
    target.write_text(json.dumps(app.openapi(), indent=2, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
