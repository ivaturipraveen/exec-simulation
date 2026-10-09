"""Typed content model for the simulation (Content Pack v0.1).

All gameplay content (payers, measures, investment cards, leading KPIs, crisis events,
run-of-show, rubrics, data rooms, assumptions and the simplification register) lives in
YAML under ``content/`` and is validated against these models. The engine is generic:
card behaviour is expressed with a small condition vocabulary (``Condition``) so that a
content owner can change a rule without touching code.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

Fraction = Annotated[float, Field(ge=0.0, le=1.0)]
Slug = Annotated[str, Field(pattern=r"^[a-z0-9][a-z0-9_-]*$", max_length=64)]
ArtifactId = Annotated[str, Field(pattern=r"^[A-Z]-\d{2}$")]


class _Model(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


# --------------------------------------------------------------------------- enums


class Level(StrEnum):
    """Payer effectiveness of a card (section 5.1): High 1.0, Medium 0.6, Low 0.3."""

    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class CapabilityClass(StrEnum):
    DATA_FOUNDATION = "data_foundation"
    PREDICTIVE = "predictive"
    COPILOT = "copilot"
    GENERATIVE = "generative"
    AGENT = "agent"
    GOVERNANCE = "governance"
    OPERATING_MODEL = "operating_model"
    OPERATIONS = "operations"
    AUTOMATION = "automation"
    ADOPTION = "adoption"


class Department(StrEnum):
    """The eight data-room domains."""

    STARS_QUALITY = "stars_quality"
    MEMBERS = "members"
    PHARMACY = "pharmacy"
    EXPERIENCE = "experience"
    PROVIDERS = "providers"
    TECHNOLOGY = "technology"
    FINANCE = "finance"
    RISK = "risk"


class ArtifactFormat(StrEnum):
    DASHBOARD = "dashboard"
    TABLE = "table"
    LOG = "log"
    MEMO = "memo"
    SURVEY = "survey"
    MODEL_CARD = "model_card"
    AUDIT = "audit"
    DECK = "deck"
    CONTRACT = "contract"


class StageKind(StrEnum):
    BRIEFING = "briefing"
    COMPANY = "company"
    DIAGNOSE = "diagnose"
    INVEST_R1 = "invest_r1"
    SIMULATE_Y1 = "simulate_y1"
    ANALYZE = "analyze"
    INVEST_R2 = "invest_r2"
    SIMULATE_Y2 = "simulate_y2"
    OPERATING_MODEL = "operating_model"
    CRISIS = "crisis"
    RESULTS = "results"
    DEBRIEF = "debrief"
    TRANSLATE = "translate"


class Round2Mechanic(StrEnum):
    """OD-02. ``hybrid`` (base + pitch-earned capital) is the Content Pack default."""

    FIXED = "fixed"
    DIFFERENTIATED = "differentiated"
    HYBRID = "hybrid"


class SimMode(StrEnum):
    """OD-11: deterministic draws the midpoint of each effect range; variable draws within it."""

    DETERMINISTIC = "deterministic"
    VARIABLE = "variable"


class WorkflowMode(StrEnum):
    HUMAN = "human"
    AI_ASSIST = "ai_assist"
    AGENT_APPROVAL = "agent_approval"
    AUTONOMOUS = "autonomous"


class Severity(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class Channel(StrEnum):
    """How a card reaches members; drives the dual-eligible equity modifier."""

    DIGITAL = "digital"
    PHONE = "phone"
    PROVIDER = "provider"
    ACCESS = "access"
    INTERNAL = "internal"


# --------------------------------------------------------------------------- conditions


class Condition(_Model):
    """A conjunction of tests against a team's state. An empty condition is always true.

    *live* means delivered (progress 1.0) and not paused or cancelled; *funded* means in the
    portfolio (any status except cancelled).
    """

    any_live: list[Slug] = []
    all_live: list[Slug] = []
    none_live: list[Slug] = []
    not_all_live: list[Slug] = Field(default=[], description="True when at least one is not live")
    any_funded: list[Slug] = []
    all_funded: list[Slug] = []
    none_funded: list[Slug] = []
    not_live_by_year1: list[Slug] = Field(
        default=[], description="True when any of these was not live at the end of Year 1"
    )
    funded_full_scope: list[Slug] = []
    funded_partial_scope: list[Slug] = []
    funded_round1: list[Slug] = []
    kpi_below: dict[Slug, float] = {}
    kpi_at_least: dict[Slug, float] = {}
    payers: list[Slug] = []
    not_payers: list[Slug] = []
    payer_flags: list[Slug] = []
    not_payer_flags: list[Slug] = []
    opmodel_missing_human_review: bool = False
    pitch_unsupported_figure: bool = False

    def references(self) -> set[str]:
        return {
            *self.any_live,
            *self.all_live,
            *self.none_live,
            *self.not_all_live,
            *self.any_funded,
            *self.all_funded,
            *self.none_funded,
            *self.not_live_by_year1,
            *self.funded_full_scope,
            *self.funded_partial_scope,
            *self.funded_round1,
        }


# --------------------------------------------------------------------------- measures / KPIs


class Measure(_Model):
    id: Slug
    code: str = Field(pattern=r"^M\d{1,2}$")
    name: str
    part: Literal["C", "D", "C and D"]
    domain: str
    weight: Annotated[float, Field(gt=0, le=5)]
    unit: str
    unit_kind: Literal["percent", "score", "rate"]
    higher_is_better: bool = True
    cut_points: tuple[float, float, float, float] = Field(
        description="Thresholds for 2, 3, 4 and 5 Stars. Higher-is-better: rate >= cut. "
        "Lower-is-better: rate < cut."
    )
    thresholds_text: str
    data_period: str
    lag_share: Fraction = Field(description="Share of full effect realized in the next rating year")
    lag_text: str
    leading_indicators: list[str] = Field(min_length=1)
    leading_kpis: list[Slug] = []
    causal_pathway: str
    simplification: str = ""

    @model_validator(mode="after")
    def _monotonic_cut_points(self) -> Measure:
        cps = list(self.cut_points)
        ordered = sorted(cps) if self.higher_is_better else sorted(cps, reverse=True)
        if cps != ordered:
            raise ValueError(f"cut_points for {self.id} must move in the direction of improvement")
        return self


class Kpi(_Model):
    """Leading operational indicator. Moves the quarter after a card goes live."""

    id: Slug
    name: str
    unit: Literal["%", "days", "per 1,000", "minutes", "pts"]
    higher_is_better: bool = True
    measures: list[Slug] = []
    description: str = ""


# --------------------------------------------------------------------------- payers


class MeasureBaseline(_Model):
    value: float
    headroom: float = Field(
        description="Two-year headroom in measure units, signed in the improvement direction"
    )
    headroom_text: str
    root_cause_link: str


class RootCause(_Model):
    id: str = Field(pattern=r"^[A-Z]-RC\d$")
    title: str
    description: str
    affected_measures: list[Slug]
    clue: str = Field(description="Causal clue surfaced in the performance review while unaddressed")
    addressed_by: list[Slug] = Field(description="Investment ids that remediate this cause")


class MisleadingSignal(_Model):
    id: str = Field(pattern=r"^[A-Z]-MS\d$")
    title: str
    why_misleading: str


class Strategy(_Model):
    title: str
    description: str
    round1: list[Slug]
    round2: list[Slug] = []
    scopes: dict[Slug, Slug] = {}


class FailureMode(_Model):
    title: str
    description: str


class Drift(_Model):
    """Baseline movement that happens without action (e.g. Heritage's abandonment slide)."""

    measure: Slug
    delta_per_year: float = Field(description="Raw measure units per year (signed as reported)")
    unless: Condition
    note: str


class ConflictHook(_Model):
    roles: list[str] = Field(min_length=2)
    tension: str


class ProfileRow(_Model):
    label: str
    value: str


class Segment(_Model):
    """A book of business shown as a sub-rating (Heritage's Lakeshore contract)."""

    id: Slug
    name: str
    members: int
    starting_stars: float
    target_stars: float | None = Field(default=None, description="The board's goal for this book")
    target_cycles: int = 2
    measure_overrides: dict[Slug, MeasureBaseline]


class Payer(_Model):
    id: Slug
    name: str
    archetype: str
    tagline: str
    members: Annotated[int, Field(gt=0)]
    starting_stars: Annotated[float, Field(ge=1, le=5)]
    starting_stars_text: str
    rating_adjustment: float = Field(
        default=0.0,
        description="Constant added to the summary score to stand in for the ~30 measures not "
        "modelled, so the baseline matches the payer's stated starting rating",
    )
    capital_round1_musd: Annotated[float, Field(gt=0)]
    capacity_per_quarter: Annotated[float, Field(gt=0)]
    data_readiness: Annotated[int, Field(ge=1, le=5)]
    dual_share: Fraction
    flags: list[Slug] = []
    profile: list[ProfileRow]
    population: str
    board_mandate: str
    briefing: str
    advantages: list[str] = Field(min_length=1)
    constraints: list[str] = Field(min_length=1)
    hidden_root_causes: list[RootCause] = Field(min_length=3)
    misleading_signals: list[MisleadingSignal] = Field(min_length=2)
    trap_title: str
    trap_description: str
    measures: dict[Slug, MeasureBaseline]
    kpis: dict[Slug, float]
    viable_strategies: list[Strategy] = Field(min_length=2)
    failure_modes: list[FailureMode] = Field(min_length=2)
    drifts: list[Drift] = []
    segments: list[Segment] = []
    conflict_hooks: list[ConflictHook] = []
    savings_note: str = ""


# --------------------------------------------------------------------------- investment cards


class CardEffect(_Model):
    measure: Slug
    base: float = Field(description="Effect at full execution in raw measure units, signed as reported")
    payers: list[Slug] = Field(default=[], description="Restrict this effect to these payers")
    not_payers: list[Slug] = []


class KpiEffect(_Model):
    kpi: Slug
    delta: float | None = None
    pct: float | None = Field(default=None, description="Relative change, e.g. -0.40 for -40%")
    set_to: float | None = None
    payers: list[Slug] = []
    not_payers: list[Slug] = []

    @model_validator(mode="after")
    def _one_kind(self) -> KpiEffect:
        if sum(x is not None for x in (self.delta, self.pct, self.set_to)) != 1:
            raise ValueError(f"kpi effect on {self.kpi} needs exactly one of delta, pct, set_to")
        return self


class Rule(_Model):
    """Multiplier applied to a card's realized effect when ``when`` holds."""

    when: Condition
    multiplier: Annotated[float, Field(ge=0, le=5)]
    label: str


class SideEffect(_Model):
    when: Condition
    measure: Slug
    delta: float
    label: str
    member_harm: bool = True


class Decay(_Model):
    rate_per_year: Fraction
    unless: Condition | None = Field(default=None, description="No decay while this holds")
    label: str


class Adoption(_Model):
    """Copilots and agents only: realized effect scales with adoption."""

    baseline: Fraction


class Scope(_Model):
    id: Slug
    label: str
    cost_musd: Annotated[float, Field(gt=0)]
    factor: Annotated[float, Field(gt=0, le=1)]


class PayerFit(_Model):
    level: Level
    note: str


class InvestmentRisk(_Model):
    tags: list[str] = []
    text: str


class Investment(_Model):
    id: Slug
    code: str = Field(pattern=r"^I\d{1,2}$")
    name: str
    capability_class: CapabilityClass
    class_label: str
    summary: str
    cost_musd: Annotated[float, Field(gt=0)] = Field(description="One-time cost, or annual if per_year")
    cost_basis: Literal["one_time", "per_year"] = "one_time"
    cost_text: str
    scopes: list[Scope] = []
    duration_quarters: Annotated[int, Field(ge=1, le=8)]
    lead_quarters: dict[str, Annotated[int, Field(ge=0, le=4)]] = Field(
        default={},
        description="Quarters of waiting before building starts (agreements, IT queues); key is a payer id or '*'",
    )
    capacity_points: Annotated[float, Field(gt=0)]
    opex_musd_per_year: Annotated[float, Field(ge=0)]
    opex_text: str
    prerequisites_text: str
    effect_text: str
    decay_text: str
    synergies: list[Slug] = []
    conflicts: list[Slug] = []
    conflicts_text: str = "None"
    reversible_text: str
    reversibility: Fraction = Field(description="Share of unspent committed capital recovered on cancel")
    channel: Channel = Channel.INTERNAL
    payer_fit: dict[Slug, PayerFit]
    effects: list[CardEffect] = []
    kpi_effects: list[KpiEffect] = []
    rules: list[Rule] = []
    side_effects: list[SideEffect] = []
    decay: Decay | None = None
    adoption: Adoption | None = None
    owner_required: bool = Field(
        default=False, description="Effect is zero unless the team names an accountable owner"
    )
    owner_missing_multiplier: Fraction = 0.0
    owner_prompt: str = ""
    savings_musd_per_year: dict[Slug, float] = {}
    risk: InvestmentRisk
    is_foundation: bool = False


# --------------------------------------------------------------------------- crises


class CrisisEffects(_Model):
    measures: dict[Slug, float] = {}
    kpis: dict[Slug, float] = {}
    capacity_points: float = 0.0
    write_off_musd: float = 0.0
    dimensions: dict[Literal["stars", "member", "financial", "maturity", "risk"], float] = {}
    equity_modifier: float | None = None
    pitch_points: float = 0.0
    adoption_override: Fraction | None = None
    description: str


class SeverityRule(_Model):
    severity: Severity
    when: Condition


class CrisisEvent(_Model):
    id: Slug
    code: str = Field(pattern=r"^E\d$")
    title: str
    payer_ids: list[Slug] = Field(description="Empty list means cross-cutting (any payer)")
    trigger_text: str
    severity_rules: list[SeverityRule] = Field(min_length=1)
    governance_adjusts: bool = Field(
        default=True, description="I10 halves probability and lowers severity one level"
    )
    facilitator_only: bool = False
    one_team_per_session: bool = False
    probability_halved_by: list[Slug] = Field(
        default=[], description="Cards whose funding halves this event's probability (e.g. I12 for E4)"
    )
    privacy_event: bool = Field(default=False, description="Counts against the privacy control in Risk")
    severities: dict[Severity, CrisisEffects]
    packet: str
    minutes: Annotated[int, Field(ge=5, le=30)]
    leadership_test: str
    effect_text: str
    best_practice: list[str] = []


class RubricRow(_Model):
    id: Slug
    criterion: str
    good_answer: str
    levels: tuple[str, str, str, str] = Field(description="Descriptions for 0, 1, 2 and 3 points")


class CapitalTier(_Model):
    min_score: int
    earned_musd: float


class Rubrics(_Model):
    crisis: list[RubricRow] = Field(min_length=6, max_length=6)
    pitch: list[RubricRow] = Field(min_length=5, max_length=5)
    opmodel: list[RubricRow] = Field(min_length=4, max_length=4)
    pitch_capital: list[CapitalTier]
    critical_crisis_threshold: int = 6


# --------------------------------------------------------------------------- stages / workflow


class Stage(_Model):
    id: Slug
    kind: StageKind
    title: str
    start: str = Field(pattern=r"^\d:\d{2}$")
    duration_minutes: Annotated[int, Field(gt=0)]
    lecture_minutes: Annotated[int, Field(ge=0)] = 0
    what_happens: str
    executive_question: str
    primary_output: str
    transition_script: str = ""
    console_actions: list[str] = []
    optional: bool = False
    facilitator_script: str


class ContingencyCut(_Model):
    id: Slug
    condition: str
    cut: str
    checkpoint_stage: StageKind | None = None
    behind_minutes: int = 10


class WorkflowStep(_Model):
    id: Slug
    number: int
    name: str
    description: str
    facilitator_note: str
    risk_level: Literal["low", "medium", "high"]
    member_facing: bool
    sensitive: bool = False
    value_by_mode: dict[WorkflowMode, Annotated[float, Field(ge=0, le=1)]]


class WorkflowControl(_Model):
    id: Slug
    name: str
    description: str


class DecisionDimension(_Model):
    id: Slug
    name: str
    prompt: str


# --------------------------------------------------------------------------- data room


class Artifact(_Model):
    id: ArtifactId
    title: str
    format: ArtifactFormat
    domain: Department
    file: str
    summary: str
    supports: str = Field(pattern=r"^(neutral|[A-Z]-(RC|MS)\d)$")
    release: Literal["company", "diagnose", "analyze", "crisis"] = "diagnose"
    tags: list[str] = []

    @property
    def kind(self) -> Literal["document", "table"]:
        return "table" if self.file.endswith(".csv") else "document"


class DataRoom(_Model):
    payer_id: Slug
    artifacts: list[Artifact] = Field(min_length=8)


# --------------------------------------------------------------------------- reference material


class Assumption(_Model):
    id: str
    decision: str
    assumption: str
    status: Literal["assumed", "confirmed", "changed"] = "assumed"


class ReviewItem(_Model):
    """Content Pack §12: each item needs a confirm or a change; silence is read as confirm at gate G1."""

    id: str
    section: str
    item: str


class Simplification(_Model):
    actual: str
    representation: str
    reason: str
    risk: str
    disclosure: str


class OpportunityConfig(_Model):
    capability_classes: list[str]
    readiness_dimensions: list[str]
    foundational_themes: list[str]
    act_now_value: int = 4
    act_now_readiness: int = 4
    foundational_min_links: int = 3
    retention_months: int = 12
    consent_text: str


class ReferencePortfolio(_Model):
    id: Slug
    payer_id: Slug
    name: str
    kind: Literal["viable", "failure", "baseline", "stress"]
    round1: list[Slug]
    round2: list[Slug] = []
    scopes: dict[Slug, Slug] = {}
    illustrative_year1: str = ""
    illustrative_year2: str = ""
    illustrative_crisis: str = ""
    expect_overall_min: float | None = None
    expect_overall_max: float | None = None


# --------------------------------------------------------------------------- game config


class ScoreWeights(_Model):
    stars: float = 0.30
    member: float = 0.20
    financial: float = 0.20
    maturity: float = 0.15
    risk: float = 0.15

    @model_validator(mode="after")
    def _sum_to_one(self) -> ScoreWeights:
        total = self.stars + self.member + self.financial + self.maturity + self.risk
        if abs(total - 1.0) > 1e-6:
            raise ValueError("score weights must sum to 1.0")
        return self


class ScoringParams(_Model):
    """Weights inside each scorecard dimension (pack §10.1 leaves these to the build; review item)."""

    stars_lift_weight: Fraction = 0.6
    stars_path_weight: Fraction = 0.4
    equity_scale: float = Field(default=2.5, gt=0, description="Equity modifier = (dual ratio − 1) × scale")
    equity_points: float = Field(default=10.0, ge=0, description="Member points per unit of equity modifier")
    member_harm_points: float = Field(default=5.0, ge=0)
    financial_bonus_weight: Fraction = 0.5
    financial_savings_weight: Fraction = 0.2
    financial_discipline_weight: Fraction = 0.3
    savings_reference_share: Fraction = Field(
        default=0.02, description="Savings = full marks at this share of bonus"
    )
    writeoff_penalty_factor: float = Field(default=3.0, ge=0)
    maturity_foundations_weight: Fraction = 0.4
    maturity_adoption_weight: Fraction = 0.4
    maturity_rights_weight: Fraction = 0.2
    risk_governance_weight: Fraction = 0.35
    risk_validation_weight: Fraction = 0.25
    risk_subgroup_weight: Fraction = 0.2
    risk_privacy_weight: Fraction = 0.2
    risk_harm_points: float = Field(default=8.0, ge=0)


class PilotTargets(_Model):
    """Pilot success indicators (docx §21)."""

    learning: Fraction = 0.80
    judgment_changed: Fraction = 0.75
    usefulness: Fraction = 0.85


class GameConfig(_Model):
    edition: str
    content_version: str
    content_pack: str
    methodology_baseline_date: str
    default_seed: int = 42
    sim_mode: SimMode = SimMode.DETERMINISTIC
    effect_range: Fraction = Field(default=0.20, description="Each base effect is a ±range; also the band")
    confidence_band: Fraction = 0.20
    payer_effectiveness: dict[Level, Fraction] = {Level.HIGH: 1.0, Level.MEDIUM: 0.6, Level.LOW: 0.3}
    diminishing_returns: list[Fraction] = [1.0, 0.6, 0.3]
    adoption_with_workflow: Fraction = 0.60
    adoption_with_workflow_and_incentives: Fraction = 0.85
    adoption_literacy_bonus: Fraction = 0.10
    capacity_overrun_cap: float = 1.5
    capacity_overrun_speed: Fraction = 0.5
    paused_effect_share: Fraction = 0.5
    paused_opex_share: Fraction = 0.25
    adoption_decay_per_year: Fraction = Field(
        default=0.10, description="I11: adoption falls this much per year without reinforcement (I18)"
    )
    round2_mechanic: Round2Mechanic = Round2Mechanic.HYBRID
    round2_base_musd: float = 8.0
    round2_differentiated_musd: tuple[float, float, float] = (8.0, 10.0, 12.0)
    bonus_pmpy_usd: float = 600.0
    target_stars: float = 4.0
    dual_responsiveness: dict[Channel, float]
    score_weights: ScoreWeights = ScoreWeights()
    crisis_probability: dict[Severity, Fraction] = {
        Severity.HIGH: 0.9,
        Severity.MEDIUM: 0.6,
        Severity.LOW: 0.3,
    }
    critical_incident_penalty: float = 10.0
    member_harm_risk_cap: float = 20.0
    overrun_maturity_cap: float = 50.0
    opmodel_share_of_maturity: Fraction = 0.40
    crisis_share_of_risk: Fraction = 0.50
    scoring: ScoringParams = ScoringParams()
    nudge_minutes: Annotated[int, Field(ge=1, le=60)] = 15
    playtest_stall_minutes: Annotated[int, Field(ge=2, le=60)] = 8
    playtest_overrun_share: Annotated[float, Field(ge=0, le=2)] = 0.2
    pitch_word_limit: Annotated[int, Field(ge=60, le=600)] = 230
    pitch_words_per_second: Annotated[float, Field(gt=0, le=5)] = 2.5
    pilot_targets: PilotTargets = PilotTargets()
    member_measures: list[Slug]
    foundation_cards: list[Slug]
    governance_card: Slug
    validation_card: Slug
    workflow_card: Slug
    incentive_card: Slug
    literacy_card: Slug
    identity_card: Slug
    identity_kpi: Slug
    reserve_measures: list[str] = []
