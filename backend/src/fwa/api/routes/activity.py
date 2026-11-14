from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import APIRouter, Query, Request
from fastapi.responses import StreamingResponse

from fwa.api.deps import Uow
from fwa.api.schemas import EventOut
from fwa.services.events import EventBroadcaster

router = APIRouter(tags=["actividad"])

HEARTBEAT_SECONDS = 15.0


@router.get("/activity", response_model=list[EventOut])
def recent_activity(
    uow: Uow,
    limit: Annotated[int, Query(ge=1, le=200)] = 30,
    project_id: str | None = None,
) -> list[EventOut]:
    return [
        EventOut.model_validate(e) for e in uow.events.recent(limit=limit, project_id=project_id)
    ]


@router.get("/events/stream")
async def event_stream(request: Request) -> StreamingResponse:
    """Flujo SSE de eventos en vivo. Envía latidos para detectar desconexiones."""
    broadcaster: EventBroadcaster = request.app.state.broadcaster
    queue = broadcaster.subscribe()

    async def generate() -> AsyncIterator[str]:
        try:
            yield "event: ready\ndata: {}\n\n"
            while not broadcaster.closed:
                try:
                    item = await asyncio.wait_for(queue.get(), timeout=HEARTBEAT_SECONDS)
                except TimeoutError:
                    yield ": latido\n\n"
                    continue
                if item is None:
                    yield "event: closing\ndata: {}\n\n"
                    break
                yield f"event: activity\ndata: {json.dumps(item, ensure_ascii=False)}\n\n"
        finally:
            broadcaster.unsubscribe(queue)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )
