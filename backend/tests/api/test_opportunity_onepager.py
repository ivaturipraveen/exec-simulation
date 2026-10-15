"""One-page Opportunity Map PDF: switched on in Settings, one company per page, facilitator only."""

from __future__ import annotations

import re

from fastapi.testclient import TestClient

from app.schemas.views import OpportunityItem
from app.services.opportunity_onepager import render_onepager
from tests.api.helpers import auth, create_session, join_all, stage

CONSENT = {"granted": True, "participant": "Pat", "at": "2026-10-08T12:00:00Z"}


def _opportunity(title: str, value: int, ready: int) -> dict:
    return {
        "participant": "Pat",
        "title": title,
        "capability_class": "Predictive",
        "value_hypothesis": "Adherence up two points in one region",
        "value": value,
        "readiness": {"data": ready, "workflow": ready, "owner": ready, "controls": ready},
        "dependencies": "Identity resolution",
        "risks": "Bias against thin-history members",
        "owner": "VP Pharmacy",
        "next_step": "90-day pilot with subgroup monitoring",
        "foundations": ["Governance"],
    }


def _item(n: int, value: int, ready: int, quadrant: str, title: str | None = None) -> OpportunityItem:
    return OpportunityItem(
        id=f"o{n}",
        participant=f"Exec {n}",
        title=title or f"Opportunity number {n} with a deliberately long title that has to wrap or be cut",
        capability_class="Predictive",
        value_hypothesis="h",
        value=value,
        readiness={"data": ready, "workflow": ready, "owner": ready, "controls": ready},
        readiness_avg=float(ready),
        dependencies="A dependency that is long enough to wrap onto a second line of the panel text " * 2,
        risks="",
        owner="Chief Operating Officer",
        next_step="A first step that is long enough to wrap onto a second and third line of the panel text "
        * 2,
        foundations=["Governance"],
        team="Co",
        quadrant=quadrant,
    )


def _pages(pdf: bytes) -> int:
    return len(re.findall(rb"/Type\s*/Page\b", pdf))


def _enable(client: TestClient, on: bool = True) -> None:
    """Switch the export on the way an admin does: through Settings."""
    r = client.put("/api/admin/settings", json={"values": {"opportunity_onepager": on}})
    assert r.status_code == 200, r.text


def _setup(client: TestClient) -> tuple[dict, str, str]:
    session, ftok = create_session(client)
    sid, teams = session["id"], join_all(client, session)
    stage(client, sid, ftok, "start")
    items = [_opportunity("Act now", 5, 4), _opportunity("Strategic", 4, 2), _opportunity("Defer", 2, 2)]
    r = client.put(
        "/api/team/opportunities", json={"items": items, "consent": CONSENT}, headers=auth(teams["horizon"])
    )
    assert r.status_code == 200, r.text
    horizon = next(t for t in session["teams"] if t["payer_id"] == "horizon")
    return session, ftok, horizon["team_id"]


def test_off_by_default_and_reported_to_the_console(client: TestClient) -> None:
    session, ftok, team_id = _setup(client)
    sid = session["id"]
    m = client.get(f"/api/sessions/{sid}/opportunity-map", headers=auth(ftok)).json()
    assert m["onepager_enabled"] is False
    r = client.post(
        f"/api/sessions/{sid}/teams/{team_id}/opportunity-onepager.pdf", json={}, headers=auth(ftok)
    )
    assert r.status_code == 404 and r.json()["error"]["code"] == "onepager_disabled"


def test_one_page_for_the_company_and_the_facilitators_selection(client: TestClient) -> None:
    session, ftok, team_id = _setup(client)
    sid, fh = session["id"], auth(ftok)
    _enable(client)
    assert client.get(f"/api/sessions/{sid}/opportunity-map", headers=fh).json()["onepager_enabled"] is True
    path = f"/api/sessions/{sid}/teams/{team_id}/opportunity-onepager.pdf"

    r = client.post(path, json={}, headers=fh)
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert 'filename="AI-Opportunity-Map_Horizon-Health.pdf"' in r.headers["content-disposition"]
    assert r.content.startswith(b"%PDF-") and _pages(r.content) == 1

    ids = [i["id"] for i in client.get(f"/api/sessions/{sid}/opportunity-map", headers=fh).json()["items"]]
    assert client.post(path, json={"item_ids": ids[:1]}, headers=fh).status_code == 200
    assert client.post(path, json={"item_ids": ["not-on-this-map"]}, headers=fh).status_code == 404
    assert client.post(path, json={"item_ids": []}, headers=fh).status_code == 404


def test_company_without_shared_opportunities_has_nothing_to_export(client: TestClient) -> None:
    session, ftok, _ = _setup(client)
    _enable(client)
    heritage = next(t for t in session["teams"] if t["payer_id"] == "heritage")
    path = f"/api/sessions/{session['id']}/teams/{heritage['team_id']}/opportunity-onepager.pdf"
    assert client.post(path, json={}, headers=auth(ftok)).status_code == 404
    unknown = f"/api/sessions/{session['id']}/teams/nope/opportunity-onepager.pdf"
    assert client.post(unknown, json={}, headers=auth(ftok)).status_code == 404


def test_only_the_facilitator_can_export(client: TestClient) -> None:
    session, _, team_id = _setup(client)
    _enable(client)
    path = f"/api/sessions/{session['id']}/teams/{team_id}/opportunity-onepager.pdf"
    assert client.post(path, json={}).status_code in (401, 403)


def test_always_exactly_one_page_however_much_is_captured() -> None:
    quadrants = ["act_now", "strategic", "quick_win", "defer"]
    many = [_item(n, 5 if n % 4 < 2 else 2, 4 if n % 2 == 0 else 2, quadrants[n % 4]) for n in range(40)]
    assert _pages(render_onepager("A company with a rather long name, Inc.", many)) == 1
    assert _pages(render_onepager("Solo", [_item(1, 2, 2, "defer")])) == 1  # empty panels say so


def test_text_outside_the_built_in_fonts_does_not_break_rendering() -> None:
    odd = _item(1, 5, 5, "act_now", title="Prior-auth → automation ≥ 40% <b>&</b> “smart” 🚀 triage")
    assert render_onepager("Acme & Søns", [odd]).startswith(b"%PDF-")
