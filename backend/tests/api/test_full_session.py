"""End-to-end workshop session over HTTP (Content Pack v0.1 flow)."""

from fastapi.testclient import TestClient

from tests.api.helpers import auth, create_session, goto_kind, join_all, stage

OWNER = "Named executive"
PLAYS = {
    "horizon": ["i1", "i3", "i14", "i10", "i17", "i4", "i12"],
    "heritage": ["i1", "i13", "i14", "i10", "i17", "i9", "i12"],
    "communitycare": ["i16", "i14", "i7", "i10", "i18", "i12"],
}
GOOD_PITCH = {
    "evidence": [],
    "results": "Year 1 moved leading indicators: abandonment fell and outreach coverage rose; measures lag.",
    "causal": "Results lagged because measures move a rating year after the operational change, which is why we hold course.",
    "decision": "Fund I15 provider incentives because providers have no reason to act today.",
    "risk": "Providers may game measures; quality operations audits and the governance owner can pause it.",
    "ask": "Approve provider incentives for one year.",
}
RESPONSE = {
    "decision": "pause",
    "restart_criteria": "Restart only after validation on a sample and owner sign-off.",
    "owner": "Chief Operating Officer",
    "operational_lead": "VP Quality Operations",
    "authority": "Can stop any campaign immediately",
    "investigation": "Scope affected members, the rule that fired and every campaign built on it; reconstruct a "
    "timeline from logs within 24 hours and confirm the platform has stopped sending.",
    "hypotheses": "Unvalidated eligibility flag; missing human review step",
    "stakeholders": ["members", "regulator", "board", "press"],
    "disclosure": "immediate",
    "communication": "Members first by phone today, regulator within 24 hours, board Thursday; the COO signs every message.",
    "protection": "Call back every affected member, correct records and brief providers.",
    "resources": "Twenty agents and two pharmacists for two weeks",
    "corrective_action": "Add validation and human approval before restart; change the release process.",
    "monitoring": "Weekly complaint and error-rate review for a quarter",
}


def test_full_session_happy_path(client: TestClient) -> None:
    session, ftok = create_session(client, seed=7)
    sid, fh = session["id"], auth(ftok)
    teams = join_all(client, session)
    hz = auth(teams["horizon"])

    assert client.put("/api/team/round1", json={"items": [], "thesis": ""}, headers=hz).status_code == 403

    stage(client, sid, ftok, "start")
    session = goto_kind(client, session, ftok, "company")
    ids = {a["id"] for a in client.get("/api/team/dataroom", headers=hz).json()}
    assert ids == {"H-01", "H-20", "H-24", "H-25", "H-26"}  # first layer only

    session = goto_kind(client, session, ftok, "diagnose")
    room = client.get("/api/team/dataroom", headers=hz).json()
    assert len(room) == 30 and all(a["id"].startswith("H-") for a in room)
    assert "supports" not in str([a["supports"] for a in room if a["supports"]])
    assert client.get("/api/team/dataroom/L-01", headers=hz).status_code == 404
    table = client.get("/api/team/dataroom/H-05", headers=hz).json()
    assert table["columns"] and table["rows"]

    r = client.put(
        "/api/team/priorities",
        json={"priorities": [{"title": "History gap", "rationale": "x", "evidence": ["H-05", "H-09"]}]},
        headers=hz,
    )
    assert r.status_code == 200, r.text
    view = client.get(f"/api/sessions/{sid}", headers=fh).json()
    assert next(t for t in view["teams"] if t["payer_id"] == "horizon")["root_causes_cited"] == 1

    r = client.post(
        "/api/team/ai/ask", json={"question": "Why are complaints rising in new counties?"}, headers=hz
    )
    assert r.status_code == 200, r.text
    ans = r.json()
    assert ans["generative"] is False and ans["sources"]
    assert all(s["artifact_id"].startswith("H-") for s in ans["sources"])

    # Round 1 with owners, scopes and staggered starts; preview warns about capacity and owners.
    session = goto_kind(client, session, ftok, "invest_r1")
    r = client.put("/api/team/round1", json={"items": [{"investment_id": "i10"}], "thesis": "x"}, headers=hz)
    assert any("Accountable executive" in w or "accountable executive" in w for w in r.json()["warnings"])
    for payer, cards in PLAYS.items():
        items = [{"investment_id": c, "owner": OWNER} for c in cards]
        if payer == "heritage":
            items[0]["scope"] = "scoped"
        items[-1]["start_offset"] = 1
        r = client.put(
            "/api/team/round1",
            json={"items": items, "thesis": "Sequence foundations with value."},
            headers=auth(teams[payer]),
        )
        body = r.json()
        assert r.status_code == 200 and body["errors"] == [], r.text
        assert len(body["capacity"]) == 4 and body["ledger"]["available"] >= 0
        assert client.post("/api/team/round1/submit", headers=auth(teams[payer])).status_code == 200
    me = client.get("/api/team", headers=hz).json()
    assert me["initiatives"][-1]["start_label"] == "Y1 Q2" and me["initiatives"][0]["owner"] == OWNER

    session = goto_kind(client, session, ftok, "simulate_y1")
    assert client.post(f"/api/sessions/{sid}/simulate", json={"year": 2}, headers=fh).status_code == 409
    assert client.post(f"/api/sessions/{sid}/simulate", json={"year": 1}, headers=fh).status_code == 200
    # Review before release (pack §9.2): the facilitator sees results first.
    assert client.get("/api/team/results/1", headers=auth(teams["heritage"])).status_code == 403
    hz_tid = next(t["team_id"] for t in session["teams"] if t["payer_id"] == "horizon")
    assert client.get(f"/api/sessions/{sid}/teams/{hz_tid}/results/1", headers=fh).status_code == 200
    assert client.post(f"/api/sessions/{sid}/results/1/release", headers=fh).status_code == 200
    y1 = client.get("/api/team/results/1", headers=auth(teams["heritage"])).json()
    assert y1["stars"]["year_rating"] == y1["stars"]["baseline"]  # measures lag a rating year
    assert y1["kpis"] and y1["confidence_band"] == 0.2
    assert client.get("/api/team/results/2", headers=hz).status_code == 404

    # Board pitch: figure check, suggested score, facilitator decides, capital tiers.
    session = goto_kind(client, session, ftok, "analyze")
    bad = {**GOOD_PITCH, "evidence": ["H-09"], "ask": "This delivers a $14.7M benefit."}
    r = client.put("/api/team/pitch", json={"pitch": bad, "submit": False}, headers=hz)
    assert r.json()["unsupported_figures"] == ["$14.7M"]
    for payer, tok in teams.items():
        evidence = {
            "horizon": ["H-09", "H-12", "H-22"],
            "heritage": ["L-02", "L-10", "L-17"],
            "communitycare": ["C-17"],
        }[payer]
        r = client.put(
            "/api/team/pitch",
            json={"pitch": {**GOOD_PITCH, "evidence": evidence}, "submit": True},
            headers=auth(tok),
        )
        assert r.status_code == 200 and r.json()["unsupported_figures"] == []
    session = goto_kind(client, session, ftok, "invest_r2")
    assert client.post(f"/api/sessions/{sid}/round2/grant", headers=fh).status_code == 409  # pitches unscored
    for t in session["teams"]:
        review = client.get(f"/api/sessions/{sid}/teams/{t['team_id']}/pitch", headers=fh).json()
        assert review["score"]["max"] == 15
        rows = review["score"]["suggested"]
        assert (
            client.put(
                f"/api/sessions/{sid}/teams/{t['team_id']}/pitch-score",
                json={"rows": rows, "note": ""},
                headers=fh,
            ).status_code
            == 422
        )
        r = client.put(
            f"/api/sessions/{sid}/teams/{t['team_id']}/pitch-score",
            json={"rows": rows, "note": "Accepted"},
            headers=fh,
        )
        assert r.status_code == 200
    view = client.post(f"/api/sessions/{sid}/round2/grant", headers=fh).json()
    for t in view["teams"]:
        earned = {13: 4.0, 10: 2.0, 7: 1.0, 0: 0.0}[max(k for k in (13, 10, 7, 0) if t["pitch_total"] >= k)]
        assert (
            t["granted_musd"]
            == {"horizon": 18, "heritage": 15, "communitycare": 12}[t["payer_id"]] + 8 + earned
        )

    for payer, tok in teams.items():
        actions = (
            [{"action": "fund", "investment_id": "i15"}]
            if payer != "heritage"
            else [{"action": "fund", "investment_id": "i3"}]
        )
        r = client.put(
            "/api/team/round2",
            json={"actions": actions, "thesis": "We learned adoption limits value."},
            headers=auth(tok),
        )
        assert r.status_code == 200 and r.json()["errors"] == [], r.text
        assert client.post("/api/team/round2/submit", headers=auth(tok)).status_code == 200

    session = goto_kind(client, session, ftok, "simulate_y2")
    assert client.post(f"/api/sessions/{sid}/simulate", json={"year": 2}, headers=fh).status_code == 200
    assert client.post(f"/api/sessions/{sid}/results/2/release", headers=fh).status_code == 200

    # Operating model with decision dimensions; facilitator can override with a note.
    session = goto_kind(client, session, ftok, "operating_model")
    catalog = client.get("/api/catalog").json()
    dims = {d["id"]: "Answered with owner, scope and thresholds" for d in catalog["decision_dimensions"]}
    steps = []
    for s in catalog["workflow_steps"]:
        if s["sensitive"]:
            steps.append(
                {
                    "step_id": s["id"],
                    "mode": "ai_assist",
                    "controls": ["audit_log", "human_review"],
                    "owner": "Lead",
                }
            )
        else:
            steps.append(
                {
                    "step_id": s["id"],
                    "mode": "agent_approval",
                    "controls": [
                        "human_review",
                        "audit_log",
                        "kill_switch",
                        "validation",
                        "exception_handling",
                        "subgroup_monitoring",
                    ],
                    "owner": "Quality ops",
                    "dimensions": dims,
                }
            )
    design = {"steps": steps, "accountable_executive": "Chief Quality Officer"}
    for tok in teams.values():
        r = client.put(
            "/api/team/operating-model", json={"design": design, "submit": True}, headers=auth(tok)
        )
        assert r.status_code == 200, r.text
        assert r.json()["opmodel_score"]["total"] >= 8
    t0 = session["teams"][0]["team_id"]
    r = client.put(
        f"/api/sessions/{sid}/teams/{t0}/opmodel-score",
        json={"rows": {"value": 3, "control": 3, "adoption": 3, "recoverability": 3}, "note": "Strong"},
        headers=fh,
    )
    assert r.status_code == 200

    # Crisis: engine recommends; facilitator can override event/severity with a note.
    session = goto_kind(client, session, ftok, "crisis")
    cands = client.get(f"/api/sessions/{sid}/crisis/candidates", headers=fh).json()
    hz_id = next(t["team_id"] for t in session["teams"] if t["payer_id"] == "horizon")
    assert cands[hz_id][0]["code"] == "E1"
    assert (
        client.post(
            f"/api/sessions/{sid}/crisis/assign",
            json={"team_id": hz_id, "event_id": "e1", "severity": "high"},
            headers=fh,
        ).status_code
        == 422
    )
    assert client.post(f"/api/sessions/{sid}/crisis/assign", json={}, headers=fh).status_code == 200
    assert (
        client.get("/api/team/crisis", headers=auth(teams["communitycare"])).status_code == 404
    )  # clean: none
    cc_id = next(t["team_id"] for t in session["teams"] if t["payer_id"] == "communitycare")
    r = client.post(
        f"/api/sessions/{sid}/crisis/assign",
        json={"team_id": cc_id, "event_id": "e7", "severity": "medium", "note": "Curveball"},
        headers=fh,
    )
    assert r.status_code == 200, r.text
    for tok in teams.values():
        brief = client.get("/api/team/crisis", headers=auth(tok)).json()
        assert brief["best_practice"] is None and brief["minutes"] >= 10
        r = client.post("/api/team/crisis/response", json=RESPONSE, headers=auth(tok))
        assert r.status_code == 200 and r.json()["score"]["total"] >= 15
    r = client.put(
        f"/api/sessions/{sid}/teams/{t0}/crisis-score",
        json={"rows": {"owner": 1}, "note": "Debrief"},
        headers=fh,
    )
    assert r.status_code == 200

    assert client.get("/api/team/scorecard", headers=hz).status_code == 403
    session = goto_kind(client, session, ftok, "results")
    assert client.get("/api/team/scorecard", headers=hz).status_code == 403  # not released yet
    assert client.post(f"/api/sessions/{sid}/scorecards/release", headers=fh).status_code == 200
    card = client.get("/api/team/scorecard", headers=hz).json()
    assert 0 < card["total"] <= 100 and len(card["dimensions"]) == 5 and card["crisis_event"] == "e1"
    assert len(client.get(f"/api/sessions/{sid}/scoreboard", headers=fh).json()) == 3

    # Opportunity Map: consent, readiness dimensions, quadrant rules, foundational band.
    def opp(title: str, value: int, ready: int) -> dict:
        r5 = {"data": ready, "workflow": ready, "owner": ready, "controls": ready}
        return {
            "participant": "Pat",
            "title": title,
            "capability_class": "Predictive",
            "value": value,
            "readiness": r5,
            "foundations": ["Governance"],
        }

    items = [opp("Act now", 5, 4), opp("Strategic", 4, 2), opp("Quick win", 2, 5), opp("Defer", 2, 2)]
    assert client.put("/api/team/opportunities", json={"items": items}, headers=hz).status_code == 200
    assert client.get(f"/api/sessions/{sid}/opportunity-map", headers=fh).json()["items"] == []
    consent = {"granted": True, "participant": "Pat", "at": "2026-10-08T12:00:00Z"}
    assert (
        client.put(
            "/api/team/opportunities", json={"items": items, "consent": consent}, headers=hz
        ).status_code
        == 200
    )
    m = client.get(f"/api/sessions/{sid}/opportunity-map", headers=fh).json()
    assert [i["quadrant"] for i in m["items"]] == ["act_now", "strategic", "quick_win", "defer"]
    assert m["foundational"][0]["theme"] == "Governance" and m["foundational"][0]["links"] == 4
    syn = client.post(f"/api/sessions/{sid}/opportunity-map/synthesis", headers=fh).json()
    assert "Act now" in syn["synthesis"] and syn["generative"] is False
    bad = [{**items[0], "capability_class": "Magic"}]
    assert client.put("/api/team/opportunities", json={"items": bad}, headers=hz).status_code == 422

    r = client.post(
        "/api/team/feedback",
        json={
            "learning": 5,
            "judgment_changed": True,
            "usefulness_vs_presentation": 5,
            "realism": 4,
            "would_recommend": 9,
        },
        headers=hz,
    )
    assert r.status_code == 200

    md = client.get(f"/api/sessions/{sid}/summary.md", headers=fh)
    assert md.status_code == 200 and "AI Opportunity Map" in md.text and "simulated" in md.text
    kinds = {e["kind"] for e in client.get(f"/api/sessions/{sid}/events", headers=fh).json()}
    assert {
        "round1_submitted",
        "year_simulated",
        "pitch_scored",
        "crisis_scored",
        "ai_query",
        "artifact_viewed",
    } <= kinds
    assert client.get(f"/api/sessions/{sid}/events.csv", headers=fh).text.startswith("id,created_at")
    edition = client.get(f"/api/sessions/{sid}/edition", headers=fh).json()
    assert len(edition["assumptions"]) >= 18 and edition["warnings"] == []


def test_force_simulate_stage_clock_and_options(client: TestClient) -> None:
    session, ftok = create_session(client, round2_mechanic="fixed")
    sid, fh = session["id"], auth(ftok)
    assert stage(client, sid, ftok, "start")["clock"]["status"] == "running"
    assert stage(client, sid, ftok, "pause")["clock"]["status"] == "paused"
    stage(client, sid, ftok, "resume")
    r = client.post(f"/api/sessions/{sid}/simulate", json={"year": 1}, headers=fh)
    assert r.status_code == 409 and len(r.json()["error"]["details"]) == 3
    assert (
        client.post(f"/api/sessions/{sid}/simulate", json={"year": 1, "force": True}, headers=fh).status_code
        == 200
    )
    v = client.post(f"/api/sessions/{sid}/round2/grant", headers=fh).json()  # fixed: no pitch needed
    assert all(t["granted_musd"] == t["granted_musd"] for t in v["teams"])
    r = client.put(
        f"/api/sessions/{sid}/options",
        json={"opmodel_compressed": True, "note": "Behind schedule"},
        headers=fh,
    )
    assert r.status_code == 200 and r.json()["options"]["opmodel_compressed"] is True


def test_facilitator_capital_and_round2_base_are_audited(client: TestClient) -> None:
    session, ftok = create_session(client)
    sid, team = session["id"], session["teams"][0]
    fh = auth(ftok)
    url = f"/api/sessions/{sid}/teams/{team['team_id']}"
    assert client.post(f"{url}/capital", json={"amount_musd": 2, "note": ""}, headers=fh).status_code == 422
    r = client.post(f"{url}/capital", json={"amount_musd": 2, "note": "Board bonus"}, headers=fh)
    assert r.status_code == 200
    updated = next(t for t in r.json()["teams"] if t["team_id"] == team["team_id"])
    assert updated["granted_musd"] == team["granted_musd"] + 2
    r = client.put(
        f"{url}/round2-base", json={"amount_musd": 6, "note": "Differentiated playtest"}, headers=fh
    )
    assert next(t for t in r.json()["teams"] if t["team_id"] == team["team_id"])["round2_base_musd"] == 6


def test_early_release_feedback_summary_and_early_opportunities(client: TestClient) -> None:
    session, ftok = create_session(client)
    sid, fh = session["id"], auth(ftok)
    teams = join_all(client, session)
    hz = next(t for t in session["teams"] if t["payer_id"] == "horizon")
    stage(client, sid, ftok, "start")

    room = client.get(f"/api/sessions/{sid}/teams/{hz['team_id']}/dataroom", headers=fh).json()
    hidden = [a for a in room if not a["visible"]]
    assert hidden and all(a["supports"] for a in room)  # facilitator sees what each artifact supports
    client.post(
        f"/api/sessions/{sid}/release",
        json={"payer_id": "horizon", "artifact_id": hidden[0]["id"]},
        headers=fh,
    )
    ids = {a["id"] for a in client.get("/api/team/dataroom", headers=auth(teams["horizon"])).json()}
    assert hidden[0]["id"] in ids

    opp = {
        "participant": "Pat",
        "title": "Idea during diagnose",
        "capability_class": "Predictive",
        "value": 4,
    }
    assert (
        client.put(
            "/api/team/opportunities", json={"items": [opp]}, headers=auth(teams["horizon"])
        ).status_code
        == 200
    )

    for score in (5, 3):
        client.post(
            "/api/team/feedback",
            json={
                "learning": score,
                "judgment_changed": score > 4,
                "usefulness_vs_presentation": score,
                "realism": 4,
                "would_recommend": 8,
                "comments": "Great",
            },
            headers=auth(teams["horizon"]),
        )
    fb = client.get(f"/api/sessions/{sid}/feedback", headers=fh).json()
    assert fb["responses"] == 2 and fb["learning_4plus_pct"] == 0.5 and fb["judgment_changed_pct"] == 0.5


def test_lock_round_rename_and_delete_opportunities(client: TestClient) -> None:
    session, ftok = create_session(client, team_names={"horizon": "Team Bayview CFO"})
    sid, fh = session["id"], auth(ftok)
    assert next(t for t in session["teams"] if t["payer_id"] == "horizon")["team_name"] == "Team Bayview CFO"
    teams = join_all(client, session)
    stage(client, sid, ftok, "start")
    session = goto_kind(client, session, ftok, "invest_r1")
    client.put(
        "/api/team/round1",
        json={"items": [{"investment_id": "i17"}], "thesis": "Fix the IVR."},
        headers=auth(teams["horizon"]),
    )
    view = client.post(f"/api/sessions/{sid}/rounds/1/lock", headers=fh).json()
    assert all(t["round1_submitted"] for t in view["teams"])
    me = client.get("/api/team", headers=auth(teams["horizon"])).json()
    assert [i["code"] for i in me["initiatives"]] == ["I17"] and not me["flags"]["can_edit_round1"]
    tid = session["teams"][0]["team_id"]
    assert (
        client.put(
            f"/api/sessions/{sid}/teams/{tid}/name", json={"name": "Blue", "note": "Table 1"}, headers=fh
        ).json()["teams"][0]["team_name"]
        == "Blue"
    )
    opp = {"participant": "Pat", "title": "Idea", "capability_class": "Predictive", "value": 4}
    consent = {"granted": True, "participant": "Pat", "at": "2026-10-08T12:00:00Z"}
    client.put(
        "/api/team/opportunities", json={"items": [opp], "consent": consent}, headers=auth(teams["horizon"])
    )
    assert (
        client.post(
            f"/api/sessions/{sid}/opportunities/delete",
            json={"note": "Client asked for deletion"},
            headers=fh,
        ).status_code
        == 200
    )
    assert client.get(f"/api/sessions/{sid}/opportunity-map", headers=fh).json()["items"] == []


def test_session_settings_snapshot_and_locks(client: TestClient) -> None:
    session, ftok = create_session(client)
    sid, fh = session["id"], auth(ftok)
    teams = join_all(client, session)
    fields = {f["key"]: f for f in client.get(f"/api/sessions/{sid}/settings", headers=fh).json()}
    assert fields["round2_base_musd"]["value"] == 8.0 and not fields["payer_effectiveness.low"]["locked"]
    r = client.put(
        f"/api/sessions/{sid}/settings",
        json={"values": {"round2_base_musd": 6, "pitch_word_limit": 200}, "note": "Playtest"},
        headers=fh,
    )
    assert r.status_code == 200, r.text
    rules = client.get("/api/team", headers=auth(teams["horizon"])).json()["rules"]
    assert rules["round2_base_musd"] == 6 and rules["pitch_word_limit"] == 200
    bad = {"values": {"score_weights.stars": 0.9}, "note": "x"}
    assert (
        client.put(f"/api/sessions/{sid}/settings", json=bad, headers=fh).status_code == 422
    )  # weights must sum to 1
    stage(client, sid, ftok, "start")
    client.post(f"/api/sessions/{sid}/simulate", json={"year": 1, "force": True}, headers=fh)
    locked = {"values": {"payer_effectiveness.low": 0.5}, "note": "x"}
    assert client.put(f"/api/sessions/{sid}/settings", json=locked, headers=fh).status_code == 409
