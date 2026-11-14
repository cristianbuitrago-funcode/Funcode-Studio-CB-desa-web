"""Protección de la API local.

Tres comprobaciones en cada petición HTTP:

1. ``Host`` debe ser el loopback y el puerto del backend (frena DNS rebinding).
2. ``Origin``, si existe, debe pertenecer a la interfaz de la aplicación
   (frena peticiones lanzadas por páginas web abiertas en un navegador).
3. Todo salvo ``/health`` exige el token de sesión en ``Authorization: Bearer``.

No se usan cookies, por lo que un sitio externo no puede aprovechar una sesión
ya abierta (CSRF): sin conocer el token no hay forma de autenticarse.
"""

from __future__ import annotations

import hmac
import json
from collections.abc import Iterable

from starlette.types import ASGIApp, Message, Receive, Scope, Send

PUBLIC_PATHS = frozenset({"/health"})

_SECURITY_HEADERS = (
    (b"x-content-type-options", b"nosniff"),
    (b"cache-control", b"no-store"),
    (b"referrer-policy", b"no-referrer"),
)


class LocalAuthMiddleware:
    def __init__(
        self,
        app: ASGIApp,
        *,
        token: str,
        allowed_hosts: Iterable[str],
        allowed_origins: Iterable[str],
    ) -> None:
        if len(token) < 16:
            raise ValueError("El token de sesión es demasiado corto.")
        self._app = app
        self._token = token.encode()
        self._hosts = {h.lower() for h in allowed_hosts}
        self._origins = set(allowed_origins)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            if scope["type"] == "websocket":  # No se usan WebSockets: se rechazan.
                await send({"type": "websocket.close", "code": 1008})
                return
            await self._app(scope, receive, send)
            return

        headers = {k.decode("latin-1").lower(): v.decode("latin-1") for k, v in scope["headers"]}

        if headers.get("host", "").lower() not in self._hosts:
            await _reject(send, 400, "invalid_host", "Cabecera Host no permitida.")
            return

        origin = headers.get("origin")
        if origin is not None and origin not in self._origins:
            await _reject(send, 403, "origin_not_allowed", "Origen no autorizado.")
            return

        is_preflight = scope["method"] == "OPTIONS"
        if not is_preflight and scope["path"] not in PUBLIC_PATHS:
            scheme, _, value = headers.get("authorization", "").partition(" ")
            valid = scheme.lower() == "bearer" and hmac.compare_digest(
                value.strip().encode(), self._token
            )
            if not valid:
                await _reject(send, 401, "unauthorized", "Token de sesión ausente o inválido.")
                return

        async def send_with_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                message.setdefault("headers", [])
                existing = {name for name, _ in message["headers"]}
                message["headers"].extend(h for h in _SECURITY_HEADERS if h[0] not in existing)
            await send(message)

        await self._app(scope, receive, send_with_headers)


async def _reject(send: Send, status: int, code: str, message: str) -> None:
    body = json.dumps({"error": {"code": code, "message": message, "details": {}}}).encode()
    await send(
        {
            "type": "http.response.start",
            "status": status,
            "headers": [
                (b"content-type", b"application/json"),
                (b"content-length", str(len(body)).encode()),
                *_SECURITY_HEADERS,
            ],
        }
    )
    await send({"type": "http.response.body", "body": body})
