from fastapi.testclient import TestClient

from tests.api.helpers import auth, create_session, join_all


def test_catalog_hides_hidden_mechanics(client: TestClient) -> None:
    r = client.get("/api/catalog")
    assert r.status_code == 200
    body = r.json()
    assert len(body["investments"]) == 18 and len(body["measures"]) == 10
    assert body["rules"]["round2_mechanic"] == "hybrid" and body["rules"]["round2_base_musd"] == 8.0
    raw = r.text
    for secret in (
        "hidden_root_causes",
        "severity_rules",
        "value_by_mode",
        "side_effects",
        "rating_adjustment",
        '"rules":[{"when"',
    ):
        assert secret not in raw


def test_errors_use_envelope_and_request_id(client: TestClient) -> None:
    r = client.get("/api/team")
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "unauthorized"
    assert r.headers.get("X-Request-ID")
    r = client.post("/api/sessions", json={"name": ""})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "validation_error"
    assert client.get("/api/does-not-exist").json()["error"]["code"] == "not_found"


def test_tokens_are_scoped(client: TestClient) -> None:
    s1, f1 = create_session(client)
    _s2, f2 = create_session(client)
    assert client.get(f"/api/sessions/{s1['id']}", headers=auth(f2)).status_code == 403
    tokens = join_all(client, s1)
    team_token = next(iter(tokens.values()))
    assert client.get(f"/api/sessions/{s1['id']}", headers=auth(team_token)).status_code == 403
    assert client.get("/api/team", headers=auth(f1)).status_code == 403
    assert client.get("/api/team", headers=auth(team_token + "x")).status_code == 401


def test_bad_join_code(client: TestClient) -> None:
    assert client.post("/api/join", json={"code": "ZZZZZZ"}).status_code == 404


def test_team_view_hides_answer_key(client: TestClient) -> None:
    s, _ = create_session(client)
    tokens = join_all(client, s)
    r = client.get("/api/team", headers=auth(tokens["horizon"]))
    assert r.status_code == 200
    assert "H-RC1" not in r.text and "Automate everything" not in r.text
    body = r.json()
    assert body["payer"]["name"] == "Horizon Health" and body["payer"]["bonus_value_musd"] == 31.4


def test_env_overrides_game_config(settings, tmp_path) -> None:
    from app.main import create_app

    s = settings.model_copy(
        update={"round2_base_musd": 6.0, "sim_mode": "variable", "include_translation": False}
    )
    with TestClient(create_app(s)) as c:
        rules = c.get("/api/catalog").json()["rules"]
        assert rules["round2_base_musd"] == 6.0 and rules["sim_mode"] == "variable"
        session, _ = create_session(c)
        assert session["sim_mode"] == "variable"
        assert session["stages"][-1]["kind"] == "debrief"
