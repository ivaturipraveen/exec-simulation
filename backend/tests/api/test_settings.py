"""Settings screen API: facilitator access, layered values, validation, live application, review sign-off."""

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from tests.api.helpers import auth, create_session, join_all

FACILITATOR = {"email": "facilitator@example.com", "password": "fac-pass-1x"}


@pytest.fixture
def admin_client(settings: Settings):
    app = create_app(settings)
    app.state.accounts.upsert(FACILITATOR["email"], FACILITATOR["password"], "facilitator")
    with TestClient(app) as c:
        c.headers.update(_login(c))  # the signed-in facilitator; per-request tokens still override it
        yield c


def _login(c: TestClient) -> dict[str, str]:
    r = c.post("/api/auth/login", json=FACILITATOR)
    assert r.status_code == 200, r.text
    return auth(r.json()["token"])


def test_settings_open_locally_without_sign_in(client: TestClient) -> None:
    assert client.get("/api/admin/settings").status_code == 200


def test_settings_closed_in_production_without_sign_in(settings: Settings) -> None:
    s = settings.model_copy(update={"environment": "production"})
    with TestClient(create_app(s)) as c:
        assert c.get("/api/admin/settings").status_code == 403


def test_access_control(admin_client: TestClient) -> None:
    c = admin_client
    signed_in = c.headers.pop("Authorization")
    assert c.get("/api/admin/settings").status_code == 401
    c.headers["Authorization"] = signed_in
    _, ftok = create_session(c)
    assert c.get("/api/admin/settings", headers=auth(ftok)).status_code == 401  # session token ≠ sign-in
    view = c.get("/api/admin/settings").json()
    keys = {f["key"]: f for f in view["fields"]}
    assert keys["round2_base_musd"]["value"] == 8.0 and keys["anthropic_model"]["source"] == "env"
    assert view["system"]["sign_in_accounts"] == 1 and "ANTHROPIC" not in str(view["system"])
    assert {r["id"] for r in view["review"]} >= {"RC-1", "OD-01", "B-01"}


def test_update_applies_to_new_sessions_only_and_resets(admin_client: TestClient) -> None:
    c = admin_client
    h = _login(c)
    old, _ = create_session(c)
    r = c.put(
        "/api/admin/settings", json={"values": {"round2_base_musd": 5, "pitch_ai_suggest": False}}, headers=h
    )
    assert r.status_code == 200, r.text
    field = next(f for f in r.json()["fields"] if f["key"] == "round2_base_musd")
    assert field["value"] == 5 and field["source"] == "ui"
    assert c.get("/api/catalog").json()["rules"]["round2_base_musd"] == 5
    new, nf = create_session(c)
    nf_rules = {
        f["key"]: f["value"] for f in c.get(f"/api/sessions/{new['id']}/settings", headers=auth(nf)).json()
    }
    assert nf_rules["round2_base_musd"] == 5
    assert old["id"] != new["id"]
    r = c.delete("/api/admin/settings/round2_base_musd", headers=h)
    assert next(f for f in r.json()["fields"] if f["key"] == "round2_base_musd")["source"] in (
        "content",
        "env",
    )


def test_validation_errors(admin_client: TestClient) -> None:
    c = admin_client
    h = _login(c)
    assert (
        c.put("/api/admin/settings", json={"values": {"score_weights.stars": 0.5}}, headers=h).status_code
        == 422
    )
    assert (
        c.put("/api/admin/settings", json={"values": {"ai_effort": "extreme"}}, headers=h).status_code == 422
    )
    assert c.put("/api/admin/settings", json={"values": {"nudge_minutes": 0}}, headers=h).status_code == 422
    assert c.put("/api/admin/settings", json={"values": {"nope": 1}}, headers=h).status_code == 422


def test_review_sign_off(admin_client: TestClient) -> None:
    c = admin_client
    h = _login(c)
    assert (
        c.put("/api/admin/review/RC-2", json={"status": "changed", "note": ""}, headers=h).status_code == 422
    )
    r = c.put(
        "/api/admin/review/RC-2",
        json={"status": "confirmed", "note": "Checked against Technical Notes"},
        headers=h,
    )
    entry = next(e for e in r.json()["review"] if e["id"] == "RC-2")
    assert entry["status"] == "confirmed"


def test_admin_can_open_any_session(admin_client: TestClient) -> None:
    c = admin_client
    h = _login(c)
    s, _ = create_session(c)
    rows = c.get("/api/admin/sessions", headers=h).json()
    assert rows[0]["id"] == s["id"]
    tok = c.post(f"/api/admin/sessions/{s['id']}/token", headers=h).json()["token"]
    assert c.get(f"/api/sessions/{s['id']}", headers=auth(tok)).status_code == 200


def test_admin_can_delete_a_session(admin_client: TestClient) -> None:
    c = admin_client
    session, ftok = create_session(c)
    sid = session["id"]
    join_all(c, session)
    codes = [t["join_code"] for t in session["teams"]]
    admin = _login(c)
    # Only admins may delete; facilitators and unknown ids are refused.
    assert c.delete(f"/api/admin/sessions/{sid}", headers=auth(ftok)).status_code == 401
    assert c.delete("/api/admin/sessions/nope", headers=admin).status_code == 404
    assert c.delete(f"/api/admin/sessions/{sid}", headers=admin).status_code == 204
    # The session, its teams (join codes) and its listing are gone.
    assert sid not in {s["id"] for s in c.get("/api/admin/sessions", headers=admin).json()}
    assert c.get(f"/api/sessions/{sid}", headers=auth(ftok)).status_code == 404
    for code in codes:
        assert c.post("/api/join", json={"code": code}).status_code == 404


def test_sign_in_page_is_public_and_editable(admin_client: TestClient) -> None:
    c = admin_client
    h = _login(c)
    page = c.get("/api/auth/page", headers={"Authorization": ""}).json()
    assert page["layout"] == "hero-left" and page["card_title"] == "Sign in" and page["show_ticker"] is True
    r = c.put(
        "/api/admin/settings",
        json={"values": {"login_layout": "centered", "login_title": "Welcome, analysts", "login_badge": ""}},
        headers=h,
    )
    assert r.status_code == 200, r.text
    page = c.get("/api/auth/page").json()
    assert (page["layout"], page["title"], page["badge"]) == ("centered", "Welcome, analysts", "")
    # required text cannot be blank; layout must be one of the options
    assert c.put("/api/admin/settings", json={"values": {"login_title": " "}}, headers=h).status_code == 422
    assert (
        c.put("/api/admin/settings", json={"values": {"login_layout": "grid"}}, headers=h).status_code == 422
    )
