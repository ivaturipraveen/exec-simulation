"""Opportunity map: teammates add and delete their own items without overwriting each other,
consent is per participant, and the facilitator map shows exactly the consented items."""

from fastapi.testclient import TestClient

from tests.api.helpers import auth, create_session, stage


def _setup(client: TestClient):
    session, ftok = create_session(client)
    stage(client, session["id"], ftok, "start")
    code = session["teams"][0]["join_code"]
    ta = auth(client.post("/api/join", json={"code": code}).json()["token"])
    tb = auth(client.post("/api/join", json={"code": code}).json()["token"])
    return session["id"], auth(ftok), ta, tb


def _item(who: str, title: str, **extra) -> dict:
    return {"participant": who, "title": title, "capability_class": "Predictive", "value": 4, **extra}


def _consent(who: str, granted: bool) -> dict:
    return {"granted": granted, "participant": who, "at": "2026-10-15T10:00:00Z"}


def _map(client: TestClient, sid: str, fh: dict) -> dict:
    return client.get(f"/api/sessions/{sid}/opportunity-map", headers=fh).json()


def test_teammates_do_not_overwrite_each_other(client: TestClient) -> None:
    _sid, _fh, ta, tb = _setup(client)
    assert (
        client.post("/api/team/opportunities/items", json=_item("Asha", "A1"), headers=ta).status_code == 200
    )
    assert (
        client.post("/api/team/opportunities/items", json=_item("Ben", "B1"), headers=tb).status_code == 200
    )
    titles = [o["title"] for o in client.get("/api/team", headers=ta).json()["workspace"]["opportunities"]]
    assert titles == ["A1", "B1"]


def test_consent_is_per_person_and_drives_the_facilitator_map(client: TestClient) -> None:
    sid, fh, ta, tb = _setup(client)
    client.post("/api/team/opportunities/items", json=_item("Asha", "A1"), headers=ta)
    client.post("/api/team/opportunities/items", json=_item("Ben", "B1"), headers=tb)
    m = _map(client, sid, fh)
    assert m["items"] == [] and m["awaiting_consent"] == 2

    assert (
        client.put("/api/team/opportunities/consent", json=_consent("Asha", True), headers=ta).status_code
        == 200
    )
    m = _map(client, sid, fh)
    assert [i["title"] for i in m["items"]] == ["A1"] and m["awaiting_consent"] == 1

    # Ben adding another item does not touch Asha's consent; names match loosely.
    client.post("/api/team/opportunities/items", json=_item("Ben", "B2"), headers=tb)
    client.put("/api/team/opportunities/consent", json=_consent("  ben ", True), headers=tb)
    assert sorted(i["title"] for i in _map(client, sid, fh)["items"]) == ["A1", "B1", "B2"]

    client.put("/api/team/opportunities/consent", json=_consent("Asha", False), headers=ta)
    assert sorted(i["title"] for i in _map(client, sid, fh)["items"]) == ["B1", "B2"]


def test_update_delete_and_validation(client: TestClient) -> None:
    _sid, _fh, ta, tb = _setup(client)
    saved = client.post("/api/team/opportunities/items", json=_item("Asha", "First"), headers=ta).json()
    oid = saved["opportunities"][0]["id"]
    client.post("/api/team/opportunities/items", json=_item("Asha", "Renamed", id=oid, value=5), headers=ta)
    ops = client.get("/api/team", headers=ta).json()["workspace"]["opportunities"]
    assert len(ops) == 1 and ops[0]["title"] == "Renamed" and ops[0]["value"] == 5

    assert client.delete(f"/api/team/opportunities/items/{oid}", headers=tb).status_code == 200
    assert client.get("/api/team", headers=ta).json()["workspace"]["opportunities"] == []
    assert client.delete(f"/api/team/opportunities/items/{oid}", headers=tb).status_code == 404

    bad = _item("Asha", "X", capability_class="Magic")
    assert client.post("/api/team/opportunities/items", json=bad, headers=ta).status_code == 422
    assert client.post("/api/team/opportunities/items", json=_item("  ", "X"), headers=ta).status_code == 422
    assert (
        client.put("/api/team/opportunities/consent", json=_consent("", True), headers=ta).status_code == 422
    )


def test_facilitator_delete_clears_items_and_consent(client: TestClient) -> None:
    sid, fh, ta, _ = _setup(client)
    client.post("/api/team/opportunities/items", json=_item("Asha", "A1"), headers=ta)
    client.put("/api/team/opportunities/consent", json=_consent("Asha", True), headers=ta)
    r = client.post(f"/api/sessions/{sid}/opportunities/delete", json={"note": "Org request"}, headers=fh)
    assert r.status_code == 200
    ws = client.get("/api/team", headers=ta).json()["workspace"]
    assert ws["opportunities"] == [] and ws["consents"] == {}
    assert _map(client, sid, fh)["items"] == []


def test_synthesis_is_saved_shared_with_teams_flagged_stale_and_exported(client: TestClient) -> None:
    sid, fh, ta, _ = _setup(client)
    assert client.get("/api/team/organization-map", headers=ta).json() is None
    client.post("/api/team/opportunities/items", json=_item("Asha", "A1"), headers=ta)
    client.put("/api/team/opportunities/consent", json=_consent("Asha", True), headers=ta)

    made = client.post(f"/api/sessions/{sid}/opportunity-map/synthesis", headers=fh).json()
    assert "A1" in made["text"] and made["items"] == 1 and made["stale"] is False

    # Saved: the console, the team page and the export all read the same text.
    assert _map(client, sid, fh)["synthesis"]["text"] == made["text"]
    assert client.get("/api/team/organization-map", headers=ta).json()["text"] == made["text"]
    assert "Organizational synthesis" in client.get(f"/api/sessions/{sid}/summary.md", headers=fh).text
    assert "synthesis" not in client.get(f"/api/sessions/{sid}", headers=fh).json()["options"]

    # A new shared opportunity marks it stale until it is regenerated.
    client.post("/api/team/opportunities/items", json=_item("Asha", "A2"), headers=ta)
    assert _map(client, sid, fh)["synthesis"]["stale"] is True
    again = client.post(f"/api/sessions/{sid}/opportunity-map/synthesis", headers=fh).json()
    assert again["items"] == 2 and again["stale"] is False

    client.post(f"/api/sessions/{sid}/opportunities/delete", json={"note": "Org request"}, headers=fh)
    assert _map(client, sid, fh)["synthesis"] is None
    assert client.get("/api/team/organization-map", headers=ta).json() is None
