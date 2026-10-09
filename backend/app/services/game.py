"""Game service: the only place that mutates sessions and teams.

Every mutation runs under one process-wide lock (workshop scale, SQLite), persists team
state atomically, appends to the event log (DAT-003) and publishes a realtime hint.
"""

from __future__ import annotations

import csv
import io
import json
import threading
import uuid
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Any, Literal, Protocol

from sqlalchemy.engine import Engine
from sqlmodel import Session, select

from app.core.errors import Conflict, DomainError, Forbidden, NotFound
from app.core.security import issue_token, new_join_code
from app.db import EventLog, GameSession, Team, utcnow
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
from app.services.playtest import PlaytestReport, TeamInfo, build_report
from app.services.realtime import RealtimeHub
from sim.content import ContentBundle, content_warnings
from sim.content.models import Round2Mechanic, Severity, StageKind
from sim.engine import (
    CrisisOutcome,
    CrisisResponse,
    Disclosure,
    OperatingModelDesign,
    PitchSubmission,
    RubricScore,
    Scorecard,
    SimulationError,
    TeamState,
    YearReport,
    build_scorecard,
    cancel,
    capacity_plan,
    evaluate,
    fund,
    ledger,
    missing_human_review,
    new_team_state,
    pause,
    rank_crises,
    resume,
    round2_capital,
    run_year,
    score_crisis,
    score_opmodel,
    score_pitch,
    set_owner,
    unsupported_figures,
    year_report,
)
from sim.engine.reports import quarter_label
from sim.engine.rubric import build_score
from sim.engine.state import QUARTERS_PER_YEAR, CapitalAdjustment

StageAction = Literal["start", "pause", "resume", "next", "previous", "goto", "complete"]


class InvalidAction(DomainError):
    status_code = 422
    code = "invalid_action"


class PitchAdvisor(Protocol):
    def suggest_pitch(
        self, content: ContentBundle, payer_id: str, pitch: PitchSubmission, results_text: str
    ) -> tuple[dict[str, int], dict[str, str]] | None: ...


@dataclass
class TeamContext:
    row: Team
    state: TeamState
    workspace: Workspace


@dataclass
class GameOptions:
    """Runtime options from .env (see app.core.config.Settings)."""

    include_translation: bool = True
    pitch_ai_suggest: bool = True
    opportunity_retention_days: int = 365
    extra: dict[str, Any] = field(default_factory=dict)


class GameService:
    def __init__(
        self,
        engine: Engine,
        content: ContentBundle,
        hub: RealtimeHub,
        secret: str,
        ai_enabled: bool,
        default_seed: int | None = None,
        options: GameOptions | None = None,
        advisor: PitchAdvisor | None = None,
    ) -> None:
        self.engine = engine
        self.content = content
        self.hub = hub
        self.secret = secret
        self.ai_enabled = ai_enabled
        self.default_seed = default_seed if default_seed is not None else content.config.default_seed
        self.options = options or GameOptions()
        self.advisor = advisor
        self._lock = threading.RLock()
        self._pitch_cache: dict[tuple[str, str], RubricScore] = {}
        self._content_cache: dict[tuple[str, str], ContentBundle] = {}
        self._stage_pos = {s.kind: i for i, s in enumerate(content.stages)}

    # ------------------------------------------------------------------ plumbing

    def _db(self) -> Session:
        return Session(self.engine, expire_on_commit=False)

    def _session(self, db: Session, session_id: str) -> GameSession:
        gs = db.get(GameSession, session_id)
        if gs is None:
            raise NotFound("Session not found")
        if gs.content_version.split(".")[0] != self.content.config.content_version.split(".")[0]:
            raise Conflict(
                f"Session was created with content {gs.content_version}; this server runs "
                f"{self.content.config.content_version}. Create a new session."
            )
        return gs

    def _team(self, db: Session, team_id: str) -> TeamContext:
        row = db.get(Team, team_id)
        if row is None:
            raise NotFound("Team not found")
        return TeamContext(
            row=row,
            state=TeamState.model_validate(row.state),
            workspace=Workspace.model_validate(row.workspace),
        )

    def _save(self, db: Session, ctx: TeamContext) -> None:
        ctx.row.state = ctx.state.model_dump(mode="json")
        ctx.row.workspace = ctx.workspace.model_dump(mode="json")
        ctx.row.version += 1
        ctx.row.updated_at = utcnow()
        db.add(ctx.row)

    def _log(
        self, db: Session, session_id: str, kind: str, actor: str, team_id: str | None = None, **payload: Any
    ) -> None:
        db.add(EventLog(session_id=session_id, team_id=team_id, actor=actor, kind=kind, payload=payload))

    def _publish(self, session_id: str, *scopes: str) -> None:
        self.hub.publish(session_id, list(scopes) or ["session"])

    def _mutate_team(
        self, team_id: str, fn: Callable[[Session, GameSession, TeamContext], Any], kind: str, **payload: Any
    ) -> Any:
        with self._lock, self._db() as db:
            ctx = self._team(db, team_id)
            gs = self._session(db, ctx.row.session_id)
            result = fn(db, gs, ctx)
            self._save(db, ctx)
            self._log(db, gs.id, kind, "team", team_id, **payload)
            db.commit()
        self._publish(gs.id, "session", f"team:{team_id}")
        return result

    def _opt(self, gs: GameSession, key: str, default: Any = None) -> Any:
        return (gs.options or {}).get(key, default)

    def set_content(self, content: ContentBundle) -> None:
        """New effective content from Settings; existing sessions keep their snapshot."""
        self.content = content

    def _c(self, gs: GameSession) -> ContentBundle:
        """The content bundle with this session's game-config snapshot."""
        snap = self._opt(gs, "config")
        if not snap:
            return self.content
        key = (gs.id, json.dumps(snap, sort_keys=True))
        bundle = self._content_cache.get(key)
        if bundle is None:
            bundle = self.content.with_full_config(snap)
            self._content_cache[key] = bundle
        return bundle

    # ------------------------------------------------------------------ stage / clock

    def _kind(self, gs: GameSession) -> StageKind:
        return self.content.stages[gs.stage_index].kind

    def _reached(self, gs: GameSession, kind: StageKind) -> bool:
        return gs.stage_status != "not_started" and gs.stage_index >= self._stage_pos[kind]

    def _last_index(self, gs: GameSession) -> int:
        last = len(self.content.stages) - 1
        if not self._opt(gs, "include_translation", True) and self.content.stages[last].optional:
            return last - 1
        return last

    def _elapsed(self, gs: GameSession, now: datetime) -> float:
        elapsed = gs.elapsed_before_pause
        if gs.stage_status == "running" and gs.stage_started_at:
            started = gs.stage_started_at
            if started.tzinfo is None:
                started = started.replace(tzinfo=UTC)
            elapsed += (now - started).total_seconds()
        return elapsed

    def clock(self, gs: GameSession) -> v.ClockView:
        stage = self.content.stages[gs.stage_index]
        now = datetime.now(UTC)
        elapsed = self._elapsed(gs, now)
        duration = stage.duration_minutes * 60
        return v.ClockView(
            stage_index=gs.stage_index,
            stage_id=stage.id,
            stage_kind=stage.kind.value,
            stage_title=stage.title,
            status=gs.stage_status,
            duration_seconds=duration,
            elapsed_seconds=round(elapsed, 1),
            remaining_seconds=round(duration - elapsed, 1),
            server_time=now,
        )

    def _schedule_offset(self, gs: GameSession) -> float:
        """Minutes behind (+) or ahead (−) of the run-of-show."""
        started = self._opt(gs, "started_at")
        if not started or gs.stage_status == "not_started":
            return 0.0
        start = datetime.fromisoformat(started)
        now = datetime.now(UTC)
        stage = self.content.stages[gs.stage_index]
        h, m = stage.start.split(":")
        planned = int(h) * 60 + int(m) + min(self._elapsed(gs, now) / 60, stage.duration_minutes)
        actual = (now - start).total_seconds() / 60
        return round(actual - planned, 1)

    def _contingency(self, gs: GameSession, behind: float) -> list[v.ContingencyHint]:
        hints = []
        here = gs.stage_index
        for cut in self.content.contingency_cuts:
            if cut.behind_minutes <= 0 or behind < cut.behind_minutes:
                continue
            if cut.checkpoint_stage is not None:
                pos = self._stage_pos[cut.checkpoint_stage]
                if not pos - 1 <= here <= pos:
                    continue
            hints.append(
                v.ContingencyHint(id=cut.id, condition=cut.condition, cut=cut.cut, behind_minutes=behind)
            )
        return hints

    def control_stage(self, session_id: str, action: StageAction, index: int | None = None) -> v.SessionView:
        with self._lock, self._db() as db:
            gs = self._session(db, session_id)
            now = datetime.now(UTC)
            last = self._last_index(gs)

            def enter(new_index: int) -> None:
                if not 0 <= new_index <= last:
                    raise InvalidAction("No such stage")
                gs.stage_index = new_index
                gs.elapsed_before_pause = 0.0
                gs.stage_started_at = now
                gs.stage_status = "running"

            if action == "start":
                if gs.stage_status != "not_started":
                    raise Conflict("Session already started")
                enter(0)
                gs.options = {**(gs.options or {}), "started_at": now.isoformat()}
            elif action == "pause":
                if gs.stage_status != "running":
                    raise Conflict("Clock is not running")
                gs.elapsed_before_pause = self._elapsed(gs, now)
                gs.stage_started_at = None
                gs.stage_status = "paused"
            elif action == "resume":
                if gs.stage_status != "paused":
                    raise Conflict("Clock is not paused")
                gs.stage_started_at = now
                gs.stage_status = "running"
            elif action == "next":
                if gs.stage_index >= last:
                    raise InvalidAction("Already at the final stage; use 'complete'")
                enter(gs.stage_index + 1)
            elif action == "previous":
                enter(max(0, gs.stage_index - 1))
            elif action == "goto":
                if index is None:
                    raise InvalidAction("goto requires an index")
                enter(index)
            elif action == "complete":
                gs.elapsed_before_pause = self._elapsed(gs, now)
                gs.stage_started_at = None
                gs.stage_status = "completed"
            gs.updated_at = utcnow()
            db.add(gs)
            self._log(
                db, gs.id, "stage", "facilitator", action=action, stage=self.content.stages[gs.stage_index].id
            )
            db.commit()
            view = self._session_view(db, gs)
        self._publish(session_id, "session", "team:*")
        return view

    def set_options(self, session_id: str, updates: dict[str, Any], note: str) -> v.SessionView:
        allowed = {"opmodel_compressed", "include_translation"}
        if set(updates) - allowed:
            raise InvalidAction(f"Unknown options: {sorted(set(updates) - allowed)}")
        if not note.strip():
            raise InvalidAction("An audit note is required")
        with self._lock, self._db() as db:
            gs = self._session(db, session_id)
            gs.options = {**(gs.options or {}), **updates}
            db.add(gs)
            self._log(db, gs.id, "options_changed", "facilitator", note=note, **updates)
            db.commit()
        self._publish(session_id, "session", "team:*")
        return self.session_view(session_id)

    # ------------------------------------------------------------------ sessions

    def create_session(
        self,
        name: str,
        seed: int | None,
        mechanic: Round2Mechanic | None,
        payer_ids: list[str] | None,
        sim_mode: str | None = None,
        team_names: dict[str, str] | None = None,
    ) -> v.CreatedSession:
        payers = payer_ids or sorted(self.content.payers)
        unknown = set(payers) - set(self.content.payers)
        if unknown:
            raise InvalidAction(f"Unknown payer(s): {sorted(unknown)}")
        mode = sim_mode or self.content.config.sim_mode.value
        chosen_mechanic = (mechanic or self.content.config.round2_mechanic).value
        with self._lock, self._db() as db:
            gs = GameSession(
                id=uuid.uuid4().hex[:12],
                name=name,
                seed=seed if seed is not None else self.content.config.default_seed,
                round2_mechanic=chosen_mechanic,
                content_version=self.content.config.content_version,
                options={
                    "sim_mode": mode,
                    "include_translation": self.options.include_translation,
                    "opmodel_compressed": False,
                    "config": {
                        **self.content.config.model_dump(mode="json"),
                        "sim_mode": mode,
                        "round2_mechanic": chosen_mechanic,
                    },
                    "released_years": [],
                    "scorecards_released": False,
                },
            )
            db.add(gs)
            for payer_id in payers:
                payer = self.content.payers[payer_id]
                state = new_team_state(self.content, payer_id, gs.seed, variable=mode == "variable")
                db.add(
                    Team(
                        id=uuid.uuid4().hex[:12],
                        session_id=gs.id,
                        payer_id=payer_id,
                        name=((team_names or {}).get(payer_id) or payer.name).strip()[:80],
                        join_code=self._unique_code(db),
                        state=state.model_dump(mode="json"),
                        workspace=Workspace().model_dump(mode="json"),
                    )
                )
            self._log(db, gs.id, "session_created", "facilitator", name=name, payers=payers, sim_mode=mode)
            db.commit()
            view = self._session_view(db, gs)
        return v.CreatedSession(
            session=view, facilitator_token=issue_token(self.secret, "facilitator", gs.id)
        )

    def _unique_code(self, db: Session) -> str:
        for _ in range(20):
            code = new_join_code()
            if not db.exec(select(Team).where(Team.join_code == code)).first():
                return code
        raise DomainError("Could not allocate a join code")

    def join(self, code: str) -> v.JoinResult:
        with self._db() as db:
            row = db.exec(select(Team).where(Team.join_code == code.strip().upper())).first()
            if row is None:
                raise NotFound("No team uses that join code")
            self._session(db, row.session_id)
            self._log(db, row.session_id, "team_joined", "team", row.id)
            db.commit()
            return v.JoinResult(
                token=issue_token(self.secret, "team", row.id),
                team_id=row.id,
                session_id=row.session_id,
                team_name=row.name,
                payer_name=self.content.payers[row.payer_id].name,
            )

    def session_view(self, session_id: str) -> v.SessionView:
        with self._db() as db:
            return self._session_view(db, self._session(db, session_id))

    def _teams(self, db: Session, session_id: str) -> list[Team]:
        return list(db.exec(select(Team).where(Team.session_id == session_id).order_by(Team.payer_id)))

    def _cited(self, payer_id: str, ws: Workspace) -> tuple[set[str], int]:
        cited = {a for p in ws.priorities for a in p.evidence}
        payer = self.content.payers[payer_id]
        supports = {a.supports for a in self.content.datarooms[payer_id].artifacts if a.id in cited}
        return cited, sum(1 for rc in payer.hidden_root_causes if rc.id in supports)

    def _session_view(self, db: Session, gs: GameSession) -> v.SessionView:
        c = self._c(gs)
        clock = self.clock(gs)
        teams = []
        for row in self._teams(db, gs.id):
            state = TeamState.model_validate(row.state)
            ws = Workspace.model_validate(row.workspace)
            payer = self.content.payers[row.payer_id]
            led = ledger(state, c)
            cited, found = self._cited(row.payer_id, ws)
            years = state.quarter // QUARTERS_PER_YEAR
            card = self._scorecard(state, ws, c) if years >= 1 else None
            report = year_report(state, c, years) if years >= 1 else None
            teams.append(
                v.TeamProgress(
                    team_id=row.id,
                    team_name=row.name,
                    payer_id=row.payer_id,
                    payer_name=payer.name,
                    join_code=row.join_code,
                    priorities=len(ws.priorities),
                    evidence_cited=len(cited),
                    needs_nudge=clock.stage_kind == StageKind.DIAGNOSE.value
                    and clock.elapsed_seconds >= c.config.nudge_minutes * 60
                    and not cited,
                    round1_submitted=ws.round1_submitted_at is not None,
                    round2_submitted=ws.round2_submitted_at is not None,
                    pitch_submitted=ws.pitch_submitted_at is not None,
                    opmodel_submitted=ws.opmodel_submitted_at is not None,
                    crisis_event_id=ws.crisis_event_id,
                    crisis_severity=ws.crisis_severity.value if ws.crisis_severity else None,
                    crisis_responded=ws.crisis_response is not None,
                    pitch_total=ws.pitch_score.total if ws.pitch_score else None,
                    pitch_figures=ws.pitch_figures,
                    opmodel_total=ws.opmodel_score.total if ws.opmodel_score else None,
                    crisis_total=ws.crisis_score.total if ws.crisis_score else None,
                    opportunities=len(ws.opportunities),
                    ai_requests=ws.ai_requests,
                    available_musd=led.available,
                    granted_musd=led.granted,
                    round2_base_musd=self._round2_base(ws, c),
                    capacity_peak=report.capacity_peak if report else None,
                    root_causes_cited=found,
                    root_causes_total=len(payer.hidden_root_causes),
                    stars_projected=report.stars.projected if report else None,
                    score_total=card.total if card else None,
                )
            )
        behind = self._schedule_offset(gs)
        return v.SessionView(
            id=gs.id,
            name=gs.name,
            rules=v.game_rules(c),
            seed=gs.seed,
            round2_mechanic=gs.round2_mechanic,
            sim_mode=self._opt(gs, "sim_mode", "deterministic"),
            content_version=gs.content_version,
            clock=clock,
            stages=[
                v.FacilitatorStageView(**s.model_dump(include=set(v.FacilitatorStageView.model_fields)))
                for s in self.content.stages[: self._last_index(gs) + 1]
            ],
            schedule_offset_minutes=behind,
            contingency=self._contingency(gs, behind),
            options={k: val for k, val in (gs.options or {}).items() if k not in ("started_at", "config")},
            simulated_years=gs.simulated_years,
            round2_granted=gs.round2_granted,
            released=gs.released,
            teams=teams,
            created_at=gs.created_at,
        )

    def assert_team_in_session(self, session_id: str, team_id: str) -> None:
        with self._db() as db:
            row = db.get(Team, team_id)
            if row is None or row.session_id != session_id:
                raise NotFound("Team not found in this session")

    def edition(self) -> v.EditionInfo:
        c = self.content
        return v.EditionInfo(
            content_pack=c.config.content_pack,
            content_version=c.config.content_version,
            assumptions=[a.model_dump() for a in c.assumptions],
            simplifications=[v.SimplificationView(**s.model_dump()) for s in c.simplifications],
            warnings=content_warnings(c),
            contingency_cuts=[x.model_dump(mode="json") for x in c.contingency_cuts],
            events=[
                v.EventSummary(
                    id=e.id,
                    code=e.code,
                    title=e.title,
                    payer_ids=e.payer_ids,
                    trigger_text=e.trigger_text,
                    severities=[s.value for s in e.severities],
                    minutes=e.minutes,
                    leadership_test=e.leadership_test,
                )
                for e in c.events.values()
            ],
            workflow_notes={s.id: s.facilitator_note for s in c.workflow_steps},
        )

    # ------------------------------------------------------------------ team view

    def _initiative_views(self, state: TeamState) -> list[v.InitiativeView]:
        out = []
        for i in state.initiatives:
            inv = self.content.investments[i.investment_id]
            out.append(
                v.InitiativeView(
                    investment_id=i.investment_id,
                    code=inv.code,
                    name=inv.name,
                    funded_round=i.funded_round,
                    scope=i.scope,
                    start_label=quarter_label(i.start_quarter),
                    owner=i.owner,
                    owner_required=inv.owner_required,
                    status=i.status.value,
                    progress=round(i.progress, 3),
                    live_label=quarter_label(i.live_quarter) if i.live_quarter is not None else None,
                    capital_committed=round(i.capital_committed, 3),
                    capital_spent=round(i.capital_spent, 3),
                    recoverable=round(i.remaining_commitment * inv.reversibility, 3),
                )
            )
        return out

    def team_view(self, team_id: str) -> v.TeamView:
        with self._db() as db:
            ctx = self._team(db, team_id)
            gs = self._session(db, ctx.row.session_id)
            c = self._c(gs)
            led = ledger(ctx.state, c)
            payer = c.payers[ctx.row.payer_id]
            return v.TeamView(
                team_id=ctx.row.id,
                team_name=ctx.row.name,
                session_id=gs.id,
                session_name=gs.name,
                payer=v.payer_briefing(payer, c),
                rules=v.game_rules(c),
                clock=self.clock(gs),
                ledger=v.LedgerView(**led.__dict__),
                capacity_per_quarter=payer.capacity_per_quarter,
                initiatives=self._initiative_views(ctx.state),
                workspace=ctx.workspace,
                flags=self._flags(gs, ctx),
                round2_mechanic=gs.round2_mechanic,
                round2_granted=gs.round2_granted,
                ai_enabled=self.ai_enabled,
                include_translation=self._opt(gs, "include_translation", True),
            )

    def _flags(self, gs: GameSession, ctx: TeamContext) -> v.TeamFlags:
        ws = ctx.workspace
        started = gs.stage_status != "not_started"
        return v.TeamFlags(
            can_edit_priorities=started and not self._reached(gs, StageKind.SIMULATE_Y1),
            can_edit_round1=started
            and ws.round1_submitted_at is None
            and self._reached(gs, StageKind.DIAGNOSE)
            and gs.simulated_years == 0,
            can_edit_round2=gs.simulated_years == 1 and ws.round2_submitted_at is None,
            can_edit_pitch=gs.simulated_years == 1 and not gs.round2_granted and ws.pitch_score is None,
            can_edit_opmodel=gs.simulated_years >= 1
            and ws.opmodel_submitted_at is None
            and self._reached(gs, StageKind.OPERATING_MODEL),
            can_respond_crisis=ws.crisis_event_id is not None and ws.crisis_response is None,
            can_capture_opportunities=started,
            results_years=[y for y in self._opt(gs, "released_years", []) if y <= gs.simulated_years],
            results_pending=[
                y for y in range(1, gs.simulated_years + 1) if y not in self._opt(gs, "released_years", [])
            ],
            scorecard_available=gs.simulated_years == 2 and bool(self._opt(gs, "scorecards_released", False)),
            opmodel_compressed=bool(self._opt(gs, "opmodel_compressed", False)),
            debrief_open=self._reached(gs, StageKind.DEBRIEF),
        )

    # ------------------------------------------------------------------ data room

    def _visible(self, gs: GameSession, payer_id: str, art) -> bool:
        if f"{payer_id}:{art.id}" in gs.released:
            return True
        stage = {
            "company": StageKind.COMPANY,
            "diagnose": StageKind.DIAGNOSE,
            "analyze": StageKind.ANALYZE,
            "crisis": StageKind.CRISIS,
        }[art.release]
        return self._reached(gs, stage)

    def _item(self, a, *, visible: bool = True, facilitator: bool = False) -> v.DataRoomItem:
        return v.DataRoomItem(
            id=a.id,
            title=a.title,
            domain=a.domain.value,
            format=a.format.value,
            kind=a.kind,
            summary=a.summary,
            tags=a.tags,
            release=a.release,
            is_new=a.release not in ("company", "diagnose"),
            visible=visible,
            supports=a.supports if facilitator else None,
        )

    def dataroom(self, team_id: str) -> list[v.DataRoomItem]:
        with self._db() as db:
            ctx = self._team(db, team_id)
            gs = self._session(db, ctx.row.session_id)
            room = self.content.datarooms[ctx.row.payer_id]
            return [self._item(a) for a in room.artifacts if self._visible(gs, ctx.row.payer_id, a)]

    def facilitator_dataroom(self, session_id: str, team_id: str) -> list[v.DataRoomItem]:
        self.assert_team_in_session(session_id, team_id)
        with self._db() as db:
            ctx = self._team(db, team_id)
            gs = self._session(db, session_id)
            room = self.content.datarooms[ctx.row.payer_id]
            return [
                self._item(a, visible=self._visible(gs, ctx.row.payer_id, a), facilitator=True)
                for a in room.artifacts
            ]

    def artifact(self, team_id: str, artifact_id: str, *, as_facilitator: bool = False) -> v.ArtifactContent:
        with self._db() as db:
            ctx = self._team(db, team_id)
            gs = self._session(db, ctx.row.session_id)
            payer_id = ctx.row.payer_id
            art = self.content.artifacts.get((payer_id, artifact_id))
            if art is None or (not as_facilitator and not self._visible(gs, payer_id, art)):
                raise NotFound("Artifact not found")
            text = self.content.read_artifact(payer_id, artifact_id)
            if not as_facilitator:
                self._log(db, gs.id, "artifact_viewed", "team", team_id, artifact_id=artifact_id)
                db.commit()
        base = {
            "id": art.id,
            "title": art.title,
            "domain": art.domain.value,
            "format": art.format.value,
            "kind": art.kind,
        }
        if art.kind == "table":
            rows = list(csv.reader(io.StringIO(text)))
            return v.ArtifactContent(**base, columns=rows[0] if rows else [], rows=rows[1:])
        return v.ArtifactContent(**base, markdown=text)

    # ------------------------------------------------------------------ pilot indicators

    def feedback_summary(self, session_id: str) -> v.FeedbackSummary:
        with self._db() as db:
            self._session(db, session_id)
            rows = self._teams(db, session_id)
        entries = [f for r in rows for f in Workspace.model_validate(r.workspace).feedback]

        def avg(xs: list[float]) -> float | None:
            return round(sum(xs) / len(xs), 2) if xs else None

        return v.FeedbackSummary(
            responses=len(entries),
            learning_avg=avg([f.learning for f in entries]),
            learning_4plus_pct=avg([1.0 if f.learning >= 4 else 0.0 for f in entries]),
            judgment_changed_pct=avg([1.0 if f.judgment_changed else 0.0 for f in entries]),
            usefulness_avg=avg([f.usefulness_vs_presentation for f in entries]),
            usefulness_4plus_pct=avg([1.0 if f.usefulness_vs_presentation >= 4 else 0.0 for f in entries]),
            realism_avg=avg([f.realism for f in entries]),
            recommend_avg=avg([f.would_recommend for f in entries]),
            comments=[f.comments for f in entries if f.comments.strip()][:50],
        )

    # ------------------------------------------------------------------ diagnose

    def set_priorities(self, team_id: str, priorities: list[Priority]) -> Workspace:
        def apply(_db: Session, gs: GameSession, ctx: TeamContext) -> Workspace:
            if not self._flags(gs, ctx).can_edit_priorities:
                raise Forbidden("Priorities are locked at this stage")
            payer_id = ctx.row.payer_id
            for p in priorities:
                for a in p.evidence:
                    art = self.content.artifacts.get((payer_id, a))
                    if art is None or not self._visible(gs, payer_id, art):
                        raise InvalidAction(f"Unknown evidence artifact '{a}'")
            ctx.workspace.priorities = priorities
            return ctx.workspace

        return self._mutate_team(
            team_id, apply, "priorities_saved", priorities=[p.model_dump() for p in priorities]
        )

    # ------------------------------------------------------------------ round 1

    def _fund_item(self, state: TeamState, item: DraftItem | Round2Action, round_no: int) -> None:
        fund(
            state,
            self.content,
            item.investment_id,
            round_no,
            scope=item.scope,
            start_offset=item.start_offset,
            owner=item.owner,
        )

    def _warnings(self, state: TeamState, c: ContentBundle) -> tuple[list[str], list[float]]:
        plan = capacity_plan(state, c)
        payer = c.payers[state.payer_id]
        cap = c.config.capacity_overrun_cap
        warnings = []
        for i, util in enumerate(plan):
            label = quarter_label(state.quarter + i)
            if util > cap:
                warnings.append(
                    f"{label}: capacity demand is {util:.0%} of your {payer.capacity_per_quarter:g} points. Above "
                    f"{cap:.0%}, everything progresses at half speed and AI maturity is capped."
                )
            elif util > 1:
                warnings.append(
                    f"{label}: capacity demand is {util:.0%} of supply; delivery slows proportionally."
                )
        for ini in state.initiatives:
            inv = self.content.investments[ini.investment_id]
            if inv.owner_required and not ini.owner.strip() and ini.in_portfolio:
                consequence = (
                    "it has no effect"
                    if inv.owner_missing_multiplier == 0
                    else "its prerequisites are not met"
                )
                warnings.append(
                    f"{inv.code} needs a named {inv.owner_prompt.lower()}; without one {consequence}."
                )
        return warnings, plan

    def _preview_round1(self, state: TeamState, items: list[DraftItem], c: ContentBundle) -> v.DraftPreview:
        trial = state.model_copy(deep=True)
        errors = []
        seen = set()
        for item in items:
            if item.investment_id in seen:
                errors.append(f"{item.investment_id} appears twice")
                continue
            seen.add(item.investment_id)
            try:
                self._fund_item(trial, item, 1)
            except SimulationError as exc:
                errors.append(str(exc))
        warnings, plan = self._warnings(trial, c)
        return v.DraftPreview(
            ledger=v.LedgerView(**ledger(trial, c).__dict__),
            errors=errors,
            warnings=warnings,
            capacity=plan,
        )

    def save_round1(self, team_id: str, items: list[DraftItem], thesis: str) -> v.DraftPreview:
        def apply(_db: Session, gs: GameSession, ctx: TeamContext) -> v.DraftPreview:
            if not self._flags(gs, ctx).can_edit_round1:
                raise Forbidden("Round 1 is not open for editing")
            ctx.workspace.round1_draft = items
            ctx.workspace.thesis_r1 = thesis
            return self._preview_round1(ctx.state, items, self._c(gs))

        return self._mutate_team(
            team_id, apply, "round1_draft_saved", items=[i.model_dump() for i in items], thesis=thesis
        )

    def submit_round1(self, team_id: str) -> v.TeamView:
        def apply(_db: Session, gs: GameSession, ctx: TeamContext) -> None:
            if not self._flags(gs, ctx).can_edit_round1:
                raise Forbidden("Round 1 is not open")
            if not ctx.workspace.round1_draft:
                raise InvalidAction("Add at least one investment before submitting")
            if not ctx.workspace.thesis_r1.strip():
                raise InvalidAction("State your investment thesis before submitting")
            self._apply_round1(ctx, self._c(gs))

        self._mutate_team(team_id, apply, "round1_submitted")
        return self.team_view(team_id)

    def _apply_round1(self, ctx: TeamContext, c: ContentBundle) -> None:
        preview = self._preview_round1(ctx.state, ctx.workspace.round1_draft, c)
        if preview.errors:
            raise InvalidAction("Portfolio is not valid", details=preview.errors)
        for item in ctx.workspace.round1_draft:
            self._fund_item(ctx.state, item, 1)
        ctx.workspace.round1_submitted_at = utcnow()

    # ------------------------------------------------------------------ board pitch

    def _round2_base(self, ws: Workspace, c: ContentBundle) -> float:
        return ws.round2_base_musd if ws.round2_base_musd is not None else c.config.round2_base_musd

    def _evidence_corpus(self, ctx: TeamContext, c: ContentBundle) -> str:
        payer_id = ctx.row.payer_id
        parts = [
            self.content.read_artifact(payer_id, a.id) for a in self.content.datarooms[payer_id].artifacts
        ]
        parts += [f"{i.cost_text} {i.effect_text} {i.opex_text}" for i in self.content.investments.values()]
        parts.append(json.dumps(self.content.payers[payer_id].model_dump(mode="json")))
        if ctx.state.quarter >= QUARTERS_PER_YEAR:
            parts.append(year_report(ctx.state, c, 1).model_dump_json())
        return "\n".join(parts)

    def save_pitch(self, team_id: str, pitch: PitchSubmission, submit: bool) -> v.PitchReview:
        def apply(_db: Session, gs: GameSession, ctx: TeamContext) -> v.PitchReview:
            if not self._flags(gs, ctx).can_edit_pitch:
                raise Forbidden("The board pitch opens after Year 1 and closes when it is scored")
            payer_id = ctx.row.payer_id
            valid = {a.id for a in self.content.datarooms[payer_id].artifacts}
            unknown = [a for a in pitch.evidence if a not in valid]
            if unknown:
                raise InvalidAction(f"Unknown evidence artifact(s): {unknown}")
            ctx.workspace.pitch = pitch
            figures = unsupported_figures(pitch.text, self._evidence_corpus(ctx, self._c(gs)))
            ctx.workspace.pitch_figures = figures
            if submit:
                ctx.workspace.pitch_submitted_at = utcnow()
                ctx.state.pitch_unsupported_figure = bool(figures)
            return v.PitchReview(pitch=pitch.model_dump(), score=None, unsupported_figures=figures)

        return self._mutate_team(team_id, apply, "pitch_submitted" if submit else "pitch_saved")

    def pitch_review(self, session_id: str, team_id: str, *, allow_ai: bool = True) -> v.PitchReview:
        """Suggested rubric score (AI-assisted when available, OD-08) for the facilitator."""
        self.assert_team_in_session(session_id, team_id)
        with self._db() as db:
            ctx = self._team(db, team_id)
            c = self._c(self._session(db, session_id))
        ws = ctx.workspace
        if ws.pitch_score:
            return v.PitchReview(
                pitch=ws.pitch.model_dump(), score=ws.pitch_score, unsupported_figures=ws.pitch_figures
            )
        key = (team_id, ws.pitch.model_dump_json())
        score = self._pitch_cache.get(key)
        if score is None:
            valid = {a.id for a in self.content.datarooms[ctx.row.payer_id].artifacts}
            ai = None
            if allow_ai and self.advisor and self.options.pitch_ai_suggest and ws.pitch_submitted_at:
                results = year_report(ctx.state, c, 1).model_dump_json() if ctx.state.quarter >= 4 else ""
                ai = self.advisor.suggest_pitch(c, ctx.row.payer_id, ws.pitch, results)
            score = score_pitch(c, ws.pitch, valid, ai_suggestion=ai)
            if ai is not None:  # one AI suggestion per submitted pitch (AI calls cost money)
                self._pitch_cache[key] = score
        return v.PitchReview(pitch=ws.pitch.model_dump(), score=score, unsupported_figures=ws.pitch_figures)

    def set_pitch_score(
        self, session_id: str, team_id: str, rows: dict[str, int], note: str
    ) -> v.SessionView:
        review = self.pitch_review(session_id, team_id, allow_ai=False)  # saving never waits on AI
        suggested = review.score.suggested if review.score else {}
        why = review.score.rationale if review.score else {}
        source = review.score.source if review.score else "engine"

        def edit(gs: GameSession, ctx: TeamContext) -> None:
            if gs.round2_granted:
                raise Conflict("Round 2 capital is already granted; adjust capital instead")
            ctx.workspace.pitch_score = build_score(
                self.content.rubrics.pitch, suggested, why, override=rows, note=note, source=source
            )

        self._facilitator_team_edit(session_id, team_id, "pitch_scored", note, edit, rows=rows)
        return self.session_view(session_id)

    def set_round2_base(self, session_id: str, team_id: str, amount: float, note: str) -> v.SessionView:
        def edit(gs: GameSession, ctx: TeamContext) -> None:
            if gs.round2_granted:
                raise Conflict("Round 2 capital is already granted; adjust capital instead")
            ctx.workspace.round2_base_musd = amount

        self._facilitator_team_edit(session_id, team_id, "round2_base_set", note, edit, amount=amount)
        return self.session_view(session_id)

    def grant_round2(self, session_id: str) -> v.SessionView:
        with self._lock, self._db() as db:
            gs = self._session(db, session_id)
            if gs.simulated_years < 1:
                raise Conflict("Simulate Year 1 before granting Round 2 capital")
            if gs.round2_granted:
                raise Conflict("Round 2 capital already granted")
            mechanic = Round2Mechanic(gs.round2_mechanic)
            c = self._c(gs)
            contexts = [self._team(db, t.id) for t in self._teams(db, gs.id)]
            ranks: dict[str, int] = {}
            if mechanic is Round2Mechanic.DIFFERENTIATED:
                ordered = sorted(contexts, key=lambda x: -build_scorecard(x.state, c).total)
                ranks = {c.row.id: i for i, c in enumerate(ordered)}
            if mechanic is Round2Mechanic.HYBRID:
                missing = [c.row.name for c in contexts if c.workspace.pitch_score is None]
                if missing:
                    raise Conflict(f"Score every board pitch first: {', '.join(missing)}")
            grants = {}
            for ctx in contexts:
                pitch_total = None
                if ctx.workspace.pitch_score:
                    pitch_total = max(
                        0, ctx.workspace.pitch_score.total + int(ctx.state.pitch_points_adjustment)
                    )
                amount = round2_capital(
                    c,
                    mechanic,
                    base=self._round2_base(ctx.workspace, c),
                    pitch_total=pitch_total,
                    rank=ranks.get(ctx.row.id),
                    teams=len(contexts),
                )
                ctx.state.capital_round2_musd = amount
                grants[ctx.row.name] = amount
                self._save(db, ctx)
            gs.round2_granted = True
            db.add(gs)
            self._log(db, gs.id, "round2_granted", "facilitator", mechanic=mechanic.value, grants=grants)
            db.commit()
        self._publish(session_id, "session", "team:*")
        return self.session_view(session_id)

    # ------------------------------------------------------------------ round 2

    def _apply_actions(self, state: TeamState, actions: list[Round2Action]) -> list[str]:
        errors = []
        for a in actions:
            try:
                if a.action == "fund":
                    self._fund_item(state, a, 2)
                elif a.action == "pause":
                    pause(state, a.investment_id)
                elif a.action == "resume":
                    resume(state, a.investment_id)
                elif a.action == "cancel":
                    cancel(state, self.content, a.investment_id)
                elif a.action == "owner":
                    set_owner(state, a.investment_id, a.owner)
            except SimulationError as exc:
                errors.append(str(exc))
        return errors

    def _estimated_round2(self, ws: Workspace, c: ContentBundle, mechanic: str) -> float:
        base = self._round2_base(ws, c)
        if mechanic == Round2Mechanic.HYBRID.value and ws.pitch_score:
            from sim.engine import earned_capital

            return base + earned_capital(c, ws.pitch_score.total)
        return base

    def save_round2(self, team_id: str, actions: list[Round2Action], thesis: str) -> v.DraftPreview:
        def apply(_db: Session, gs: GameSession, ctx: TeamContext) -> v.DraftPreview:
            if not self._flags(gs, ctx).can_edit_round2:
                raise Forbidden("Round 2 is not open for editing")
            c = self._c(gs)
            trial = ctx.state.model_copy(deep=True)
            if not gs.round2_granted:
                trial.capital_round2_musd = self._estimated_round2(ctx.workspace, c, gs.round2_mechanic)
            errors = self._apply_actions(trial, actions)
            ctx.workspace.round2_draft = actions
            ctx.workspace.thesis_r2 = thesis
            warnings, plan = self._warnings(trial, c)
            return v.DraftPreview(
                ledger=v.LedgerView(**ledger(trial, c).__dict__),
                errors=errors,
                warnings=warnings,
                capacity=plan,
                capital_is_estimate=not gs.round2_granted,
            )

        return self._mutate_team(
            team_id, apply, "round2_draft_saved", actions=[a.model_dump() for a in actions], thesis=thesis
        )

    def submit_round2(self, team_id: str) -> v.TeamView:
        def apply(_db: Session, gs: GameSession, ctx: TeamContext) -> None:
            if not self._flags(gs, ctx).can_edit_round2:
                raise Forbidden("Round 2 is not open")
            if not gs.round2_granted:
                raise Conflict("Round 2 capital has not been granted yet")
            if not ctx.workspace.thesis_r2.strip():
                raise InvalidAction("Explain what you learned and what you are changing")
            self._apply_round2(ctx)

        self._mutate_team(team_id, apply, "round2_submitted")
        return self.team_view(team_id)

    def _apply_round2(self, ctx: TeamContext) -> None:
        trial = ctx.state.model_copy(deep=True)
        errors = self._apply_actions(trial, ctx.workspace.round2_draft)
        if errors:
            raise InvalidAction("Round 2 plan is not valid", details=errors)
        ctx.state = trial
        ctx.workspace.round2_submitted_at = utcnow()

    # ------------------------------------------------------------------ simulation

    def simulate(self, session_id: str, year: int, force: bool) -> v.SessionView:
        with self._lock, self._db() as db:
            gs = self._session(db, session_id)
            if year != gs.simulated_years + 1 or year > 2:
                raise Conflict(f"Next year to simulate is Year {gs.simulated_years + 1}")
            c = self._c(gs)
            contexts = [self._team(db, t.id) for t in self._teams(db, gs.id)]
            if year == 2 and not gs.round2_granted:
                raise Conflict("Grant Round 2 capital before simulating Year 2")
            pending = [
                c
                for c in contexts
                if (c.workspace.round1_submitted_at if year == 1 else c.workspace.round2_submitted_at) is None
            ]
            if pending and not force:
                raise Conflict("Some teams have not submitted", details=[c.row.name for c in pending])
            for ctx in pending:
                try:
                    self._apply_round1(ctx, c) if year == 1 else self._apply_round2(ctx)
                except InvalidAction:
                    if year == 1:
                        ctx.workspace.round1_submitted_at = utcnow()
                    else:
                        ctx.workspace.round2_submitted_at = utcnow()
                self._log(db, gs.id, "force_submitted", "facilitator", ctx.row.id, year=year)
            for ctx in contexts:
                run_year(ctx.state, c)
                self._save(db, ctx)
            gs.simulated_years = year
            db.add(gs)
            self._log(
                db, gs.id, "year_simulated", "facilitator", year=year, forced=[c.row.name for c in pending]
            )
            db.commit()
        self._publish(session_id, "session", "team:*")
        return self.session_view(session_id)

    def results(self, team_id: str, year: int, *, as_facilitator: bool = False) -> YearReport:
        with self._db() as db:
            ctx = self._team(db, team_id)
            gs = self._session(db, ctx.row.session_id)
        if year < 1 or ctx.state.quarter < year * QUARTERS_PER_YEAR:
            raise NotFound(f"Year {year} results are not available yet")
        if not as_facilitator and year not in self._opt(gs, "released_years", []):
            raise Forbidden(f"The Year {year} performance review has not been released yet")
        return year_report(ctx.state, self._c(gs), year)

    # ------------------------------------------------------------------ operating model

    def save_opmodel(self, team_id: str, design: OperatingModelDesign, submit: bool) -> Workspace:
        def apply(_db: Session, gs: GameSession, ctx: TeamContext) -> Workspace:
            if not self._flags(gs, ctx).can_edit_opmodel:
                raise Forbidden("The operating-model exercise is not open")
            ctx.workspace.opmodel_design = design
            if submit:
                compressed = bool(self._opt(gs, "opmodel_compressed", False))
                try:
                    score, findings = score_opmodel(design, ctx.state, self._c(gs), compressed=compressed)
                except ValueError as exc:
                    raise InvalidAction(str(exc)) from exc
                ctx.workspace.opmodel_score = score
                ctx.workspace.opmodel_findings = findings
                ctx.workspace.opmodel_submitted_at = utcnow()
                ctx.state.opmodel_missing_human_review = missing_human_review(design, self.content)
            return ctx.workspace

        return self._mutate_team(team_id, apply, "opmodel_submitted" if submit else "opmodel_saved")

    def override_opmodel(
        self, session_id: str, team_id: str, rows: dict[str, int], note: str
    ) -> v.SessionView:
        def edit(_gs: GameSession, ctx: TeamContext) -> None:
            sc = ctx.workspace.opmodel_score
            if sc is None:
                raise Conflict("The team has not submitted its operating model yet")
            ctx.workspace.opmodel_score = build_score(
                self.content.rubrics.opmodel, sc.suggested, sc.rationale, override=rows, note=note
            )

        self._facilitator_team_edit(session_id, team_id, "opmodel_scored", note, edit, rows=rows)
        return self.session_view(session_id)

    # ------------------------------------------------------------------ crisis

    def _exclusive_taken(self, db: Session, session_id: str, except_team: str | None = None) -> set[str]:
        """One-team-per-session events (E4) already assigned to another team."""
        exclusive = {e.id for e in self.content.events.values() if e.one_team_per_session}
        taken = set()
        for row in self._teams(db, session_id):
            event_id = Workspace.model_validate(row.workspace).crisis_event_id
            if row.id != except_team and event_id in exclusive:
                taken.add(event_id)
        return taken

    def crisis_candidates(self, session_id: str) -> dict[str, list[v.CrisisCandidateView]]:
        with self._db() as db:
            c = self._c(self._session(db, session_id))
            out = {}
            for row in self._teams(db, session_id):
                state = TeamState.model_validate(row.state)
                exclude = self._exclusive_taken(db, session_id, row.id)
                out[row.id] = [
                    v.CrisisCandidateView(**x.model_dump()) for x in rank_crises(state, c, exclude=exclude)
                ]
            return out

    def assign_crisis(
        self,
        session_id: str,
        team_id: str | None,
        event_id: str | None,
        severity: Severity | None = None,
        note: str = "",
    ) -> v.SessionView:
        with self._lock, self._db() as db:
            gs = self._session(db, session_id)
            if gs.simulated_years < 2:
                raise Conflict("Run both simulated years before the crisis")
            c = self._c(gs)
            if (event_id or severity) and not note.strip() and team_id is not None:
                raise InvalidAction("An audit note is required to override the recommended crisis")
            rows = self._teams(db, gs.id) if team_id is None else [db.get(Team, team_id)]
            for row in rows:
                if row is None or row.session_id != gs.id:
                    raise NotFound("Team not found in this session")
                ctx = self._team(db, row.id)
                if event_id:
                    event = self.content.events.get(event_id)
                    if event is None or (event.payer_ids and row.payer_id not in event.payer_ids):
                        raise InvalidAction(f"Crisis '{event_id}' does not apply to {row.name}")
                    if event.id in self._exclusive_taken(db, gs.id, row.id):
                        raise InvalidAction(f"{event.code} can be used for one team per session")
                    candidate = evaluate(event, ctx.state, c)
                    chosen = severity or (candidate.severity if candidate else next(iter(event.severities)))
                else:
                    ranked = rank_crises(ctx.state, c, exclude=self._exclusive_taken(db, gs.id, row.id))
                    if not ranked:
                        if team_id is None:
                            # Clean portfolio: no event fires (pack 5.2 "None"); the facilitator may
                            # still assign one manually.
                            self._log(db, gs.id, "crisis_none_eligible", "facilitator", row.id)
                            continue
                        raise InvalidAction(f"No eligible crisis for {row.name}; choose one manually")
                    event = self.content.events[ranked[0].event_id]
                    chosen = severity or ranked[0].severity
                if chosen not in event.severities:
                    raise InvalidAction(f"{event.code} has no {chosen.value} severity")
                ctx.workspace.crisis_event_id = event.id
                ctx.workspace.crisis_severity = chosen
                ctx.workspace.crisis_assigned_at = utcnow()
                ctx.workspace.crisis_response = None
                ctx.workspace.crisis_score = None
                self._save(db, ctx)
                self._log(
                    db,
                    gs.id,
                    "crisis_assigned",
                    "facilitator",
                    row.id,
                    event_id=event.id,
                    severity=chosen.value,
                    note=note,
                )
            db.commit()
        self._publish(session_id, "session", "team:*")
        return self.session_view(session_id)

    def crisis_briefing(self, team_id: str) -> v.CrisisBriefing:
        with self._db() as db:
            ctx = self._team(db, team_id)
        ws = ctx.workspace
        if ws.crisis_event_id is None:
            raise NotFound("No crisis has been assigned")
        e = self.content.events[ws.crisis_event_id]
        sev = e.severities.get(ws.crisis_severity) if ws.crisis_severity else None
        done = ws.crisis_response is not None
        return v.CrisisBriefing(
            event_id=e.id,
            code=e.code,
            title=e.title,
            packet=e.packet,
            severity=ws.crisis_severity.value if ws.crisis_severity else None,
            severity_description=sev.description if sev and done else None,
            minutes=e.minutes,
            assigned_at=ws.crisis_assigned_at,
            response=ws.crisis_response,
            score=ws.crisis_score,
            best_practice=e.best_practice if done else None,
            leadership_test=e.leadership_test if done else None,
            effect_text=e.effect_text if done else None,
        )

    def respond_crisis(self, team_id: str, response: CrisisResponse) -> v.CrisisBriefing:
        def apply(_db: Session, gs: GameSession, ctx: TeamContext) -> None:
            if not self._flags(gs, ctx).can_respond_crisis:
                raise Forbidden("No open crisis to respond to")
            literacy = self.content.config.literacy_card
            live = {i.investment_id for i in ctx.state.initiatives if i.is_live_at(ctx.state.quarter)}
            ctx.workspace.crisis_response = response
            ctx.workspace.crisis_score = score_crisis(self.content, response, literacy_live=literacy in live)

        self._mutate_team(team_id, apply, "crisis_responded", response=response.model_dump())
        return self.crisis_briefing(team_id)

    def override_crisis_score(
        self, session_id: str, team_id: str, rows: dict[str, int], note: str
    ) -> v.SessionView:
        def edit(_gs: GameSession, ctx: TeamContext) -> None:
            sc = ctx.workspace.crisis_score
            if sc is None or ctx.workspace.crisis_response is None:
                raise Conflict("The team has not responded yet")
            override = rows
            if ctx.workspace.crisis_response.disclosure is Disclosure.NONE:
                override = dict.fromkeys(rows, 0)
            ctx.workspace.crisis_score = build_score(
                self.content.rubrics.crisis, sc.suggested, sc.rationale, override=override, note=note
            )

        self._facilitator_team_edit(session_id, team_id, "crisis_scored", note, edit, rows=rows)
        return self.session_view(session_id)

    # ------------------------------------------------------------------ scorecards

    def _scorecard(self, state: TeamState, ws: Workspace, c: ContentBundle) -> Scorecard:
        crisis = None
        if ws.crisis_event_id and ws.crisis_severity:
            crisis = CrisisOutcome(
                event_id=ws.crisis_event_id,
                severity=ws.crisis_severity,
                rubric=ws.crisis_score,
                concealment=bool(ws.crisis_response and ws.crisis_response.disclosure is Disclosure.NONE),
            )
        return build_scorecard(
            state, c, opmodel=ws.opmodel_score, opmodel_design=ws.opmodel_design, crisis=crisis
        )

    def scorecard(self, team_id: str, *, as_facilitator: bool = False) -> Scorecard:
        with self._db() as db:
            ctx = self._team(db, team_id)
            gs = self._session(db, ctx.row.session_id)
        if ctx.state.quarter < QUARTERS_PER_YEAR:
            raise NotFound("No simulated results yet")
        if not as_facilitator and not self._flags(gs, ctx).scorecard_available:
            raise Forbidden("The final scorecard is released at the Final results stage")
        return self._scorecard(ctx.state, ctx.workspace, self._c(gs))

    def scoreboard(self, session_id: str) -> list[v.ScoreboardEntry]:
        with self._db() as db:
            c = self._c(self._session(db, session_id))
            rows = self._teams(db, session_id)
        board = []
        for row in rows:
            state = TeamState.model_validate(row.state)
            if state.quarter < QUARTERS_PER_YEAR:
                continue
            ws = Workspace.model_validate(row.workspace)
            payer = self.content.payers[row.payer_id]
            board.append(
                v.ScoreboardEntry(
                    team_id=row.id,
                    team_name=row.name,
                    payer_id=row.payer_id,
                    archetype=payer.archetype,
                    trap_title=payer.trap_title,
                    scorecard=self._scorecard(state, ws, c),
                )
            )
        board.sort(key=lambda b: -b.scorecard.total)
        return board

    # ------------------------------------------------------------------ translation

    def save_opportunities(
        self, team_id: str, items: list[Opportunity], consent: Consent | None
    ) -> Workspace:
        classes = set(self.content.opportunity.capability_classes)
        themes = set(self.content.opportunity.foundational_themes)

        def apply(_db: Session, gs: GameSession, ctx: TeamContext) -> Workspace:
            if not self._flags(gs, ctx).can_capture_opportunities:
                raise Forbidden("Opportunity capture opens when the session starts")
            for o in items:
                if o.capability_class not in classes:
                    raise InvalidAction(f"Unknown capability class '{o.capability_class}'")
                if set(o.foundations) - themes:
                    raise InvalidAction(
                        f"Unknown foundational theme(s): {sorted(set(o.foundations) - themes)}"
                    )
            ctx.workspace.opportunities = items
            if consent is not None:
                ctx.workspace.consent = consent
            return ctx.workspace

        return self._mutate_team(team_id, apply, "opportunities_saved", count=len(items))

    def add_feedback(self, team_id: str, feedback: Feedback) -> Workspace:
        def apply(_db: Session, _gs: GameSession, ctx: TeamContext) -> Workspace:
            ctx.workspace.feedback.append(feedback.model_copy(update={"at": utcnow()}))
            return ctx.workspace

        return self._mutate_team(team_id, apply, "feedback_submitted")

    def _quadrant(
        self, value: int, readiness: float
    ) -> Literal["act_now", "strategic", "quick_win", "defer"]:
        cfg = self.content.opportunity
        high_value = value >= cfg.act_now_value
        ready = readiness >= cfg.act_now_readiness
        if high_value:
            return "act_now" if ready else "strategic"
        return "quick_win" if ready else "defer"

    def opportunity_map(self, session_id: str) -> v.OpportunityMapView:
        with self._db() as db:
            self._session(db, session_id)
            rows = self._teams(db, session_id)
        items: list[v.OpportunityItem] = []
        for row in rows:
            ws = Workspace.model_validate(row.workspace)
            if not (ws.consent and ws.consent.granted):
                continue
            for o in ws.opportunities:
                avg = o.readiness.average
                items.append(
                    v.OpportunityItem(
                        **o.model_dump(exclude={"readiness"}),
                        readiness=o.readiness.model_dump(),
                        readiness_avg=round(avg, 2),
                        team=row.name,
                        quadrant=self._quadrant(o.value, avg),
                    )
                )
        counts: dict[str, int] = {}
        for it in items:
            counts[it.quadrant] = counts.get(it.quadrant, 0) + 1
        band = []
        for theme in self.content.opportunity.foundational_themes:
            linked = [it.title for it in items if theme in it.foundations]
            if len(linked) >= self.content.opportunity.foundational_min_links:
                band.append(v.FoundationBand(theme=theme, links=len(linked), opportunities=linked))
        return v.OpportunityMapView(items=items, counts=counts, foundational=band)

    def purge_expired(self) -> int:
        """OD-09: delete captured opportunities after the retention period."""
        cutoff = utcnow() - timedelta(days=self.options.opportunity_retention_days)
        purged = 0
        with self._lock, self._db() as db:
            for gs in db.exec(select(GameSession)):
                created = gs.created_at if gs.created_at.tzinfo else gs.created_at.replace(tzinfo=UTC)
                if created >= cutoff:
                    continue
                for row in self._teams(db, gs.id):
                    ws = Workspace.model_validate(row.workspace)
                    if ws.opportunities or ws.consent:
                        purged += len(ws.opportunities)
                        ws.opportunities, ws.consent = [], None
                        row.workspace = ws.model_dump(mode="json")
                        db.add(row)
                        self._log(db, gs.id, "opportunities_purged", "system", row.id)
            db.commit()
        return purged

    # ------------------------------------------------------------------ release, lock, session settings

    def release_results(self, session_id: str, year: int) -> v.SessionView:
        """Pack §9.2: run the engine, review before release, release the performance review."""
        with self._lock, self._db() as db:
            gs = self._session(db, session_id)
            if year > gs.simulated_years:
                raise Conflict(f"Simulate Year {year} first")
            released = sorted({*self._opt(gs, "released_years", []), year})
            gs.options = {**(gs.options or {}), "released_years": released}
            db.add(gs)
            self._log(db, gs.id, "results_released", "facilitator", year=year)
            db.commit()
        self._publish(session_id, "session", "team:*")
        return self.session_view(session_id)

    def release_scorecards(self, session_id: str) -> v.SessionView:
        with self._lock, self._db() as db:
            gs = self._session(db, session_id)
            if gs.simulated_years < 2:
                raise Conflict("Simulate Year 2 before releasing scorecards")
            gs.options = {**(gs.options or {}), "scorecards_released": True}
            db.add(gs)
            self._log(db, gs.id, "scorecards_released", "facilitator")
            db.commit()
        self._publish(session_id, "session", "team:*")
        return self.session_view(session_id)

    def lock_round(self, session_id: str, round_no: int) -> v.SessionView:
        """Pack §9.2 "lock at the timebox": apply every pending draft as submitted."""
        with self._lock, self._db() as db:
            gs = self._session(db, session_id)
            c = self._c(gs)
            if round_no == 1 and gs.simulated_years != 0:
                raise Conflict("Round 1 is already closed")
            if round_no == 2 and (gs.simulated_years != 1 or not gs.round2_granted):
                raise Conflict("Round 2 can be locked after Year 1 and once capital is granted")
            locked = []
            for row in self._teams(db, gs.id):
                ctx = self._team(db, row.id)
                ws = ctx.workspace
                if (ws.round1_submitted_at if round_no == 1 else ws.round2_submitted_at) is not None:
                    continue
                try:
                    self._apply_round1(ctx, c) if round_no == 1 else self._apply_round2(ctx)
                except InvalidAction:
                    # An invalid draft is dropped; the team plays the round with what is already funded.
                    if round_no == 1:
                        ws.round1_submitted_at = utcnow()
                    else:
                        ws.round2_submitted_at = utcnow()
                self._save(db, ctx)
                locked.append(row.name)
            self._log(db, gs.id, "round_locked", "facilitator", round=round_no, teams=locked)
            db.commit()
        self._publish(session_id, "session", "team:*")
        return self.session_view(session_id)

    def rename_team(self, session_id: str, team_id: str, name: str, note: str) -> v.SessionView:
        clean = name.strip()[:80]
        if not clean:
            raise InvalidAction("Team name is required")

        def edit(_gs: GameSession, ctx: TeamContext) -> None:
            ctx.row.name = clean

        self._facilitator_team_edit(session_id, team_id, "team_renamed", note, edit, name=clean)
        return self.session_view(session_id)

    def purge_opportunities(self, session_id: str, note: str) -> v.SessionView:
        """OD-09: delete captured opportunities and consent when the organization asks."""
        if not note.strip():
            raise InvalidAction("An audit note is required")
        with self._lock, self._db() as db:
            gs = self._session(db, session_id)
            count = 0
            for row in self._teams(db, gs.id):
                ws = Workspace.model_validate(row.workspace)
                count += len(ws.opportunities)
                ws.opportunities, ws.consent = [], None
                row.workspace = ws.model_dump(mode="json")
                db.add(row)
            self._log(db, gs.id, "opportunities_deleted", "facilitator", note=note, count=count)
            db.commit()
        self._publish(session_id, "session", "team:*")
        return self.session_view(session_id)

    def session_settings(self, session_id: str) -> list[v.SessionSettingView]:
        from app.services.settings_store import FIELDS, get_path

        with self._db() as db:
            gs = self._session(db, session_id)
        config = self._c(gs).config.model_dump(mode="json")
        defaults = self.content.config.model_dump(mode="json")
        locked_model = gs.simulated_years >= 1
        out = []
        for f in FIELDS:
            if not f.session_editable:
                continue
            if f.key == "include_translation":
                value, default = self._opt(gs, "include_translation", True), self.options.include_translation
            elif f.key == "sim_mode":
                value, default = self._opt(gs, "sim_mode", "deterministic"), defaults["sim_mode"]
            elif f.key == "round2_mechanic":
                value, default = gs.round2_mechanic, defaults["round2_mechanic"]
            else:
                value, default = get_path(config, f.key), get_path(defaults, f.key)
            locked = (f.lock_after_year1 and locked_model) or (
                f.key == "round2_mechanic" and gs.round2_granted
            )
            out.append(
                v.SessionSettingView(
                    key=f.key,
                    group=f.group,
                    label=f.label,
                    help=f.help,
                    kind=f.kind,
                    options=list(f.options),
                    min=f.min,
                    max=f.max,
                    step=f.step,
                    value=value,
                    default=default,
                    locked=locked,
                )
            )
        return out

    def update_session_settings(self, session_id: str, values: dict[str, Any], note: str) -> v.SessionView:
        from app.services.settings_store import BY_KEY, coerce, merge_game

        if not note.strip():
            raise InvalidAction("An audit note is required to change session settings")
        current = {x.key: x for x in self.session_settings(session_id)}
        with self._lock, self._db() as db:
            gs = self._session(db, session_id)
            options = dict(gs.options or {})
            config_overrides: dict[str, Any] = {}
            for key, raw in values.items():
                if key not in current:
                    raise InvalidAction(f"'{key}' cannot be changed for a session")
                if current[key].locked:
                    raise Conflict(f"{current[key].label} is locked once Year 1 has been simulated")
                value = coerce(BY_KEY[key], raw)
                if key == "include_translation":
                    options["include_translation"] = value
                elif key == "round2_mechanic":
                    gs.round2_mechanic = value
                    config_overrides[key] = value
                else:
                    config_overrides[key] = value
                    if key == "sim_mode":
                        options["sim_mode"] = value
                        for row in self._teams(db, gs.id):
                            state = TeamState.model_validate(row.state)
                            state.variable = value == "variable"
                            row.state = state.model_dump(mode="json")
                            db.add(row)
            base = options.get("config") or self.content.config.model_dump(mode="json")
            options["config"] = merge_game(base, config_overrides).model_dump(mode="json")
            gs.options = options
            db.add(gs)
            self._log(db, gs.id, "session_settings_changed", "facilitator", note=note, values=values)
            db.commit()
        self._publish(session_id, "session", "team:*")
        return self.session_view(session_id)

    # ------------------------------------------------------------------ facilitator tools

    def _facilitator_team_edit(
        self,
        session_id: str,
        team_id: str,
        kind: str,
        note: str,
        edit: Callable[[GameSession, TeamContext], None],
        **payload: Any,
    ) -> None:
        if not note.strip():
            raise InvalidAction("An audit note is required for facilitator overrides (FUN-004)")
        with self._lock, self._db() as db:
            gs = self._session(db, session_id)
            ctx = self._team(db, team_id)
            if ctx.row.session_id != gs.id:
                raise NotFound("Team not found in this session")
            edit(gs, ctx)
            self._save(db, ctx)
            self._log(db, gs.id, kind, "facilitator", team_id, note=note, **payload)
            db.commit()
        self._publish(session_id, "session", f"team:{team_id}")

    def adjust_capital(self, session_id: str, team_id: str, amount: float, note: str) -> v.SessionView:
        def edit(_gs: GameSession, ctx: TeamContext) -> None:
            ctx.state.adjustments.append(CapitalAdjustment(amount_musd=amount, reason=note))
            if ledger(ctx.state, self.content).available < -1e-9:
                raise InvalidAction("Adjustment would leave the team with negative available capital")

        self._facilitator_team_edit(session_id, team_id, "capital_adjusted", note, edit, amount=amount)
        return self.session_view(session_id)

    def unlock(self, session_id: str, team_id: str, what: str, note: str) -> v.SessionView:
        def edit(gs: GameSession, ctx: TeamContext) -> None:
            if what == "round1":
                raise Conflict("Round 1 is applied at submission; adjust capital or use Round 2 instead")
            if what == "round2":
                if ctx.workspace.round2_submitted_at and gs.simulated_years == 1:
                    raise Conflict("Round 2 actions are already applied; adjust capital instead")
                ctx.workspace.round2_submitted_at = None
            elif what == "pitch":
                if gs.round2_granted:
                    raise Conflict("Round 2 capital is already granted")
                ctx.workspace.pitch_submitted_at = None
                ctx.workspace.pitch_score = None
            elif what == "opmodel":
                ctx.workspace.opmodel_submitted_at = None
            elif what == "crisis":
                ctx.workspace.crisis_response = None
                ctx.workspace.crisis_score = None

        self._facilitator_team_edit(session_id, team_id, "unlocked", note, edit, what=what)
        return self.session_view(session_id)

    def release_artifact(self, session_id: str, payer_id: str, artifact_id: str) -> v.SessionView:
        if (payer_id, artifact_id) not in self.content.artifacts:
            raise NotFound("Artifact not found")
        with self._lock, self._db() as db:
            gs = self._session(db, session_id)
            key = f"{payer_id}:{artifact_id}"
            if key not in gs.released:
                gs.released = [*gs.released, key]
                db.add(gs)
                self._log(
                    db, gs.id, "artifact_released", "facilitator", payer_id=payer_id, artifact_id=artifact_id
                )
                db.commit()
        self._publish(session_id, "session", "team:*")
        return self.session_view(session_id)

    def add_observation(self, session_id: str, text: str, team_id: str | None) -> None:
        if not text.strip():
            raise InvalidAction("Observation text is required")
        with self._lock, self._db() as db:
            self._session(db, session_id)
            self._log(db, session_id, "observation", "facilitator", team_id, text=text)
            db.commit()

    def answer_key(self, session_id: str) -> list[v.AnswerKeyEntry]:
        with self._db() as db:
            self._session(db, session_id)
            rows = self._teams(db, session_id)
        out = []
        for row in rows:
            p = self.content.payers[row.payer_id]
            room = self.content.datarooms[p.id]
            evidence: dict[str, list[str]] = {}
            for a in room.artifacts:
                evidence.setdefault(a.supports, []).append(f"{a.id} {a.title}")
            out.append(
                v.AnswerKeyEntry(
                    team_id=row.id,
                    team_name=row.name,
                    payer_id=p.id,
                    payer_name=p.name,
                    hidden_root_causes=[
                        {
                            **rc.model_dump(),
                            "evidence": evidence.get(rc.id, []),
                            "addressed_by": [self.content.investments[i].code for i in rc.addressed_by],
                        }
                        for rc in p.hidden_root_causes
                    ],
                    misleading_signals=[
                        {**ms.model_dump(), "evidence": evidence.get(ms.id, [])}
                        for ms in p.misleading_signals
                    ],
                    trap_title=p.trap_title,
                    trap_description=p.trap_description,
                    viable_strategies=[
                        {
                            **s.model_dump(),
                            "cards": [self.content.investments[i].code for i in [*s.round1, *s.round2]],
                        }
                        for s in p.viable_strategies
                    ],
                    failure_modes=[f.model_dump() for f in p.failure_modes],
                )
            )
        return out

    def team_detail(self, session_id: str, team_id: str) -> dict[str, Any]:
        self.assert_team_in_session(session_id, team_id)
        view = self.team_view(team_id)
        with self._db() as db:
            ctx = self._team(db, team_id)
        return {"team": view.model_dump(mode="json"), "state": ctx.state.model_dump(mode="json")}

    def events(self, session_id: str, since_id: int = 0) -> list[EventLog]:
        with self._db() as db:
            self._session(db, session_id)
            stmt = (
                select(EventLog)
                .where(EventLog.session_id == session_id, EventLog.id > since_id)
                .order_by(EventLog.id)
            )
            return list(db.exec(stmt))

    def playtest_report(self, session_id: str) -> PlaytestReport:
        """T-094: stage timing, engagement and stalls for comparing playtests."""
        with self._db() as db:
            gs = self._session(db, session_id)
            teams = [
                TeamInfo(id=t.id, name=t.name, payer=self.content.payers[t.payer_id].name)
                for t in self._teams(db, gs.id)
            ]
            stages = self.content.stages[: self._last_index(gs) + 1]
            current = None if gs.stage_status in {"not_started", "completed"} else stages[gs.stage_index].id
            config = self._c(gs).config
            name = gs.name
        return build_report(
            session_id=session_id,
            session_name=name,
            stages=stages,
            current_stage=current,
            teams=teams,
            events=self.events(session_id),
            feedback=self.feedback_summary(session_id),
            config=config,
        )

    def events_csv(self, session_id: str) -> str:
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(["id", "created_at", "team_id", "actor", "kind", "payload"])
        for e in self.events(session_id):
            writer.writerow(
                [
                    e.id,
                    e.created_at.isoformat(),
                    e.team_id or "",
                    e.actor,
                    e.kind,
                    json.dumps(e.payload, default=str),
                ]
            )
        return buf.getvalue()

    # ------------------------------------------------------------------ AI accounting

    def record_ai_request(
        self, team_id: str, limit_per_10min: int, question: str, mode: str, citations: list[str]
    ) -> None:
        from app.core.errors import RateLimited

        def apply(_db: Session, _gs: GameSession, ctx: TeamContext) -> None:
            now = utcnow()
            ws = ctx.workspace
            start = ws.ai_window_start
            if start is not None and start.tzinfo is None:
                start = start.replace(tzinfo=UTC)
            if start is None or (now - start).total_seconds() > 600:
                ws.ai_window_start, ws.ai_window_count = now, 0
            if ws.ai_window_count >= limit_per_10min:
                raise RateLimited("The analyst is busy — try again in a few minutes")
            ws.ai_window_count += 1
            ws.ai_requests += 1

        self._mutate_team(
            team_id, apply, "ai_query", question=question[:2000], mode=mode, citations=citations
        )

    def log_ai_answer(self, team_id: str, citations: list[str], generative: bool) -> None:
        with self._db() as db:
            session_id, _ = self.team_payer(team_id)
            self._log(
                db, session_id, "ai_answer", "system", team_id, citations=citations, generative=generative
            )
            db.commit()

    def team_payer(self, team_id: str) -> tuple[str, str]:
        with self._db() as db:
            row = db.get(Team, team_id)
            if row is None:
                raise NotFound("Team not found")
            return row.session_id, row.payer_id

    def team_context_text(self, team_id: str) -> str:
        """Short, non-spoiler context for the analyst (portfolio and latest results)."""
        with self._db() as db:
            ctx = self._team(db, team_id)
        lines = []
        for ini in ctx.state.initiatives:
            inv = self.content.investments[ini.investment_id]
            lines.append(
                f"{inv.code} {inv.name}: {ini.status.value}, {ini.progress:.0%} delivered, owner {ini.owner or 'none'}"
            )
        years = ctx.state.quarter // QUARTERS_PER_YEAR
        if years:
            with self._db() as db:
                c = self._c(self._session(db, ctx.row.session_id))
            r = year_report(ctx.state, c, years)
            lines.append(
                f"Year {years}: Stars rating {r.stars.year_rating}, projected {r.stars.projected} (simulated)"
            )
            lines += [
                f"{m.code} {m.name}: start {m.baseline}, year {m.year_value}, projected {m.projected}"
                for m in r.measures
            ]
        return "\n".join(lines)
