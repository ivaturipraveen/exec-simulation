"""Settings screen API: admin login, layered values, validation, live application, review sign-off."""

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from tests.api.helpers import auth, create_session


@pytest.fixture
def admin_client(settings: Settings):
    s = settings.model_copy(update={"admin_password": "s3cret-pass"})
    s.admin_password = __import__("pydantic").SecretStr("s3cret-pass")
    with TestClient(create_app(s)) as c:
        yield c


def _login(c: TestClient) -> dict[str, str]:
    r = c.post("/api/admin/login", json={"password": "s3cret-pass"})
    assert r.status_code == 200, r.text
    return auth(r.json()["token"])


def test_settings_disabled_without_admin_password(client: TestClient) -> None:
    assert client.get("/api/admin/status").json() == {"enabled": False}
    assert client.post("/api/admin/login", json={"password": "x"}).status_code == 403


def test_login_and_access_control(admin_client: TestClient) -> None:
    c = admin_client
    assert c.post("/api/admin/login", json={"password": "wrong"}).status_code == 403
    assert c.get("/api/admin/settings").status_code == 401
    _, ftok = create_session(c)
    assert c.get("/api/admin/settings", headers=auth(ftok)).status_code == 403  # facilitator ≠ admin
    view = c.get("/api/admin/settings", headers=_login(c)).json()
    keys = {f["key"]: f for f in view["fields"]}
    assert keys["round2_base_musd"]["value"] == 8.0 and keys["anthropic_model"]["source"] == "env"
    assert view["system"]["admin_password_set"] is True and "ANTHROPIC" not in str(view["system"])
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
