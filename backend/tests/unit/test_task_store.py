"""Persistencia y recuperación de tareas del orquestador."""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest
from sqlalchemy.orm import Session

from fwa.db.models import Project
from fwa.db.session import create_db_engine, create_session_factory, run_migrations
from fwa.orchestrator.states import InvalidTransition, TaskStatus
from fwa.orchestrator.task_store import TaskStore, recover_interrupted_tasks


def _open(path: Path) -> Session:
    engine = create_db_engine(path)
    run_migrations(engine)
    return create_session_factory(engine)()


@pytest.fixture
def db_path(tmp_path: Path) -> Path:
    return tmp_path / "fwa.sqlite3"


@pytest.fixture
def session(db_path: Path) -> Iterator[Session]:
    with _open(db_path) as s:
        s.add(Project(id="p1", name="P", slug="p", directory="/tmp/p"))
        s.commit()
        yield s


def _task(store: TaskStore, key: str, **kwargs):  # type: ignore[no-untyped-def]
    return store.create(project_id="p1", kind="demo", title=key, idempotency_key=key, **kwargs)


def test_same_operation_is_not_registered_twice(session: Session) -> None:
    store = TaskStore(session)
    first, again = _task(store, "analizar"), _task(store, "analizar")
    assert first.id == again.id
    assert len(store.list_for_project("p1")) == 1


def test_transitions_are_enforced(session: Session) -> None:
    store = TaskStore(session)
    task = _task(store, "t")
    with pytest.raises(InvalidTransition):
        store.set_status(task, TaskStatus.COMPLETED)
    store.set_status(task, TaskStatus.RUNNING)
    assert task.attempts == 1 and task.started_at is not None
    store.set_status(task, TaskStatus.COMPLETED, result={"ok": True})
    assert task.finished_at is not None and task.result == {"ok": True}
    with pytest.raises(InvalidTransition):
        store.set_status(task, TaskStatus.RUNNING)


def test_dependencies_gate_ready_tasks(session: Session) -> None:
    store = TaskStore(session)
    a = _task(store, "a")
    b = _task(store, "b", depends_on=[a.id])
    assert [t.id for t in store.ready_tasks("p1")] == [a.id]
    store.set_status(a, TaskStatus.RUNNING)
    assert store.ready_tasks("p1") == []
    store.set_status(a, TaskStatus.COMPLETED)
    assert [t.id for t in store.ready_tasks("p1")] == [b.id]


def test_recovery_after_unexpected_shutdown(session: Session, db_path: Path) -> None:
    store = TaskStore(session)
    done, running, unsafe, pending = (
        _task(store, "hecha"),
        _task(store, "en-curso"),
        _task(store, "no-repetible", resumable=False),
        _task(store, "pendiente"),
    )
    store.set_status(done, TaskStatus.RUNNING)
    store.set_status(done, TaskStatus.COMPLETED)
    store.set_status(running, TaskStatus.RUNNING)
    store.set_status(unsafe, TaskStatus.RUNNING)
    session.commit()
    session.close()  # la aplicación «se cierra» con dos tareas en ejecución

    with _open(db_path) as reopened:
        assert recover_interrupted_tasks(reopened) == 2
        reopened.commit()
        store = TaskStore(reopened)
        by_key = {t.idempotency_key: t for t in store.list_for_project("p1")}
        assert by_key["hecha"].status == TaskStatus.COMPLETED
        assert by_key["pendiente"].status == TaskStatus.PENDING
        assert by_key["en-curso"].status == TaskStatus.INTERRUPTED
        assert by_key["no-repetible"].status == TaskStatus.INTERRUPTED
        assert "requiere revisión" in (by_key["no-repetible"].error or "")
        # Reanudar: lo interrumpido vuelve a la cola; lo completado no se repite.
        store.resume(by_key["en-curso"])
        store.resume(by_key["hecha"])
        assert by_key["en-curso"].status == TaskStatus.PENDING
        assert by_key["hecha"].status == TaskStatus.COMPLETED
        assert by_key["hecha"].attempts == 1
        assert recover_interrupted_tasks(reopened) == 0
        assert pending.id == by_key["pendiente"].id


def test_tasks_are_removed_with_their_project(session: Session) -> None:
    store = TaskStore(session)
    a = _task(store, "a")
    _task(store, "b", depends_on=[a.id])
    session.delete(session.get(Project, "p1"))
    session.commit()
    assert store.list_for_project("p1") == []
