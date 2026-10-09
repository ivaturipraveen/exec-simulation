"""Regression suite (pack section 5): directional outcomes of the reference portfolios."""

import pytest

from sim.content import ContentBundle
from sim.engine import build_scorecard, rank_crises, year_report
from sim.portfolios import regression_suite, run_portfolio
from tests.sim.conftest import play


def _projected(content: ContentBundle, pid: str) -> float:
    return year_report(play(content, pid), content, 2).stars.projected


@pytest.mark.parametrize(
    ("portfolio", "stars"),
    [
        ("hz-foundation-light", 3.5),
        ("hz-provider-first", 3.5),
        ("hz-failure", 3.0),
        ("lg-sequenced", 3.5),
        ("lg-operational", 3.5),
        ("lg-failure", 3.0),
        ("cc-capacity-first", 4.0),
        ("cc-failure", 3.5),
        ("cc-outreach", 3.0),
    ],
)
def test_reference_projected_rating(content: ContentBundle, portfolio: str, stars: float) -> None:
    assert _projected(content, portfolio) == stars


@pytest.mark.parametrize(
    ("portfolio", "event", "severity"),
    [
        ("hz-foundation-light", "e1", "low"),
        ("hz-provider-first", "e1", "medium"),
        ("hz-failure", "e1", "high"),
        ("lg-sequenced", "e2", "low"),
        ("lg-failure", "e2", "high"),
        ("cc-failure", "e3", "high"),
    ],
)
def test_crisis_triggers_match_pack(
    content: ContentBundle, portfolio: str, event: str, severity: str
) -> None:
    top = rank_crises(play(content, portfolio), content)[0]
    assert (top.event_id, top.severity.value) == (event, severity)


def test_clean_portfolios_trigger_no_crisis(content: ContentBundle) -> None:
    assert rank_crises(play(content, "lg-operational"), content) == []
    assert rank_crises(play(content, "cc-capacity-first"), content) == []


def test_capacity_overruns_match_pack(content: ContentBundle) -> None:
    assert year_report(play(content, "hz-failure"), content, 1).capacity_peak == pytest.approx(1.3)
    assert year_report(play(content, "lg-failure"), content, 1).capacity_peak == pytest.approx(1.625)


def test_viable_beat_failure_for_every_payer(content: ContentBundle) -> None:
    suite = regression_suite(content)
    for payer in content.payers:
        scores = {p.kind: [] for p in suite if p.payer_id == payer}
        for p in suite:
            if p.payer_id == payer:
                scores[p.kind].append(build_scorecard(run_portfolio(content, p).state, content).total)
        assert min(scores["viable"]) > max(scores["failure"]), payer
        assert min(scores["viable"]) > max(scores["baseline"]), payer


def test_no_single_card_dominates(content: ContentBundle) -> None:
    """The best single-card portfolio never beats the payer's viable strategies."""
    from sim.content.models import ReferencePortfolio

    for payer in content.payers:
        viable = [p for p in content.portfolios if p.payer_id == payer and p.kind == "viable"]
        best_viable = max(build_scorecard(run_portfolio(content, p).state, content).total for p in viable)
        for inv in content.investments:
            single = ReferencePortfolio(
                id=f"{payer}-{inv}", payer_id=payer, name=inv, kind="stress", round1=[inv]
            )
            assert build_scorecard(run_portfolio(content, single).state, content).total < best_viable, (
                payer,
                inv,
            )
