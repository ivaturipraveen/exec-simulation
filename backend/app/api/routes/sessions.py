"""Facilitator endpoints. Session creation is open locally; everything else needs the
session's facilitator token."""

from typing import Annotated, Any, Literal

from fastapi import APIRouter, Path, Request
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field

from app.api.deps import FacilitatorSession, GameDep
from app.schemas import views as v
from app.services.exports import session_summary_markdown
from app.services.game import StageAction
from app.services.playtest import PlaytestReport, report_markdown
from sim.content.models import Round2Mechanic, Severity
from sim.engine import Scorecard, YearReport

router = APIRouter(prefix="/sessions", tags=["facilitator"])


class CreateSessionBody(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    seed: int | None = Field(default=None, ge=0, le=2**31)
    round2_mechanic: Round2Mechanic | None = None
    payer_ids: list[str] | None = None
    sim_mode: Literal["deterministic", "variable"] | None = None
    team_names: dict[str, str] | None = Field(default=None, description="Optional team name per payer id")


@router.post("", status_code=201)
def create_session(body: CreateSessionBody, game: GameDep) -> v.CreatedSession:
    return game.create_session(
        body.name, body.seed, body.round2_mechanic, body.payer_ids, body.sim_mode, body.team_names
    )


@router.get("/{session_id}")
def get_session(session_id: FacilitatorSession, game: GameDep) -> v.SessionView:
    return game.session_view(session_id)


class StageBody(BaseModel):
    action: StageAction
    index: int | None = None


@router.post("/{session_id}/stage")
def stage(body: StageBody, session_id: FacilitatorSession, game: GameDep) -> v.SessionView:
    return game.control_stage(session_id, body.action, body.index)


class SimulateBody(BaseModel):
    year: Literal[1, 2]
    force: bool = False


@router.post("/{session_id}/simulate")
def simulate(body: SimulateBody, session_id: FacilitatorSession, game: GameDep) -> v.SessionView:
    return game.simulate(session_id, body.year, body.force)


@router.post("/{session_id}/results/{year}/release")
def release_results(
    year: Annotated[int, Path(ge=1, le=2)], session_id: FacilitatorSession, game: GameDep
) -> v.SessionView:
    """Pack §9.2: review the simulated results, then release the performance review to teams."""
    return game.release_results(session_id, year)


@router.post("/{session_id}/scorecards/release")
def release_scorecards(session_id: FacilitatorSession, game: GameDep) -> v.SessionView:
    return game.release_scorecards(session_id)


@router.post("/{session_id}/rounds/{round_no}/lock")
def lock_round(
    round_no: Annotated[int, Path(ge=1, le=2)], session_id: FacilitatorSession, game: GameDep
) -> v.SessionView:
    """Pack §9.2 "lock at the timebox": every pending draft is applied as submitted."""
    return game.lock_round(session_id, round_no)


@router.get("/{session_id}/settings")
def session_settings(session_id: FacilitatorSession, game: GameDep) -> list[v.SessionSettingView]:
    return game.session_settings(session_id)


class SessionSettingsBody(BaseModel):
    values: dict[str, Any]
    note: str = Field(min_length=1, max_length=1000)


@router.put("/{session_id}/settings")
def update_session_settings(
    body: SessionSettingsBody, session_id: FacilitatorSession, game: GameDep
) -> v.SessionView:
    return game.update_session_settings(session_id, body.values, body.note)


class RenameBody(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    note: str = Field(min_length=1, max_length=1000)


@router.put("/{session_id}/teams/{team_id}/name")
def rename_team(
    team_id: str, body: RenameBody, session_id: FacilitatorSession, game: GameDep
) -> v.SessionView:
    return game.rename_team(session_id, team_id, body.name, body.note)


class NoteBody(BaseModel):
    note: str = Field(min_length=1, max_length=1000)


@router.post("/{session_id}/opportunities/delete")
def delete_opportunities(body: NoteBody, session_id: FacilitatorSession, game: GameDep) -> v.SessionView:
    """OD-09: delete captured opportunities and consent on the organization's request."""
    return game.purge_opportunities(session_id, body.note)


@router.post("/{session_id}/round2/grant")
def grant_round2(session_id: FacilitatorSession, game: GameDep) -> v.SessionView:
    return game.grant_round2(session_id)


class RubricBody(BaseModel):
    rows: dict[str, int] = Field(description="Final 0-3 score per rubric row")
    note: str = Field(min_length=1, max_length=1000)


@router.get("/{session_id}/teams/{team_id}/pitch")
def pitch_review(team_id: str, session_id: FacilitatorSession, game: GameDep) -> v.PitchReview:
    """The team's pitch with a suggested rubric score (AI-assisted when configured, OD-08)."""
    return game.pitch_review(session_id, team_id)


@router.put("/{session_id}/teams/{team_id}/pitch-score")
def pitch_score(
    team_id: str, body: RubricBody, session_id: FacilitatorSession, game: GameDep
) -> v.SessionView:
    return game.set_pitch_score(session_id, team_id, body.rows, body.note)


class BaseBody(BaseModel):
    amount_musd: float = Field(ge=0, le=50)
    note: str = Field(min_length=1, max_length=1000)


@router.put("/{session_id}/teams/{team_id}/round2-base")
def round2_base(team_id: str, body: BaseBody, session_id: FacilitatorSession, game: GameDep) -> v.SessionView:
    return game.set_round2_base(session_id, team_id, body.amount_musd, body.note)


@router.put("/{session_id}/teams/{team_id}/opmodel-score")
def opmodel_score(
    team_id: str, body: RubricBody, session_id: FacilitatorSession, game: GameDep
) -> v.SessionView:
    return game.override_opmodel(session_id, team_id, body.rows, body.note)


@router.put("/{session_id}/teams/{team_id}/crisis-score")
def crisis_score(
    team_id: str, body: RubricBody, session_id: FacilitatorSession, game: GameDep
) -> v.SessionView:
    return game.override_crisis_score(session_id, team_id, body.rows, body.note)


class OptionsBody(BaseModel):
    opmodel_compressed: bool | None = None
    include_translation: bool | None = None
    note: str = Field(min_length=1, max_length=1000)


@router.put("/{session_id}/options")
def options(body: OptionsBody, session_id: FacilitatorSession, game: GameDep) -> v.SessionView:
    updates = body.model_dump(exclude={"note"}, exclude_none=True)
    return game.set_options(session_id, updates, body.note)


class CapitalBody(BaseModel):
    amount_musd: float = Field(ge=-50, le=50)
    note: str = Field(min_length=1, max_length=1000)


@router.post("/{session_id}/teams/{team_id}/capital")
def capital(team_id: str, body: CapitalBody, session_id: FacilitatorSession, game: GameDep) -> v.SessionView:
    return game.adjust_capital(session_id, team_id, body.amount_musd, body.note)


class UnlockBody(BaseModel):
    what: Literal["round1", "round2", "pitch", "opmodel", "crisis"]
    note: str = Field(min_length=1, max_length=1000)


@router.post("/{session_id}/teams/{team_id}/unlock")
def unlock(team_id: str, body: UnlockBody, session_id: FacilitatorSession, game: GameDep) -> v.SessionView:
    return game.unlock(session_id, team_id, body.what, body.note)


@router.get("/{session_id}/teams/{team_id}")
def team_detail(team_id: str, session_id: FacilitatorSession, game: GameDep) -> dict[str, Any]:
    return game.team_detail(session_id, team_id)


@router.get("/{session_id}/teams/{team_id}/results/{year}")
def team_results(team_id: str, year: int, session_id: FacilitatorSession, game: GameDep) -> YearReport:
    game.assert_team_in_session(session_id, team_id)
    return game.results(team_id, year, as_facilitator=True)


@router.get("/{session_id}/teams/{team_id}/scorecard")
def team_scorecard(team_id: str, session_id: FacilitatorSession, game: GameDep) -> Scorecard:
    game.assert_team_in_session(session_id, team_id)
    return game.scorecard(team_id, as_facilitator=True)


@router.get("/{session_id}/teams/{team_id}/dataroom/{artifact_id}")
def team_artifact(
    team_id: str, artifact_id: str, session_id: FacilitatorSession, game: GameDep
) -> v.ArtifactContent:
    game.assert_team_in_session(session_id, team_id)
    return game.artifact(team_id, artifact_id, as_facilitator=True)


@router.get("/{session_id}/teams/{team_id}/dataroom")
def team_dataroom(team_id: str, session_id: FacilitatorSession, game: GameDep) -> list[v.DataRoomItem]:
    """Every artifact for the team's payer with its current visibility (for early release)."""
    return game.facilitator_dataroom(session_id, team_id)


@router.get("/{session_id}/feedback")
def feedback(session_id: FacilitatorSession, game: GameDep) -> v.FeedbackSummary:
    return game.feedback_summary(session_id)


class CrisisAssignBody(BaseModel):
    team_id: str | None = None
    event_id: str | None = None
    severity: Severity | None = None
    note: str = Field(default="", max_length=1000)


@router.get("/{session_id}/crisis/candidates")
def crisis_candidates(
    session_id: FacilitatorSession, game: GameDep
) -> dict[str, list[v.CrisisCandidateView]]:
    return game.crisis_candidates(session_id)


@router.post("/{session_id}/crisis/assign")
def assign_crisis(body: CrisisAssignBody, session_id: FacilitatorSession, game: GameDep) -> v.SessionView:
    return game.assign_crisis(session_id, body.team_id, body.event_id, body.severity, body.note)


class ReleaseBody(BaseModel):
    payer_id: str
    artifact_id: str


@router.post("/{session_id}/release")
def release(body: ReleaseBody, session_id: FacilitatorSession, game: GameDep) -> v.SessionView:
    return game.release_artifact(session_id, body.payer_id, body.artifact_id)


class ObservationBody(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    team_id: str | None = None


@router.post("/{session_id}/observations", status_code=204)
def observation(body: ObservationBody, session_id: FacilitatorSession, game: GameDep) -> None:
    game.add_observation(session_id, body.text, body.team_id)


@router.get("/{session_id}/answer-key")
def answer_key(session_id: FacilitatorSession, game: GameDep) -> list[v.AnswerKeyEntry]:
    return game.answer_key(session_id)


@router.get("/{session_id}/edition")
def edition(session_id: FacilitatorSession, game: GameDep, request: Request) -> v.EditionInfo:
    """Assumptions log, simplification register, content warnings, contingency cuts and the
    content owner's review sign-off (pack §12)."""
    info = game.edition()
    info.review = [e.model_dump(mode="json") for e in request.app.state.settings_store.review_entries()]
    return info


@router.get("/{session_id}/scoreboard")
def scoreboard(session_id: FacilitatorSession, game: GameDep) -> list[v.ScoreboardEntry]:
    return game.scoreboard(session_id)


@router.get("/{session_id}/opportunity-map")
def opportunity_map(session_id: FacilitatorSession, game: GameDep) -> v.OpportunityMapView:
    return game.opportunity_map(session_id)


class SynthesisOut(BaseModel):
    synthesis: str
    generative: bool


@router.post("/{session_id}/opportunity-map/synthesis")
def opportunity_synthesis(session_id: FacilitatorSession, game: GameDep, request: Request) -> SynthesisOut:
    """Synthesizer agent: aggregate consented opportunities into an organizational map."""
    analyst = request.app.state.analyst
    items = [i.model_dump() for i in game.opportunity_map(session_id).items]
    return SynthesisOut(synthesis=analyst.synthesize_opportunities(items), generative=analyst.generative)


@router.get("/{session_id}/events")
def events(session_id: FacilitatorSession, game: GameDep, since: int = 0) -> list[v.EventView]:
    return [v.EventView.model_validate(e.model_dump()) for e in game.events(session_id, since)]


@router.get("/{session_id}/events.csv", response_class=PlainTextResponse)
def events_csv(session_id: FacilitatorSession, game: GameDep) -> PlainTextResponse:
    return PlainTextResponse(
        game.events_csv(session_id),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="session-{session_id}-events.csv"'},
    )


@router.get("/{session_id}/playtest")
def playtest(session_id: FacilitatorSession, game: GameDep) -> PlaytestReport:
    """T-094: timing vs plan, team engagement, stalls and pilot indicators."""
    return game.playtest_report(session_id)


@router.get("/{session_id}/playtest.md", response_class=PlainTextResponse)
def playtest_markdown(session_id: FacilitatorSession, game: GameDep) -> PlainTextResponse:
    return PlainTextResponse(
        report_markdown(game.playtest_report(session_id)),
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="session-{session_id}-playtest.md"'},
    )


@router.get("/{session_id}/summary.md", response_class=PlainTextResponse)
def summary(session_id: FacilitatorSession, game: GameDep) -> PlainTextResponse:
    return PlainTextResponse(
        session_summary_markdown(game, session_id),
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="session-{session_id}-summary.md"'},
    )
