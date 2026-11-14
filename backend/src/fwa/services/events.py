"""Eventos de actividad: se guardan en la base de datos y se difunden por SSE."""

from __future__ import annotations

import asyncio
import contextlib
import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from fwa.db.models import Event

logger = logging.getLogger(__name__)

_QUEUE_SIZE = 200


class EventBroadcaster:
    """Reparte eventos a los clientes SSE conectados. Seguro entre hilos."""

    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue[dict[str, Any] | None]] = set()
        self._loop: asyncio.AbstractEventLoop | None = None
        self._closed = False

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop
        self._closed = False

    @property
    def closed(self) -> bool:
        return self._closed

    def subscribe(self) -> asyncio.Queue[dict[str, Any] | None]:
        queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue(maxsize=_QUEUE_SIZE)
        self._subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue[dict[str, Any] | None]) -> None:
        self._subscribers.discard(queue)

    def publish(self, event: dict[str, Any]) -> None:
        self._dispatch(event)

    def close(self) -> None:
        """Termina todos los flujos abiertos (apagado controlado)."""
        self._closed = True
        self._dispatch(None)

    def _dispatch(self, item: dict[str, Any] | None) -> None:
        loop = self._loop
        if loop is None or loop.is_closed():
            return

        def deliver() -> None:
            for queue in list(self._subscribers):
                with contextlib.suppress(asyncio.QueueFull):
                    queue.put_nowait(item)

        try:
            running = asyncio.get_running_loop()
        except RuntimeError:
            running = None
        if running is loop:
            deliver()
        else:
            loop.call_soon_threadsafe(deliver)


def serialize_event(event: Event) -> dict[str, Any]:
    return {
        "id": event.id,
        "project_id": event.project_id,
        "kind": event.kind,
        "actor": event.actor,
        "message": event.message,
        "payload": event.payload,
        "created_at": event.created_at.isoformat(),
    }


class EventService:
    def __init__(self, session: Session, broadcaster: EventBroadcaster) -> None:
        self._session = session
        self._broadcaster = broadcaster
        self._pending: list[Event] = []

    def record(
        self,
        kind: str,
        message: str,
        *,
        project_id: str | None = None,
        actor: str = "user",
        payload: dict[str, Any] | None = None,
    ) -> Event:
        """Añade el evento a la transacción en curso. Se difunde con ``flush_published``."""
        event = Event(
            kind=kind, message=message, project_id=project_id, actor=actor, payload=payload or {}
        )
        self._session.add(event)
        self._pending.append(event)
        return event

    def publish_pending(self) -> None:
        """Difunde los eventos ya confirmados en la base de datos."""
        for event in self._pending:
            self._broadcaster.publish(serialize_event(event))
        self._pending.clear()

    def recent(self, *, limit: int = 30, project_id: str | None = None) -> list[Event]:
        query = select(Event).order_by(Event.id.desc()).limit(limit)
        if project_id is not None:
            query = query.where(Event.project_id == project_id)
        return list(self._session.scalars(query))
