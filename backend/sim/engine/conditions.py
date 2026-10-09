"""Evaluate content ``Condition`` objects against a team's state."""

from __future__ import annotations

from dataclasses import dataclass

from sim.content import ContentBundle
from sim.content.models import Condition
from sim.engine.state import QUARTERS_PER_YEAR, Initiative, InitiativeStatus, TeamState


@dataclass(frozen=True)
class Context:
    payer_id: str
    payer_flags: frozenset[str]
    live: frozenset[str]
    funded: frozenset[str]
    funded_round1: frozenset[str]
    full_scope: frozenset[str]
    partial_scope: frozenset[str]
    live_by_year1: frozenset[str]
    kpis: dict[str, float]
    opmodel_missing_human_review: bool
    pitch_unsupported_figure: bool


def context(state: TeamState, content: ContentBundle, quarter: int | None = None) -> Context:
    """Snapshot of what conditions can see at ``quarter`` (default: now)."""
    q = state.quarter if quarter is None else quarter
    payer = content.payers[state.payer_id]
    # A card that needs a named owner and is worthless without one (I10) is ceremonial: it does
    # not count as funded or live for any rule until the team names the owner.
    funded = [i for i in state.initiatives if i.in_portfolio and not is_ceremonial(i, content)]
    kpis = dict(state.history[q - 1].kpis) if 0 < q <= len(state.history) else dict(payer.kpis)
    return Context(
        payer_id=payer.id,
        payer_flags=frozenset(payer.flags),
        live=frozenset(i.investment_id for i in funded if i.is_live_at(q)),
        funded=frozenset(i.investment_id for i in funded),
        funded_round1=frozenset(i.investment_id for i in funded if i.funded_round == 1),
        full_scope=frozenset(i.investment_id for i in funded if i.scope_factor >= 1.0),
        partial_scope=frozenset(i.investment_id for i in funded if i.scope_factor < 1.0),
        live_by_year1=frozenset(
            i.investment_id
            for i in state.initiatives
            if i.live_quarter is not None
            and i.live_quarter < QUARTERS_PER_YEAR
            and i.status is not InitiativeStatus.CANCELLED
        ),
        kpis=kpis,
        opmodel_missing_human_review=bool(state.opmodel_missing_human_review),
        pitch_unsupported_figure=state.pitch_unsupported_figure,
    )


def is_ceremonial(ini: Initiative, content: ContentBundle) -> bool:
    inv = content.investments[ini.investment_id]
    return inv.owner_required and inv.owner_missing_multiplier == 0 and not ini.owner.strip()


def holds(cond: Condition, ctx: Context) -> bool:
    if cond.any_live and not ctx.live.intersection(cond.any_live):
        return False
    if cond.all_live and not ctx.live.issuperset(cond.all_live):
        return False
    if cond.none_live and ctx.live.intersection(cond.none_live):
        return False
    if cond.not_all_live and ctx.live.issuperset(cond.not_all_live):
        return False
    if cond.any_funded and not ctx.funded.intersection(cond.any_funded):
        return False
    if cond.all_funded and not ctx.funded.issuperset(cond.all_funded):
        return False
    if cond.none_funded and ctx.funded.intersection(cond.none_funded):
        return False
    if cond.funded_full_scope and not ctx.full_scope.intersection(cond.funded_full_scope):
        return False
    if cond.funded_partial_scope and not ctx.partial_scope.intersection(cond.funded_partial_scope):
        return False
    if cond.funded_round1 and not ctx.funded_round1.intersection(cond.funded_round1):
        return False
    if cond.not_live_by_year1 and ctx.live_by_year1.issuperset(cond.not_live_by_year1):
        return False
    if any(ctx.kpis.get(k, 0.0) >= v for k, v in cond.kpi_below.items()):
        return False
    if any(ctx.kpis.get(k, 0.0) < v for k, v in cond.kpi_at_least.items()):
        return False
    if cond.payers and ctx.payer_id not in cond.payers:
        return False
    if cond.not_payers and ctx.payer_id in cond.not_payers:
        return False
    if cond.payer_flags and not ctx.payer_flags.issuperset(cond.payer_flags):
        return False
    if cond.not_payer_flags and ctx.payer_flags.intersection(cond.not_payer_flags):
        return False
    if cond.opmodel_missing_human_review and not ctx.opmodel_missing_human_review:
        return False
    return not (cond.pitch_unsupported_figure and not ctx.pitch_unsupported_figure)
