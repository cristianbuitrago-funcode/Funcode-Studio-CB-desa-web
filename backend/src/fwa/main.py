"""Punto de entrada del backend.

Uso en desarrollo, de forma independiente::

    FWA_DEV=1 FWA_SESSION_TOKEN=<token-de-al-menos-16-caracteres> uv run fwa-backend

La aplicación de escritorio lo inicia con ``FWA_PORT``, ``FWA_SESSION_TOKEN`` y
``FWA_WATCH_STDIN=1``.
"""

from __future__ import annotations

import logging
import sys
import threading

import uvicorn

from fwa.app import create_app
from fwa.config import LOOPBACK_HOST, Settings
from fwa.services.instance_lock import AlreadyRunningError, InstanceLock

EXIT_CONFIG = 2
EXIT_ALREADY_RUNNING = 3

logger = logging.getLogger("fwa")


def _watch_stdin(stop: threading.Event, shutdown: object) -> None:
    """Apaga el backend cuando la aplicación de escritorio cierra o muere.

    La aplicación mantiene abierta la entrada estándar del backend. Cuando
    desaparece (cierre normal o fallo), la lectura devuelve fin de archivo.
    """
    stream = sys.stdin
    if stream is None:
        return
    try:
        while not stop.is_set() and stream.buffer.read(1):
            pass
    except (OSError, ValueError):
        pass
    if not stop.is_set():
        logger.info("La aplicación de escritorio se cerró; deteniendo el backend.")
        shutdown()  # type: ignore[operator]


def run() -> None:
    settings = Settings()
    if settings.session_token is None or len(settings.session_token.get_secret_value()) < 16:
        print(
            "Falta FWA_SESSION_TOKEN (mínimo 16 caracteres). "
            "La aplicación de escritorio lo genera en cada sesión.",
            file=sys.stderr,
        )
        sys.exit(EXIT_CONFIG)

    lock = InstanceLock(settings.resolved_data_dir)
    try:
        lock.acquire()
    except AlreadyRunningError as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(EXIT_ALREADY_RUNNING)

    server: uvicorn.Server | None = None

    def request_shutdown() -> None:
        if server is not None:
            server.should_exit = True

    app = create_app(settings, on_shutdown_request=request_shutdown)
    config = uvicorn.Config(
        app,
        host=LOOPBACK_HOST,
        port=settings.port,
        log_config=None,
        access_log=False,
        timeout_graceful_shutdown=3,
    )
    server = uvicorn.Server(config)

    stop_watch = threading.Event()
    if settings.watch_stdin:
        threading.Thread(
            target=_watch_stdin, args=(stop_watch, app.state.request_shutdown), daemon=True
        ).start()
    try:
        server.run()
    finally:
        stop_watch.set()
        lock.release()


if __name__ == "__main__":
    run()
