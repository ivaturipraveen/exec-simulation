"""T-094: the playtest report rebuilds timing, engagement and stalls from the event log."""

from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

from app.db import EventLog
from app.schemas.views import FeedbackSummary
from app.services.playtest import TeamInfo, build_report, report_markdown
from sim.content import load_content
from tests.api.helpers import auth, create_session, stage
from tests.sim.conftest import CONTENT_DIR

T0 = datetime(2026, 10, 9, 9, 0, tzinfo=UTC)
NO_FEEDBACK = FeedbackSummary(
    responses=0,
    learning_avg=None,
    learning_4plus_pct=None,
    judgment_changed_pct=None,
    usefulness_avg=None,
    usefulness_4plus_pct=None,
    realism_avg=None,
    recommend_avg=None,
    comments=[],
)


def ev(minute: float, kind: str, actor: str = "team", team: str | None = None, **payload: object) -> EventLog:
    return EventLog(
        session_id="s",
        team_id=team,
        actor=actor,
        kind=kind,
        payload=payload,
        created_at=T0 + timedelta(minutes=minute),
    )


def test_report_times_stages_excluding_pauses_and_flags_stalls() -> None:
    content = load_content(CONTENT_DIR)
    stages = content.stages
    setup, company, diagnose = stages[0], stages[1], stages[2]
    events = [
        ev(0, "stage", "facilitator", action="start", stage=setup.id),
        ev(12, "stage", "facilitator", action="next", stage=company.id),
        ev(13, "artifact_viewed", team="a", artifact_id="h-01"),
        ev(14, "artifact_viewed", team="a", artifact_id="h-01"),
        ev(20, "stage", "facilitator", action="pause", stage=company.id),
        ev(30, "stage", "facilitator", action="resume", stage=company.id),  # 10 paused minutes
        ev(37, "stage", "facilitator", action="next", stage=diagnose.id),  # company ran 8 + 7 = 15
        ev(38, "ai_query", team="a", question="why?"),
        ev(70, "stage", "facilitator", action="next", stage=stages[3].id),  # diagnose 33 vs 25 planned
        ev(71, "force_submitted", "facilitator", team="b", year=1),
        ev(72, "observation", "facilitator", team="a", text="Confused by the capacity chart"),
    ]
    r = build_report(
        session_id="s",
        session_name="Playtest 1",
        stages=stages,
        current_stage=stages[3].id,
        teams=[TeamInfo("a", "Team A", "Horizon Health"), TeamInfo("b", "Team B", "Heritage Medicare")],
        events=events,
        feedback=NO_FEEDBACK,
        config=content.config,
        now=T0 + timedelta(minutes=75),
    )
    timing = {s.id: s for s in r.stages}
    assert timing[setup.id].actual_minutes == 12 and not timing[setup.id].overrun
    assert timing[company.id].actual_minutes == 15  # pause excluded
    assert timing[diagnose.id].actual_minutes == 33 and timing[diagnose.id].overrun
    assert timing[stages[3].id].status == "current" and timing[stages[-1].id].status == "not_reached"
    assert r.paused_minutes == 10

    a, b = r.teams
    assert (a.ai_questions, a.artifacts_viewed, a.actions) == (1, 1, 3)
    assert a.longest_quiet_minutes == 32  # diagnose: minute 38 → 70
    assert [s.stage for s in a.stalls] == [diagnose.title]
    assert b.forced == ["Year 1"] and b.ai_questions == 0
    assert r.observations[0].stage == stages[3].title and r.observations[0].team == "Team A"

    text = " ".join(r.findings)
    assert diagnose.title in text and "Team B did not submit on its own" in text
    md = report_markdown(r)
    assert "## Stage timing" in md and "Confused by the capacity chart" in md


def test_playtest_endpoints(client: TestClient) -> None:
    session, ftok = create_session(client)
    sid, fh = session["id"], auth(ftok)
    stage(client, sid, ftok, "start")
    stage(client, sid, ftok, "next")
    r = client.get(f"/api/sessions/{sid}/playtest", headers=fh)
    assert r.status_code == 200
    body = r.json()
    assert len(body["teams"]) == 3 and body["stages"][0]["status"] == "done"
    md = client.get(f"/api/sessions/{sid}/playtest.md", headers=fh)
    assert md.status_code == 200 and md.text.startswith("# Playtest report")
    assert client.get(f"/api/sessions/{sid}/playtest").status_code == 401
