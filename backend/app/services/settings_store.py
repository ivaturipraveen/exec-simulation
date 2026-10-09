"""Settings: one registry of everything configurable, layered as

    content/game.yaml defaults  →  .env  →  overrides saved from the Settings screen

Runtime fields (AI, facilitation) apply immediately. Game fields (rules, model parameters,
scoring) apply to sessions created afterwards: every session keeps a snapshot of the game
config it started with, so results never shift mid-workshop. Secrets (API key, signing key,
admin password) stay in .env and are only reported as configured or not.
"""

from __future__ import annotations

import copy
import threading
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, Literal

from pydantic import BaseModel, ValidationError
from sqlalchemy.engine import Engine
from sqlmodel import Session, select

from app.core.config import Settings
from app.core.errors import DomainError
from app.db import AppSetting
from sim.content import ContentBundle
from sim.content.models import GameConfig

Kind = Literal["bool", "int", "float", "percent", "money", "enum", "text"]


class InvalidSetting(DomainError):
    status_code = 422
    code = "invalid_setting"


@dataclass(frozen=True)
class FieldSpec:
    key: str
    group: str
    label: str
    kind: Kind
    target: Literal["runtime", "game"]
    help: str = ""
    options: tuple[str, ...] = ()
    min: float | None = None
    max: float | None = None
    step: float | None = None
    env: str | None = None
    session_editable: bool = False
    lock_after_year1: bool = False

    @property
    def scope(self) -> str:
        return "Applies immediately" if self.target == "runtime" else "Applies to new sessions"


def _p(key: str, label: str, group: str, help: str = "", **kw: Any) -> FieldSpec:
    return FieldSpec(
        key=key,
        label=label,
        group=group,
        kind="percent",
        target="game",
        help=help,
        min=0,
        max=1,
        step=0.01,
        **kw,
    )


G_SESSION = "Session defaults"
G_FACIL = "Facilitation"
G_AI = "AI analyst"
G_MODEL = "Model parameters"
G_SCORE = "Scorecard"
G_PILOT = "Pilot targets"

FIELDS: tuple[FieldSpec, ...] = (
    # ---------------------------------------------------------------- session defaults
    FieldSpec(
        "sim_mode",
        G_SESSION,
        "Simulation mode",
        "enum",
        "game",
        "Deterministic draws the midpoint of every effect range (comparable runs, OD-11); variable draws within ±range for replays.",
        options=("deterministic", "variable"),
        env="SIM_MODE",
        session_editable=True,
        lock_after_year1=True,
    ),
    FieldSpec(
        "default_seed",
        G_SESSION,
        "Default scenario seed",
        "int",
        "game",
        "Same seed, same results.",
        min=0,
        max=2**31,
        step=1,
        env="SIM_DEFAULT_SEED",
    ),
    FieldSpec(
        "round2_mechanic",
        G_SESSION,
        "Round 2 capital mechanic",
        "enum",
        "game",
        "Hybrid: base plus capital earned on the board-pitch rubric (OD-02). Fixed: base only. Differentiated: by Year 1 rank.",
        options=("hybrid", "fixed", "differentiated"),
        env="ROUND2_MECHANIC",
        session_editable=True,
        lock_after_year1=True,
    ),
    FieldSpec(
        "round2_base_musd",
        G_SESSION,
        "Round 2 base capital ($M)",
        "money",
        "game",
        "Per team; the facilitator can still set a different base per team with an audit note.",
        min=0,
        max=50,
        step=0.5,
        env="ROUND2_BASE_MUSD",
        session_editable=True,
    ),
    FieldSpec(
        "round2_differentiated_musd.0",
        G_SESSION,
        "Differentiated: lowest-ranked team ($M)",
        "money",
        "game",
        min=0,
        max=50,
        step=0.5,
        session_editable=True,
    ),
    FieldSpec(
        "round2_differentiated_musd.1",
        G_SESSION,
        "Differentiated: middle team ($M)",
        "money",
        "game",
        min=0,
        max=50,
        step=0.5,
        session_editable=True,
    ),
    FieldSpec(
        "round2_differentiated_musd.2",
        G_SESSION,
        "Differentiated: top-ranked team ($M)",
        "money",
        "game",
        min=0,
        max=50,
        step=0.5,
        session_editable=True,
    ),
    _p(
        "confidence_band",
        "Confidence band on projected results",
        G_SESSION,
        "Displayed ± share of each effect (pack §5).",
        env="CONFIDENCE_BAND",
        session_editable=True,
    ),
    FieldSpec(
        "target_stars",
        G_SESSION,
        "Stars target",
        "float",
        "game",
        "The 4-Star bonus cliff.",
        min=1,
        max=5,
        step=0.5,
        lock_after_year1=True,
    ),
    FieldSpec(
        "bonus_pmpy_usd",
        G_SESSION,
        "4-Star bonus per member per year ($)",
        "int",
        "game",
        "Illustrative (A-15); used only for the financial dimension.",
        min=0,
        max=5000,
        step=50,
        session_editable=True,
        lock_after_year1=True,
    ),
    FieldSpec(
        "include_translation",
        G_SESSION,
        "Include the real-company translation stage",
        "bool",
        "runtime",
        "The optional 25-minute extension after the 180-minute core (OD-01).",
        env="INCLUDE_TRANSLATION",
        session_editable=True,
    ),
    # ---------------------------------------------------------------- facilitation
    FieldSpec(
        "playtest_stall_minutes",
        G_FACIL,
        "Playtest: stall after (minutes)",
        "int",
        "game",
        "The playtest report flags a team that does nothing for this long during a working stage.",
        min=2,
        max=60,
        step=1,
        session_editable=True,
    ),
    FieldSpec(
        "playtest_overrun_share",
        G_FACIL,
        "Playtest: stage overrun flag",
        "percent",
        "game",
        "The playtest report flags a stage that runs this much longer than planned.",
        min=0,
        max=2,
        session_editable=True,
    ),
    FieldSpec(
        "nudge_minutes",
        G_FACIL,
        "Diagnose evidence nudge (minutes)",
        "int",
        "game",
        "Flag teams that have cited no evidence after this many minutes of Diagnose (pack §9.2).",
        min=1,
        max=60,
        step=1,
        session_editable=True,
    ),
    FieldSpec(
        "pitch_word_limit",
        G_FACIL,
        "Board pitch word limit",
        "int",
        "game",
        "About 90 seconds spoken.",
        min=60,
        max=600,
        step=10,
        session_editable=True,
    ),
    FieldSpec(
        "pitch_words_per_second",
        G_FACIL,
        "Speaking pace (words per second)",
        "float",
        "game",
        "Converts word count to seconds on the pitch page.",
        min=1,
        max=5,
        step=0.1,
        session_editable=True,
    ),
    FieldSpec(
        "pitch_ai_suggest",
        G_FACIL,
        "AI-suggested pitch scores",
        "bool",
        "runtime",
        "Claude suggests a 0–3 score per rubric row; the facilitator always decides (OD-08). Costs one AI call per pitch.",
        env="PITCH_AI_SUGGEST",
    ),
    FieldSpec(
        "opportunity_retention_days",
        G_FACIL,
        "Opportunity Map retention (days)",
        "int",
        "runtime",
        "Captured opportunities are deleted after this period (OD-09: 12 months).",
        min=1,
        max=3650,
        step=1,
        env="OPPORTUNITY_RETENTION_DAYS",
    ),
    # ---------------------------------------------------------------- AI
    FieldSpec(
        "anthropic_model",
        G_AI,
        "Claude model",
        "text",
        "runtime",
        "Model id used by the analyst, pitch suggestions and the synthesizer.",
        env="ANTHROPIC_MODEL",
    ),
    FieldSpec(
        "ai_effort",
        G_AI,
        "Effort",
        "enum",
        "runtime",
        "Higher effort is slower and costs more.",
        options=("low", "medium", "high"),
        env="AI_EFFORT",
    ),
    FieldSpec(
        "ai_max_tokens",
        G_AI,
        "Max output tokens",
        "int",
        "runtime",
        min=1024,
        max=64000,
        step=512,
        env="AI_MAX_TOKENS",
    ),
    FieldSpec(
        "ai_requests_per_10_min",
        G_AI,
        "Questions per team per 10 minutes",
        "int",
        "runtime",
        min=1,
        max=500,
        step=1,
        env="AI_REQUESTS_PER_10_MIN",
    ),
    # ---------------------------------------------------------------- model parameters (pack §5)
    _p(
        "payer_effectiveness.high",
        "Payer fit: High",
        G_MODEL,
        "Share of a card's base effect when fit is High (pack 5.1: 1.0).",
        lock_after_year1=True,
        session_editable=True,
    ),
    _p(
        "payer_effectiveness.medium",
        "Payer fit: Medium",
        G_MODEL,
        "Pack: 0.6.",
        lock_after_year1=True,
        session_editable=True,
    ),
    _p(
        "payer_effectiveness.low",
        "Payer fit: Low",
        G_MODEL,
        "Pack: 0.3.",
        lock_after_year1=True,
        session_editable=True,
    ),
    _p(
        "diminishing_returns.0",
        "1st card on a measure",
        G_MODEL,
        "Pack: 100%.",
        lock_after_year1=True,
        session_editable=True,
    ),
    _p(
        "diminishing_returns.1",
        "2nd card on a measure",
        G_MODEL,
        "Pack: 60%.",
        lock_after_year1=True,
        session_editable=True,
    ),
    _p(
        "diminishing_returns.2",
        "3rd and later cards",
        G_MODEL,
        "Pack: 30%.",
        lock_after_year1=True,
        session_editable=True,
    ),
    _p(
        "adoption_with_workflow",
        "Adoption with workflow redesign (I11)",
        G_MODEL,
        "Copilots and agents (pack: 60%).",
        lock_after_year1=True,
        session_editable=True,
    ),
    _p(
        "adoption_with_workflow_and_incentives",
        "Adoption with I11 + incentives (I15)",
        G_MODEL,
        "Pack: 85%.",
        lock_after_year1=True,
        session_editable=True,
    ),
    _p(
        "adoption_literacy_bonus",
        "Adoption bonus from AI literacy (I18)",
        G_MODEL,
        "Pack: +10 points.",
        lock_after_year1=True,
        session_editable=True,
    ),
    _p(
        "adoption_decay_per_year",
        "Adoption decay without reinforcement",
        G_MODEL,
        "I11: falls 10 points a year unless I18 is live.",
        lock_after_year1=True,
        session_editable=True,
    ),
    FieldSpec(
        "capacity_overrun_cap",
        G_MODEL,
        "Capacity overrun threshold",
        "float",
        "game",
        "Above this share of supply, cards progress at the overrun speed and AI maturity is capped (pack: 1.5 = 150%).",
        min=1,
        max=3,
        step=0.05,
        lock_after_year1=True,
        session_editable=True,
    ),
    _p(
        "capacity_overrun_speed",
        "Speed above the threshold",
        G_MODEL,
        "Pack: half speed.",
        lock_after_year1=True,
        session_editable=True,
    ),
    _p(
        "paused_effect_share",
        "Effect kept while paused",
        G_MODEL,
        lock_after_year1=True,
        session_editable=True,
    ),
    _p(
        "paused_opex_share",
        "Run cost kept while paused",
        G_MODEL,
        lock_after_year1=True,
        session_editable=True,
    ),
    _p(
        "effect_range",
        "Effect range (variable mode)",
        G_MODEL,
        "Each base effect is base ± this share (pack §5 uncertainty).",
        lock_after_year1=True,
        session_editable=True,
    ),
    _p(
        "crisis_probability.high",
        "Crisis probability: high severity",
        G_MODEL,
        lock_after_year1=True,
        session_editable=True,
    ),
    _p(
        "crisis_probability.medium",
        "Crisis probability: medium severity",
        G_MODEL,
        lock_after_year1=True,
        session_editable=True,
    ),
    _p(
        "crisis_probability.low",
        "Crisis probability: low severity",
        G_MODEL,
        lock_after_year1=True,
        session_editable=True,
    ),
    # ---------------------------------------------------------------- scorecard (pack §10.1)
    _p(
        "score_weights.stars",
        "Weight: Stars trajectory",
        G_SCORE,
        "The five weights must sum to 100% (pack: 30/20/20/15/15).",
        session_editable=True,
    ),
    _p("score_weights.member", "Weight: Member outcomes and experience", G_SCORE, session_editable=True),
    _p("score_weights.financial", "Weight: Financial performance", G_SCORE, session_editable=True),
    _p("score_weights.maturity", "Weight: AI transformation maturity", G_SCORE, session_editable=True),
    _p("score_weights.risk", "Weight: Risk and governance", G_SCORE, session_editable=True),
    FieldSpec(
        "critical_incident_penalty",
        G_SCORE,
        "Penalty: crisis rubric under 6/18",
        "float",
        "game",
        "Points off the total (pack: 10).",
        min=0,
        max=50,
        step=1,
        session_editable=True,
    ),
    FieldSpec(
        "member_harm_risk_cap",
        G_SCORE,
        "Cap: Risk after member harm without corrective action",
        "float",
        "game",
        "Pack: 20% of available points.",
        min=0,
        max=100,
        step=1,
        session_editable=True,
    ),
    FieldSpec(
        "overrun_maturity_cap",
        G_SCORE,
        "Cap: AI maturity after capacity overrun",
        "float",
        "game",
        "Pack: 50%.",
        min=0,
        max=100,
        step=1,
        session_editable=True,
    ),
    _p(
        "opmodel_share_of_maturity",
        "Operating model share of AI maturity",
        G_SCORE,
        "Pack: 40%.",
        session_editable=True,
    ),
    _p("crisis_share_of_risk", "Crisis rubric share of Risk", G_SCORE, "Pack: 50%.", session_editable=True),
    _p("scoring.stars_lift_weight", "Stars: lift ÷ headroom weight", G_SCORE, session_editable=True),
    _p("scoring.stars_path_weight", "Stars: projected path to target weight", G_SCORE, session_editable=True),
    FieldSpec(
        "scoring.equity_scale",
        G_SCORE,
        "Member: equity modifier scale",
        "float",
        "game",
        "Modifier = (dual-eligible lift ratio − 1) × scale, clamped to ±1.",
        min=0.1,
        max=10,
        step=0.1,
        session_editable=True,
    ),
    FieldSpec(
        "scoring.equity_points",
        G_SCORE,
        "Member: points per unit of equity modifier",
        "float",
        "game",
        min=0,
        max=50,
        step=1,
        session_editable=True,
    ),
    FieldSpec(
        "scoring.member_harm_points",
        G_SCORE,
        "Member: points lost per harm incident",
        "float",
        "game",
        min=0,
        max=50,
        step=1,
        session_editable=True,
    ),
    _p("scoring.financial_bonus_weight", "Financial: bonus progress weight", G_SCORE, session_editable=True),
    _p(
        "scoring.financial_savings_weight",
        "Financial: run-rate savings weight",
        G_SCORE,
        session_editable=True,
    ),
    _p(
        "scoring.financial_discipline_weight",
        "Financial: spend discipline weight",
        G_SCORE,
        session_editable=True,
    ),
    _p(
        "scoring.savings_reference_share",
        "Financial: savings for full marks (share of bonus)",
        G_SCORE,
        session_editable=True,
    ),
    FieldSpec(
        "scoring.writeoff_penalty_factor",
        G_SCORE,
        "Financial: write-off penalty factor",
        "float",
        "game",
        min=0,
        max=20,
        step=0.5,
        session_editable=True,
    ),
    _p("scoring.maturity_foundations_weight", "Maturity: foundations weight", G_SCORE, session_editable=True),
    _p("scoring.maturity_adoption_weight", "Maturity: adoption weight", G_SCORE, session_editable=True),
    _p("scoring.maturity_rights_weight", "Maturity: decision rights weight", G_SCORE, session_editable=True),
    _p(
        "scoring.risk_governance_weight",
        "Risk: owned governance (I10) weight",
        G_SCORE,
        session_editable=True,
    ),
    _p(
        "scoring.risk_validation_weight",
        "Risk: model validation (I12) weight",
        G_SCORE,
        session_editable=True,
    ),
    _p("scoring.risk_subgroup_weight", "Risk: subgroup monitoring weight", G_SCORE, session_editable=True),
    _p("scoring.risk_privacy_weight", "Risk: no privacy event weight", G_SCORE, session_editable=True),
    FieldSpec(
        "scoring.risk_harm_points",
        G_SCORE,
        "Risk: points lost per harm incident",
        "float",
        "game",
        min=0,
        max=50,
        step=1,
        session_editable=True,
    ),
    # ---------------------------------------------------------------- pilot targets (docx §21)
    _p("pilot_targets.learning", "Target: learning rated 4–5", G_PILOT, "Docx §21: 80%."),
    _p("pilot_targets.judgment_changed", "Target: evidence changed a decision", G_PILOT, "Docx §21: 75%."),
    _p("pilot_targets.usefulness", "Target: more useful than a presentation", G_PILOT, "Docx §21: 85%."),
)
BY_KEY = {f.key: f for f in FIELDS}
# Game fields that .env can set (blank .env values fall back to content/game.yaml).
ENV_ATTR = {
    "sim_mode": "sim_mode",
    "round2_mechanic": "round2_mechanic",
    "round2_base_musd": "round2_base_musd",
    "confidence_band": "confidence_band",
    "default_seed": "sim_default_seed",
}


# --------------------------------------------------------------------------- views


class SettingView(BaseModel):
    key: str
    group: str
    label: str
    help: str
    kind: Kind
    options: list[str]
    min: float | None
    max: float | None
    step: float | None
    value: Any
    default: Any
    source: Literal["content", "env", "ui"]
    env: str | None
    scope: str
    session_editable: bool
    lock_after_year1: bool


class SystemInfo(BaseModel):
    environment: str
    version: str
    content_version: str
    content_pack: str
    api_port: int
    web_port: int
    database: str
    content_dir: str
    data_dir: str
    log_level: str
    cors_origins: list[str]
    ai_configured: bool
    signing_key: str
    admin_password_set: bool


class ReviewEntry(BaseModel):
    id: str
    kind: Literal["checklist", "assumption"]
    section: str
    text: str
    status: Literal["open", "confirmed", "changed"]
    note: str = ""
    updated_at: datetime | None = None


class SettingsView(BaseModel):
    fields: list[SettingView]
    system: SystemInfo
    review: list[ReviewEntry]


# --------------------------------------------------------------------------- path helpers


def get_path(data: dict[str, Any], path: str) -> Any:
    cur: Any = data
    for part in path.split("."):
        cur = cur[int(part)] if isinstance(cur, list) else cur[part]
    return cur


def set_path(data: dict[str, Any], path: str, value: Any) -> None:
    parts = path.split(".")
    cur: Any = data
    for part in parts[:-1]:
        cur = cur[int(part)] if isinstance(cur, list) else cur[part]
    last = parts[-1]
    if isinstance(cur, list):
        cur[int(last)] = value
    else:
        cur[last] = value


def coerce(spec: FieldSpec, value: Any) -> Any:
    """Type- and range-check one value from the UI."""
    try:
        if spec.kind == "bool":
            if isinstance(value, bool):
                return value
            if str(value).lower() in ("true", "1", "yes", "on"):
                return True
            if str(value).lower() in ("false", "0", "no", "off"):
                return False
            raise ValueError
        if spec.kind == "enum":
            if str(value) not in spec.options:
                raise ValueError
            return str(value)
        if spec.kind == "text":
            text = str(value).strip()
            if not text or len(text) > 200:
                raise ValueError
            return text
        number = int(value) if spec.kind == "int" else float(value)
    except (TypeError, ValueError) as exc:
        raise InvalidSetting(f"{spec.label}: invalid value {value!r}") from exc
    if (spec.min is not None and number < spec.min) or (spec.max is not None and number > spec.max):
        raise InvalidSetting(f"{spec.label}: must be between {spec.min:g} and {spec.max:g}")
    return number


def merge_game(base: dict[str, Any], overrides: dict[str, Any]) -> GameConfig:
    data = copy.deepcopy(base)
    for key, value in overrides.items():
        spec = BY_KEY.get(key)
        if spec and spec.target == "game":
            set_path(data, key, value)
    try:
        return GameConfig.model_validate(data)
    except ValidationError as exc:
        message = "; ".join(e["msg"].removeprefix("Value error, ") for e in exc.errors())
        raise InvalidSetting(f"Invalid combination: {message}") from exc


def _mask_db(url: str) -> str:
    if "@" in url and "://" in url:
        scheme, rest = url.split("://", 1)
        return f"{scheme}://•••@{rest.split('@', 1)[1]}"
    return url


# --------------------------------------------------------------------------- store


@dataclass
class SettingsStore:
    engine: Engine
    settings: Settings
    base_content: ContentBundle
    version: str
    on_change: Callable[[ContentBundle], None] | None = None
    overrides: dict[str, Any] = field(default_factory=dict)
    review: dict[str, dict[str, Any]] = field(default_factory=dict)
    _lock: threading.RLock = field(default_factory=threading.RLock)

    def __post_init__(self) -> None:
        self._env_runtime = {f.key: getattr(self.settings, f.key) for f in FIELDS if f.target == "runtime"}
        self._base_config = self.base_content.config.model_dump(mode="json")
        with Session(self.engine) as db:
            for row in db.exec(select(AppSetting)):
                if row.key.startswith("review:"):
                    self.review[row.key.removeprefix("review:")] = row.value or {}
                elif row.key in BY_KEY:
                    self.overrides[row.key] = row.value
        self._apply()

    # ---- effective values

    @property
    def content(self) -> ContentBundle:
        return self._content

    def _apply(self) -> None:
        config = merge_game(self._base_config, self.overrides)
        self._content = self.base_content.with_full_config(config.model_dump(mode="json"))
        for key, env_value in self._env_runtime.items():
            setattr(self.settings, key, self.overrides.get(key, env_value))
        if self.on_change:
            self.on_change(self._content)

    def default_of(self, spec: FieldSpec) -> Any:
        if spec.target == "runtime":
            return self._env_runtime[spec.key]
        return get_path(self._base_config, spec.key)

    def value_of(self, spec: FieldSpec) -> Any:
        if spec.target == "runtime":
            return getattr(self.settings, spec.key)
        return get_path(self._content.config.model_dump(mode="json"), spec.key)

    def source_of(self, spec: FieldSpec) -> Literal["content", "env", "ui"]:
        if spec.key in self.overrides:
            return "ui"
        if spec.target == "runtime":
            return "env"
        attr = ENV_ATTR.get(spec.key)
        return "env" if attr and getattr(self.settings, attr, None) is not None else "content"

    # ---- views

    def view(self) -> SettingsView:
        s = self.settings
        fields = [
            SettingView(
                key=f.key,
                group=f.group,
                label=f.label,
                help=f.help,
                kind=f.kind,
                options=list(f.options),
                min=f.min,
                max=f.max,
                step=f.step,
                value=self.value_of(f),
                default=self.default_of(f),
                source=self.source_of(f),
                env=f.env,
                scope=f.scope,
                session_editable=f.session_editable,
                lock_after_year1=f.lock_after_year1,
            )
            for f in FIELDS
        ]
        system = SystemInfo(
            environment=s.environment,
            version=self.version,
            content_version=self._content.config.content_version,
            content_pack=self._content.config.content_pack,
            api_port=s.api_port,
            web_port=s.web_port,
            database=_mask_db(s.database_url),
            content_dir=str(s.content_dir),
            data_dir=str(s.data_dir),
            log_level=s.log_level,
            cors_origins=s.cors_origins,
            ai_configured=s.ai_configured,
            signing_key="set in backend/.env" if s.secret_key else "generated locally (data/.secret)",
            admin_password_set=s.admin_password is not None,
        )
        return SettingsView(fields=fields, system=system, review=self.review_entries())

    def review_entries(self) -> list[ReviewEntry]:
        c = self._content
        items = [("checklist", r.id, r.section, r.item) for r in c.review_checklist]
        items += [("assumption", a.id, a.decision, a.assumption) for a in c.assumptions]
        out = []
        for kind, item_id, section, text in items:
            rec = self.review.get(item_id, {})
            out.append(
                ReviewEntry(
                    id=item_id,
                    kind=kind,  # type: ignore[arg-type]
                    section=section,
                    text=text,
                    status=rec.get("status", "open"),
                    note=rec.get("note", ""),
                    updated_at=rec.get("updated_at"),
                )
            )
        return out

    # ---- mutations

    def update(self, values: dict[str, Any], by: str = "admin") -> SettingsView:
        with self._lock:
            candidate = dict(self.overrides)
            for key, raw in values.items():
                spec = BY_KEY.get(key)
                if spec is None:
                    raise InvalidSetting(f"Unknown setting '{key}'")
                value = coerce(spec, raw)
                if value == self.default_of(spec):
                    candidate.pop(key, None)  # back to the .env / content value
                else:
                    candidate[key] = value
            merge_game(self._base_config, candidate)  # validates the whole config
            self._persist(candidate, by)
            self.overrides = candidate
            self._apply()
            return self.view()

    def reset(self, key: str, by: str = "admin") -> SettingsView:
        if key not in BY_KEY:
            raise InvalidSetting(f"Unknown setting '{key}'")
        return self.update({key: self.default_of(BY_KEY[key])}, by)

    def set_review(self, item_id: str, status: str, note: str, by: str = "admin") -> SettingsView:
        known = {e.id for e in self.review_entries()}
        if item_id not in known:
            raise InvalidSetting(f"Unknown review item '{item_id}'")
        if status not in ("open", "confirmed", "changed"):
            raise InvalidSetting("Status must be open, confirmed or changed")
        if status == "changed" and not note.strip():
            raise InvalidSetting("Describe the change in the note")
        record = {"status": status, "note": note.strip()[:1000], "updated_at": datetime.now(UTC).isoformat()}
        with self._lock, Session(self.engine) as db:
            row = db.get(AppSetting, f"review:{item_id}") or AppSetting(key=f"review:{item_id}")
            row.value, row.updated_by, row.updated_at = record, by, datetime.now(UTC)
            db.add(row)
            db.commit()
            self.review[item_id] = record
        return self.view()

    def _persist(self, candidate: dict[str, Any], by: str) -> None:
        with Session(self.engine) as db:
            for key in set(self.overrides) - set(candidate):
                row = db.get(AppSetting, key)
                if row:
                    db.delete(row)
            for key, value in candidate.items():
                row = db.get(AppSetting, key) or AppSetting(key=key)
                row.value, row.updated_by, row.updated_at = value, by, datetime.now(UTC)
                db.add(row)
            db.commit()
