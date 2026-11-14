from __future__ import annotations

import ast
import asyncio
import subprocess
import sys
from pathlib import Path

import pytest

import fwa
from fwa.config import LOOPBACK_HOST, Settings
from fwa.security.redaction import REDACTED, SecretRedactor
from fwa.services.events import EventBroadcaster
from fwa.services.instance_lock import AlreadyRunningError, InstanceLock

SRC = Path(fwa.__file__).parent


def test_backend_only_binds_to_loopback() -> None:
    assert LOOPBACK_HOST == "127.0.0.1"
    assert "host" not in Settings.model_fields, "El host no debe ser configurable"


def test_dev_origins_only_in_dev_mode() -> None:
    assert "http://localhost:1420" not in Settings(dev=False).allowed_origins
    assert "http://localhost:1420" in Settings(dev=True).allowed_origins
    assert "tauri://localhost" in Settings(dev=False).allowed_origins


def test_redactor() -> None:
    r = SecretRedactor()
    r.register("mi-secreto-largo")
    assert r.redact("valor mi-secreto-largo aquí") == f"valor {REDACTED} aquí"
    assert "abc123456789" not in r.redact("Authorization: Bearer abc123456789")
    assert r.redact("texto normal sin secretos") == "texto normal sin secretos"


def test_instance_lock_blocks_second_process(tmp_path: Path) -> None:
    lock = InstanceLock(tmp_path)
    lock.acquire()
    code = (
        "import sys; from pathlib import Path;"
        "from fwa.services.instance_lock import InstanceLock, AlreadyRunningError\n"
        "try:\n    InstanceLock(Path(sys.argv[1])).acquire()\n"
        "except AlreadyRunningError:\n    sys.exit(7)\n"
    )
    try:
        assert subprocess.run([sys.executable, "-c", code, str(tmp_path)]).returncode == 7
    finally:
        lock.release()
    assert subprocess.run([sys.executable, "-c", code, str(tmp_path)]).returncode == 0
    with pytest.raises(AlreadyRunningError):
        first = InstanceLock(tmp_path)
        first.acquire()
        try:
            InstanceLock(tmp_path).acquire()
        finally:
            first.release()


def test_broadcaster_delivers_and_closes() -> None:
    async def scenario() -> list[object]:
        b = EventBroadcaster()
        b.bind_loop(asyncio.get_running_loop())
        queue = b.subscribe()
        b.publish({"n": 1})
        await asyncio.to_thread(b.publish, {"n": 2})  # desde otro hilo
        await asyncio.sleep(0.05)
        b.close()
        return [queue.get_nowait() for _ in range(3)]

    assert asyncio.run(scenario()) == [{"n": 1}, {"n": 2}, None]


def _imports(path: Path) -> set[str]:
    found: set[str] = set()
    for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
        if isinstance(node, ast.ImportFrom) and node.module:
            found.add(node.module)
        elif isinstance(node, ast.Import):
            found.update(alias.name for alias in node.names)
    return found


def _package_imports(package: str) -> set[str]:
    return {m for f in (SRC / package).rglob("*.py") for m in _imports(f) if m.startswith("fwa.")}


def test_architecture_layering_rules() -> None:
    """Reglas de dependencia entre capas (ver docs/ARCHITECTURE.md, sección 3)."""

    def uses(package: str, target: str) -> bool:
        return any(m == target or m.startswith(target + ".") for m in _package_imports(package))

    # Los motores no conocen la API, ni proveedores concretos, ni el entorno aislado.
    for forbidden in ("fwa.api", "fwa.providers", "fwa.sandbox", "fwa.app"):
        assert not uses("engines", forbidden)
    # Nada por debajo de la API depende de ella.
    for package in ("services", "orchestrator", "security", "db", "sandbox", "providers"):
        assert not uses(package, "fwa.api"), package
    # La seguridad y la persistencia son capas base.
    assert not uses("security", "fwa.services")
    assert not uses("db", "fwa.services")
    # Las rutas no acceden directamente a los motores.
    assert not uses("api", "fwa.engines")


def test_engines_do_not_import_each_other() -> None:
    engines = [d for d in (SRC / "engines").iterdir() if d.is_dir() and d.name != "__pycache__"]
    for engine in engines:
        for module in _package_imports(f"engines/{engine.name}"):
            if module.startswith("fwa.engines."):
                assert module.split(".")[2] == engine.name, f"{engine.name} importa {module}"


def test_subprocess_is_only_used_by_the_command_service() -> None:
    offenders = [
        str(f.relative_to(SRC))
        for f in SRC.rglob("*.py")
        if {"subprocess", "os.system"} & _imports(f) and f.name != "commands.py"
    ]
    assert offenders == []
