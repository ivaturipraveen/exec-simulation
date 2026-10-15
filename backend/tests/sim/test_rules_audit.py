"""Randomized rules audit: random two-year portfolios checked against REQUIREMENTS §1.6 by independent
recomputation — capacity, go-live, leading KPIs, lag shares, Stars, the ±20% band, the ledger, and year
reviews that never change once the year is over."""

import contextlib
import math
import random
from statistics import mean

import pytest

from sim.content import ContentBundle
from sim.engine import model as M
from sim.engine.reports import year_report
from sim.engine.state import InitiativeStatus

SEEDS = range(40)


def _stars(measure, rate: float) -> int:
    stars = 1
    for i, cut in enumerate(measure.cut_points):
        if (rate >= cut - 1e-9) if measure.higher_is_better else (rate < cut - 1e-9):
            stars = i + 2
    return stars


def _overall(c: ContentBundle, rates: dict[str, float], adj: float) -> float:
    w = sum(m.weight for m in c.measures.values())
    score = sum(m.weight * _stars(m, rates[m.id]) for m in c.measures.values()) / w + adj
    return int(score * 2 + 0.5 + 1e-9) / 2


def _buy(c: ContentBundle, st, rng: random.Random, round_no: int) -> None:
    ids = list(c.investments)
    rng.shuffle(ids)
    for iid in ids[: rng.randint(1, 7)]:
        inv = c.investments[iid]
        scope = rng.choice([s.id for s in inv.scopes]) if inv.scopes and rng.random() < 0.5 else None
        owner = "" if rng.random() < 0.2 else "Named executive"
        with contextlib.suppress(M.SimulationError):  # unaffordable or already held
            M.fund(st, c, iid, round_no, scope=scope, start_offset=rng.choice([0, 0, 0, 1, 2]), owner=owner)


def _play(c: ContentBundle, pid: str, seed: int):
    rng = random.Random(f"{pid}-{seed}")
    st = M.new_team_state(c, pid, seed, variable=seed % 3 == 0)
    _buy(c, st, rng, 1)
    M.run_year(st, c)
    year1 = year_report(st, c, 1)
    st.capital_round2_musd = 8.0 + rng.choice([0, 2, 4])
    held = [i for i in st.initiatives if i.in_portfolio]
    if held and rng.random() < 0.3:
        M.cancel(st, c, rng.choice(held).investment_id)
    _buy(c, st, rng, 2)
    M.run_year(st, c)
    return st, year1


def _check(c: ContentBundle, pid: str, seed: int) -> list[str]:
    payer, cfg = c.payers[pid], c.config
    st, year1_at_year_end = _play(c, pid, seed)
    errors: list[str] = []
    where = f"{pid}/{seed}"

    ledger = M.ledger(st, c)
    if ledger.available < -1e-6 or ledger.spent > ledger.committed + 1e-6:
        errors.append(f"{where} ledger {ledger}")

    for h in st.history:
        want = 1.0 if h.capacity_demand == 0 else min(1.0, h.capacity_supply / h.capacity_demand)
        if h.capacity_utilization > cfg.capacity_overrun_cap:
            want = min(want, cfg.capacity_overrun_speed)
        if abs(h.capacity_multiplier - round(want, 3)) > 1e-3:
            errors.append(f"{where} Q{h.quarter} capacity multiplier {h.capacity_multiplier} != {want}")

    for ini in st.initiatives:
        inv = c.investments[ini.investment_id]
        earliest = M.build_start(ini, c, pid) + math.ceil(inv.duration_quarters - 1e-9) - 1
        if ini.live_quarter is not None and ini.live_quarter < earliest:
            errors.append(f"{where} {inv.id} live at {ini.live_quarter}, earliest {earliest}")

    # Leading KPIs move only once a card that targets them has gone live (the quarter after go-live).
    for h in st.history:
        t = h.quarter - 1
        allowed = set()
        for ini in st.initiatives:
            ran = ini.live_quarter is not None and ini.live_quarter < t
            if M.contributes_at(ini, t) or (ini.status is InitiativeStatus.CANCELLED and ran):
                for ke in c.investments[ini.investment_id].kpi_effects:
                    if not ((ke.payers and pid not in ke.payers) or pid in ke.not_payers):
                        allowed.add(ke.kpi)
        for k, v in h.kpis.items():
            if k != "copilot_adoption" and abs(v - payer.kpis[k]) > 1e-9 and k not in allowed:
                errors.append(f"{where} Q{h.quarter} {k} moved with no live card")
            if c.kpis[k].unit == "%" and not 0 <= v <= 100:
                errors.append(f"{where} {k} = {v} outside 0-100")

    # Measures: rating year = lag share × this year + the rest of last year; projected = full effect.
    for y in (1, 2):
        rep = year_report(st, c, y)
        this = [s for s in st.history if s.year == y]
        prev = [s for s in st.history if s.year == y - 1]
        shown, proj = {}, {}
        for mr in rep.measures:
            m = c.measures[mr.id]
            effect = m.lag_share * mean(s.effects[m.id] for s in this) + (1 - m.lag_share) * (
                mean(s.effects[m.id] for s in prev) if prev else 0.0
            )
            want = payer.measures[m.id].value + M.sign(c, m.id) * effect
            if abs(mr.year_value - want) > 0.011:
                errors.append(f"{where} Y{y} {mr.code} rating-year {mr.year_value} != {want:.3f}")
            if mr.year_stars != _stars(m, mr.year_value):
                errors.append(f"{where} Y{y} {mr.code} shows {mr.year_value} with {mr.year_stars} stars")
            shown[m.id], proj[m.id] = mr.year_value, mr.projected
        adj = payer.rating_adjustment
        if rep.stars.year_rating != _overall(c, shown, adj) or rep.stars.projected != _overall(c, proj, adj):
            errors.append(f"{where} Y{y} overall Stars do not follow the measures shown")
        if not rep.stars.projected_low <= rep.stars.projected <= rep.stars.projected_high:
            errors.append(f"{where} Y{y} band {rep.stars.projected_low}-{rep.stars.projected_high}")

    # A year's review is fixed once the year is over (Round 2 grants, pauses and cancellations come later).
    before = year1_at_year_end.model_dump(exclude={"clues"})
    after = year_report(st, c, 1).model_dump(exclude={"clues"})
    if before != after:
        errors.append(
            f"{where} Year 1 review changed after Year 2: {[k for k in before if before[k] != after[k]]}"
        )
    return errors


@pytest.mark.parametrize("pid", ["communitycare", "heritage", "horizon"])
def test_random_portfolios_follow_the_rules(content: ContentBundle, pid: str) -> None:
    errors = [e for seed in SEEDS for e in _check(content, pid, seed)]
    assert not errors, errors[:5]
