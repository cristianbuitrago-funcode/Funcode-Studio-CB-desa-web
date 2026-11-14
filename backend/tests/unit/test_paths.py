from __future__ import annotations

from pathlib import Path

import pytest

from fwa.errors import UnsafePathError
from fwa.security.paths import (
    assert_safe_to_delete,
    resolve_within,
    slugify,
    validate_workspace_dir,
)
from tests.conftest import make_symlink


@pytest.mark.parametrize(
    ("name", "expected"),
    [
        ("Tienda de Tecnología", "tienda-de-tecnologia"),
        ("  ¡Hola, Mundo!  ", "hola-mundo"),
        ("../../etc/passwd", "etc-passwd"),
        ("C:\\Windows\\System32", "c-windows-system32"),
        ("日本語", "proyecto"),
        ("CON", "proyecto-con"),
        ("lpt1", "proyecto-lpt1"),
        ("a" * 200, "a" * 60),
    ],
)
def test_slugify(name: str, expected: str) -> None:
    assert slugify(name) == expected


def test_resolve_within_accepts_inner_paths(tmp_path: Path) -> None:
    tmp_path = tmp_path.resolve()
    assert resolve_within(tmp_path, "src/index.html") == tmp_path.resolve() / "src" / "index.html"
    assert resolve_within(tmp_path, ".") == tmp_path.resolve()


@pytest.mark.parametrize(
    "bad",
    [
        "../fuera.txt",
        "src/../../fuera.txt",
        "src\\..\\..\\fuera.txt",
        "/etc/passwd",
        "\\\\servidor\\recurso",
        "C:\\Windows\\win.ini",
        "c:archivo",
        "archivo\x00.txt",
    ],
)
def test_resolve_within_rejects_escapes(tmp_path: Path, bad: str) -> None:
    with pytest.raises(UnsafePathError):
        resolve_within(tmp_path, bad)


def test_resolve_within_rejects_symlink_escape(tmp_path: Path) -> None:
    root = tmp_path / "proyecto"
    root.mkdir()
    outside = tmp_path / "secreto"
    outside.mkdir()
    make_symlink(root / "enlace", outside)
    with pytest.raises(UnsafePathError):
        resolve_within(root, "enlace/clave.txt")


def test_validate_workspace_dir(tmp_path: Path) -> None:
    tmp_path = tmp_path.resolve()
    assert validate_workspace_dir(str(tmp_path / "nuevo")) == (tmp_path / "nuevo").resolve()
    for bad in ("", "   ", "relativa", "a\x00b"):
        with pytest.raises(UnsafePathError):
            validate_workspace_dir(bad)
    with pytest.raises(UnsafePathError):
        validate_workspace_dir(str(tmp_path / "datos" / "x"), forbidden=(tmp_path / "datos",))


def test_assert_safe_to_delete(tmp_path: Path) -> None:
    tmp_path = tmp_path.resolve()
    project = tmp_path / "trabajo" / "proyecto"
    project.mkdir(parents=True)
    assert assert_safe_to_delete(project) == project.resolve()
    for protected in (Path.home(), Path(Path.home().anchor), Path.home().parent):
        with pytest.raises(UnsafePathError):
            assert_safe_to_delete(protected)
    with pytest.raises(UnsafePathError):
        assert_safe_to_delete(tmp_path / "trabajo", protected=(tmp_path / "trabajo",))
    with pytest.raises(UnsafePathError):  # contiene una carpeta protegida
        assert_safe_to_delete(tmp_path, protected=(project,))
    with pytest.raises(UnsafePathError):
        assert_safe_to_delete(tmp_path / "no-existe")
