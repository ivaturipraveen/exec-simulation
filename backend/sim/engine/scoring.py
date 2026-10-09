"""Executive scorecard — Content Pack v0.1 section 10.1.

Five dimensions, each 0–100 and normalized by payer (lift ÷ headroom, benefit ÷ 4-Star bonus
value) so different archetypes compare fairly (OD-06). Crisis effects land here because the
crisis happens after Year 2 (B-04). Guardrails:

* crisis rubric under 6 of 18 → −10 points on the total
* member harm with no corrective action → Risk and governance capped at 20
* capacity overrun above 150% in any quarter → AI maturity capped at 50
"""

from __future__ import annotations

from pydantic import BaseModel

from sim.content import ContentBundle
from sim.content.models import Severity
from sim.engine.conditions import context
from sim.engine.model import clamp, granted_capital, sign
from sim.engine.opmodel import OperatingModelDesign
from sim.engine.reports import YearReport, bonus_value_musd, year_report, year_values
from sim.engine.rubric import RubricScore
from sim.engine.stars import improvement, overall_stars, summary_score
from sim.engine.state import QUARTERS_PER_YEAR, TeamState


class CrisisOutcome(BaseModel):
    event_id: str
    severity: Severity
    rubric: RubricScore | None = None
    concealment: bool = False


class Dimension(BaseModel):
    id: str
    label: str
    weight: float
    score: float
    drivers: list[str]


class Scorecard(BaseModel):
    payer_id: str
    year: int
    total: float
    uncapped_total: float
    dimensions: list[Dimension]
    flags: list[str]
    stars_start: float
    stars_year: float
    stars_projected: float
    stars_target: float
    equity_modifier: float
    crisis_event: str | None = None
    crisis_severity: str | None = None
    crisis_total: int | None = None


def _weighted_lift(content: ContentBundle, payer, values: dict[str, float], ids: list[str]) -> float:
    num = den = 0.0
    for m_id in ids:
        measure = content.measures[m_id]
        base = payer.measures[m_id]
        share = (
            clamp(improvement(measure, base.value, values[m_id]) / base.headroom, -1, 1)
            if base.headroom
            else 0.0
        )
        num += share * measure.weight
        den += measure.weight
    return num / den if den else 0.0


def build_scorecard(
    state: TeamState,
    content: ContentBundle,
    *,
    opmodel: RubricScore | None = None,
    opmodel_design: OperatingModelDesign | None = None,
    crisis: CrisisOutcome | None = None,
) -> Scorecard:
    if state.quarter < QUARTERS_PER_YEAR:
        raise ValueError("at least one simulated year is required for a scorecard")
    cfg = content.config
    w = cfg.score_weights
    sp = cfg.scoring
    year = state.quarter // QUARTERS_PER_YEAR
    payer = content.payers[state.payer_id]
    report: YearReport = year_report(state, content, year)
    rating, projected = year_values(state, content, year)
    ctx = context(state, content)
    flags: list[str] = []

    effects = None
    event = None
    if crisis:
        event = content.events[crisis.event_id]
        effects = event.severities.get(crisis.severity)
    if effects:
        for m_id, delta in effects.measures.items():
            rating[m_id] += delta
            projected[m_id] += delta
    adj = payer.rating_adjustment
    base_vals = {m: payer.measures[m].value for m in content.measures}
    stars_start = overall_stars(content.measures, base_vals, adj)
    stars_year = overall_stars(content.measures, rating, adj)
    stars_proj = overall_stars(content.measures, projected, adj)
    base_score = summary_score(content.measures, base_vals, adj)
    proj_score = summary_score(content.measures, projected, adj)

    # --- Stars trajectory (30%): achieved lift ÷ headroom, plus projected path to 4.0.
    # Lift is measured on delivered (full-effect) values; the rating-year lag is a reporting
    # effect, shown separately as the Year rating.
    lift = _weighted_lift(content, payer, projected, list(content.measures))
    if stars_start >= cfg.target_stars:
        path = 1.0 if stars_proj >= cfg.target_stars else 0.0
    else:
        path = clamp((proj_score - base_score) / (cfg.target_stars - base_score), 0, 1)
    stars_score = 100 * (sp.stars_lift_weight * clamp(lift, 0, 1) + sp.stars_path_weight * path)
    stars_drivers = [
        f"Rating {stars_start:.1f} → {stars_year:.1f} after Year {year}; projected path {stars_proj:.1f} "
        f"(target {cfg.target_stars:.1f})",
        f"Delivered lift is {lift:.0%} of the two-year headroom across the 10 measures (weights 3/2/1)",
    ]
    up = [m.code for m in report.measures if m.year_stars > m.baseline_stars]
    down = [m.code for m in report.measures if m.year_stars < m.baseline_stars]
    if up:
        stars_drivers.append("Gained a star: " + ", ".join(up))
    if down:
        stars_drivers.append("Lost a star: " + ", ".join(down))

    # --- Member outcomes and experience (20%): M3, M4, M7 outcomes; M9–M11 experience; equity.
    member_lift = _weighted_lift(content, payer, projected, cfg.member_measures)
    equity = clamp((report.dual_ratio - 1.0) * sp.equity_scale, -1, 1)
    if effects and effects.equity_modifier is not None:
        equity = effects.equity_modifier
    harms = [i for i in state.incidents if i.member_harm]
    member_score = clamp(
        100 * clamp(member_lift, 0, 1) + sp.equity_points * equity - sp.member_harm_points * len(harms),
        0,
        100,
    )
    member_drivers = [
        f"Outcome and experience measures improved {member_lift:.0%} of headroom",
        f"Equity modifier {equity:+.1f} (dual-eligible members' share of the lift relative to overall)",
    ]
    member_drivers += [f"Member harm: {i.description}" for i in harms[:3]]

    # --- Financial performance (20%): benefit as a share of the 4-Star bonus value; discipline.
    fin = report.financials
    bonus = bonus_value_musd(content, payer.id)
    write_off = fin.written_off_musd + (effects.write_off_musd if effects else 0.0)
    granted = granted_capital(state)
    committed = max(fin.committed_musd, 0.01)
    execution = clamp(fin.capital_spent_musd / committed, 0, 1)
    discipline = clamp(
        0.5 * execution + 0.5 * (1 - sp.writeoff_penalty_factor * write_off / max(granted, 1)), 0, 1
    )
    bonus_progress = (
        1.0 if stars_proj >= cfg.target_stars else (0.0 if stars_start >= cfg.target_stars else path)
    )
    run_rate = clamp(fin.savings_run_rate_musd / (sp.savings_reference_share * bonus), 0, 1) if bonus else 0.0
    financial_score = 100 * (
        sp.financial_bonus_weight * bonus_progress
        + sp.financial_savings_weight * run_rate
        + sp.financial_discipline_weight * discipline
    )
    financial_drivers = [
        f"4-Star bonus value ${bonus:.1f}M a year (${cfg.bonus_pmpy_usd:.0f} per member, illustrative); "
        + (
            "projected to reach it"
            if stars_proj >= cfg.target_stars
            else f"{bonus_progress:.0%} of the way there"
        ),
        f"Capital spent ${fin.capital_spent_musd:.1f}M of ${fin.committed_musd:.1f}M committed; run cost ${fin.opex_musd:.1f}M",
        f"Run-rate savings ${fin.savings_run_rate_musd:.1f}M a year",
    ]
    if write_off:
        financial_drivers.append(f"${write_off:.1f}M written off")

    # --- AI transformation maturity (15%): foundations, adoption, decision rights, op model (40%).
    fits = {
        c: cfg.payer_effectiveness[content.investments[c].payer_fit[payer.id].level]
        for c in cfg.foundation_cards
    }
    foundations = sum(f for c, f in fits.items() if c in ctx.live) / sum(fits.values())
    live_adoption = [v for k, v in state.history[-1].adoption.items()]
    if effects and effects.adoption_override is not None and live_adoption:
        live_adoption = [min(v, effects.adoption_override) for v in live_adoption]
    if live_adoption:
        adoption = sum(live_adoption) / len(live_adoption)
    else:
        adoption = cfg.adoption_with_workflow if cfg.workflow_card in ctx.live else 0.3
    gov_owned = cfg.governance_card in ctx.live
    exec_named = bool(opmodel_design and opmodel_design.accountable_executive.strip())
    rights = 0.5 * gov_owned + 0.5 * exec_named
    base_part = (
        sp.maturity_foundations_weight * foundations
        + sp.maturity_adoption_weight * adoption
        + sp.maturity_rights_weight * rights
    )
    op_part = opmodel.total / opmodel.max if opmodel else 0.0
    maturity = 100 * (
        (1 - cfg.opmodel_share_of_maturity) * base_part + cfg.opmodel_share_of_maturity * op_part
    )
    maturity_drivers = [
        f"Reusable foundations live: {foundations:.0%} of what matters here",
        f"Copilot and agent adoption {adoption:.0%}",
        f"Decision rights: governance {'owned' if gov_owned else 'missing'}, workflow executive {'named' if exec_named else 'not named'}",
        f"Operating model exercise {opmodel.total}/{opmodel.max}"
        if opmodel
        else "Operating model exercise not yet scored",
    ]
    if report.overrun_quarters:
        maturity = min(maturity, cfg.overrun_maturity_cap)
        flags.append(
            f"Capacity overrun above {cfg.capacity_overrun_cap:.0%} in {report.overrun_quarters} quarter(s): AI maturity capped at {cfg.overrun_maturity_cap:.0f}."
        )

    # --- Risk and governance (15%): controls, incidents, privacy; crisis rubric is 50%.
    validation_live = cfg.validation_card in ctx.live
    subgroup = bool(opmodel_design and any("subgroup_monitoring" in s.controls for s in opmodel_design.steps))
    privacy_ok = not (event is not None and event.privacy_event)
    controls = clamp(
        100
        * (
            sp.risk_governance_weight * gov_owned
            + sp.risk_validation_weight * validation_live
            + sp.risk_subgroup_weight * subgroup
            + sp.risk_privacy_weight * privacy_ok
        )
        - sp.risk_harm_points * len(harms),
        0,
        100,
    )
    crisis_pct = None
    if crisis and crisis.rubric:
        crisis_pct = 100 * crisis.rubric.total / crisis.rubric.max
    risk = (
        controls
        if crisis_pct is None
        else (1 - cfg.crisis_share_of_risk) * controls + cfg.crisis_share_of_risk * crisis_pct
    )
    risk_drivers = [
        f"Controls: governance {'owned' if gov_owned else 'missing'}, model validation {'live' if validation_live else 'missing'}, "
        f"subgroup monitoring {'designed' if subgroup else 'missing'}",
        f"{len(harms)} member-harm incident(s)",
    ]
    if crisis and crisis.rubric:
        risk_drivers.append(f"Crisis response {crisis.rubric.total}/{crisis.rubric.max}")

    # --- Crisis dimension adjustments and guardrails.
    dims = {
        "stars": stars_score,
        "member": member_score,
        "financial": financial_score,
        "maturity": maturity,
        "risk": risk,
    }
    if effects:
        for dim, delta in effects.dimensions.items():
            dims[dim] = clamp(dims[dim] + delta, 0, 100)
        flags.append(f"{event.code} {event.title} ({crisis.severity.value} severity): {effects.description}")
    corrective = crisis.rubric.rows.get("corrective", 0) if crisis and crisis.rubric else 0
    if harms and corrective == 0:
        dims["risk"] = min(dims["risk"], cfg.member_harm_risk_cap)
        flags.append("Member harm occurred with no corrective action: Risk and governance capped at 20.")
    if crisis and crisis.concealment:
        flags.append("Concealment: the crisis response scores zero.")

    dimensions = [
        Dimension(
            id="stars",
            label="Stars trajectory",
            weight=w.stars,
            score=round(dims["stars"], 1),
            drivers=stars_drivers,
        ),
        Dimension(
            id="member",
            label="Member outcomes and experience",
            weight=w.member,
            score=round(dims["member"], 1),
            drivers=member_drivers,
        ),
        Dimension(
            id="financial",
            label="Financial performance",
            weight=w.financial,
            score=round(dims["financial"], 1),
            drivers=financial_drivers,
        ),
        Dimension(
            id="maturity",
            label="AI transformation maturity",
            weight=w.maturity,
            score=round(dims["maturity"], 1),
            drivers=maturity_drivers,
        ),
        Dimension(
            id="risk",
            label="Risk and governance",
            weight=w.risk,
            score=round(dims["risk"], 1),
            drivers=risk_drivers,
        ),
    ]
    uncapped = sum(d.score * d.weight for d in dimensions)
    total = uncapped
    if crisis and crisis.rubric and crisis.rubric.total < content.rubrics.critical_crisis_threshold:
        total -= cfg.critical_incident_penalty
        flags.append(
            f"Critical incident not contained (crisis rubric {crisis.rubric.total} of {crisis.rubric.max}, "
            f"under {content.rubrics.critical_crisis_threshold}): −{cfg.critical_incident_penalty:.0f} points."
        )

    return Scorecard(
        payer_id=payer.id,
        year=year,
        total=round(clamp(total, 0, 100), 1),
        uncapped_total=round(uncapped, 1),
        dimensions=dimensions,
        flags=flags,
        stars_start=stars_start,
        stars_year=stars_year,
        stars_projected=stars_proj,
        stars_target=cfg.target_stars,
        equity_modifier=round(equity, 2),
        crisis_event=crisis.event_id if crisis else None,
        crisis_severity=crisis.severity.value if crisis else None,
        crisis_total=crisis.rubric.total if crisis and crisis.rubric else None,
    )


__all__ = ["CrisisOutcome", "Dimension", "Scorecard", "build_scorecard", "sign"]
