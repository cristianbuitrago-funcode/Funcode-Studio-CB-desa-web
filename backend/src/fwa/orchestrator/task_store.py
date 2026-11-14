"""Almacén persistente de tareas.

Fase 1: la base sobre la que se construirá el orquestador. Garantiza tres
propiedades que el resto del sistema necesitará:

- Las tareas sobreviven al cierre de la aplicación.
- Una misma operación no se registra ni se ejecuta dos veces (clave de idempotencia).
- Tras un cierre inesperado, las tareas que estaban en ejecución quedan marcadas
  como interrumpidas y solo se reanudan las que es seguro repetir.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from fwa.db.models import Task, TaskDependency, utcnow
from fwa.orchestrator.states import TERMINAL, TaskStatus, ensure_transition


class TaskStore:
    def __init__(self, session: Session) -> None:
        self._session = session

    def create(
        self,
        *,
        project_id: str,
        kind: str,
        title: str,
        idempotency_key: str,
        engine: str | None = None,
        input: dict[str, Any] | None = None,
        depends_on: list[str] | None = None,
        resumable: bool = True,
        position: int = 0,
    ) -> Task:
        """Crea la tarea, o devuelve la existente si la operación ya estaba registrada."""
        existing = self._session.scalar(
            select(Task).where(
                Task.project_id == project_id, Task.idempotency_key == idempotency_key
            )
        )
        if existing is not None:
            return existing
        task = Task(
            project_id=project_id,
            kind=kind,
            title=title,
            idempotency_key=idempotency_key,
            engine=engine,
            input=input or {},
            resumable=resumable,
            position=position,
        )
        self._session.add(task)
        self._session.flush()
        for dependency in depends_on or []:
            self._session.add(TaskDependency(task_id=task.id, depends_on_id=dependency))
        self._session.flush()
        return task

    def list_for_project(self, project_id: str) -> list[Task]:
        return list(
            self._session.scalars(
                select(Task)
                .where(Task.project_id == project_id)
                .order_by(Task.position, Task.created_at)
            )
        )

    def set_status(
        self,
        task: Task,
        status: TaskStatus,
        *,
        result: dict[str, Any] | None = None,
        error: str | None = None,
    ) -> Task:
        ensure_transition(TaskStatus(task.status), status)
        task.status = status.value
        now = utcnow()
        if status is TaskStatus.RUNNING:
            task.started_at = now
            task.finished_at = None
            task.attempts += 1
            task.error = None
        elif status in (TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED):
            task.finished_at = now
        if result is not None:
            task.result = result
        if error is not None:
            task.error = error
        self._session.flush()
        return task

    def ready_tasks(self, project_id: str) -> list[Task]:
        """Tareas pendientes cuyas dependencias ya están completadas."""
        tasks = self.list_for_project(project_id)
        completed = {t.id for t in tasks if t.status == TaskStatus.COMPLETED}
        dependencies: dict[str, set[str]] = {}
        rows = self._session.execute(
            select(TaskDependency.task_id, TaskDependency.depends_on_id).where(
                TaskDependency.task_id.in_([t.id for t in tasks])
            )
        )
        for task_id, depends_on_id in rows:
            dependencies.setdefault(task_id, set()).add(depends_on_id)
        return [
            t
            for t in tasks
            if t.status == TaskStatus.PENDING and dependencies.get(t.id, set()) <= completed
        ]

    def resume(self, task: Task) -> Task:
        """Devuelve a la cola una tarea interrumpida, fallida o en espera."""
        if TaskStatus(task.status) in TERMINAL:
            return task  # Nunca se repite una operación ya terminada.
        return self.set_status(task, TaskStatus.PENDING)


def recover_interrupted_tasks(session: Session) -> int:
    """Se ejecuta al arrancar: ninguna tarea puede seguir «en ejecución» tras un reinicio."""
    stale = list(session.scalars(select(Task).where(Task.status == TaskStatus.RUNNING)))
    for task in stale:
        task.status = TaskStatus.INTERRUPTED.value
        task.error = (
            "La aplicación se cerró mientras la tarea estaba en ejecución."
            if task.resumable
            else "La aplicación se cerró durante una operación que no puede repetirse "
            "automáticamente; requiere revisión."
        )
    session.flush()
    return len(stale)
