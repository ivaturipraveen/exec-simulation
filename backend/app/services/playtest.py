"""Playtest report (T-094): timing, engagement and stalls, rebuilt from the event log.

Everything is derived from events the game already records, so the report also works for sessions
played before it existed. The three internal playtests are compared on the same page: stage time vs
plan, what each team did, where teams went quiet, and the survey against the pilot targets.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from datetime import UTC, datetime
from itertools import pairwise
from typing import Literal

from pydantic import BaseModel

from app.db import EventLog
from app.schemas.views import FeedbackSummary
from sim.content.models import GameConfig, Stage, StageKind

# Stages where teams are expected to be doing something on screen.
WORKING_STAGES = {
    StageKind.COMPANY,
    StageKind.DIAGNOSE,
    StageKind.INVEST_R1,
    StageKind.ANALYZE,
    StageKind.INVEST_R2,
    StageKind.OPERATING_MODEL,
    StageKind.CRISIS,
    StageKind.TRANSLATE,
}
# Facilitator events that are part of running the session rather than an intervention.
ROUTINE = {
    "stage",
    "session_created",
    "year_simulated",
    "results_released",
    "scorecards_released",
    "observation",
}


class StageTiming(BaseModel):
    id: str
    title: str
    planned_minutes: float
    actual_minutes: float
    delta_minutes: float
    visits: int
    status: Literal["done", "current", "not_reached"]
    overrun: bool


class Stall(BaseModel):
    stage: str
    started_at: datetime
    minutes: float


class TeamEngagement(BaseModel):
    team_id: str
    team: str
    payer: str
    actions: int
    ai_questions: int
    artifacts_viewed: int
    round1_submit_minute: float | None
    round2_submit_minute: float | None
    forced: list[str]
    longest_quiet_minutes: float
    stalls: list[Stall]


class Observation(BaseModel):
    at: datetime
    stage: str
    team: str | None
    text: str


class PilotCheck(BaseModel):
    label: str
    value: float | None
    target: float
    met: bool | None


class PlaytestReport(BaseModel):
    session_id: str
    session_name: str
    generated_at: datetime
    started_at: datetime | None
    run_minutes: float
    paused_minutes: float
    planned_minutes: float
    stall_minutes: int
    stages: list[StageTiming]
    teams: list[TeamEngagement]
    interventions: dict[str, int]
    observations: list[Observation]
    feedback: FeedbackSummary
    pilot: list[PilotCheck]
    findings: list[str]


@dataclass
class TeamInfo:
    id: str
    name: str
    payer: str


@dataclass
class _Window:
    stage: Stage
    start: datetime
    end: datetime


def _utc(t: datetime) -> datetime:
    return t if t.tzinfo else t.replace(tzinfo=UTC)


def _mins(seconds: float) -> float:
    return round(seconds / 60, 1)


def _windows(events: list[EventLog], stages: dict[str, Stage], now: datetime) -> tuple[list[_Window], float]:
    """Running intervals per stage (pauses excluded) and total paused seconds."""
    windows: list[_Window] = []
    paused = 0.0
    current: Stage | None = None
    since: datetime | None = None
    paused_at: datetime | None = None
    for e in events:
        if e.kind != "stage":
            continue
        t = _utc(e.created_at)
        action = e.payload.get("action")
        stage = stages.get(str(e.payload.get("stage")))
        if action == "pause":
            if current and since:
                windows.append(_Window(current, since, t))
            since, paused_at = None, t
        elif action == "resume":
            if paused_at:
                paused += (t - paused_at).total_seconds()
            since, paused_at = t, None
        elif action == "complete":
            if current and since:
                windows.append(_Window(current, since, t))
            current = since = None
        elif stage is not None:  # start, next, previous, goto: enter `stage`
            if current and since:
                windows.append(_Window(current, since, t))
            if paused_at:
                paused += (t - paused_at).total_seconds()
                paused_at = None
            current, since = stage, t
    if current and since:
        windows.append(_Window(current, since, now))
    if paused_at:
        paused += (now - paused_at).total_seconds()
    return windows, paused


def _stage_at(windows: list[_Window], t: datetime) -> _Window | None:
    for w in windows:
        if w.start <= t < w.end:
            return w
    return None


def build_report(
    *,
    session_id: str,
    session_name: str,
    stages: list[Stage],
    current_stage: str | None,
    teams: list[TeamInfo],
    events: list[EventLog],
    feedback: FeedbackSummary,
    config: GameConfig,
    now: datetime | None = None,
) -> PlaytestReport:
    now = now or datetime.now(UTC)
    events = sorted(events, key=lambda e: (_utc(e.created_at), e.id or 0))
    by_id = {s.id: s for s in stages}
    windows, paused = _windows(events, by_id, now)
    stall_s = config.playtest_stall_minutes * 60

    # ---- stage timing
    actual: Counter[str] = Counter()
    visits: Counter[str] = Counter()
    for w in windows:
        actual[w.stage.id] += (w.end - w.start).total_seconds()
    for e in events:
        if e.kind == "stage" and e.payload.get("action") in {"start", "next", "previous", "goto"}:
            visits[str(e.payload.get("stage"))] += 1
    timings: list[StageTiming] = []
    for s in stages:
        got = _mins(actual[s.id])
        status = "current" if s.id == current_stage else "done" if visits[s.id] else "not_reached"
        timings.append(
            StageTiming(
                id=s.id,
                title=s.title,
                planned_minutes=s.duration_minutes,
                actual_minutes=got,
                delta_minutes=round(got - s.duration_minutes, 1) if visits[s.id] else 0.0,
                visits=visits[s.id],
                status=status,
                overrun=status == "done" and got > s.duration_minutes * (1 + config.playtest_overrun_share),
            )
        )
    entered = {s.id: min((w.start for w in windows if w.stage.id == s.id), default=None) for s in stages}

    # ---- team engagement
    engagement: list[TeamEngagement] = []
    for team in teams:
        own = [e for e in events if e.team_id == team.id]
        acts = [e for e in own if e.actor == "team"]
        kinds = Counter(e.kind for e in acts)

        def submit_minute(kind: str, stage_kind: StageKind, acts: list[EventLog] = acts) -> float | None:
            at = next((_utc(e.created_at) for e in acts if e.kind == kind), None)
            start = next((entered[s.id] for s in stages if s.kind == stage_kind and entered[s.id]), None)
            return _mins((at - start).total_seconds()) if at and start else None

        forced = [f"Year {e.payload.get('year')}" for e in own if e.kind == "force_submitted"]
        forced += [
            f"Round {e.payload.get('round')} lock"
            for e in events
            if e.kind == "round_locked" and team.id in (e.payload.get("teams") or [])
        ]

        # Quiet spells: time with no team action while a working stage runs, counted from the
        # moment the team first shows up (a team that never joined is reported separately).
        stalls: list[Stall] = []
        longest = 0.0
        times = [_utc(e.created_at) for e in acts]
        for w in windows if times else []:
            start = max(w.start, times[0])
            if w.stage.kind not in WORKING_STAGES or start >= w.end:
                continue
            marks = [start, *[t for t in times if start <= t < w.end], w.end]
            for a, b in pairwise(marks):
                gap = (b - a).total_seconds()
                longest = max(longest, gap)
                if gap >= stall_s:
                    stalls.append(Stall(stage=w.stage.title, started_at=a, minutes=_mins(gap)))
        engagement.append(
            TeamEngagement(
                team_id=team.id,
                team=team.name,
                payer=team.payer,
                actions=len(acts),
                ai_questions=kinds["ai_query"],
                artifacts_viewed=len(
                    {e.payload.get("artifact_id") for e in acts if e.kind == "artifact_viewed"}
                ),
                round1_submit_minute=submit_minute("round1_submitted", StageKind.INVEST_R1),
                round2_submit_minute=submit_minute("round2_submitted", StageKind.INVEST_R2),
                forced=forced,
                longest_quiet_minutes=_mins(longest),
                stalls=stalls,
            )
        )

    # ---- facilitator interventions and observations
    interventions = Counter(e.kind for e in events if e.actor == "facilitator" and e.kind not in ROUTINE)
    names = {t.id: t.name for t in teams}
    observations = [
        Observation(
            at=_utc(e.created_at),
            stage=(w.stage.title if (w := _stage_at(windows, _utc(e.created_at))) else "—"),
            team=names.get(e.team_id or ""),
            text=str(e.payload.get("text", "")),
        )
        for e in events
        if e.kind == "observation"
    ]

    # ---- pilot targets (docx §21)
    t = config.pilot_targets
    pilot = [
        PilotCheck(label="Learning rated 4+", value=feedback.learning_4plus_pct, target=t.learning, met=None),
        PilotCheck(
            label="Judgment changed", value=feedback.judgment_changed_pct, target=t.judgment_changed, met=None
        ),
        PilotCheck(
            label="More useful than a presentation (4+)",
            value=feedback.usefulness_4plus_pct,
            target=t.usefulness,
            met=None,
        ),
    ]
    for p in pilot:
        p.met = None if p.value is None else p.value >= p.target

    started = next(
        (_utc(e.created_at) for e in events if e.kind == "stage" and e.payload.get("action") == "start"), None
    )
    run = _mins(sum((w.end - w.start).total_seconds() for w in windows))
    reached = [s for s in timings if s.status != "not_reached"]
    report = PlaytestReport(
        session_id=session_id,
        session_name=session_name,
        generated_at=now,
        started_at=started,
        run_minutes=run,
        paused_minutes=_mins(paused),
        planned_minutes=float(sum(s.planned_minutes for s in reached)),
        stall_minutes=config.playtest_stall_minutes,
        stages=timings,
        teams=engagement,
        interventions=dict(interventions.most_common()),
        observations=observations,
        feedback=feedback,
        pilot=pilot,
        findings=[],
    )
    report.findings = _findings(report)
    return report


def _findings(r: PlaytestReport) -> list[str]:
    out: list[str] = []
    for s in r.stages:
        if s.overrun:
            out.append(
                f"{s.title} ran {s.actual_minutes:g} min against {s.planned_minutes:g} planned (+{s.delta_minutes:g})."
            )
        if s.visits > 1:
            out.append(f"{s.title} was entered {s.visits} times (the facilitator went back).")
    for t in r.teams:
        if not t.actions:
            out.append(f"{t.team} has no activity (never joined, or played on another team's screen).")
        elif t.ai_questions == 0:
            out.append(f"{t.team} never asked the AI analyst a question.")
        if t.forced:
            out.append(f"{t.team} did not submit on its own: {', '.join(t.forced)}.")
        for st in t.stalls:
            out.append(f"{t.team} was quiet for {st.minutes:g} min during {st.stage}.")
    for p in r.pilot:
        if p.met is False:
            out.append(f"Pilot target missed: {p.label} {p.value:.0%} vs {p.target:.0%}.")
    if r.feedback.responses == 0 and any(s.status != "not_reached" for s in r.stages):
        out.append("No participant survey responses yet.")
    return out


def report_markdown(r: PlaytestReport) -> str:
    def m(x: float | None) -> str:
        return "—" if x is None else f"{x:g}"

    def pct(x: float | None) -> str:
        return "—" if x is None else f"{x:.0%}"

    lines = [
        f"# Playtest report — {r.session_name}",
        "",
        f"Generated {r.generated_at:%Y-%m-%d %H:%M} UTC"
        + (f" · started {r.started_at:%Y-%m-%d %H:%M} UTC" if r.started_at else " · not started"),
        "",
        f"**Run time** {m(r.run_minutes)} min against {m(r.planned_minutes)} planned for the stages reached"
        f" · paused {m(r.paused_minutes)} min · stall threshold {r.stall_minutes} min",
        "",
        "## Findings",
        *([f"- {f}" for f in r.findings] or ["- Nothing flagged."]),
        "",
        "## Stage timing",
        "| Stage | Planned | Actual | Δ | Visits | |",
        "|---|---|---|---|---|---|",
        *[
            f"| {s.title} | {m(s.planned_minutes)} | {m(s.actual_minutes) if s.visits else '—'} | "
            f"{f'{s.delta_minutes:+g}' if s.visits else '—'} | {s.visits} | "
            f"{'⚠ overrun' if s.overrun else s.status.replace('_', ' ')} |"
            for s in r.stages
        ],
        "",
        "## Teams",
        "| Team | Company | Actions | AI questions | Artifacts | R1 submit (min) | R2 submit (min) | Longest quiet | Forced |",
        "|---|---|---|---|---|---|---|---|---|",
        *[
            f"| {t.team} | {t.payer} | {t.actions} | {t.ai_questions} | {t.artifacts_viewed} | "
            f"{m(t.round1_submit_minute)} | {m(t.round2_submit_minute)} | {m(t.longest_quiet_minutes)} min | "
            f"{', '.join(t.forced) or '—'} |"
            for t in r.teams
        ],
        "",
        "## Pilot indicators (docx §21)",
        f"{r.feedback.responses} survey responses.",
        "",
        "| Indicator | Result | Target | |",
        "|---|---|---|---|",
        *[
            f"| {p.label} | {pct(p.value)} | {pct(p.target)} | {'✅' if p.met else '—' if p.met is None else '❌'} |"
            for p in r.pilot
        ],
        "",
        "## Facilitator interventions",
        *([f"- {k.replace('_', ' ')}: {v}" for k, v in r.interventions.items()] or ["- None."]),
        "",
        "## Observations",
        *(
            [
                f"- {o.at:%H:%M} · {o.stage}{f' · {o.team}' if o.team else ''}: {o.text}"
                for o in r.observations
            ]
            or ["- None recorded. Use the observation log in the console during the playtest."]
        ),
    ]
    if r.feedback.comments:
        lines += ["", "## Participant comments", *[f"> {c}" for c in r.feedback.comments]]
    return "\n".join(lines) + "\n"
