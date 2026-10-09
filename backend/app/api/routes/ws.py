"""Realtime channel. The token is sent as the first message (never in the URL, so it is
never written to access logs or browser history)."""

import asyncio
import contextlib
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.errors import NotFound
from app.core.security import verify_token

router = APIRouter()
AUTH_TIMEOUT_S = 5


async def _reject(websocket: WebSocket) -> None:
    with contextlib.suppress(WebSocketDisconnect, RuntimeError):  # client already went away
        await websocket.close(code=4401)


@router.websocket("/ws/sessions/{session_id}")
async def session_socket(websocket: WebSocket, session_id: str) -> None:
    app = websocket.app
    await websocket.accept()
    try:
        raw = await asyncio.wait_for(websocket.receive_text(), timeout=AUTH_TIMEOUT_S)
        token = json.loads(raw).get("token", "") if raw.startswith("{") else ""
    except WebSocketDisconnect:
        return
    except (TimeoutError, json.JSONDecodeError):
        await _reject(websocket)
        return
    principal = verify_token(app.state.secret, token)
    allowed = False
    if principal is not None:
        if principal.role == "facilitator":
            allowed = principal.subject_id == session_id
        else:
            try:
                allowed = app.state.game.team_payer(principal.subject_id)[0] == session_id
            except NotFound:
                allowed = False
    if not allowed:
        await _reject(websocket)
        return
    hub = app.state.hub
    hub.register(session_id, websocket)
    await websocket.send_json({"type": "ready"})
    try:
        while True:
            await websocket.receive_text()  # keep-alive pings from the client
    except WebSocketDisconnect:
        hub.disconnect(session_id, websocket)
