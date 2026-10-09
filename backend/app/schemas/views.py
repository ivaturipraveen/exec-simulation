"""API response models. Team-facing views never include hidden mechanics (root causes,
rule multipliers, trigger logic); facilitator views add them."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.schemas.workspace import Workspace
from sim.content import ContentBundle
from sim.content.models import Investment, Payer, RubricRow
from sim.engine import CrisisResponse, RubricScore, Scorecard
from sim.engine.stars import measure_stars

# --------------------------------------------------------------------------- catalog


class MeasureView(BaseModel):
    id: str
    code: str
    name: str
    part: str
    domain: str
    weight: float
    unit: str
    unit_kind: str
    higher_is_better: bool
    cut_points: tuple[float, float, float, float]
    thresholds_text: str
    data_period: str
    lag_text: str
    leading_indicators: list[str]
    causal_pathway: str


class KpiView(BaseModel):
    id: str
    name: str
    unit: str
    higher_is_better: bool
    measures: list[str]


class ScopeView(BaseModel):
    id: str
    label: str
    cost_musd: float


class PayerFitView(BaseModel):
    level: str
    note: str


class InvestmentView(BaseModel):
    id: str
    code: str
    name: str
    capability_class: str
    class_label: str
    summary: str
    cost_musd: float
    cost_basis: str
    cost_text: str
    scopes: list[ScopeView]
    duration_quarters: int
    capacity_points: float
    opex_musd_per_year: float
    opex_text: str
    prerequisites_text: str
    effect_text: str
    decay_text: str
    risk_text: str
    synergies: list[str]
    conflicts_text: str
    reversible_text: str
    payer_fit: dict[str, PayerFitView]
    measures: list[str]
    owner_required: bool
    owner_prompt: str
    is_foundation: bool


def investment_view(inv: Investment, content: ContentBundle) -> InvestmentView:
    return InvestmentView(
        id=inv.id,
        code=inv.code,
        name=inv.name,
        capability_class=inv.capability_class.value,
        class_label=inv.class_label,
        summary=inv.summary,
        cost_musd=inv.cost_musd,
        cost_basis=inv.cost_basis,
        cost_text=inv.cost_text,
        scopes=[ScopeView(id=s.id, label=s.label, cost_musd=s.cost_musd) for s in inv.scopes],
        duration_quarters=inv.duration_quarters,
        capacity_points=inv.capacity_points,
        opex_musd_per_year=inv.opex_musd_per_year,
        opex_text=inv.opex_text,
        prerequisites_text=inv.prerequisites_text,
        effect_text=inv.effect_text,
        decay_text=inv.decay_text,
        risk_text=inv.risk.text,
        synergies=[content.investments[s].code for s in inv.synergies],
        conflicts_text=inv.conflicts_text,
        reversible_text=inv.reversible_text,
        payer_fit={pid: PayerFitView(level=f.level.value, note=f.note) for pid, f in inv.payer_fit.items()},
        measures=sorted({content.measures[e.measure].code for e in inv.effects}, key=lambda c: int(c[1:])),
        owner_required=inv.owner_required or bool(inv.owner_prompt),
        owner_prompt=inv.owner_prompt,
        is_foundation=inv.is_foundation,
    )


class StageView(BaseModel):
    id: str
    kind: str
    title: str
    start: str
    duration_minutes: int
    what_happens: str
    executive_question: str
    primary_output: str
    transition_script: str
    optional: bool


class FacilitatorStageView(StageView):
    lecture_minutes: int
    console_actions: list[str]
    facilitator_script: str


class WorkflowStepView(BaseModel):
    id: str
    number: int
    name: str
    description: str
    risk_level: str
    member_facing: bool
    sensitive: bool


class NamedItem(BaseModel):
    id: str
    name: str
    description: str


class RubricRowView(BaseModel):
    id: str
    criterion: str
    good_answer: str
    levels: list[str]


def rubric_view(rows: list[RubricRow]) -> list[RubricRowView]:
    return [
        RubricRowView(id=r.id, criterion=r.criterion, good_answer=r.good_answer, levels=list(r.levels))
        for r in rows
    ]


class CapitalTierView(BaseModel):
    min_score: int
    earned_musd: float


class PayerSummary(BaseModel):
    id: str
    name: str
    archetype: str
    tagline: str
    members: int
    starting_stars: float


class SimplificationView(BaseModel):
    actual: str
    representation: str
    reason: str
    risk: str
    disclosure: str


class OpportunityConfigView(BaseModel):
    capability_classes: list[str]
    readiness_dimensions: list[str]
    foundational_themes: list[str]
    act_now_value: int
    act_now_readiness: int
    foundational_min_links: int
    retention_months: int
    consent_text: str


class GameRules(BaseModel):
    round2_mechanic: str
    round2_base_musd: float
    pitch_capital: list[CapitalTierView]
    bonus_pmpy_usd: float
    target_stars: float
    confidence_band: float
    sim_mode: str
    score_weights: dict[str, float]
    critical_crisis_threshold: int
    pitch_word_limit: int
    pitch_words_per_second: float
    round2_max_earned_musd: float
    capacity_overrun_cap: float
    capacity_overrun_speed: float
    overrun_maturity_cap: float
    critical_incident_penalty: float
    member_harm_risk_cap: float
    payer_effectiveness: dict[str, float]
    diminishing_returns: list[float]
    adoption_with_workflow: float
    adoption_with_workflow_and_incentives: float
    adoption_literacy_bonus: float
    nudge_minutes: int
    pilot_targets: dict[str, float]


def game_rules(content: ContentBundle) -> GameRules:
    """Rules teams see (from the session's config snapshot when one applies)."""
    cfg = content.config
    return GameRules(
        round2_mechanic=cfg.round2_mechanic.value,
        round2_base_musd=cfg.round2_base_musd,
        pitch_capital=[
            CapitalTierView(min_score=t.min_score, earned_musd=t.earned_musd)
            for t in content.rubrics.pitch_capital
        ],
        bonus_pmpy_usd=cfg.bonus_pmpy_usd,
        target_stars=cfg.target_stars,
        confidence_band=cfg.confidence_band,
        sim_mode=cfg.sim_mode.value,
        score_weights=cfg.score_weights.model_dump(),
        critical_crisis_threshold=content.rubrics.critical_crisis_threshold,
        pitch_word_limit=cfg.pitch_word_limit,
        pitch_words_per_second=cfg.pitch_words_per_second,
        round2_max_earned_musd=max(t.earned_musd for t in content.rubrics.pitch_capital),
        capacity_overrun_cap=cfg.capacity_overrun_cap,
        capacity_overrun_speed=cfg.capacity_overrun_speed,
        overrun_maturity_cap=cfg.overrun_maturity_cap,
        critical_incident_penalty=cfg.critical_incident_penalty,
        member_harm_risk_cap=cfg.member_harm_risk_cap,
        payer_effectiveness={k.value: v for k, v in cfg.payer_effectiveness.items()},
        diminishing_returns=list(cfg.diminishing_returns),
        adoption_with_workflow=cfg.adoption_with_workflow,
        adoption_with_workflow_and_incentives=cfg.adoption_with_workflow_and_incentives,
        adoption_literacy_bonus=cfg.adoption_literacy_bonus,
        nudge_minutes=cfg.nudge_minutes,
        pilot_targets=cfg.pilot_targets.model_dump(),
    )


class CatalogView(BaseModel):
    edition: str
    content_version: str
    content_pack: str
    methodology_baseline_date: str
    measures: list[MeasureView]
    reserve_measures: list[str]
    kpis: list[KpiView]
    investments: list[InvestmentView]
    stages: list[StageView]
    workflow_steps: list[WorkflowStepView]
    workflow_controls: list[NamedItem]
    decision_dimensions: list[NamedItem]
    rubrics: dict[str, list[RubricRowView]]
    rules: GameRules
    payers: list[PayerSummary]
    simplifications: list[SimplificationView]
    opportunity: OpportunityConfigView


def catalog_view(content: ContentBundle) -> CatalogView:
    cfg = content.config
    return CatalogView(
        edition=cfg.edition,
        content_version=cfg.content_version,
        content_pack=cfg.content_pack,
        methodology_baseline_date=cfg.methodology_baseline_date,
        measures=[
            MeasureView(**m.model_dump(include=set(MeasureView.model_fields)))
            for m in content.measures.values()
        ],
        reserve_measures=cfg.reserve_measures,
        kpis=[KpiView(**k.model_dump(include=set(KpiView.model_fields))) for k in content.kpis.values()],
        investments=[investment_view(i, content) for i in content.investments.values()],
        stages=[StageView(**s.model_dump(include=set(StageView.model_fields))) for s in content.stages],
        workflow_steps=[
            WorkflowStepView(**s.model_dump(include=set(WorkflowStepView.model_fields)))
            for s in content.workflow_steps
        ],
        workflow_controls=[
            NamedItem(id=c.id, name=c.name, description=c.description) for c in content.workflow_controls
        ],
        decision_dimensions=[
            NamedItem(id=d.id, name=d.name, description=d.prompt) for d in content.decision_dimensions
        ],
        rubrics={
            "pitch": rubric_view(content.rubrics.pitch),
            "crisis": rubric_view(content.rubrics.crisis),
            "opmodel": rubric_view(content.rubrics.opmodel),
        },
        rules=game_rules(content),
        payers=[
            PayerSummary(
                id=p.id,
                name=p.name,
                archetype=p.archetype,
                tagline=p.tagline,
                members=p.members,
                starting_stars=p.starting_stars,
            )
            for p in content.payers.values()
        ],
        simplifications=[SimplificationView(**s.model_dump()) for s in content.simplifications],
        opportunity=OpportunityConfigView(**content.opportunity.model_dump()),
    )


# --------------------------------------------------------------------------- session / clock


class ClockView(BaseModel):
    stage_index: int
    stage_id: str
    stage_kind: str
    stage_title: str
    status: str
    duration_seconds: int
    elapsed_seconds: float
    remaining_seconds: float
    server_time: datetime


class LedgerView(BaseModel):
    granted: float
    committed: float
    spent: float
    available: float
    paused: float
    recoverable: float
    written_off: float


class ProfileRowView(BaseModel):
    label: str
    value: str


class BaselineMeasure(BaseModel):
    id: str
    code: str
    value: float
    stars: int
    headroom_text: str


class SegmentView(BaseModel):
    id: str
    name: str
    members: int
    starting_stars: float
    target_stars: float | None = None
    target_cycles: int = 2
    overrides: dict[str, float]


class PayerBriefing(BaseModel):
    id: str
    name: str
    archetype: str
    tagline: str
    members: int
    starting_stars: float
    starting_stars_text: str
    target_stars: float
    capital_round1_musd: float
    round2_base_musd: float
    capacity_per_quarter: float
    data_readiness: int
    dual_share: float
    bonus_value_musd: float
    profile: list[ProfileRowView]
    population: str
    board_mandate: str
    briefing: str
    advantages: list[str]
    constraints: list[str]
    conflict_hooks: list[dict[str, Any]]
    baseline: list[BaselineMeasure]
    kpis: dict[str, float]
    segments: list[SegmentView]


def payer_briefing(p: Payer, content: ContentBundle) -> PayerBriefing:
    cfg = content.config
    return PayerBriefing(
        id=p.id,
        name=p.name,
        archetype=p.archetype,
        tagline=p.tagline,
        members=p.members,
        starting_stars=p.starting_stars,
        starting_stars_text=p.starting_stars_text,
        target_stars=cfg.target_stars,
        capital_round1_musd=p.capital_round1_musd,
        round2_base_musd=cfg.round2_base_musd,
        capacity_per_quarter=p.capacity_per_quarter,
        data_readiness=p.data_readiness,
        dual_share=p.dual_share,
        bonus_value_musd=round(p.members * cfg.bonus_pmpy_usd / 1e6, 1),
        profile=[ProfileRowView(label=r.label, value=r.value) for r in p.profile],
        population=p.population,
        board_mandate=p.board_mandate,
        briefing=p.briefing,
        advantages=p.advantages,
        constraints=p.constraints,
        conflict_hooks=[h.model_dump() for h in p.conflict_hooks],
        baseline=[
            BaselineMeasure(
                id=m_id,
                code=content.measures[m_id].code,
                value=b.value,
                stars=measure_stars(content.measures[m_id], b.value),
                headroom_text=b.headroom_text,
            )
            for m_id, b in p.measures.items()
        ],
        kpis=dict(p.kpis),
        segments=[
            SegmentView(
                id=s.id,
                name=s.name,
                members=s.members,
                starting_stars=s.starting_stars,
                target_stars=s.target_stars,
                target_cycles=s.target_cycles,
                overrides={m: o.value for m, o in s.measure_overrides.items()},
            )
            for s in p.segments
        ],
    )


class InitiativeView(BaseModel):
    investment_id: str
    code: str
    name: str
    funded_round: int
    scope: str | None
    start_label: str
    owner: str
    owner_required: bool
    status: str
    progress: float
    live_label: str | None
    capital_committed: float
    capital_spent: float
    recoverable: float


class TeamFlags(BaseModel):
    can_edit_priorities: bool
    can_edit_round1: bool
    can_edit_round2: bool
    can_edit_pitch: bool
    can_edit_opmodel: bool
    can_respond_crisis: bool
    can_capture_opportunities: bool
    results_years: list[int]
    results_pending: list[int] = Field(default=[], description="Simulated years awaiting facilitator release")
    scorecard_available: bool
    opmodel_compressed: bool
    debrief_open: bool


class TeamView(BaseModel):
    team_id: str
    team_name: str
    session_id: str
    session_name: str
    payer: PayerBriefing
    rules: GameRules
    clock: ClockView
    ledger: LedgerView
    capacity_per_quarter: float
    initiatives: list[InitiativeView]
    workspace: Workspace
    flags: TeamFlags
    round2_mechanic: str
    round2_granted: bool
    ai_enabled: bool
    include_translation: bool


class DataRoomItem(BaseModel):
    id: str
    title: str
    domain: str
    format: str
    kind: str
    summary: str
    tags: list[str]
    release: str
    is_new: bool = False
    visible: bool = True
    supports: str | None = None


class ArtifactContent(BaseModel):
    id: str
    title: str
    domain: str
    format: str
    kind: str
    markdown: str | None = None
    columns: list[str] | None = None
    rows: list[list[str]] | None = None


class TeamProgress(BaseModel):
    team_id: str
    team_name: str
    payer_id: str
    payer_name: str
    join_code: str
    priorities: int
    evidence_cited: int
    needs_nudge: bool
    round1_submitted: bool
    round2_submitted: bool
    pitch_submitted: bool
    opmodel_submitted: bool
    crisis_event_id: str | None
    crisis_severity: str | None
    crisis_responded: bool
    pitch_total: int | None
    pitch_figures: list[str]
    opmodel_total: int | None
    crisis_total: int | None
    opportunities: int
    ai_requests: int
    available_musd: float
    granted_musd: float
    round2_base_musd: float
    capacity_peak: float | None
    root_causes_cited: int
    root_causes_total: int
    stars_projected: float | None
    score_total: float | None


class ContingencyHint(BaseModel):
    id: str
    condition: str
    cut: str
    behind_minutes: float


class SessionView(BaseModel):
    id: str
    name: str
    rules: GameRules
    seed: int
    round2_mechanic: str
    sim_mode: str
    content_version: str
    clock: ClockView
    stages: list[FacilitatorStageView]
    schedule_offset_minutes: float
    contingency: list[ContingencyHint]
    options: dict[str, Any]
    simulated_years: int
    round2_granted: bool
    released: list[str]
    teams: list[TeamProgress]
    created_at: datetime


class CreatedSession(BaseModel):
    session: SessionView
    facilitator_token: str


class JoinResult(BaseModel):
    token: str
    team_id: str
    session_id: str
    team_name: str
    payer_name: str


class DraftPreview(BaseModel):
    ledger: LedgerView
    errors: list[str]
    warnings: list[str] = []
    capacity: list[float] = []
    capital_is_estimate: bool = False


class CrisisBriefing(BaseModel):
    event_id: str
    code: str
    title: str
    packet: str
    severity: str | None
    severity_description: str | None
    minutes: int
    assigned_at: datetime | None
    response: CrisisResponse | None = None
    score: RubricScore | None = None
    best_practice: list[str] | None = None
    leadership_test: str | None = None
    effect_text: str | None = None


class CrisisCandidateView(BaseModel):
    event_id: str
    code: str
    title: str
    severity: str
    probability: float
    payer_specific: bool
    governance_lowered: bool
    reason: str


class ScoreboardEntry(BaseModel):
    team_id: str
    team_name: str
    payer_id: str
    archetype: str
    trap_title: str
    scorecard: Scorecard


class OpportunityItem(BaseModel):
    id: str
    participant: str
    title: str
    capability_class: str
    value_hypothesis: str
    value: int
    readiness: dict[str, int]
    readiness_avg: float
    dependencies: str
    risks: str
    owner: str
    next_step: str
    foundations: list[str]
    team: str
    quadrant: Literal["act_now", "strategic", "quick_win", "defer"]


class FoundationBand(BaseModel):
    theme: str
    links: int
    opportunities: list[str]


class OpportunityMapView(BaseModel):
    items: list[OpportunityItem]
    counts: dict[str, int]
    foundational: list[FoundationBand]
    synthesis: str | None = None


class AnswerKeyEntry(BaseModel):
    team_id: str
    team_name: str
    payer_id: str
    payer_name: str
    hidden_root_causes: list[dict[str, Any]]
    misleading_signals: list[dict[str, Any]]
    trap_title: str
    trap_description: str
    viable_strategies: list[dict[str, Any]]
    failure_modes: list[dict[str, Any]]


class EventView(BaseModel):
    id: int
    session_id: str
    team_id: str | None
    actor: str
    kind: str
    payload: dict[str, Any]
    created_at: datetime


class FeedbackSummary(BaseModel):
    """Pilot success indicators (§21), from the post-session participant survey."""

    responses: int
    learning_avg: float | None
    learning_4plus_pct: float | None
    judgment_changed_pct: float | None
    usefulness_avg: float | None
    usefulness_4plus_pct: float | None
    realism_avg: float | None
    recommend_avg: float | None
    comments: list[str]


class EventSummary(BaseModel):
    id: str
    code: str
    title: str
    payer_ids: list[str]
    trigger_text: str
    severities: list[str]
    minutes: int
    leadership_test: str


class SessionSettingView(BaseModel):
    key: str
    group: str
    label: str
    help: str
    kind: Literal["bool", "int", "float", "percent", "money", "enum", "text"]
    options: list[str]
    min: float | None
    max: float | None
    step: float | None
    value: Any
    default: Any
    locked: bool


class EditionInfo(BaseModel):
    content_pack: str
    content_version: str
    assumptions: list[dict[str, Any]]
    simplifications: list[SimplificationView]
    warnings: list[str]
    contingency_cuts: list[dict[str, Any]]
    events: list[EventSummary]
    workflow_notes: dict[str, str]
    review: list[dict[str, Any]] = []


class PitchReview(BaseModel):
    pitch: dict[str, Any]
    score: RubricScore | None
    unsupported_figures: list[str]
