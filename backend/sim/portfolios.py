"""Reference portfolios (pack section 5.2 plus the section-5 regression suite).

The named portfolios live in content/reference.yaml. ``regression_suite`` adds the generic
portfolios the pack asks for per payer: do-nothing, all-foundation, all-AI, all-operations,
max-capacity overrun and a balanced portfolio.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from sim.content import ContentBundle
from sim.content.models import ReferencePortfolio
from sim.engine import (
    SimulationError,
    TeamState,
    build_scorecard,
    fund,
    new_team_state,
    run_year,
    year_report,
)

OWNER = "Named executive"

GENERIC: dict[str, tuple[str, list[str]]] = {
    "do-nothing": ("baseline", []),
    "all-foundation": ("stress", ["i1", "i2", "i13", "i10", "i12"]),
    "all-ai": ("stress", ["i3", "i4", "i5", "i6", "i7", "i8", "i9"]),
    "all-operations": ("stress", ["i14", "i15", "i16", "i17", "i13", "i11"]),
    "max-overrun": ("stress", ["i2", "i1", "i8", "i6", "i5"]),
    "balanced": ("viable", ["i10", "i12", "i17", "i14", "i11", "i15"]),
}


@dataclass
class PortfolioRun:
    portfolio: ReferencePortfolio
    state: TeamState
    funded: list[str] = field(default_factory=list)
    dropped: list[str] = field(default_factory=list)


def regression_suite(content: ContentBundle) -> list[ReferencePortfolio]:
    named = list(content.portfolios)
    for payer_id in content.payers:
        for key, (kind, cards) in GENERIC.items():
            named.append(
                ReferencePortfolio(
                    id=f"{payer_id}-{key}",
                    payer_id=payer_id,
                    name=key.replace("-", " ").capitalize(),
                    kind=kind,
                    round1=cards,
                )
            )
    return named


def run_portfolio(content: ContentBundle, pf: ReferencePortfolio, seed: int = 42) -> PortfolioRun:
    """Fund Round 1 in order (dropping what the ledger blocks), run both years."""
    state = new_team_state(content, pf.payer_id, seed)
    run = PortfolioRun(pf, state)

    def buy(cards: list[str], round_no: int) -> None:
        for inv_id in cards:
            try:
                fund(state, content, inv_id, round_no, scope=pf.scopes.get(inv_id), owner=OWNER)
                run.funded.append(inv_id)
            except SimulationError:
                run.dropped.append(inv_id)

    buy(pf.round1, 1)
    run_year(state, content)
    state.capital_round2_musd = content.config.round2_base_musd
    buy(pf.round2, 2)
    run_year(state, content)
    return run


__all__ = ["GENERIC", "PortfolioRun", "build_scorecard", "regression_suite", "run_portfolio", "year_report"]
