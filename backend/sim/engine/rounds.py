"""Round-2 capital (OD-02) and the board pitch (pack section 10.2).

Hybrid (default): $8.0M base plus capital earned on the 15-point pitch rubric
(13–15 → +$4.0M, 10–12 → +$2.0M, 7–9 → +$1.0M, ≤6 → $0). Fixed: base only.
Differentiated: by Year-1 scorecard rank (playtest option).
"""

from __future__ import annotations

import re

from pydantic import BaseModel, Field

from sim.content import ContentBundle
from sim.content.models import Round2Mechanic
from sim.engine.rubric import CARD_CODE, RubricScore, build_score, depth, mentions, words


class PitchSubmission(BaseModel):
    evidence: list[str] = Field(default=[], max_length=12, description="Data-room artifact ids cited")
    results: str = Field(default="", max_length=1500, description="What Round 1 produced")
    causal: str = Field(default="", max_length=1500, description="Why results differed from the thesis")
    decision: str = Field(
        default="", max_length=1500, description="What to scale, modify, pause or cancel, and why"
    )
    risk: str = Field(default="", max_length=1000, description="A risk the portfolio creates and its control")
    ask: str = Field(default="", max_length=600, description="The one-sentence ask")

    @property
    def text(self) -> str:
        return "\n".join((self.results, self.causal, self.decision, self.risk, self.ask))


def earned_capital(content: ContentBundle, pitch_total: int) -> float:
    for tier in content.rubrics.pitch_capital:
        if pitch_total >= tier.min_score:
            return tier.earned_musd
    return 0.0


def round2_capital(
    content: ContentBundle,
    mechanic: Round2Mechanic,
    *,
    base: float | None = None,
    pitch_total: int | None = None,
    rank: int | None = None,
    teams: int = 3,
) -> float:
    cfg = content.config
    base = cfg.round2_base_musd if base is None else base
    if mechanic is Round2Mechanic.FIXED:
        return base
    if mechanic is Round2Mechanic.DIFFERENTIATED:
        if rank is None:
            raise ValueError("differentiated mechanic requires the team's Year-1 rank")
        low, mid, high = cfg.round2_differentiated_musd
        ladder = [high, mid, low] if teams >= 3 else [high, low][:teams]
        return ladder[min(rank, len(ladder) - 1)]
    if pitch_total is None:
        raise ValueError("hybrid mechanic requires a pitch score")
    return round(base + earned_capital(content, pitch_total), 2)


# --------------------------------------------------------------------------- figure check (E6)

_FIGURE = re.compile(
    r"\$\s?(?P<money>\d+(?:[.,]\d+)?)\s?(?P<unit>m|mm|million|k|thousand|b|bn|billion)?\b|(?P<pct>\d+(?:\.\d+)?)\s?%",
    re.I,
)
_CORPUS_MONEY = re.compile(r"\$\s?(\d+(?:[.,]\d+)?)\s?(m|mm|million|k|thousand|b|bn|billion)?\b", re.I)
_CORPUS_PCT = re.compile(r"(\d+(?:\.\d+)?)\s?%")
_SCALE = {
    "": 1.0,
    "m": 1.0,
    "mm": 1.0,
    "million": 1.0,
    "k": 0.001,
    "thousand": 0.001,
    "b": 1000.0,
    "bn": 1000.0,
    "billion": 1000.0,
}


def _musd(number: str, unit: str | None) -> float:
    """Dollar amount in $M. A bare '$14' is read as $14M (board-pack convention)."""
    value = float(number.replace(",", ""))
    unit = (unit or "").lower()
    if not unit and value >= 10_000:  # e.g. $140,000
        return value / 1e6
    return value * _SCALE[unit]


def unsupported_figures(text: str, corpus: str) -> list[str]:
    """Dollar figures and percentages in the pitch that appear nowhere in the team's evidence.

    ``corpus`` is the team's data room, card catalog and results text. Dollar figures must match
    a dollar figure in the corpus (to 0.05M); percentages must match a percentage. Bare numbers
    never count as support, so "$14M" is not "supported" by "14 source systems".
    """
    money = {round(_musd(n, u), 2) for n, u in _CORPUS_MONEY.findall(corpus)}
    pcts = {round(float(n), 1) for n in _CORPUS_PCT.findall(corpus)}
    missing: list[str] = []
    for m in _FIGURE.finditer(text):
        raw = m.group(0).strip()
        if m.group("money"):
            value = round(_musd(m.group("money"), m.group("unit")), 2)
            if not any(abs(value - x) <= 0.05 for x in money):
                missing.append(raw)
        elif m.group("pct"):
            if round(float(m.group("pct")), 1) not in pcts:
                missing.append(raw)
    return list(dict.fromkeys(missing))


def suggest_pitch(
    content: ContentBundle, pitch: PitchSubmission, valid_artifacts: set[str]
) -> tuple[dict[str, int], dict[str, str]]:
    cited = [a for a in pitch.evidence if a in valid_artifacts]
    has_results = words(pitch.results) >= 8
    s: dict[str, int] = {}
    why: dict[str, str] = {}

    if len(cited) >= 3 and has_results:
        s["evidence"] = 3
    elif len(cited) >= 2 and has_results:
        s["evidence"] = 2
    else:
        s["evidence"] = 1 if (cited or has_results) else 0
    why["evidence"] = (
        f"{len(cited)} valid artifact(s) cited; Round 1 results {'referenced' if has_results else 'missing'}"
    )

    causal = depth(pitch.causal)
    if causal >= 2 and not mentions(
        pitch.causal, "because", "due to", "driven by", "caused", "so ", "which meant", "root cause"
    ):
        causal = min(causal, 1)
    s["causal"] = min(3, causal)
    why["causal"] = (
        "Explains the causal chain" if causal >= 2 else "Restates results without the causal chain"
    )

    acts = mentions(
        pitch.decision,
        "scale",
        "pause",
        "cancel",
        "stop",
        "fund",
        "add",
        "modify",
        "descope",
        "expand",
        "cut",
    )
    specific = bool(CARD_CODE.search(pitch.decision)) or any(
        inv.name.lower()[:18] in pitch.decision.lower() for inv in content.investments.values()
    )
    reason = mentions(pitch.decision, "because", "so that", "to ", "since", "given")
    s["decision"] = (
        3 if acts and specific and reason else 2 if acts and specific else 1 if words(pitch.decision) else 0
    )
    why["decision"] = (
        "Specific action with a reason" if s["decision"] == 3 else "Name the card and the reason"
    )

    control = mentions(
        pitch.risk, "control", "monitor", "govern", "validat", "review", "kill", "pause", "owner", "audit"
    )
    s["risk"] = (
        3
        if words(pitch.risk) >= 8 and control
        else 2
        if words(pitch.risk) >= 8
        else 1
        if words(pitch.risk)
        else 0
    )
    why["risk"] = "Risk named with a control" if s["risk"] == 3 else "Pair the risk with a control"

    total_words = words(pitch.text)
    limit = content.config.pitch_word_limit
    ask_ok = 3 <= words(pitch.ask) <= 45
    if not total_words:
        s["clarity"] = 0
    elif total_words <= limit and ask_ok:
        s["clarity"] = 3
    elif total_words <= limit * 1.3:
        s["clarity"] = 2
    else:
        s["clarity"] = 1
    why["clarity"] = (
        f"{total_words} words (≈{round(total_words / 2.5)} seconds); ask {'clear' if ask_ok else 'missing or long'}"
    )
    return s, why


def score_pitch(
    content: ContentBundle,
    pitch: PitchSubmission,
    valid_artifacts: set[str],
    *,
    override: dict[str, int] | None = None,
    note: str = "",
    ai_suggestion: tuple[dict[str, int], dict[str, str]] | None = None,
) -> RubricScore:
    suggested, why = ai_suggestion or suggest_pitch(content, pitch, valid_artifacts)
    return build_score(
        content.rubrics.pitch,
        suggested,
        why,
        override=override,
        note=note,
        source="ai" if ai_suggestion else "engine",
    )


__all__ = [
    "PitchSubmission",
    "RubricScore",
    "earned_capital",
    "round2_capital",
    "score_pitch",
    "suggest_pitch",
    "unsupported_figures",
]
