from __future__ import annotations

from collections.abc import Callable, Iterator
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import SecretStr

from fwa.app import create_app
from fwa.config import Settings

TOKEN = "token-de-prueba-0123456789abcdef"
PORT = 8765
BASE_URL = f"http://127.0.0.1:{PORT}"
AUTH = {"Authorization": f"Bearer {TOKEN}"}


@pytest.fixture
def data_dir(tmp_path: Path) -> Path:
    # ``resolve`` evita diferencias por rutas cortas de Windows (p. ej. RUNNER~1).
    return tmp_path.resolve() / "datos"


@pytest.fixture
def workspace(tmp_path: Path) -> Path:
    path = tmp_path.resolve() / "proyectos"
    path.mkdir()
    return path


def make_symlink(link: Path, target: Path) -> None:
    """Crea un enlace simbólico; omite la prueba si el sistema no lo permite (Windows)."""
    try:
        link.symlink_to(target, target_is_directory=True)
    except OSError:
        pytest.skip("Este sistema no permite crear enlaces simbólicos sin privilegios.")


@pytest.fixture
def settings(data_dir: Path) -> Settings:
    return Settings(port=PORT, session_token=SecretStr(TOKEN), data_dir=data_dir, dev=True)


@pytest.fixture
def make_app(settings: Settings) -> Callable[[], FastAPI]:
    return lambda: create_app(settings)


@pytest.fixture
def client(make_app: Callable[[], FastAPI]) -> Iterator[TestClient]:
    """Cliente autenticado contra una aplicación con base de datos temporal."""
    with TestClient(make_app(), base_url=BASE_URL, headers=AUTH) as test_client:
        yield test_client


@pytest.fixture
def anonymous(make_app: Callable[[], FastAPI]) -> Iterator[TestClient]:
    with TestClient(make_app(), base_url=BASE_URL) as test_client:
        yield test_client
