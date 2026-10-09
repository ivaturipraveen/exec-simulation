"""Load and validate the content bundle from the ``content/`` directory."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field, replace
from functools import cached_property
from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, TypeAdapter, ValidationError

from sim.content.models import (
    Artifact,
    Assumption,
    Condition,
    ContingencyCut,
    CrisisEvent,
    DataRoom,
    DecisionDimension,
    GameConfig,
    Investment,
    Kpi,
    Measure,
    OpportunityConfig,
    Payer,
    ReferencePortfolio,
    ReviewItem,
    Rubrics,
    Simplification,
    Stage,
    WorkflowControl,
    WorkflowStep,
)


class ContentError(Exception):
    """Raised when content files are missing, malformed or inconsistent."""

    def __init__(self, problems: list[str]) -> None:
        self.problems = problems
        super().__init__("Invalid content:\n  - " + "\n  - ".join(problems))


@dataclass(frozen=True)
class ContentBundle:
    root: Path
    config: GameConfig
    measures: dict[str, Measure]
    kpis: dict[str, Kpi]
    investments: dict[str, Investment]
    payers: dict[str, Payer]
    events: dict[str, CrisisEvent]
    stages: list[Stage]
    contingency_cuts: list[ContingencyCut]
    workflow_steps: list[WorkflowStep]
    workflow_controls: list[WorkflowControl]
    decision_dimensions: list[DecisionDimension]
    rubrics: Rubrics
    assumptions: list[Assumption]
    simplifications: list[Simplification]
    opportunity: OpportunityConfig
    portfolios: list[ReferencePortfolio]
    review_checklist: list[ReviewItem] = field(default_factory=list)
    datarooms: dict[str, DataRoom] = field(default_factory=dict)

    @cached_property
    def artifacts(self) -> dict[tuple[str, str], Artifact]:
        return {(room.payer_id, a.id): a for room in self.datarooms.values() for a in room.artifacts}

    def artifact_path(self, payer_id: str, artifact_id: str) -> Path:
        artifact = self.artifacts[(payer_id, artifact_id)]
        return self.root / "dataroom" / payer_id / artifact.file

    def read_artifact(self, payer_id: str, artifact_id: str) -> str:
        return self.artifact_path(payer_id, artifact_id).read_text(encoding="utf-8")

    @property
    def total_minutes(self) -> int:
        return sum(s.duration_minutes for s in self.stages if not s.optional)

    def with_full_config(self, config: dict[str, Any]) -> ContentBundle:
        """Copy with a complete game config (a session's snapshot or the Settings result)."""
        return replace(self, config=GameConfig.model_validate(config))

    def with_config(self, **overrides: Any) -> ContentBundle:
        """Copy with runtime overrides applied to the game config (values from .env)."""
        clean = {k: v for k, v in overrides.items() if v is not None}
        if not clean:
            return self
        config = GameConfig.model_validate({**self.config.model_dump(), **clean})
        return replace(self, config=config)


def _read_yaml(path: Path) -> Any:
    try:
        with path.open(encoding="utf-8") as fh:
            return yaml.safe_load(fh)
    except FileNotFoundError as exc:
        raise ContentError([f"missing file: {path}"]) from exc
    except yaml.YAMLError as exc:
        raise ContentError([f"invalid YAML in {path}: {exc}"]) from exc


def _parse[T](tp: type[T] | Any, data: Any, source: Path, problems: list[str]) -> T | None:
    try:
        if isinstance(tp, type) and issubclass(tp, BaseModel):
            return tp.model_validate(data)  # type: ignore[return-value]
        return TypeAdapter(tp).validate_python(data)
    except ValidationError as exc:
        for err in exc.errors():
            loc = ".".join(str(p) for p in err["loc"])
            problems.append(f"{source.name}: {loc}: {err['msg']}")
        return None


def load_content(root: Path) -> ContentBundle:
    """Load every content file under ``root`` and validate cross-references.

    Raises ``ContentError`` listing *all* problems found, not just the first.
    """
    root = root.resolve()
    problems: list[str] = []

    def load(tp: Any, name: str, key: str | None = None) -> Any:
        path = root / name
        data = _read_yaml(path)
        if key is not None:
            data = (data or {}).get(key)
        return _parse(tp, data, path, problems)

    config = load(GameConfig, "game.yaml")
    measures = load(list[Measure], "measures.yaml")
    kpis = load(list[Kpi], "kpis.yaml")
    investments = load(list[Investment], "investments.yaml")
    events = load(list[CrisisEvent], "events.yaml")
    stages = load(list[Stage], "stages.yaml", "stages")
    cuts = load(list[ContingencyCut], "stages.yaml", "contingency_cuts")
    steps = load(list[WorkflowStep], "workflow.yaml", "steps")
    controls = load(list[WorkflowControl], "workflow.yaml", "controls")
    dimensions = load(list[DecisionDimension], "workflow.yaml", "decision_dimensions")
    rubrics = load(Rubrics, "rubrics.yaml")
    assumptions = load(list[Assumption], "reference.yaml", "assumptions")
    simplifications = load(list[Simplification], "reference.yaml", "simplifications")
    opportunity = load(OpportunityConfig, "reference.yaml", "opportunity")
    portfolios = load(list[ReferencePortfolio], "reference.yaml", "portfolios")
    review = load(list[ReviewItem], "reference.yaml", "review_checklist")

    payers: dict[str, Payer] = {}
    for path in sorted((root / "payers").glob("*.yaml")):
        payer = _parse(Payer, _read_yaml(path), path, problems)
        if payer:
            payers[payer.id] = payer

    datarooms: dict[str, DataRoom] = {}
    for manifest in sorted((root / "dataroom").glob("*/manifest.yaml")):
        room = _parse(DataRoom, _read_yaml(manifest), manifest, problems)
        if room:
            datarooms[room.payer_id] = room

    required = (config, measures, kpis, investments, events, stages, cuts, steps, controls, dimensions)
    if problems or any(x is None for x in (*required, rubrics, assumptions, simplifications, opportunity)):
        raise ContentError(problems or ["content failed to load"])

    bundle = ContentBundle(
        root=root,
        config=config,
        measures=_index(measures, "measure", problems),
        kpis=_index(kpis, "kpi", problems),
        investments=_index(investments, "investment", problems),
        payers=payers,
        events=_index(events, "event", problems),
        stages=stages,
        contingency_cuts=cuts,
        workflow_steps=steps,
        workflow_controls=controls,
        decision_dimensions=dimensions,
        rubrics=rubrics,
        assumptions=assumptions,
        simplifications=simplifications,
        opportunity=opportunity,
        portfolios=portfolios or [],
        review_checklist=review or [],
        datarooms=datarooms,
    )
    problems.extend(validate_references(bundle))
    if problems:
        raise ContentError(problems)
    return bundle


def _index(items: list[Any], kind: str, problems: list[str]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for item in items:
        if item.id in out:
            problems.append(f"duplicate {kind} id: {item.id}")
        out[item.id] = item
    return out


def content_warnings(b: ContentBundle) -> list[str]:
    """Design-rule checks (pack section 6) reported to the content owner, not enforced."""
    warnings: list[str] = []
    for payer in b.payers.values():
        room = b.datarooms.get(payer.id)
        if room is None:
            continue
        by_support: dict[str, list[Artifact]] = defaultdict(list)
        for a in room.artifacts:
            by_support[a.supports].append(a)
        for rc in payer.hidden_root_causes:
            arts = by_support.get(rc.id, [])
            if len(arts) < 3 or len({a.domain for a in arts}) < 2:
                ids = ", ".join(a.id for a in arts) or "none"
                warnings.append(
                    f"{payer.name}: {rc.id} is supported by {len(arts)} artifact(s) ({ids}); "
                    "the design rule asks for 3+ across 2+ domains"
                )
        for ms in payer.misleading_signals:
            if not by_support.get(ms.id):
                warnings.append(f"{payer.name}: {ms.id} has no supporting artifact")
    return warnings


def _check_condition(cond: Condition, where: str, b: ContentBundle) -> list[str]:
    problems = [
        f"{where}: unknown investment '{ref}'" for ref in cond.references() if ref not in b.investments
    ]
    for kpi in (*cond.kpi_below, *cond.kpi_at_least):
        if kpi not in b.kpis:
            problems.append(f"{where}: unknown KPI '{kpi}'")
    for pid in (*cond.payers, *cond.not_payers):
        if pid not in b.payers:
            problems.append(f"{where}: unknown payer '{pid}'")
    return problems


def validate_references(b: ContentBundle) -> list[str]:
    """Cross-file consistency checks that a schema alone cannot express."""
    problems: list[str] = []
    measure_ids = set(b.measures)
    kpi_ids = set(b.kpis)
    inv_ids = set(b.investments)
    payer_ids = set(b.payers)
    cfg = b.config

    if not payer_ids:
        problems.append("no payers found in content/payers/")
    if not 8 <= len(measure_ids) <= 12:
        problems.append(f"expected 8-12 measures (STR-001), found {len(measure_ids)}")
    if not 15 <= len(inv_ids) <= 20:
        problems.append(f"expected 15-20 investments (INV-001), found {len(inv_ids)}")
    for ref in (
        *cfg.foundation_cards,
        cfg.governance_card,
        cfg.validation_card,
        cfg.workflow_card,
        cfg.incentive_card,
        cfg.literacy_card,
        cfg.identity_card,
    ):
        if ref not in inv_ids:
            problems.append(f"game.yaml: unknown investment '{ref}'")
    for m in cfg.member_measures:
        if m not in measure_ids:
            problems.append(f"game.yaml: unknown member measure '{m}'")
    if cfg.identity_kpi not in kpi_ids:
        problems.append(f"game.yaml: unknown identity KPI '{cfg.identity_kpi}'")

    for m in b.measures.values():
        for k in m.leading_kpis:
            if k not in kpi_ids:
                problems.append(f"measure {m.id}: unknown leading KPI '{k}'")
    for k in b.kpis.values():
        for m in k.measures:
            if m not in measure_ids:
                problems.append(f"kpi {k.id}: unknown measure '{m}'")

    for inv in b.investments.values():
        where = f"investment {inv.id}"
        if set(inv.payer_fit) != payer_ids:
            problems.append(f"{where}: payer_fit must cover exactly {sorted(payer_ids)}")
        for eff in inv.effects:
            if eff.measure not in measure_ids:
                problems.append(f"{where}: unknown measure '{eff.measure}'")
        for ke in inv.kpi_effects:
            if ke.kpi not in kpi_ids:
                problems.append(f"{where}: unknown KPI '{ke.kpi}'")
        for ref in (*inv.synergies, *inv.conflicts):
            if ref not in inv_ids:
                problems.append(f"{where}: unknown related investment '{ref}'")
        for rule in inv.rules:
            problems.extend(_check_condition(rule.when, f"{where} rule '{rule.label}'", b))
        for se in inv.side_effects:
            problems.extend(_check_condition(se.when, f"{where} side effect", b))
            if se.measure not in measure_ids:
                problems.append(f"{where}: side effect on unknown measure '{se.measure}'")
        if inv.decay and inv.decay.unless:
            problems.extend(_check_condition(inv.decay.unless, f"{where} decay", b))
        for pid in inv.savings_musd_per_year:
            if pid not in payer_ids:
                problems.append(f"{where}: savings for unknown payer '{pid}'")

    for payer in b.payers.values():
        where = f"payer {payer.id}"
        if set(payer.measures) != measure_ids:
            problems.append(f"{where}: measure baselines must cover exactly the measure catalog")
        if set(payer.kpis) != kpi_ids:
            problems.append(f"{where}: KPI baselines must cover exactly the KPI catalog")
        for rc in payer.hidden_root_causes:
            problems.extend(
                f"{where}: {rc.id} affects unknown '{m}'"
                for m in rc.affected_measures
                if m not in measure_ids
            )
            problems.extend(
                f"{where}: {rc.id} addressed by unknown '{i}'" for i in rc.addressed_by if i not in inv_ids
            )
        for strategy in payer.viable_strategies:
            for ref in (*strategy.round1, *strategy.round2, *strategy.scopes):
                if ref not in inv_ids:
                    problems.append(f"{where}: strategy '{strategy.title}' references unknown '{ref}'")
        for drift in payer.drifts:
            problems.extend(_check_condition(drift.unless, f"{where} drift", b))
        for seg in payer.segments:
            problems.extend(
                f"{where}: segment {seg.id} overrides unknown '{m}'"
                for m in seg.measure_overrides
                if m not in measure_ids
            )

        room = b.datarooms.get(payer.id)
        if room is None:
            problems.append(f"{where}: no data room at content/dataroom/{payer.id}/manifest.yaml")
            continue
        support_ids = {rc.id for rc in payer.hidden_root_causes} | {ms.id for ms in payer.misleading_signals}
        by_support: dict[str, list[Artifact]] = defaultdict(list)
        for a in room.artifacts:
            if a.supports != "neutral":
                if a.supports not in support_ids:
                    problems.append(f"data room {payer.id}: {a.id} supports unknown '{a.supports}'")
                by_support[a.supports].append(a)
            if not (b.root / "dataroom" / payer.id / a.file).is_file():
                problems.append(f"data room {payer.id}: file not found '{a.file}'")
        if len({a.domain for a in room.artifacts}) < 8:
            problems.append(f"data room {payer.id}: must cover all 8 domains")
        if len({a.id for a in room.artifacts}) != len(room.artifacts):
            problems.append(f"data room {payer.id}: duplicate artifact ids")

    for room in b.datarooms.values():
        if room.payer_id not in payer_ids:
            problems.append(f"data room for unknown payer '{room.payer_id}'")

    for ev in b.events.values():
        for pid in ev.payer_ids:
            if pid not in payer_ids:
                problems.append(f"event {ev.id}: unknown payer '{pid}'")
        for rule in ev.severity_rules:
            problems.extend(_check_condition(rule.when, f"event {ev.id}", b))
            if rule.severity not in ev.severities:
                problems.append(f"event {ev.id}: no effects defined for severity '{rule.severity}'")

    for pf in b.portfolios:
        if pf.payer_id not in payer_ids:
            problems.append(f"portfolio {pf.id}: unknown payer '{pf.payer_id}'")
        for ref in (*pf.round1, *pf.round2, *pf.scopes):
            if ref not in inv_ids:
                problems.append(f"portfolio {pf.id}: unknown investment '{ref}'")

    kinds = [s.kind for s in b.stages]
    if len(set(kinds)) != len(kinds):
        problems.append("stages: each stage kind must appear exactly once")
    if b.total_minutes != 180:
        problems.append(f"stages: core run-of-show must total 180 minutes (found {b.total_minutes})")
    tiers = [t.min_score for t in b.rubrics.pitch_capital]
    if tiers != sorted(tiers, reverse=True) or tiers[-1] != 0:
        problems.append("rubrics: pitch_capital tiers must be descending and end at 0")
    return problems
