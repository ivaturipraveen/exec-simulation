"""Shared 0–3 rubric scoring: the engine suggests, the facilitator decides (OD-08)."""

from __future__ import annotations

import re

from pydantic import BaseModel, Field

from sim.content.models import RubricRow


class RubricScore(BaseModel):
    rows: dict[str, int] = Field(description="Final score per row (0..3)")
    suggested: dict[str, int] = Field(description="Engine or AI suggestion per row")
    rationale: dict[str, str] = {}
    total: int
    max: int
    overridden: bool = False
    note: str = ""
    source: str = "engine"


def build_score(
    rows: list[RubricRow],
    suggested: dict[str, int],
    rationale: dict[str, str],
    *,
    override: dict[str, int] | None = None,
    note: str = "",
    source: str = "engine",
) -> RubricScore:
    final = {
        r.id: max(0, min(3, int((override or suggested).get(r.id, suggested.get(r.id, 0))))) for r in rows
    }
    return RubricScore(
        rows=final,
        suggested={r.id: suggested.get(r.id, 0) for r in rows},
        rationale=rationale,
        total=sum(final.values()),
        max=3 * len(rows),
        overridden=override is not None,
        note=note,
        source=source,
    )


def words(text: str) -> int:
    return len(text.split())


def mentions(text: str, *terms: str) -> bool:
    low = text.lower()
    return any(t in low for t in terms)


def depth(text: str, *, enough: int = 25, rich: int = 60) -> int:
    """0 none, 1 thin, 2 adequate, 3 rich — by substance, not style."""
    n = words(text)
    if n == 0:
        return 0
    if n < enough // 3:
        return 1
    return 2 if n < rich else 3


CARD_CODE = re.compile(r"\bI(1[0-8]|[1-9])\b")
