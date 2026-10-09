"""WebSocket fan-out. Messages are small invalidation hints; clients refetch over REST."""

from __future__ import annotations

import asyncio
import logging
from collections import defaultdict
from datetime import UTC, datetime
from typing import Any

from fastapi import WebSocket

log = logging.getLogger(__name__)


class RealtimeHub:
    def __init__(self) -> None:
        self._sockets: dict[str, set[WebSocket]] = defaultdict(set)
        self._loop: asyncio.AbstractEventLoop | None = None

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    def register(self, session_id: str, ws: WebSocket) -> None:
        """Add an already-accepted, authenticated socket to a session's fan-out."""
        self._sockets[session_id].add(ws)

    def disconnect(self, session_id: str, ws: WebSocket) -> None:
        self._sockets[session_id].discard(ws)

    async def _broadcast(self, session_id: str, message: dict[str, Any]) -> None:
        dead = []
        for ws in list(self._sockets.get(session_id, ())):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(session_id, ws)

    def publish(self, session_id: str, scopes: list[str]) -> None:
        """Thread-safe publish from sync request handlers."""
        message = {"type": "invalidate", "scopes": scopes, "server_time": datetime.now(UTC).isoformat()}
        if self._loop is None or not self._sockets.get(session_id):
            return
        try:
            asyncio.run_coroutine_threadsafe(self._broadcast(session_id, message), self._loop)
        except RuntimeError:
            log.debug("event loop unavailable; dropping realtime message")
