from fastapi.testclient import TestClient


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def create_session(client: TestClient, **body) -> tuple[dict, str]:
    r = client.post("/api/sessions", json={"name": "Pilot", **body})
    assert r.status_code == 201, r.text
    data = r.json()
    return data["session"], data["facilitator_token"]


def join_all(client: TestClient, session: dict) -> dict[str, str]:
    tokens = {}
    for t in session["teams"]:
        r = client.post("/api/join", json={"code": t["join_code"]})
        assert r.status_code == 200, r.text
        tokens[t["payer_id"]] = r.json()["token"]
    return tokens


def stage(client: TestClient, sid: str, ftok: str, action: str, index: int | None = None) -> dict:
    r = client.post(f"/api/sessions/{sid}/stage", json={"action": action, "index": index}, headers=auth(ftok))
    assert r.status_code == 200, r.text
    return r.json()


def goto_kind(client: TestClient, session: dict, ftok: str, kind: str) -> dict:
    idx = next(i for i, s in enumerate(session["stages"]) if s["kind"] == kind)
    return stage(client, session["id"], ftok, "goto", idx)
