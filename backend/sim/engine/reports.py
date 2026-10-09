"""Executive performance review built from simulated history.

Results explain *drivers* (which cards moved which KPIs and measures, and which multipliers
applied — OD-05) without exposing formulas or parameters. Values are labelled simulated /
projected and carry a ±confidence band on the effect (pack section 5, "Uncertainty").

Rating-year value for year Y (build assumption B-03)::

    start + lag_share × mean full effect in Y + (1 − lag_share) × mean full effect in Y−1

Projected path = start + full effect at the end of Y (what the rating converges to).
"""

from __future__ import annotations

from statistics import mean

from pydantic import BaseModel

from sim.content import ContentBundle
from sim.engine.conditions import context, holds, is_ceremonial
from sim.engine.model import clamp, granted_capital, realization, sign
from sim.engine.stars import improvement, measure_stars, next_star_gap, overall_stars, summary_score
from sim.engine.state import QUARTERS_PER_YEAR, InitiativeStatus, TeamState


class MeasureResult(BaseModel):
    id: str
    code: str
    name: str
    domain: str
    weight: float
    unit: str
    unit_kind: str
    higher_is_better: bool
    baseline: float
    year_value: float
    projected: float
    band: float
    headroom: float
    lift: float
    lift_share: float
    baseline_stars: int
    year_stars: int
    projected_stars: int
    next_star_gap: float | None
    direction: str
    leading_kpis: list[str]


class KpiSeries(BaseModel):
    id: str
    name: str
    unit: str
    higher_is_better: bool
    baseline: float
    values: list[float]
    current: float
    delta: float


class Driver(BaseModel):
    kind: str
    label: str
    impact_pct: float


class CardContribution(BaseModel):
    measure: str
    code: str
    base: float
    realized: float


class InitiativeResult(BaseModel):
    investment_id: str
    code: str
    name: str
    class_label: str
    status: str
    funded_round: int
    scope: str | None
    owner: str
    progress: float
    live_label: str | None
    realized_pct: float | None
    contributions: list[CardContribution]
    drivers: list[Driver]
    kpi_effects: list[str]


class StarsSummary(BaseModel):
    baseline: float
    baseline_score: float
    year_rating: float
    year_score: float
    projected: float
    projected_score: float
    projected_low: float
    projected_high: float
    target: float


class SegmentResult(BaseModel):
    id: str
    name: str
    baseline: float
    year_rating: float
    projected: float


class QuarterRow(BaseModel):
    quarter: int
    label: str
    capacity_demand: float
    capacity_supply: float
    capacity_utilization: float
    progress_avg: float
    adoption_avg: float | None


class Financials(BaseModel):
    granted_musd: float
    committed_musd: float
    capital_spent_musd: float
    written_off_musd: float
    opex_musd: float
    savings_run_rate_musd: float
    bonus_value_musd: float
    bonus_captured_musd: float
    bonus_progress: float


class YearReport(BaseModel):
    year: int
    payer_id: str
    simulated: bool = True
    confidence_band: float
    stars: StarsSummary
    segments: list[SegmentResult]
    measures: list[MeasureResult]
    kpis: list[KpiSeries]
    quarters: list[QuarterRow]
    initiatives: list[InitiativeResult]
    financials: Financials
    unintended: list[str]
    clues: list[str]
    capacity_peak: float
    overrun_quarters: int
    dual_ratio: float


def quarter_label(q_index: int) -> str:
    """0-based global quarter → 'Y1 Q3'."""
    return f"Y{q_index // QUARTERS_PER_YEAR + 1} Q{q_index % QUARTERS_PER_YEAR + 1}"


def year_values(
    state: TeamState, content: ContentBundle, year: int
) -> tuple[dict[str, float], dict[str, float]]:
    """(rating-year values, projected values) in raw measure units."""
    payer = content.payers[state.payer_id]
    this = [s for s in state.history if s.year == year]
    prev = [s for s in state.history if s.year == year - 1]
    if len(this) != QUARTERS_PER_YEAR:
        raise ValueError(f"year {year} has not been fully simulated")
    rating, projected = {}, {}
    for m_id, measure in content.measures.items():
        f_this = mean(s.effects[m_id] for s in this)
        f_prev = mean(s.effects[m_id] for s in prev) if prev else 0.0
        effect = measure.lag_share * f_this + (1 - measure.lag_share) * f_prev
        start = payer.measures[m_id].value
        rating[m_id] = round(start + sign(content, m_id) * effect, 3)
        projected[m_id] = this[-1].measures[m_id]
    return rating, projected


def bonus_value_musd(content: ContentBundle, payer_id: str) -> float:
    return content.payers[payer_id].members * content.config.bonus_pmpy_usd / 1e6


def year_report(state: TeamState, content: ContentBundle, year: int) -> YearReport:
    payer = content.payers[state.payer_id]
    cfg = content.config
    band = cfg.confidence_band
    quarters = [s for s in state.history if s.year == year]
    rating, projected = year_values(state, content, year)
    baseline = {m: payer.measures[m].value for m in content.measures}
    last = quarters[-1]
    adj = payer.rating_adjustment

    measures: list[MeasureResult] = []
    for m_id, measure in content.measures.items():
        base = payer.measures[m_id]
        lift = improvement(measure, base.value, rating[m_id])
        noise = 0.05 * base.headroom
        measures.append(
            MeasureResult(
                id=m_id,
                code=measure.code,
                name=measure.name,
                domain=measure.domain,
                weight=measure.weight,
                unit=measure.unit,
                unit_kind=measure.unit_kind,
                higher_is_better=measure.higher_is_better,
                baseline=base.value,
                year_value=round(rating[m_id], 2 if measure.unit_kind != "rate" or base.value > 2 else 3),
                projected=round(projected[m_id], 2 if measure.unit_kind != "rate" or base.value > 2 else 3),
                band=round(abs(last.effects[m_id]) * band, 3),
                headroom=base.headroom,
                lift=round(lift, 3),
                lift_share=round(lift / base.headroom, 3) if base.headroom else 0.0,
                baseline_stars=measure_stars(measure, base.value),
                year_stars=measure_stars(measure, rating[m_id]),
                projected_stars=measure_stars(measure, projected[m_id]),
                next_star_gap=next_star_gap(measure, projected[m_id]),
                direction="up" if lift > noise else "down" if lift < -noise else "flat",
                leading_kpis=list(measure.leading_kpis),
            )
        )

    def banded(scale: float) -> float:
        rates = {m: baseline[m] + (projected[m] - baseline[m]) * scale for m in content.measures}
        return overall_stars(content.measures, rates, adj)

    stars = StarsSummary(
        baseline=overall_stars(content.measures, baseline, adj),
        baseline_score=round(summary_score(content.measures, baseline, adj), 3),
        year_rating=overall_stars(content.measures, rating, adj),
        year_score=round(summary_score(content.measures, rating, adj), 3),
        projected=overall_stars(content.measures, projected, adj),
        projected_score=round(summary_score(content.measures, projected, adj), 3),
        projected_low=banded(1 - band),
        projected_high=banded(1 + band),
        target=cfg.target_stars,
    )

    segments = []
    for seg in payer.segments:

        def seg_rates(values: dict[str, float], seg=seg) -> dict[str, float]:
            out = dict(values)
            for m_id, ov in seg.measure_overrides.items():
                ent = payer.measures[m_id]
                scale = ov.headroom / ent.headroom if ent.headroom else 1.0
                out[m_id] = ov.value + (values[m_id] - ent.value) * scale
            return out

        segments.append(
            SegmentResult(
                id=seg.id,
                name=seg.name,
                baseline=overall_stars(content.measures, seg_rates(baseline), adj),
                year_rating=overall_stars(content.measures, seg_rates(rating), adj),
                projected=overall_stars(content.measures, seg_rates(projected), adj),
            )
        )

    kpis = []
    upto = [s for s in state.history if s.year <= year]
    for k_id, kpi in content.kpis.items():
        values = [s.kpis[k_id] for s in upto]
        kpis.append(
            KpiSeries(
                id=k_id,
                name=kpi.name,
                unit=kpi.unit,
                higher_is_better=kpi.higher_is_better,
                baseline=payer.kpis[k_id],
                values=values,
                current=values[-1],
                delta=round(values[-1] - payer.kpis[k_id], 2),
            )
        )

    quarter_rows = [
        QuarterRow(
            quarter=s.quarter,
            label=quarter_label(s.quarter - 1),
            capacity_demand=s.capacity_demand,
            capacity_supply=s.capacity_supply,
            capacity_utilization=s.capacity_utilization,
            progress_avg=round(mean(s.progress.values()), 3) if s.progress else 0.0,
            adoption_avg=round(mean(s.adoption.values()), 3) if s.adoption else None,
        )
        for s in upto
    ]

    end_q = year * QUARTERS_PER_YEAR
    initiatives = [_initiative_result(state, content, ini, end_q, last) for ini in state.initiatives]

    capital = sum(s.capital_spent_musd for s in upto)
    opex = sum(s.opex_musd for s in upto)
    bonus = bonus_value_musd(content, payer.id)
    target = cfg.target_stars
    if stars.baseline >= target:
        captured = bonus if stars.projected >= target else 0.0
        progress = 1.0 if stars.projected >= target else 0.0
    else:
        captured = bonus if stars.projected >= target else 0.0
        progress = clamp(
            (stars.projected_score - stars.baseline_score) / max(target - stars.baseline_score, 0.25), 0, 1
        )
    financials = Financials(
        granted_musd=round(granted_capital(state), 2),
        committed_musd=round(sum(i.capital_committed for i in state.initiatives), 2),
        capital_spent_musd=round(capital, 2),
        written_off_musd=round(sum(i.capital_written_off for i in state.initiatives), 2),
        opex_musd=round(opex, 2),
        savings_run_rate_musd=round(last.savings_musd * QUARTERS_PER_YEAR, 2),
        bonus_value_musd=round(bonus, 1),
        bonus_captured_musd=round(captured, 1),
        bonus_progress=round(progress, 3),
    )

    peak = max(s.capacity_utilization for s in upto)
    return YearReport(
        year=year,
        payer_id=payer.id,
        confidence_band=band,
        stars=stars,
        segments=segments,
        measures=measures,
        kpis=kpis,
        quarters=quarter_rows,
        initiatives=initiatives,
        financials=financials,
        unintended=_unintended(state, content, year),
        clues=_clues(state, content),
        capacity_peak=peak,
        overrun_quarters=sum(1 for s in upto if s.capacity_utilization > cfg.capacity_overrun_cap),
        dual_ratio=last.dual_ratio,
    )


def _initiative_result(state: TeamState, content: ContentBundle, ini, end_q: int, last) -> InitiativeResult:
    inv = content.investments[ini.investment_id]
    payer_id = state.payer_id
    ctx = context(state, content, end_q)
    drivers: list[Driver] = []
    realized_pct = None
    contributions: list[CardContribution] = []
    if (
        ini.live_quarter is not None
        and ini.live_quarter < end_q
        and ini.status is not InitiativeStatus.CANCELLED
    ):
        r = realization(content, state, ini, ctx, quarter=end_q - 1, capacity_mult=last.capacity_multiplier)
        realized_pct = round(r.total * 100, 1)
        for f in r.factors:
            if abs(f.multiplier - 1.0) > 0.005:
                drivers.append(
                    Driver(kind=f.kind, label=f.label, impact_pct=round((f.multiplier - 1) * 100, 1))
                )
        for c in last.contributions:
            if c.investment_id == inv.id:
                contributions.append(
                    CardContribution(
                        measure=c.measure,
                        code=content.measures[c.measure].code,
                        base=c.base,
                        realized=c.realized,
                    )
                )
                pre = c.base * r.total
                if pre > 0 and c.realized < pre * 0.95:
                    drivers.append(
                        Driver(
                            kind="diminishing",
                            label=f"Overlaps other cards on {content.measures[c.measure].code}: diminishing returns",
                            impact_pct=round((c.realized / pre - 1) * 100, 1),
                        )
                    )
    elif ini.status is InitiativeStatus.ACTIVE:
        drivers.append(
            Driver(
                kind="delivery",
                label=f"Still being delivered: {ini.progress:.0%} complete",
                impact_pct=-100.0,
            )
        )
    if is_ceremonial(ini, content):
        drivers.append(
            Driver(
                kind="owner",
                label=f"Ceremonial: no {inv.owner_prompt.lower()} named, so no effect",
                impact_pct=-100.0,
            )
        )
    if ini.status is not InitiativeStatus.ACTIVE:
        drivers.append(Driver(kind="status", label=f"Initiative {ini.status.value}", impact_pct=0.0))
    drivers.sort(key=lambda d: abs(d.impact_pct), reverse=True)
    kpi_notes = []
    for ke in inv.kpi_effects:
        if (ke.payers and payer_id not in ke.payers) or payer_id in ke.not_payers:
            continue
        name = content.kpis[ke.kpi].name
        if ke.delta is not None:
            kpi_notes.append(f"{name} {ke.delta:+g}")
        elif ke.pct is not None:
            kpi_notes.append(f"{name} {ke.pct:+.0%}")
        else:
            kpi_notes.append(f"{name} toward {ke.set_to:g}")
    return InitiativeResult(
        investment_id=inv.id,
        code=inv.code,
        name=inv.name,
        class_label=inv.class_label,
        status=ini.status.value,
        funded_round=ini.funded_round,
        scope=ini.scope,
        owner=ini.owner,
        progress=round(ini.progress, 3),
        live_label=quarter_label(ini.live_quarter) if ini.live_quarter is not None else None,
        realized_pct=realized_pct,
        contributions=contributions,
        drivers=drivers,
        kpi_effects=kpi_notes,
    )


def _unintended(state: TeamState, content: ContentBundle, year: int) -> list[str]:
    notes: list[str] = []
    first_q, last_q = (year - 1) * QUARTERS_PER_YEAR, year * QUARTERS_PER_YEAR
    for inc in state.incidents:
        if inc.quarter < last_q:
            code = content.investments[inc.investment_id].code
            when = quarter_label(inc.quarter) if inc.quarter >= first_q else "earlier"
            notes.append(f"{when}: {inc.description} ({code}, {content.measures[inc.measure].code})")
    payer = content.payers[state.payer_id]
    ctx = context(state, content, last_q)
    for drift in payer.drifts:
        accrued = state.drift_accum.get(drift.measure)
        if accrued:
            code = content.measures[drift.measure].code
            if holds(drift.unless, ctx):
                notes.append(
                    f"Drift stopped once the fix went live; {accrued:+.2f} accrued before ({code}): {drift.note}"
                )
            else:
                notes.append(f"Without action: {drift.note} ({code}, {accrued:+.2f} so far)")
    for s in state.history:
        if s.year == year and s.capacity_utilization > content.config.capacity_overrun_cap:
            notes.append(
                f"{quarter_label(s.quarter - 1)}: capacity demand {s.capacity_demand:g} points vs supply "
                f"{s.capacity_supply:g} ({s.capacity_utilization:.0%}); everything progressed at half speed"
            )
    return notes


def _clues(state: TeamState, content: ContentBundle) -> list[str]:
    """A causal clue for each hidden root cause the portfolio does not yet address."""
    payer = content.payers[state.payer_id]
    funded = {i.investment_id for i in state.initiatives if i.in_portfolio and not is_ceremonial(i, content)}
    return [rc.clue for rc in payer.hidden_root_causes if not funded & set(rc.addressed_by)][:3]
