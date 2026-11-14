"""Gestión de proyectos a través de la API."""

from __future__ import annotations

import zipfile
from collections.abc import Callable
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from tests.conftest import AUTH, BASE_URL, make_symlink


def _create(client: TestClient, workspace: Path, name: str = "Tienda de tecnología") -> dict:  # type: ignore[type-arg]
    response = client.post(
        "/api/v1/projects",
        json={
            "name": name,
            "description": "  Una tienda virtual.  ",
            "workspace_dir": str(workspace),
        },
    )
    assert response.status_code == 201, response.text
    return response.json()  # type: ignore[no-any-return]


def test_list_is_empty_initially(client: TestClient) -> None:
    assert client.get("/api/v1/projects").json() == []


def test_create_project_creates_record_and_folder(client: TestClient, workspace: Path) -> None:
    project = _create(client, workspace)
    assert len(project["id"]) == 36
    assert project["name"] == "Tienda de tecnología"
    assert project["slug"] == "tienda-de-tecnologia"
    assert project["description"] == "Una tienda virtual."
    assert project["status"] == "draft"
    directory = Path(project["directory"])
    assert directory == workspace / "tienda-de-tecnologia"
    assert directory.is_dir() and project["directory_exists"] is True
    assert project["git_initialized"] is (directory / ".git").is_dir()


def test_each_project_gets_unique_id_and_folder(client: TestClient, workspace: Path) -> None:
    first, second = _create(client, workspace), _create(client, workspace)
    assert first["id"] != second["id"]
    assert Path(second["directory"]).name == "tienda-de-tecnologia-2"


def test_uses_configured_projects_dir_when_omitted(client: TestClient, workspace: Path) -> None:
    client.patch("/api/v1/settings", json={"projects_dir": str(workspace)})
    response = client.post("/api/v1/projects", json={"name": "Sin directorio"})
    assert response.status_code == 201
    assert Path(response.json()["directory"]).parent == workspace


def test_validation_errors_are_readable(client: TestClient, workspace: Path) -> None:
    response = client.post(
        "/api/v1/projects", json={"name": "   ", "workspace_dir": str(workspace)}
    )
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert error["details"]["fields"][0]["field"] == "name"


def test_relative_workspace_is_rejected(client: TestClient) -> None:
    response = client.post("/api/v1/projects", json={"name": "X", "workspace_dir": "relativa/ruta"})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "unsafe_path"


def test_workspace_inside_app_data_is_rejected(client: TestClient, data_dir: Path) -> None:
    response = client.post(
        "/api/v1/projects", json={"name": "X", "workspace_dir": str(data_dir / "dentro")}
    )
    assert response.status_code == 422
    assert not (data_dir / "dentro").exists()


def test_workspace_that_is_a_file_is_rejected(client: TestClient, tmp_path: Path) -> None:
    file = tmp_path / "archivo.txt"
    file.write_text("x")
    response = client.post("/api/v1/projects", json={"name": "X", "workspace_dir": str(file)})
    assert response.status_code == 422


def test_get_update_and_missing(client: TestClient, workspace: Path) -> None:
    project = _create(client, workspace)
    url = f"/api/v1/projects/{project['id']}"
    assert client.get(url).json()["name"] == project["name"]
    updated = client.patch(url, json={"name": "Nuevo nombre", "description": "Otra"}).json()
    assert (updated["name"], updated["description"]) == ("Nuevo nombre", "Otra")
    # Renombrar no mueve la carpeta.
    assert updated["directory"] == project["directory"]
    missing = client.get("/api/v1/projects/no-existe")
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "not_found"


def test_projects_persist_after_backend_restart(
    make_app: Callable[[], FastAPI], workspace: Path
) -> None:
    with TestClient(make_app(), base_url=BASE_URL, headers=AUTH) as first:
        created = _create(first, workspace)
        first.patch("/api/v1/settings", json={"theme": "light"})
    # Nueva instancia del backend sobre el mismo directorio de datos.
    with TestClient(make_app(), base_url=BASE_URL, headers=AUTH) as second:
        projects = second.get("/api/v1/projects").json()
        assert [p["id"] for p in projects] == [created["id"]]
        assert projects[0]["description"] == "Una tienda virtual."
        assert second.get("/api/v1/settings").json()["theme"] == "light"
        kinds = [e["kind"] for e in second.get("/api/v1/activity").json()]
        assert "project.created" in kinds


def test_delete_requires_exact_name_confirmation(client: TestClient, workspace: Path) -> None:
    project = _create(client, workspace)
    url = f"/api/v1/projects/{project['id']}/delete"
    response = client.post(url, json={"confirm_name": "otro nombre", "delete_files": True})
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "confirmation_required"
    assert Path(project["directory"]).is_dir()
    assert len(client.get("/api/v1/projects").json()) == 1


def test_there_is_no_unconfirmed_delete_endpoint(client: TestClient, workspace: Path) -> None:
    project = _create(client, workspace)
    assert client.delete(f"/api/v1/projects/{project['id']}").status_code == 405


def test_delete_keeping_files(client: TestClient, workspace: Path) -> None:
    project = _create(client, workspace)
    result = client.post(
        f"/api/v1/projects/{project['id']}/delete", json={"confirm_name": project["name"]}
    ).json()
    assert result == {"id": project["id"], "files_deleted": False, "backup_path": None}
    assert Path(project["directory"]).is_dir()
    assert client.get("/api/v1/projects").json() == []


def test_delete_with_files_creates_backup_first(
    client: TestClient, workspace: Path, data_dir: Path
) -> None:
    project = _create(client, workspace)
    directory = Path(project["directory"])
    (directory / "src").mkdir()
    (directory / "src" / "index.html").write_text("<h1>hola</h1>", encoding="utf-8")
    result = client.post(
        f"/api/v1/projects/{project['id']}/delete",
        json={"confirm_name": project["name"], "delete_files": True},
    ).json()
    assert result["files_deleted"] is True
    assert not directory.exists()
    assert workspace.is_dir(), "El directorio de trabajo no debe borrarse"
    backup = Path(result["backup_path"])
    assert backup.parent == data_dir / "backups"
    with zipfile.ZipFile(backup) as archive:
        assert archive.read("src/index.html") == b"<h1>hola</h1>"
    event = client.get("/api/v1/activity").json()[0]
    assert event["kind"] == "project.deleted" and event["payload"]["files_deleted"] is True


def test_delete_refuses_symlinked_project_folder(
    client: TestClient, workspace: Path, tmp_path: Path
) -> None:
    project = _create(client, workspace)
    directory = Path(project["directory"])
    victim = tmp_path / "carpeta-ajena"
    victim.mkdir()
    (victim / "importante.txt").write_text("no borrar")
    for child in directory.iterdir():
        if child.is_dir():
            import shutil

            shutil.rmtree(child)
    directory.rmdir()
    make_symlink(directory, victim)
    response = client.post(
        f"/api/v1/projects/{project['id']}/delete",
        json={"confirm_name": project["name"], "delete_files": True},
    )
    assert response.status_code == 422
    assert (victim / "importante.txt").exists()
    assert len(client.get("/api/v1/projects").json()) == 1


def test_missing_folder_is_reported(client: TestClient, workspace: Path) -> None:
    import shutil

    project = _create(client, workspace)
    shutil.rmtree(project["directory"])
    assert client.get(f"/api/v1/projects/{project['id']}").json()["directory_exists"] is False


def test_tasks_endpoint_starts_empty(client: TestClient, workspace: Path) -> None:
    project = _create(client, workspace)
    assert client.get(f"/api/v1/projects/{project['id']}/tasks").json() == []
    assert client.get("/api/v1/projects/nada/tasks").status_code == 404


def test_activity_records_and_filters(client: TestClient, workspace: Path) -> None:
    a, b = _create(client, workspace, "A"), _create(client, workspace, "B")
    assert len(client.get("/api/v1/activity").json()) == 2
    only_a = client.get(f"/api/v1/activity?project_id={a['id']}").json()
    assert [e["project_id"] for e in only_a] == [a["id"]]
    assert b["id"] != a["id"]
    assert client.get("/api/v1/activity?limit=0").status_code == 422
