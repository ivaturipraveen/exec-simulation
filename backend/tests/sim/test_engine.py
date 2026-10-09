"""Section 5 rules: capacity, go-live lag, multipliers, adoption, owners, diminishing returns."""

import pytest

from sim.content import ContentBundle
from sim.engine import (
    SimulationError,
    build_scorecard,
    cancel,
    capacity_plan,
    fund,
    ledger,
    new_team_state,
    run_year,
    step_quarter,
    year_report,
)
from sim.engine.conditions import context
from tests.sim.conftest import play

OWNER = "Named executive"


def test_ledger_blocks_overspend_and_prices_scopes_and_per_year_cards(content: ContentBundle) -> None:
    s = new_team_state(content, "communitycare", 1)
    fund(s, content, "i2", 1)  # 6.0
    fund(s, content, "i14", 1)  # 1.2 per year x 2
    assert ledger(s, content).committed == pytest.approx(8.4)
    with pytest.raises(SimulationError):
        fund(s, content, "i8", 1)  # 4.0 > 3.6 available
    h = new_team_state(content, "heritage", 1)
    assert fund(h, content, "i1", 1, scope="scoped", owner=OWNER).capital_committed == 2.5
    with pytest.raises(SimulationError):
        fund(h, content, "i3", 1, scope="scoped")


def test_capacity_overrun_slows_progress_at_half_speed(content: ContentBundle) -> None:
    s = new_team_state(content, "heritage", 1)
    for inv in ("i1", "i2", "i8"):
        fund(s, content, inv, 1, owner=OWNER)
    assert capacity_plan(s, content)[0] == pytest.approx(13 / 8, abs=0.01)
    snap = step_quarter(s, content)
    assert snap.capacity_multiplier == 0.5
    assert s.initiative("i1").progress == pytest.approx(0.5 / 3, abs=1e-3)


def test_effects_start_the_quarter_after_go_live(content: ContentBundle) -> None:
    s = new_team_state(content, "heritage", 1)
    fund(s, content, "i17", 1)  # 2 quarters
    q1 = step_quarter(s, content)
    q2 = step_quarter(s, content)
    q3 = step_quarter(s, content)
    assert s.initiative("i17").live_quarter == 1
    i17 = [
        [c.realized for c in q.contributions if c.investment_id == "i17" and c.measure == "m10"]
        for q in (q1, q2, q3)
    ]
    assert i17[0] == i17[1] == []
    assert i17[2] == [pytest.approx(1.5)]
    assert q3.kpis["abandonment"] == pytest.approx(7.0)


def test_staggered_start(content: ContentBundle) -> None:
    s = new_team_state(content, "horizon", 1)
    ini = fund(s, content, "i17", 1, start_offset=2)
    step_quarter(s, content)
    step_quarter(s, content)
    assert ini.progress == 0
    step_quarter(s, content)
    assert ini.progress == 0.5


def test_dependency_multipliers_i14_and_i1_on_i3(content: ContentBundle) -> None:
    def m1_effect(cards: list[str]) -> float:
        s = new_team_state(content, "heritage", 1)
        for c in cards:
            fund(s, content, c, 1, owner=OWNER)
        run_year(s, content)
        return next(
            c.realized for c in s.history[-1].contributions if c.investment_id == "i3" and c.measure == "m1"
        )

    alone = m1_effect(["i3"])  # no capacity: x0.2, identity penalty x0.6
    with_capacity = m1_effect(["i3", "i14"])
    drift = 1 - 0.25 * 0.25  # one quarter of model drift since go-live (no I12)
    assert alone == pytest.approx(2.5 * 0.6 * 0.2 * 0.6 * drift, abs=1e-3)
    assert with_capacity > alone * 5


def test_adoption_scales_copilots_and_i11_raises_it(content: ContentBundle) -> None:
    def adoption(cards: list[str]) -> float:
        s = new_team_state(content, "communitycare", 1)
        for c in cards:
            fund(s, content, c, 1)
        run_year(s, content)
        run_year(s, content)
        return s.history[-1].adoption["i6"]

    decay = 0.10 * 1.25  # I11 live since Y1 Q2; 1.25 years later, no reinforcement
    assert adoption(["i6"]) == pytest.approx(0.15)
    assert adoption(["i6", "i11"]) == pytest.approx(0.60 - decay)
    assert adoption(["i6", "i11", "i15"]) == pytest.approx(0.85 - decay)
    assert adoption(["i6", "i11", "i18"]) == pytest.approx(0.70)  # I18 reinforces and adds 10 pts


def test_lead_quarters_delay_building_without_using_capacity(content: ContentBundle) -> None:
    s = new_team_state(content, "communitycare", 1)
    ini = fund(s, content, "i6", 1)  # CommunityCare system IT queue: 2 quarters before building
    q1 = step_quarter(s, content)
    step_quarter(s, content)
    assert ini.progress == 0 and q1.capacity_demand == 0
    step_quarter(s, content)
    assert ini.progress == pytest.approx(1 / 3)
    h = new_team_state(content, "heritage", 1)
    ini13 = fund(h, content, "i13", 1)  # data-sharing agreements: 1 quarter
    step_quarter(h, content)
    assert ini13.progress == 0


def test_governance_without_owner_is_ceremonial(content: ContentBundle) -> None:
    s = new_team_state(content, "horizon", 1)
    fund(s, content, "i10", 1)
    run_year(s, content)
    assert "i10" not in context(s, content).funded
    s2 = new_team_state(content, "horizon", 1)
    fund(s2, content, "i10", 1, owner=OWNER)
    run_year(s2, content)
    assert "i10" in context(s2, content).live


def test_diminishing_returns_and_headroom_cap(content: ContentBundle) -> None:
    s = new_team_state(content, "heritage", 1)
    for c in ("i14", "i3", "i8", "i1", "i10"):
        fund(s, content, c, 1, owner=OWNER)
    s.capital_round2_musd = 8
    run_year(s, content)
    run_year(s, content)
    assert s.history[-1].effects["m1"] <= content.payers["heritage"].measures["m1"].headroom + 1e-9
    realized = sorted((c.realized for c in s.history[-1].contributions if c.measure == "m2"), reverse=True)
    assert len(realized) >= 2


def test_cancel_recovers_by_reversibility_and_stops_effects(content: ContentBundle) -> None:
    s = new_team_state(content, "horizon", 1)
    fund(s, content, "i2", 1)  # not reversible
    fund(s, content, "i17", 1)  # 0.8
    step_quarter(s, content)
    assert cancel(s, content, "i2") == 0.0
    assert cancel(s, content, "i17") > 0
    assert ledger(s, content).written_off > 0


def test_side_effects_and_drift(content: ContentBundle) -> None:
    s = play(content, "cc-outreach")
    report = year_report(s, content, 2)
    assert any("appointment" in u.lower() for u in report.unintended)
    assert report.stars.projected < report.stars.baseline
    s2 = new_team_state(content, "heritage", 1)
    run_year(s2, content)
    run_year(s2, content)
    assert year_report(s2, content, 2).stars.projected == 3.0  # abandonment slide (L-MS2)


def test_year_one_shows_leading_kpis_before_measures(content: ContentBundle) -> None:
    s = play(content, "hz-foundation-light")
    y1, y2 = year_report(s, content, 1), year_report(s, content, 2)
    kpi = {k.id: k for k in y1.kpis}
    assert kpi["abandonment"].current < kpi["abandonment"].baseline
    assert y1.stars.year_rating == y1.stars.baseline
    assert y2.stars.projected > y2.stars.baseline


def test_variable_mode_draws_within_range(content: ContentBundle) -> None:
    det = play(content, "lg-operational")
    s = new_team_state(content, "heritage", 7, variable=True)
    for c in ("i4", "i17", "i9", "i13", "i14", "i10"):
        fund(s, content, c, 1, owner=OWNER)
    run_year(s, content)
    run_year(s, content)
    for m in ("m10", "m12"):
        a, b = det.history[-1].effects[m], s.history[-1].effects[m]
        assert abs(a - b) <= abs(a) * 0.25 + 1e-6


def test_scorecard_has_five_weighted_dimensions(content: ContentBundle) -> None:
    card = build_scorecard(play(content, "lg-sequenced"), content)
    assert [d.id for d in card.dimensions] == ["stars", "member", "financial", "maturity", "risk"]
    assert sum(d.weight for d in card.dimensions) == pytest.approx(1.0)
    assert 0 < card.total <= 100


def test_pitch_figure_check_requires_matching_units() -> None:
    from sim.engine import unsupported_figures

    corpus = (
        "We run 14 source systems; abandonment 14%. Crossing 4.0 Stars is worth $31M per year; budget $18.0M."
    )
    assert unsupported_figures("This agent delivers a $14M benefit.", corpus) == ["$14M"]
    assert unsupported_figures("The bonus is worth $31 million and abandonment is 14%.", corpus) == []
    assert unsupported_figures("We have $18M of capital and 22% will improve.", corpus) == ["22%"]
