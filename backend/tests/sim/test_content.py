"""Content Pack v0.1 is loaded faithfully and validated."""

from dataclasses import replace

from sim.content import ContentBundle, content_warnings
from sim.content.models import StageKind
from sim.engine.stars import measure_stars, overall_stars


def test_pack_shape(content: ContentBundle) -> None:
    assert [m.code for m in content.measures.values()] == [
        "M1",
        "M2",
        "M3",
        "M4",
        "M5",
        "M7",
        "M9",
        "M10",
        "M11",
        "M12",
    ]
    assert [i.code for i in content.investments.values()] == [f"I{n}" for n in range(1, 19)]
    assert [e.code for e in content.events.values()] == [f"E{n}" for n in range(1, 8)]
    assert len(content.workflow_steps) == 9 and len(content.decision_dimensions) == 6
    assert {p: len(r.artifacts) for p, r in content.datarooms.items()} == {
        "horizon": 30,
        "heritage": 30,
        "communitycare": 30,
    }
    assert len(content.assumptions) >= 18 and len(content.simplifications) == 10
    assert (
        len(content.rubrics.crisis) == 6
        and len(content.rubrics.pitch) == 5
        and len(content.rubrics.opmodel) == 4
    )


def test_run_of_show_is_180_plus_25(content: ContentBundle) -> None:
    assert content.total_minutes == 180
    assert content.stages[-1].kind is StageKind.TRANSLATE and content.stages[-1].duration_minutes == 25
    assert sum(s.lecture_minutes for s in content.stages) == 24
    assert content.stages[0].start == "0:00" and content.stages[-1].start == "3:00"


def test_payers_match_bibles(content: ContentBundle) -> None:
    hz, lg, cc = (content.payers[p] for p in ("horizon", "heritage", "communitycare"))
    assert (hz.members, hz.capital_round1_musd, hz.capacity_per_quarter) == (52400, 18.0, 10)
    assert (lg.members, lg.capital_round1_musd, lg.capacity_per_quarter) == (431000, 15.0, 8)
    assert (cc.members, cc.capital_round1_musd, cc.capacity_per_quarter) == (94800, 12.0, 6)
    for p in (hz, lg, cc):
        base = {m: b.value for m, b in p.measures.items()}
        assert overall_stars(content.measures, base, p.rating_adjustment) == p.starting_stars
        assert len(p.hidden_root_causes) == 3 and len(p.misleading_signals) == 2


def test_starting_measure_stars_match_pack(content: ContentBundle) -> None:
    expected = {
        "horizon": {
            "m1": 3,
            "m2": 3,
            "m3": 2,
            "m4": 3,
            "m5": 2,
            "m7": 4,
            "m9": 4,
            "m10": 3,
            "m11": 2,
            "m12": 3,
        },
        "heritage": {
            "m1": 4,
            "m2": 4,
            "m3": 3,
            "m4": 3,
            "m5": 4,
            "m7": 2,
            "m9": 3,
            "m10": 3,
            "m11": 3,
            "m12": 2,
        },
        "communitycare": {
            "m1": 3,
            "m2": 3,
            "m3": 4,
            "m4": 4,
            "m5": 4,
            "m7": 3,
            "m9": 2,
            "m10": 4,
            "m11": 4,
            "m12": 3,
        },
    }
    for pid, stars in expected.items():
        p = content.payers[pid]
        got = {m: measure_stars(content.measures[m], b.value) for m, b in p.measures.items()}
        assert got == stars, pid


def test_lower_is_better_thresholds_follow_pack_wording(content: ContentBundle) -> None:
    m7, m11 = content.measures["m7"], content.measures["m11"]
    assert measure_stars(m7, 7.4) == 5 and measure_stars(m7, 7.5) == 4 and measure_stars(m7, 11.5) == 2
    assert measure_stars(m11, 0.09) == 5 and measure_stars(m11, 0.25) == 3 and measure_stars(m11, 0.50) == 2
    assert measure_stars(m11, 0.85) == 1


def test_design_warnings_are_reported_not_fatal(content: ContentBundle) -> None:
    assert content_warnings(content) == []  # R-03 resolved by tagging L-25 to L-RC2
    # Undo that tag on a copy: the rule is reported as a warning, never raised.
    room = content.datarooms["heritage"]
    reverted = [a.model_copy(update={"supports": "neutral"}) if a.id == "L-25" else a for a in room.artifacts]
    broken = replace(
        content, datarooms={**content.datarooms, "heritage": room.model_copy(update={"artifacts": reverted})}
    )
    warnings = content_warnings(broken)
    assert any("L-RC2" in w for w in warnings)
