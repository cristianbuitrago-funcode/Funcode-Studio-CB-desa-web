"""Prueba de humo del backend empaquetado: arranca, responde, rechaza sin token y se apaga.

Uso::

    python packaging/smoke_test.py ruta/al/fwa-backend[.exe]

No requiere dependencias: sirve para validar el ejecutable en cualquier sistema,
en particular en Windows 11 y en la integración continua.
"""

from __future__ import annotations

import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

TOKEN = "token-de-humo-0123456789abcdef"  # noqa: S105 - valor de prueba, no es un secreto


def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def call(base: str, path: str, *, method: str = "GET", body: dict | None = None, auth: bool = True):  # type: ignore[no-untyped-def, type-arg]
    headers = {"Content-Type": "application/json"}
    if auth:
        headers["Authorization"] = f"Bearer {TOKEN}"
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(base + path, data=data, method=method, headers=headers)  # noqa: S310
    with urllib.request.urlopen(request, timeout=10) as response:  # noqa: S310
        return response.status, json.load(response)


def step(message: str) -> None:
    print(f"  ok  {message}", flush=True)


def main() -> int:
    executable = Path(sys.argv[1]).resolve()
    port = free_port()
    base = f"http://127.0.0.1:{port}"
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
        env = {
            **os.environ,
            "FWA_PORT": str(port),
            "FWA_SESSION_TOKEN": TOKEN,
            "FWA_DATA_DIR": str(Path(tmp) / "datos"),
            "FWA_WATCH_STDIN": "1",
        }
        flags = 0x08000000 if sys.platform == "win32" else 0
        process = subprocess.Popen(  # noqa: S603
            [str(executable)],
            env=env,
            stdin=subprocess.PIPE,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            creationflags=flags,
        )
        try:
            started = time.monotonic()
            while True:
                if process.poll() is not None:
                    print(process.stderr.read().decode(errors="replace"))  # type: ignore[union-attr]
                    raise RuntimeError(
                        f"El backend terminó al arrancar (código {process.returncode})."
                    )
                try:
                    call(base, "/health", auth=False)
                    break
                except OSError:
                    if time.monotonic() - started > 90:
                        raise RuntimeError("El backend no respondió en 90 s.") from None
                    time.sleep(0.2)
            step(f"arranca y responde en {time.monotonic() - started:.1f} s")

            try:
                call(base, "/api/v1/projects", auth=False)
                raise RuntimeError("Aceptó una petición sin token.")
            except urllib.error.HTTPError as error:
                assert error.code == 401, error.code
            step("rechaza peticiones sin token (401)")

            workspace = Path(tmp) / "proyectos"
            status, project = call(
                base,
                "/api/v1/projects",
                method="POST",
                body={"name": "Prueba de humo", "workspace_dir": str(workspace)},
            )
            assert status == 201 and Path(project["directory"]).is_dir()
            step("migra la base de datos y crea un proyecto con su carpeta")

            _, info = call(base, "/api/v1/system/info")
            assert info["packaged"] is True, "No se detecta como empaquetado"
            step(f"se identifica como empaquetado en {info['os_name']} {info['os_release']}")

            assert process.stdin is not None
            process.stdin.close()
            code = process.wait(timeout=20)
            assert code == 0, f"Código de salida {code}"
            step("se apaga solo y sin errores al cerrarse su entrada estándar")

            time.sleep(1.0)
            with socket.socket() as sock:
                sock.settimeout(1)
                assert sock.connect_ex(("127.0.0.1", port)) != 0, "Quedó un proceso escuchando"
            step("no deja ningún proceso escuchando en el puerto")
        finally:
            if process.poll() is None:
                process.kill()
                process.wait(timeout=10)
    print("Backend empaquetado: prueba de humo superada.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
