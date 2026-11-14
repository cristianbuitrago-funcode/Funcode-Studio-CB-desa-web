"""Prueba de humo de la ventana de escritorio en Linux, bajo pantalla virtual (Xvfb).

Comprueba, con la aplicación real ya compilada:

1. Que la ventana abre y permanece abierta.
2. Que la aplicación inicia el backend empaquetado como proceso hijo.
3. Que el backend responde y exige el token de la sesión.
4. Que al terminar la aplicación de forma abrupta el backend se apaga solo.

Guarda una captura de la pantalla virtual. Uso::

    python3 scripts/linux_window_smoke.py RUTA_AL_EJECUTABLE captura.png

Requiere Xvfb y las bibliotecas de WebKitGTK. NO valida la aplicación en
Windows: para eso está ``scripts/windows-smoke.ps1`` y la lista de
comprobación manual de docs/TESTING.md.
"""

from __future__ import annotations

import os
import re
import shutil
import signal
import struct
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
import zlib
from pathlib import Path

WIDTH, HEIGHT = 1320, 840


def xwd_to_png(source: Path, target: Path) -> None:
    raw = source.read_bytes()
    fields = struct.unpack(">25I", raw[:100])
    header_size, width, height, bpp, bytes_per_line, ncolors = (
        fields[0], fields[4], fields[5], fields[11], fields[12], fields[19],
    )  # fmt: skip
    assert bpp == 32, f"Formato de pantalla no admitido: {bpp} bits por píxel"
    pixels = raw[header_size + ncolors * 12 :]
    rows = bytearray()
    for y in range(height):
        line = pixels[y * bytes_per_line : y * bytes_per_line + width * 4]
        rgb = bytearray(width * 3)
        rgb[0::3], rgb[1::3], rgb[2::3] = line[2::4], line[1::4], line[0::4]
        rows += b"\x00" + rgb

    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))

    target.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(bytes(rows), 6))
        + chunk(b"IEND", b"")
    )


def children_of(pid: int) -> list[tuple[int, str]]:
    found = []
    for entry in Path("/proc").iterdir():
        if not entry.name.isdigit():
            continue
        try:
            stat = (entry / "stat").read_text()
            name = stat[stat.index("(") + 1 : stat.rindex(")")]
            parent = int(stat[stat.rindex(")") + 2 :].split()[1])
        except (OSError, ValueError):
            continue
        if parent == pid:
            found.append((int(entry.name), name))
    return found


def alive(pid: int) -> bool:
    try:
        return "Z" not in Path(f"/proc/{pid}/stat").read_text().rsplit(")", 1)[1].split()[0]
    except OSError:
        return False


def step(message: str) -> None:
    print(f"  ok  {message}", flush=True)


def main() -> int:
    app, screenshot = Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve()
    tmp = Path(tempfile.mkdtemp(prefix="fwa-ventana-"))
    display = ":97"
    xvfb = subprocess.Popen(  # noqa: S603
        ["Xvfb", display, "-screen", "0", f"{WIDTH}x{HEIGHT}x24", "-fbdir", str(tmp), "-nolisten", "tcp"],  # noqa: S607
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    time.sleep(1.5)
    env = {
        **os.environ,
        "DISPLAY": display,
        "FWA_DATA_DIR": str(tmp / "datos"),
        "WEBKIT_DISABLE_DMABUF_RENDERER": "1",
        "WEBKIT_DISABLE_COMPOSITING_MODE": "1",
        "LIBGL_ALWAYS_SOFTWARE": "1",
        "GDK_BACKEND": "x11",
    }
    command = [str(app)]
    if shutil.which("dbus-run-session"):
        command = ["dbus-run-session", "--", *command]
    process = subprocess.Popen(command, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, start_new_session=True)  # noqa: S603
    backend_pid = None
    try:
        log = tmp / "datos" / "logs" / "backend.log"
        port = None
        deadline = time.monotonic() + 60
        while time.monotonic() < deadline and port is None:
            if process.poll() is not None:
                print(process.stderr.read().decode(errors="replace")[-3000:])  # type: ignore[union-attr]
                raise RuntimeError(f"La aplicación terminó al iniciar (código {process.returncode}).")
            if log.exists():
                match = re.search(r"Backend iniciado en el puerto (\d+)", log.read_text(encoding="utf-8"))
                port = int(match.group(1)) if match else None
            time.sleep(0.3)
        if port is None:
            raise RuntimeError("La aplicación no inició el backend en 60 s.")

        # El ejecutable empaquetado (PyInstaller) son dos procesos: lanzador e intérprete.
        app_pid = process.pid
        if command[0] == "dbus-run-session":
            app_pid = next(pid for pid, name in children_of(process.pid) if "funcode" in name)
        launcher = [pid for pid, name in children_of(app_pid) if name.startswith("fwa-backend")]
        assert launcher, f"El backend no es hijo de la aplicación: {children_of(app_pid)}"
        backend_pid = launcher[0]
        step(f"la aplicación inició el backend empaquetado (PID {backend_pid}, puerto {port})")

        base = f"http://127.0.0.1:{port}"
        with urllib.request.urlopen(f"{base}/health", timeout=5) as response:  # noqa: S310
            assert response.status == 200
        try:
            urllib.request.urlopen(f"{base}/api/v1/projects", timeout=5)  # noqa: S310
            raise RuntimeError("El backend aceptó una petición sin token.")
        except urllib.error.HTTPError as error:
            assert error.code == 401
        step("el backend responde y rechaza peticiones sin el token de la sesión")

        time.sleep(8)  # tiempo para que la interfaz cargue y se conecte
        assert process.poll() is None, "La ventana se cerró sola."
        xwd_to_png(tmp / "Xvfb_screen0", screenshot)
        step(f"la ventana sigue abierta; captura guardada en {screenshot}")

        os.killpg(process.pid, signal.SIGKILL)  # cierre abrupto de la aplicación
        process.wait(timeout=10)
        deadline = time.monotonic() + 15
        while alive(backend_pid) and time.monotonic() < deadline:
            time.sleep(0.2)
        assert not alive(backend_pid), "El backend quedó huérfano tras cerrar la aplicación."
        try:
            urllib.request.urlopen(f"{base}/health", timeout=2)  # noqa: S310
            raise RuntimeError("El backend sigue respondiendo tras cerrar la aplicación.")
        except OSError:
            pass
        step("al terminar la aplicación de forma abrupta, el backend se apagó solo")
    finally:
        if process.poll() is None:
            os.killpg(process.pid, signal.SIGKILL)
        xvfb.terminate()
        xvfb.wait(timeout=10)
        shutil.rmtree(tmp, ignore_errors=True)
    print("Ventana de escritorio (Linux, pantalla virtual): prueba de humo superada.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
