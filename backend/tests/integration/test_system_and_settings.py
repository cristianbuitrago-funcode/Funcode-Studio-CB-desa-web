from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from fwa.sandbox import detection
from fwa.services.commands import CommandResult


def test_system_info(client: TestClient, data_dir: Path) -> None:
    info = client.get("/api/v1/system/info").json()
    assert info["app_name"] == "Funcode Web Architect"
    assert info["data_dir"] == str(data_dir.resolve())
    assert info["backend_port"] == 8765
    assert isinstance(info["git"]["available"], bool)
    names = [r["name"] for r in info["isolation"]["runtimes"]]
    assert names == ["docker", "podman"]
    assert info["isolation"]["backend_projects_level"] in (2, 3)


def _fake(responses: dict[tuple[str, str], CommandResult]):  # type: ignore[no-untyped-def]
    def run_tool(name: str, args: list[str], **_: object) -> CommandResult:
        return responses.get((name, args[0]), CommandResult(found=False, ok=False, output=""))

    return run_tool


def test_no_container_runtime_means_level_3(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    monkeypatch.setattr(detection, "run_tool", _fake({}))
    status = detection.detect_isolation()
    assert status.active_runtime is None and status.backend_projects_level == 3
    assert all(not r.installed for r in status.runtimes)


def test_installed_but_stopped_runtime_is_not_available(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    monkeypatch.setattr(
        detection,
        "run_tool",
        _fake(
            {
                ("docker", "--version"): CommandResult(True, True, "Docker version 29.9.2"),
                ("docker", "info"): CommandResult(True, False, "Cannot connect to the daemon"),
            }
        ),
    )
    status = detection.detect_isolation()
    docker = status.runtimes[0]
    assert docker.installed and not docker.available and docker.detail
    assert status.backend_projects_level == 3


def test_running_podman_enables_level_2(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    monkeypatch.setattr(
        detection,
        "run_tool",
        _fake(
            {
                ("podman", "--version"): CommandResult(True, True, "podman version 5.0"),
                ("podman", "info"): CommandResult(True, True, "{}"),
            }
        ),
    )
    status = detection.detect_isolation()
    assert status.active_runtime == "podman" and status.backend_projects_level == 2


def test_settings_defaults_and_update(client: TestClient, workspace: Path) -> None:
    defaults = client.get("/api/v1/settings").json()
    assert defaults["theme"] == "dark" and Path(defaults["projects_dir"]).is_absolute()
    updated = client.patch(
        "/api/v1/settings", json={"projects_dir": str(workspace), "theme": "light"}
    ).json()
    assert updated == {"projects_dir": str(workspace.resolve()), "theme": "light"}


def test_settings_reject_invalid_values(client: TestClient, data_dir: Path) -> None:
    assert client.patch("/api/v1/settings", json={"theme": "rosa"}).status_code == 422
    assert client.patch("/api/v1/settings", json={"projects_dir": "relativa"}).status_code == 422
    assert client.patch("/api/v1/settings", json={"projects_dir": str(data_dir)}).status_code == 422


def test_shutdown_endpoint_invokes_callback(settings) -> None:  # type: ignore[no-untyped-def]
    from fwa.app import create_app
    from tests.conftest import AUTH, BASE_URL

    called: list[bool] = []
    app = create_app(settings, on_shutdown_request=lambda: called.append(True))
    with TestClient(app, base_url=BASE_URL, headers=AUTH) as client:
        response = client.post("/api/v1/system/shutdown")
        assert response.status_code == 202
    assert called == [True]
