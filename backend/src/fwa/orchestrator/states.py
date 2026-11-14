"""Estados de una tarea y transiciones permitidas."""

from __future__ import annotations

from enum import StrEnum


class TaskStatus(StrEnum):
    PENDING = "pending"  # Creada; todavía no se ha ejecutado.
    RUNNING = "running"  # En ejecución.
    COMPLETED = "completed"  # Terminó bien. No se vuelve a ejecutar.
    FAILED = "failed"  # Terminó con error.
    CANCELLED = "cancelled"  # Cancelada por el usuario.
    INTERRUPTED = "interrupted"  # Estaba en ejecución cuando se cerró la aplicación.
    WAITING_USER = "waiting_user"  # Necesita una respuesta o autorización del usuario.


TERMINAL = frozenset({TaskStatus.COMPLETED, TaskStatus.CANCELLED})

_ALLOWED: dict[TaskStatus, frozenset[TaskStatus]] = {
    TaskStatus.PENDING: frozenset({TaskStatus.RUNNING, TaskStatus.CANCELLED}),
    TaskStatus.RUNNING: frozenset(
        {
            TaskStatus.COMPLETED,
            TaskStatus.FAILED,
            TaskStatus.CANCELLED,
            TaskStatus.INTERRUPTED,
            TaskStatus.WAITING_USER,
        }
    ),
    TaskStatus.FAILED: frozenset({TaskStatus.PENDING, TaskStatus.CANCELLED}),
    TaskStatus.INTERRUPTED: frozenset({TaskStatus.PENDING, TaskStatus.CANCELLED}),
    TaskStatus.WAITING_USER: frozenset({TaskStatus.PENDING, TaskStatus.CANCELLED}),
    TaskStatus.COMPLETED: frozenset(),
    TaskStatus.CANCELLED: frozenset(),
}


class InvalidTransition(Exception):
    pass


def ensure_transition(current: TaskStatus, new: TaskStatus) -> None:
    if new not in _ALLOWED[current]:
        raise InvalidTransition(f"Transición no permitida: {current} → {new}")
