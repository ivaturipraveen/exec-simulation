"""Participant endpoints. Every route is scoped to the caller's own team."""

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from app.api.deps import GameDep, TeamId
from app.schemas import views as v
from app.schemas.workspace import (
    Consent,
    DraftItem,
    Feedback,
    Opportunity,
    Priority,
    Round2Action,
    Workspace,
)
from app.services.analyst import AnalystAnswer, AskBody
from sim.engine import CrisisResponse, OperatingModelDesign, PitchSubmission, Scorecard, YearReport

router = APIRouter(prefix="/team", tags=["team"])


@router.get("")
def me(team_id: TeamId, game: GameDep) -> v.TeamView:
    return game.team_view(team_id)


@router.get("/dataroom")
def dataroom(team_id: TeamId, game: GameDep) -> list[v.DataRoomItem]:
    return game.dataroom(team_id)


@router.get("/dataroom/{artifact_id}")
def artifact(artifact_id: str, team_id: TeamId, game: GameDep) -> v.ArtifactContent:
    return game.artifact(team_id, artifact_id)


class PrioritiesBody(BaseModel):
    priorities: list[Priority] = Field(max_length=3)


@router.put("/priorities")
def priorities(body: PrioritiesBody, team_id: TeamId, game: GameDep) -> Workspace:
    return game.set_priorities(team_id, body.priorities)


class Round1Body(BaseModel):
    items: list[DraftItem] = Field(max_length=20)
    thesis: str = Field(default="", max_length=2000)


@router.put("/round1")
def save_round1(body: Round1Body, team_id: TeamId, game: GameDep) -> v.DraftPreview:
    return game.save_round1(team_id, body.items, body.thesis)


@router.post("/round1/submit")
def submit_round1(team_id: TeamId, game: GameDep) -> v.TeamView:
    return game.submit_round1(team_id)


class PitchBody(BaseModel):
    pitch: PitchSubmission
    submit: bool = False


@router.put("/pitch")
def save_pitch(body: PitchBody, team_id: TeamId, game: GameDep) -> v.PitchReview:
    """Board pitch (pack 10.2). On submit, dollar and percent figures are checked against the data room."""
    return game.save_pitch(team_id, body.pitch, body.submit)


class Round2Body(BaseModel):
    actions: list[Round2Action] = Field(max_length=40)
    thesis: str = Field(default="", max_length=2000)


@router.put("/round2")
def save_round2(body: Round2Body, team_id: TeamId, game: GameDep) -> v.DraftPreview:
    return game.save_round2(team_id, body.actions, body.thesis)


@router.post("/round2/submit")
def submit_round2(team_id: TeamId, game: GameDep) -> v.TeamView:
    return game.submit_round2(team_id)


@router.get("/results/{year}")
def results(year: int, team_id: TeamId, game: GameDep) -> YearReport:
    return game.results(team_id, year)


class OpModelBody(BaseModel):
    design: OperatingModelDesign
    submit: bool = False


@router.put("/operating-model")
def operating_model(body: OpModelBody, team_id: TeamId, game: GameDep) -> Workspace:
    return game.save_opmodel(team_id, body.design, body.submit)


@router.get("/crisis")
def crisis(team_id: TeamId, game: GameDep) -> v.CrisisBriefing:
    return game.crisis_briefing(team_id)


@router.post("/crisis/response")
def crisis_response(body: CrisisResponse, team_id: TeamId, game: GameDep) -> v.CrisisBriefing:
    return game.respond_crisis(team_id, body)


@router.get("/scorecard")
def scorecard(team_id: TeamId, game: GameDep) -> Scorecard:
    return game.scorecard(team_id)


class OpportunitiesBody(BaseModel):
    items: list[Opportunity] = Field(max_length=60)
    consent: Consent | None = None


@router.put("/opportunities")
def opportunities(body: OpportunitiesBody, team_id: TeamId, game: GameDep) -> Workspace:
    return game.save_opportunities(team_id, body.items, body.consent)


@router.post("/feedback")
def feedback(body: Feedback, team_id: TeamId, game: GameDep) -> Workspace:
    return game.add_feedback(team_id, body)


@router.post("/ai/ask")
def ask_analyst(body: AskBody, team_id: TeamId, game: GameDep, request: Request) -> AnalystAnswer:
    """Grounded analyst over the team's released data room (DAT-002). Rate-limited and logged."""
    analyst = request.app.state.analyst
    settings = request.app.state.settings
    _, payer_id = game.team_payer(team_id)
    allowed = {a.id for a in game.dataroom(team_id)}
    game.record_ai_request(team_id, settings.ai_requests_per_10_min, body.question, body.mode, [])
    if body.mode in ("challenge", "explain", "pitch") and not body.context.strip():
        body = body.model_copy(update={"context": game.team_context_text(team_id)[:6000]})
    answer = analyst.ask(payer_id, allowed, body)
    game.log_ai_answer(team_id, answer.citations, answer.generative)
    return answer
