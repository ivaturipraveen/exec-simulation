import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from tests.api.helpers import create_session, join_all


def test_ws_requires_in_band_token(client: TestClient) -> None:
    session, ftok = create_session(client)
    sid = session["id"]
    with client.websocket_connect(f"/ws/sessions/{sid}") as ws:
        ws.send_json({"token": ftok})
        assert ws.receive_json() == {"type": "ready"}
    team_tok = next(iter(join_all(client, session).values()))
    with client.websocket_connect(f"/ws/sessions/{sid}") as ws:
        ws.send_json({"token": team_tok})
        assert ws.receive_json()["type"] == "ready"
    other, _ = create_session(client)
    with client.websocket_connect(f"/ws/sessions/{other['id']}") as ws:
        ws.send_json({"token": team_tok})  # team from a different session
        with pytest.raises(WebSocketDisconnect):
            ws.receive_json()
