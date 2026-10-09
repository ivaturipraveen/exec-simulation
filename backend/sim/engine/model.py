"""Quarterly simulation model — Content Pack v0.1 section 5.

Per quarter, for every building initiative::

    progress += 1 / duration × capacity_mult        capacity_mult = min(1, supply / demand),
                                                    0.5 when demand > 150% of supply

and for every live initiative (delivered in an earlier quarter), on each measure it targets::

    effect = base × payer_fit × rule multipliers × adoption × owner × capacity_mult × decay × draw

Effects on the same measure are sorted largest first and realize 100% / 60% / 30% (diminishing
returns), then capped at the payer's two-year headroom. Side effects (complaints from misfired
outreach, appointment demand clinics cannot absorb) and baseline drifts are added afterwards.
Lag shares turn this full effect into rating-year values in ``reports``. Leading KPIs move the
quarter after go-live. Every relationship is documented in docs/model.md.
"""

from __future__ import annotations

import hashlib
import random
from dataclasses import dataclass, field

from sim.content import ContentBundle
from sim.content.models import Investment, Payer
from sim.engine.conditions import Context, context, holds
from sim.engine.state import (
    QUARTERS_PER_YEAR,
    YEARS,
    Contribution,
    Incident,
    Initiative,
    InitiativeStatus,
    QuarterSnapshot,
    TeamState,
)


class SimulationError(ValueError):
    """Raised for invalid player actions (e.g. overspending, unknown investment)."""


# --------------------------------------------------------------------------- helpers


def stable_rng(*parts: object) -> random.Random:
    """Deterministic RNG from arbitrary parts (independent of PYTHONHASHSEED)."""
    digest = hashlib.sha256(":".join(str(p) for p in parts).encode()).hexdigest()
    return random.Random(int(digest[:16], 16))


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def sign(content: ContentBundle, measure_id: str) -> float:
    """+1 when higher is better; converts raw deltas to improvement units and back."""
    return 1.0 if content.measures[measure_id].higher_is_better else -1.0


def payer_fit(content: ContentBundle, inv: Investment, payer_id: str) -> float:
    return content.config.payer_effectiveness[inv.payer_fit[payer_id].level]


def years_remaining(state: TeamState) -> int:
    return max(1, YEARS - state.quarter // QUARTERS_PER_YEAR)


# --------------------------------------------------------------------------- realization


@dataclass(frozen=True)
class Factor:
    kind: str
    label: str
    multiplier: float


@dataclass
class Realization:
    """Why a card realizes the share of its base effect that it does (result drivers, OD-05)."""

    factors: list[Factor] = field(default_factory=list)

    @property
    def total(self) -> float:
        out = 1.0
        for f in self.factors:
            out *= f.multiplier
        return out

    def add(self, kind: str, label: str, multiplier: float) -> None:
        self.factors.append(Factor(kind, label, multiplier))


def build_start(ini: Initiative, content: ContentBundle, payer_id: str) -> int:
    """First quarter in which a card can make progress: its start plus any lead time
    (agreements, IT queues) — no capacity is consumed while waiting."""
    lead = content.investments[ini.investment_id].lead_quarters
    return ini.start_quarter + lead.get(payer_id, lead.get("*", 0))


def adoption_level(
    content: ContentBundle,
    inv: Investment,
    ctx: Context,
    state: TeamState | None = None,
    quarter: int | None = None,
) -> float | None:
    if inv.adoption is None:
        return None
    cfg = content.config
    level = inv.adoption.baseline
    if cfg.workflow_card in ctx.live:
        level = cfg.adoption_with_workflow
        if cfg.incentive_card in ctx.live:
            level = cfg.adoption_with_workflow_and_incentives
        # I11 decay: adoption falls each year after go-live unless reinforced (I18).
        workflow = state.initiative(cfg.workflow_card) if state is not None else None
        if (
            workflow
            and workflow.live_quarter is not None
            and quarter is not None
            and cfg.literacy_card not in ctx.live
        ):
            years = max(0.0, (quarter - workflow.live_quarter - 1) / QUARTERS_PER_YEAR)
            level = max(inv.adoption.baseline, level - cfg.adoption_decay_per_year * years)
    if cfg.literacy_card in ctx.live:
        level += cfg.adoption_literacy_bonus
    return min(1.0, level)


def realization(
    content: ContentBundle,
    state: TeamState,
    ini: Initiative,
    ctx: Context,
    *,
    quarter: int,
    capacity_mult: float = 1.0,
    for_kpis: bool = False,
) -> Realization:
    """Multipliers on a card's base effect. KPI effects skip rule multipliers (those describe
    how much of the measure effect lands, not whether the operational change happens)."""
    inv = content.investments[ini.investment_id]
    cfg = content.config
    r = Realization()
    fit = inv.payer_fit[state.payer_id]
    r.add(
        "context",
        f"Fit with this organization: {fit.level.value} — {fit.note}",
        payer_fit(content, inv, state.payer_id),
    )
    if not for_kpis:
        for rule in inv.rules:
            if holds(rule.when, ctx):
                r.add("rule", rule.label, rule.multiplier)
    adoption = adoption_level(content, inv, ctx, state, quarter)
    if adoption is not None:
        source = "baseline"
        if cfg.workflow_card in ctx.live:
            source = "with workflow redesign (I11)"
            if cfg.incentive_card in ctx.live:
                source = "with workflow redesign and incentives (I11 + I15)"
        r.add("adoption", f"Adoption {adoption:.0%} {source}", adoption)
    if inv.owner_required and not ini.owner.strip():
        r.add("owner", f"No {inv.owner_prompt.lower() or 'owner'} named", inv.owner_missing_multiplier)
    if ini.scope_factor < 1.0 and for_kpis:
        r.add("scope", "Scoped to one book or region", ini.scope_factor)
    if capacity_mult < 1.0:
        r.add("capacity", f"Organization over capacity this quarter (×{capacity_mult:.2f})", capacity_mult)
    if inv.decay and ini.live_quarter is not None:
        years_live = max(0.0, (quarter - ini.live_quarter - 1) / QUARTERS_PER_YEAR)
        if years_live > 0 and not (inv.decay.unless and holds(inv.decay.unless, ctx)):
            r.add("decay", inv.decay.label, max(0.0, 1.0 - inv.decay.rate_per_year * years_live))
    if ini.status is InitiativeStatus.PAUSED:
        r.add("status", "Paused", cfg.paused_effect_share)
    if not for_kpis and state.variable:
        spread = content.config.effect_range
        r.add("draw", "Variable-mode draw within the effect range", 1.0 + spread * (2 * ini.draw - 1))
    return r


def contributes_at(ini: Initiative, quarter: int) -> bool:
    """Live (or paused after go-live) in a quarter before ``quarter``."""
    return (
        ini.status is not InitiativeStatus.CANCELLED
        and ini.live_quarter is not None
        and ini.live_quarter < quarter
    )


# --------------------------------------------------------------------------- capital


@dataclass(frozen=True)
class Ledger:
    granted: float
    committed: float
    spent: float
    available: float
    paused: float
    recoverable: float
    written_off: float


def granted_capital(state: TeamState) -> float:
    return (
        state.capital_round1_musd + state.capital_round2_musd + sum(a.amount_musd for a in state.adjustments)
    )


def ledger(state: TeamState, content: ContentBundle) -> Ledger:
    granted = granted_capital(state)
    committed = sum(i.capital_committed for i in state.initiatives)
    spent = sum(i.capital_spent for i in state.initiatives)
    paused = sum(i.remaining_commitment for i in state.initiatives if i.status is InitiativeStatus.PAUSED)
    recoverable = sum(
        i.remaining_commitment * content.investments[i.investment_id].reversibility
        for i in state.initiatives
        if i.in_portfolio
    )
    written_off = sum(i.capital_written_off for i in state.initiatives)
    return Ledger(
        granted=round(granted, 3),
        committed=round(committed, 3),
        spent=round(spent, 3),
        available=round(granted - committed, 3),
        paused=round(paused, 3),
        recoverable=round(recoverable, 3),
        written_off=round(written_off, 3),
    )


def card_cost(inv: Investment, scope: str | None, years: int) -> tuple[float, float]:
    """(cost, scope factor) for funding a card now."""
    factor = 1.0
    cost = inv.cost_musd
    if inv.scopes:
        chosen = next((s for s in inv.scopes if s.id == scope), inv.scopes[0]) if scope else inv.scopes[0]
        if scope and chosen.id != scope:
            raise SimulationError(f"'{inv.name}' has no scope '{scope}'")
        cost, factor = chosen.cost_musd, chosen.factor
    elif scope:
        raise SimulationError(f"'{inv.name}' has no scope options")
    if inv.cost_basis == "per_year":
        cost *= years
    return round(cost, 3), factor


# --------------------------------------------------------------------------- player actions


def new_team_state(
    content: ContentBundle, payer_id: str, seed: int, *, variable: bool | None = None
) -> TeamState:
    if payer_id not in content.payers:
        raise SimulationError(f"unknown payer '{payer_id}'")
    payer = content.payers[payer_id]
    if variable is None:
        variable = content.config.sim_mode.value == "variable"
    return TeamState(
        payer_id=payer_id, seed=seed, variable=variable, capital_round1_musd=payer.capital_round1_musd
    )


def fund(
    state: TeamState,
    content: ContentBundle,
    investment_id: str,
    round_no: int,
    *,
    scope: str | None = None,
    start_offset: int = 0,
    owner: str = "",
) -> Initiative:
    inv = content.investments.get(investment_id)
    if inv is None:
        raise SimulationError(f"unknown investment '{investment_id}'")
    if state.initiative(investment_id):
        raise SimulationError(f"'{inv.name}' is already in the portfolio")
    if not 0 <= start_offset < QUARTERS_PER_YEAR:
        raise SimulationError("start quarter must be within the round's year (Q1 to Q4)")
    cost, factor = card_cost(inv, scope, years_remaining(state))
    available = ledger(state, content).available
    if cost > available + 1e-9:
        raise SimulationError(f"'{inv.name}' costs ${cost:.2f}M but only ${available:.2f}M is available")
    rng = stable_rng(state.seed, state.payer_id, investment_id)
    ini = Initiative(
        investment_id=investment_id,
        funded_round=round_no,
        start_quarter=state.quarter + start_offset,
        scope=scope or (inv.scopes[0].id if inv.scopes else None),
        scope_factor=factor,
        owner=owner.strip(),
        capital_committed=cost,
        draw=rng.random() if state.variable else 0.5,
    )
    state.initiatives.append(ini)
    return ini


def set_owner(state: TeamState, investment_id: str, owner: str) -> None:
    _live(state, investment_id).owner = owner.strip()


def pause(state: TeamState, investment_id: str) -> None:
    _live(state, investment_id).status = InitiativeStatus.PAUSED


def resume(state: TeamState, investment_id: str) -> None:
    _live(state, investment_id).status = InitiativeStatus.ACTIVE


def cancel(state: TeamState, content: ContentBundle, investment_id: str) -> float:
    """Cancel an initiative; returns capital recovered. Effects stop immediately."""
    ini = _live(state, investment_id)
    inv = content.investments[investment_id]
    amount = ini.remaining_commitment
    recovered = amount * inv.reversibility
    ini.capital_committed -= recovered
    ini.capital_recovered += recovered
    ini.capital_written_off += amount - recovered
    ini.status = InitiativeStatus.CANCELLED
    return recovered


def _live(state: TeamState, investment_id: str) -> Initiative:
    ini = state.initiative(investment_id)
    if ini is None:
        raise SimulationError(f"no initiative '{investment_id}' in the portfolio")
    return ini


# --------------------------------------------------------------------------- quarterly step


def _capacity(state: TeamState, content: ContentBundle, payer: Payer, t: int) -> tuple[float, float, float]:
    building = [
        i
        for i in state.initiatives
        if i.status is InitiativeStatus.ACTIVE and i.progress < 1.0 and build_start(i, content, payer.id) <= t
    ]
    demand = sum(content.investments[i.investment_id].capacity_points * i.scope_factor for i in building)
    supply = payer.capacity_per_quarter
    utilization = demand / supply if supply else 0.0
    mult = min(1.0, supply / demand) if demand > 0 else 1.0
    if utilization > content.config.capacity_overrun_cap:
        mult = min(mult, content.config.capacity_overrun_speed)
    return demand, utilization, mult


def _kpis(
    state: TeamState, content: ContentBundle, payer: Payer, ctx: Context, t: int
) -> tuple[dict[str, float], dict[str, float]]:
    kpis = dict(payer.kpis)
    adoption: dict[str, float] = {}
    for ini in state.initiatives:
        if not contributes_at(ini, t):
            continue
        inv = content.investments[ini.investment_id]
        level = adoption_level(content, inv, ctx, state, t)
        if level is not None:
            adoption[inv.id] = level
        if not inv.kpi_effects:
            continue
        r = realization(content, state, ini, ctx, quarter=t, for_kpis=True).total
        for ke in inv.kpi_effects:
            if (ke.payers and payer.id not in ke.payers) or payer.id in ke.not_payers:
                continue
            value = kpis[ke.kpi]
            if ke.delta is not None:
                value += ke.delta * r
            elif ke.pct is not None:
                value *= 1.0 + ke.pct * min(1.0, r)
            elif ke.set_to is not None:
                value += (ke.set_to - value) * min(1.0, r)
            kpis[ke.kpi] = value
    if adoption:
        kpis["copilot_adoption"] = 100 * sum(adoption.values()) / len(adoption)
    unit_bounded = {k for k, kpi in content.kpis.items() if kpi.unit == "%"}
    out = {k: round(clamp(v, 0.0, 100.0) if k in unit_bounded else max(0.0, v), 2) for k, v in kpis.items()}
    return out, adoption


def step_quarter(state: TeamState, content: ContentBundle) -> QuarterSnapshot:
    payer = content.payers[state.payer_id]
    cfg = content.config
    t = state.quarter

    # 1. Capacity and delivery progress; capital disbursement.
    demand, utilization, capacity_mult = _capacity(state, content, payer, t)
    spent = 0.0
    for ini in state.initiatives:
        inv = content.investments[ini.investment_id]
        if ini.status is not InitiativeStatus.ACTIVE or ini.start_quarter > t:
            continue
        if inv.cost_basis == "per_year":
            spend = min(ini.remaining_commitment, inv.cost_musd / QUARTERS_PER_YEAR)
            ini.capital_spent += spend
            spent += spend
        if ini.progress < 1.0 and build_start(ini, content, payer.id) <= t:
            before = ini.progress
            ini.progress = min(1.0, before + capacity_mult / inv.duration_quarters)
            if inv.cost_basis == "one_time":
                spend = ini.remaining_commitment * (ini.progress - before) / (1.0 - before)
                ini.capital_spent += spend
                spent += spend
            if ini.progress >= 1.0 - 1e-9:
                ini.progress = 1.0
                ini.live_quarter = t

    # 2. Conditions see last quarter's KPIs and what was live before this quarter.
    ctx = context(state, content, t)
    kpis, adoption = _kpis(state, content, payer, ctx, t)

    # 3. Measure effects with diminishing returns and headroom caps.
    per_measure: dict[str, list[tuple[float, float, str]]] = {m: [] for m in content.measures}
    realized_share: dict[str, float] = {}
    for ini in state.initiatives:
        if not contributes_at(ini, t):
            continue
        inv = content.investments[ini.investment_id]
        r = realization(content, state, ini, ctx, quarter=t, capacity_mult=capacity_mult).total
        realized_share[inv.id] = round(r, 4)
        for eff in inv.effects:
            if (eff.payers and payer.id not in eff.payers) or payer.id in eff.not_payers:
                continue
            base = eff.base * sign(content, eff.measure)
            per_measure[eff.measure].append((base * r, base, inv.id))

    dr = cfg.diminishing_returns
    effects: dict[str, float] = {}
    contributions: list[Contribution] = []
    member_facing_total = 0.0
    dual_weighted = 0.0
    for m_id, items in per_measure.items():
        items.sort(key=lambda x: -x[0])
        total = 0.0
        for rank, (value, base, inv_id) in enumerate(items):
            factor = dr[min(rank, len(dr) - 1)] if value > 0 else 1.0
            realized = value * factor
            total += realized
            contributions.append(
                Contribution(
                    investment_id=inv_id, measure=m_id, base=round(base, 4), realized=round(realized, 4)
                )
            )
            if realized > 0:
                channel = content.investments[inv_id].channel
                member_facing_total += realized / max(payer.measures[m_id].headroom, 1e-6)
                dual_weighted += (
                    realized / max(payer.measures[m_id].headroom, 1e-6) * cfg.dual_responsiveness[channel]
                )
        effects[m_id] = min(total, payer.measures[m_id].headroom)

    # 4. Side effects (unintended consequences) — logged once as incidents.
    for ini in state.initiatives:
        if not contributes_at(ini, t):
            continue
        inv = content.investments[ini.investment_id]
        for se in inv.side_effects:
            if holds(se.when, ctx):
                effects[se.measure] += se.delta * sign(content, se.measure)
                if not any(
                    i.investment_id == inv.id and i.measure == se.measure and i.description == se.label
                    for i in state.incidents
                ):
                    state.incidents.append(
                        Incident(
                            quarter=t,
                            investment_id=inv.id,
                            measure=se.measure,
                            description=se.label,
                            member_harm=se.member_harm,
                        )
                    )

    # 5. Baseline drift (e.g. an abandonment slide nobody fixes).
    for drift in payer.drifts:
        if not holds(drift.unless, ctx):
            state.drift_accum[drift.measure] = (
                state.drift_accum.get(drift.measure, 0.0) + drift.delta_per_year / QUARTERS_PER_YEAR
            )
    for m_id, raw in state.drift_accum.items():
        effects[m_id] += raw * sign(content, m_id)

    measures = {
        m: round(payer.measures[m].value + sign(content, m) * effects[m], 3) for m in content.measures
    }

    # 6. Economics this quarter.
    opex = 0.0
    savings = 0.0
    for ini in state.initiatives:
        inv = content.investments[ini.investment_id]
        if ini.live_quarter is None or ini.status is InitiativeStatus.CANCELLED:
            continue
        share = cfg.paused_opex_share if ini.status is InitiativeStatus.PAUSED else 1.0
        opex += inv.opex_musd_per_year * share / QUARTERS_PER_YEAR
        if contributes_at(ini, t):
            r = min(1.0, realization(content, state, ini, ctx, quarter=t, for_kpis=True).total)
            savings += inv.savings_musd_per_year.get(payer.id, 0.0) * r / QUARTERS_PER_YEAR

    snapshot = QuarterSnapshot(
        quarter=t + 1,
        year=t // QUARTERS_PER_YEAR + 1,
        quarter_of_year=t % QUARTERS_PER_YEAR + 1,
        effects={k: round(v, 4) for k, v in effects.items()},
        measures=measures,
        kpis=kpis,
        realization=realized_share,
        contributions=contributions,
        progress={i.investment_id: round(i.progress, 3) for i in state.initiatives},
        capacity_demand=round(demand, 2),
        capacity_supply=payer.capacity_per_quarter,
        capacity_utilization=round(utilization, 3),
        capacity_multiplier=round(capacity_mult, 3),
        adoption={k: round(v, 3) for k, v in adoption.items()},
        opex_musd=round(opex, 4),
        savings_musd=round(savings, 4),
        capital_spent_musd=round(spent, 4),
        dual_ratio=round(dual_weighted / member_facing_total, 3) if member_facing_total else 1.0,
    )
    state.history.append(snapshot)
    state.quarter += 1
    return snapshot


def run_year(state: TeamState, content: ContentBundle) -> list[QuarterSnapshot]:
    if state.quarter % QUARTERS_PER_YEAR != 0:
        raise SimulationError("a year can only be run from a year boundary")
    if state.quarter >= YEARS * QUARTERS_PER_YEAR:
        raise SimulationError("both simulated years have already been run")
    return [step_quarter(state, content) for _ in range(QUARTERS_PER_YEAR)]


def capacity_plan(state: TeamState, content: ContentBundle, quarters: int = QUARTERS_PER_YEAR) -> list[float]:
    """Projected capacity utilization for the next ``quarters`` (no effects, no spending)."""
    trial = state.model_copy(deep=True)
    payer = content.payers[trial.payer_id]
    out = []
    for q in range(trial.quarter, trial.quarter + quarters):
        _demand, utilization, mult = _capacity(trial, content, payer, q)
        out.append(round(utilization, 3))
        for ini in trial.initiatives:
            if (
                ini.status is InitiativeStatus.ACTIVE
                and build_start(ini, content, payer.id) <= q
                and ini.progress < 1.0
            ):
                ini.progress = min(
                    1.0, ini.progress + mult / content.investments[ini.investment_id].duration_quarters
                )
    return out
