"""Simplified Star Ratings arithmetic (simplification register: game thresholds, one rating)."""

from __future__ import annotations

from collections.abc import Mapping

from sim.content.models import Measure


def measure_stars(measure: Measure, rate: float) -> int:
    """1–5 Stars. Higher-is-better: rate >= cut. Lower-is-better: rate < cut (pack wording)."""
    stars = 1
    for i, cut in enumerate(measure.cut_points):
        meets = rate >= cut - 1e-9 if measure.higher_is_better else rate < cut - 1e-9
        if meets:
            stars = i + 2
    return stars


def summary_score(
    measures: Mapping[str, Measure], rates: Mapping[str, float], adjustment: float = 0.0
) -> float:
    """Weighted mean of measure Stars (weights 3/2/1) plus the payer's unmodelled-measure adjustment."""
    total_weight = sum(m.weight for m in measures.values())
    weighted = sum(m.weight * measure_stars(m, rates[m.id]) for m in measures.values())
    return weighted / total_weight + adjustment


def round_to_half(score: float) -> float:
    # CMS rounds the summary to the nearest half star; ties round up.
    return int(score * 2 + 0.5 + 1e-9) / 2


def overall_stars(
    measures: Mapping[str, Measure], rates: Mapping[str, float], adjustment: float = 0.0
) -> float:
    return round_to_half(summary_score(measures, rates, adjustment))


def improvement(measure: Measure, baseline: float, current: float) -> float:
    """Signed improvement in measure units, positive = better."""
    return current - baseline if measure.higher_is_better else baseline - current


def next_star_gap(measure: Measure, rate: float) -> float | None:
    """Distance (improvement units) to the next star, or None at 5 Stars."""
    stars = measure_stars(measure, rate)
    if stars >= 5:
        return None
    cut = measure.cut_points[stars - 1]
    return round(cut - rate if measure.higher_is_better else rate - cut + 1e-6, 3)
