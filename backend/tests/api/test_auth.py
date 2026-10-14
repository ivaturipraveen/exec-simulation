"""Sign-in: a facilitator account and one account per team, configured in backend/.env."""

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from tests.api.helpers import auth

FAC = {"email": "test@brightcone.ai", "password": "pw-2025!x"}
HORIZON = {"email": "admin@horizonhealth.example", "password": "HH_pass-1"}
HERITAGE = {"email": "admin@heritagemedicare.example", "password": "HM_pass-1"}


def _add_accounts(app) -> None:
    store = app.state.accounts
    store.upsert(FAC["email"], FAC["password"], "facilitator")
    store.upsert(HORIZON["email"], HORIZON["password"], "team", "horizon")
    store.upsert(HERITAGE["email"], HERITAGE["password"], "team", "heritage")


@pytest.fixture
def login_client(settings: Settings):
    app = create_app(settings)
    _add_accounts(app)
    with TestClient(app) as c:
        yield c


def _sign_in(c: TestClient, who: dict[str, str]) -> dict:
    r = c.post("/api/auth/login", json=who)
    assert r.status_code == 200, r.text
    return r.json()


def _create_session(c: TestClient, h: dict[str, str]) -> dict:
    r = c.post("/api/sessions", json={"name": "Sign-in test"}, headers=h)
    assert r.status_code == 201, r.text
    return r.json()


def test_sign_in_is_skipped_when_not_configured(client: TestClient) -> None:
    assert client.get("/api/auth/status").json()["required"] is False
    assert client.post("/api/auth/login", json=FAC).status_code == 403


def test_facilitator_sign_in(login_client: TestClient) -> None:
    c = login_client
    assert c.get("/api/auth/status").json()["signed_in"] is False
    assert c.post("/api/auth/login", json={**FAC, "password": "nope"}).status_code == 403
    me = _sign_in(c, {"email": " Test@Brightcone.ai ", "password": FAC["password"]})
    assert me["role"] == "facilitator" and me["payer_id"] is None
    status = c.get("/api/auth/status", headers=auth(me["token"])).json()
    assert status["signed_in"] is True and status["role"] == "facilitator"
    assert c.get("/api/admin/settings", headers=auth(me["token"])).status_code == 200  # no extra password


def test_team_sign_in_then_its_own_join_code_opens_the_session(login_client: TestClient) -> None:
    c = login_client
    fac = auth(_sign_in(c, FAC)["token"])
    team = _sign_in(c, HORIZON)
    assert team["role"] == "team" and team["payer_id"] == "horizon" and team["payer_name"] == "Horizon Health"
    created = _create_session(c, fac)
    code = next(t["join_code"] for t in created["session"]["teams"] if t["payer_id"] == "horizon")
    joined = c.post("/api/join", json={"code": code}, headers=auth(team["token"]))
    assert joined.status_code == 200 and joined.json()["payer_name"] == "Horizon Health"
    assert c.get("/api/team", headers=auth(joined.json()["token"])).status_code == 200
    assert c.post("/api/join", json={"code": "ZZZZZZ"}, headers=auth(team["token"])).status_code == 404


def test_team_accounts_cannot_facilitate_or_join_other_teams(login_client: TestClient) -> None:
    c = login_client
    fac = auth(_sign_in(c, FAC)["token"])
    th = auth(_sign_in(c, HORIZON)["token"])
    created = _create_session(c, fac)
    codes = {t["payer_id"]: t["join_code"] for t in created["session"]["teams"]}
    assert c.post("/api/sessions", json={"name": "x"}, headers=th).status_code == 403
    assert c.get("/api/admin/settings", headers=th).status_code == 403
    wrong = c.post("/api/join", json={"code": codes["heritage"]}, headers=th)
    assert wrong.status_code == 403 and "your own team" in wrong.json()["error"]["message"]
    assert c.post("/api/join", json={"code": codes["horizon"]}, headers=th).status_code == 200
    assert c.post("/api/join", json={"code": codes["horizon"]}).status_code == 401  # signed out
    assert c.post("/api/join", json={"code": codes["heritage"]}, headers=fac).status_code == 200  # any team


def test_changing_a_password_signs_that_account_out(login_client: TestClient) -> None:
    token = _sign_in(login_client, FAC)["token"]
    login_client.app.state.accounts.upsert(FAC["email"], "a-new-password", "facilitator")
    assert login_client.get("/api/auth/status", headers=auth(token)).json()["signed_in"] is False
    assert login_client.post("/api/auth/login", json={**FAC, "password": "a-new-password"}).status_code == 200


def test_passwords_are_stored_only_as_hashes(login_client: TestClient) -> None:
    from sqlmodel import Session, select

    from app.db import Account

    with Session(login_client.app.state.game.engine) as db:
        rows = db.exec(select(Account)).all()
    assert len(rows) == 3
    for row in rows:
        assert row.password_hash.startswith("scrypt$")
        assert FAC["password"] not in row.password_hash and HORIZON["password"] not in row.password_hash


def test_repeated_failures_are_rate_limited(login_client: TestClient) -> None:
    for _ in range(5):
        login_client.post("/api/auth/login", json={"email": "x@y.z", "password": "bad"})
    assert login_client.post("/api/auth/login", json=FAC).status_code == 429


def test_account_rules(settings: Settings) -> None:
    store = create_app(settings).state.accounts
    with pytest.raises(ValueError):
        store.upsert("a@b.example", "short", "facilitator")
    with pytest.raises(ValueError):
        store.upsert("a@b.example", "long-enough", "team")  # a team needs a payer
    assert store.remove("nobody@b.example") is False
