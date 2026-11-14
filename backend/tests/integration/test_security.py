"""Protección de la API local: token, origen, host y secretos."""

from __future__ import annotations

import logging

import pytest
from fastapi.testclient import TestClient

from tests.conftest import AUTH, BASE_URL, TOKEN

PROTECTED = [
    ("GET", "/api/v1/projects"),
    ("POST", "/api/v1/projects"),
    ("GET", "/api/v1/settings"),
    ("PATCH", "/api/v1/settings"),
    ("GET", "/api/v1/system/info"),
    ("POST", "/api/v1/system/shutdown"),
    ("GET", "/api/v1/activity"),
    ("GET", "/api/v1/events/stream"),
]


def test_health_is_public_and_minimal(anonymous: TestClient) -> None:
    response = anonymous.get("/health")
    assert response.status_code == 200
    assert set(response.json()) == {"status", "app", "version"}


@pytest.mark.parametrize(("method", "path"), PROTECTED)
def test_requests_without_token_are_rejected(anonymous: TestClient, method: str, path: str) -> None:
    response = anonymous.request(method, path)
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"


@pytest.mark.parametrize(
    "header",
    ["Bearer token-incorrecto-0123456789", f"Basic {TOKEN}", TOKEN, f"Bearer {TOKEN}x", "Bearer "],
)
def test_wrong_token_is_rejected(anonymous: TestClient, header: str) -> None:
    response = anonymous.get("/api/v1/projects", headers={"Authorization": header})
    assert response.status_code == 401


def test_token_in_query_string_is_not_accepted(anonymous: TestClient) -> None:
    assert anonymous.get(f"/api/v1/projects?token={TOKEN}").status_code == 401


def test_external_origin_is_rejected_even_with_valid_token(client: TestClient) -> None:
    response = client.get("/api/v1/projects", headers={"Origin": "https://sitio-externo.example"})
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "origin_not_allowed"
    assert "access-control-allow-origin" not in response.headers


def test_external_origin_cannot_reach_public_health_either(anonymous: TestClient) -> None:
    response = anonymous.get("/health", headers={"Origin": "https://sitio-externo.example"})
    assert response.status_code == 403


def test_app_origin_is_accepted(client: TestClient) -> None:
    response = client.get("/api/v1/projects", headers={"Origin": "http://tauri.localhost"})
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://tauri.localhost"


def test_preflight_from_external_origin_is_rejected(anonymous: TestClient) -> None:
    response = anonymous.options(
        "/api/v1/projects",
        headers={
            "Origin": "https://sitio-externo.example",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert response.status_code in (400, 403)
    assert "access-control-allow-origin" not in response.headers


def test_preflight_from_app_origin_is_allowed(anonymous: TestClient) -> None:
    response = anonymous.options(
        "/api/v1/projects",
        headers={
            "Origin": "tauri://localhost",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "tauri://localhost"


@pytest.mark.parametrize("host", ["evil.example", "127.0.0.1:9999", "192.168.1.20:8765"])
def test_unexpected_host_header_is_rejected(client: TestClient, host: str) -> None:
    """Defensa frente a DNS rebinding: solo se atiende al loopback y puerto propios."""
    response = client.get("/api/v1/projects", headers={"Host": host})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_host"


def test_api_documentation_is_not_exposed(client: TestClient) -> None:
    for path in ("/docs", "/redoc", "/openapi.json"):
        assert client.get(path).status_code == 404


def test_security_headers_present(client: TestClient) -> None:
    response = client.get("/api/v1/projects")
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["cache-control"] == "no-store"


def test_token_never_appears_in_responses(client: TestClient, workspace) -> None:  # type: ignore[no-untyped-def]
    client.post("/api/v1/projects", json={"name": "Demo", "workspace_dir": str(workspace)})
    bodies = [
        client.get(path).text
        for path in (
            "/health",
            "/api/v1/system/info",
            "/api/v1/settings",
            "/api/v1/projects",
            "/api/v1/activity",
        )
    ]
    assert all(TOKEN not in body for body in bodies)


def test_token_is_redacted_from_log_file(client: TestClient, settings) -> None:  # type: ignore[no-untyped-def]
    logger = logging.getLogger("fwa.prueba")
    logger.warning("Petición con cabecera Authorization: Bearer %s", TOKEN)
    logger.warning("valor suelto %s en un mensaje", TOKEN)
    logger.warning("api_key=sk-1234567890abcdef y password: hunter2222")
    for handler in logging.getLogger().handlers:
        handler.flush()
    content = (settings.logs_dir / "backend.log").read_text(encoding="utf-8")
    assert "Petición con cabecera" in content
    assert TOKEN not in content
    assert "sk-1234567890abcdef" not in content
    assert "hunter2222" not in content


def test_token_is_not_stored_in_database(client: TestClient, settings) -> None:  # type: ignore[no-untyped-def]
    client.get("/api/v1/settings")
    raw = settings.database_path.read_bytes()
    assert TOKEN.encode() not in raw


def test_short_token_is_refused(settings) -> None:  # type: ignore[no-untyped-def]
    from pydantic import SecretStr

    from fwa.app import create_app

    with pytest.raises(ValueError):
        create_app(settings.model_copy(update={"session_token": SecretStr("corto")}))


def test_auth_headers_constant() -> None:
    assert AUTH["Authorization"].startswith("Bearer ") and BASE_URL.startswith("http://127.0.0.1")
