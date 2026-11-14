"""Pruebas con el proceso real del backend: arranque, SSE y apagado controlado."""

from __future__ import annotations

import json
import os
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from collections.abc import Iterator
from pathlib import Path

import pytest

TOKEN = "token-de-proceso-0123456789abcdef"


def _free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


class Backend:
    def __init__(self, data_dir: Path, *, watch_stdin: bool = True) -> None:
        self.port = _free_port()
        self.base = f"http://127.0.0.1:{self.port}"
        env = {
            **os.environ,
            "FWA_PORT": str(self.port),
            "FWA_SESSION_TOKEN": TOKEN,
            "FWA_DATA_DIR": str(data_dir),
            "FWA_WATCH_STDIN": "1" if watch_stdin else "0",
        }
        self.process = subprocess.Popen(
            [sys.executable, "-m", "fwa.main"],
            env=env,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )

    def request(self, method: str, path: str, body: dict | None = None, *, auth: bool = True):  # type: ignore[no-untyped-def, type-arg]
        headers = {"Content-Type": "application/json"}
        if auth:
            headers["Authorization"] = f"Bearer {TOKEN}"
        data = json.dumps(body).encode() if body is not None else None
        request = urllib.request.Request(  # noqa: S310
            self.base + path, data=data, method=method, headers=headers
        )
        return urllib.request.urlopen(request, timeout=5)  # noqa: S310

    def wait_ready(self, timeout: float = 15.0) -> None:
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if self.process.poll() is not None:
                raise AssertionError(f"El backend terminó: {self.process.stderr.read().decode()}")  # type: ignore[union-attr]
            try:
                with self.request("GET", "/health", auth=False) as response:
                    if response.status == 200:
                        return
            except OSError:
                time.sleep(0.1)
        raise AssertionError("El backend no respondió a tiempo.")

    def stop(self) -> None:
        if self.process.poll() is None:
            self.process.kill()
        self.process.wait(timeout=5)
        for stream in (self.process.stdin, self.process.stdout, self.process.stderr):
            if stream:
                stream.close()


@pytest.fixture
def backend(tmp_path: Path) -> Iterator[Backend]:
    instance = Backend(tmp_path / "datos")
    try:
        instance.wait_ready()
        yield instance
    finally:
        instance.stop()


def test_backend_starts_and_serves_api(backend: Backend) -> None:
    with backend.request("GET", "/api/v1/projects") as response:
        assert json.load(response) == []
    with pytest.raises(urllib.error.HTTPError) as rejected:
        backend.request("GET", "/api/v1/projects", auth=False)
    assert rejected.value.code == 401


def test_backend_is_not_reachable_from_other_interfaces(backend: Backend) -> None:
    """Solo escucha en loopback: no acepta conexiones por la dirección de red del equipo."""
    try:
        address = socket.gethostbyname(socket.gethostname())
    except OSError:
        pytest.skip("No se pudo determinar la dirección de red del equipo.")
    if address.startswith("127."):
        pytest.skip("El equipo no tiene una dirección de red distinta del loopback.")
    with socket.socket() as sock:
        sock.settimeout(2)
        assert sock.connect_ex((address, backend.port)) != 0


def test_closing_stdin_stops_the_backend_cleanly(backend: Backend) -> None:
    """Así lo detiene la aplicación de escritorio, y así se detiene si esta muere."""
    assert backend.process.stdin is not None
    backend.process.stdin.close()
    assert backend.process.wait(timeout=10) == 0


def test_shutdown_endpoint_stops_the_backend(backend: Backend) -> None:
    with backend.request("POST", "/api/v1/system/shutdown") as response:
        assert response.status == 202
    assert backend.process.wait(timeout=10) == 0


def test_shutdown_completes_with_open_event_stream(backend: Backend, tmp_path: Path) -> None:
    received: list[str] = []
    ready = threading.Event()

    def listen() -> None:
        with backend.request("GET", "/api/v1/events/stream") as stream:
            for raw in stream:
                line = raw.decode().strip()
                if line:
                    received.append(line)
                if line == "event: ready":
                    ready.set()

    thread = threading.Thread(target=listen, daemon=True)
    thread.start()
    assert ready.wait(5), "El flujo SSE no se abrió"
    workspace = tmp_path / "proyectos"
    backend.request(
        "POST", "/api/v1/projects", {"name": "En vivo", "workspace_dir": str(workspace)}
    )
    deadline = time.monotonic() + 5
    while not any("project.created" in line for line in received) and time.monotonic() < deadline:
        time.sleep(0.05)
    assert any("project.created" in line for line in received), received

    backend.request("POST", "/api/v1/system/shutdown")
    assert backend.process.wait(timeout=10) == 0
    thread.join(timeout=5)
    assert "event: closing" in received


def test_second_backend_on_same_data_dir_refuses_to_start(backend: Backend, tmp_path: Path) -> None:
    duplicate = Backend(tmp_path / "datos")
    try:
        assert duplicate.process.wait(timeout=10) == 3
        assert "Ya hay un backend" in duplicate.process.stderr.read().decode()  # type: ignore[union-attr]
    finally:
        duplicate.stop()
    with backend.request("GET", "/health", auth=False) as response:
        assert response.status == 200  # el primero sigue funcionando


def test_backend_refuses_to_start_without_token(tmp_path: Path) -> None:
    env = {k: v for k, v in os.environ.items() if not k.startswith("FWA_")}
    env["FWA_DATA_DIR"] = str(tmp_path)
    result = subprocess.run(
        [sys.executable, "-m", "fwa.main"], env=env, capture_output=True, timeout=20
    )
    assert result.returncode == 2
    assert b"FWA_SESSION_TOKEN" in result.stderr


def test_data_survives_abrupt_termination(tmp_path: Path) -> None:
    """Simula un corte: el proceso muere sin apagado controlado y los datos siguen ahí."""
    data_dir, workspace = tmp_path / "datos", tmp_path / "proyectos"
    first = Backend(data_dir)
    try:
        first.wait_ready()
        first.request(
            "POST", "/api/v1/projects", {"name": "Persistente", "workspace_dir": str(workspace)}
        )
    finally:
        first.stop()  # kill
    second = Backend(data_dir)
    try:
        second.wait_ready()
        with second.request("GET", "/api/v1/projects") as response:
            assert [p["name"] for p in json.load(response)] == ["Persistente"]
    finally:
        second.stop()
