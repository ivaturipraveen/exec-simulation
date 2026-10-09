"""Crisis selection and response scoring — Content Pack v0.1 section 7.

After Round 2 the engine evaluates each event's severity rules against the team's state and
recommends one event and a severity. I10 (when owned) halves probability and lowers severity one
level unless the event's rules already account for it. The facilitator confirms or overrides.
"""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, Field

from sim.content import ContentBundle
from sim.content.models import CrisisEvent, Severity
from sim.engine.conditions import context, holds
from sim.engine.rubric import RubricScore, build_score, depth, mentions, words
from sim.engine.state import TeamState

ORDER = [Severity.LOW, Severity.MEDIUM, Severity.HIGH]


class ContainmentDecision(StrEnum):
    PAUSE = "pause"
    CONTINUE_WITH_CONTROLS = "continue_with_controls"
    CONTINUE = "continue"
    SHUT_DOWN = "shut_down"


class Disclosure(StrEnum):
    IMMEDIATE = "immediate"
    AFTER_INVESTIGATION = "after_investigation"
    NONE = "none"


STAKEHOLDERS = ("members", "providers", "regulator", "board", "press", "staff")


class CrisisResponse(BaseModel):
    decision: ContainmentDecision
    restart_criteria: str = Field(default="", max_length=1500)
    owner: str = Field(default="", max_length=200)
    operational_lead: str = Field(default="", max_length=200)
    authority: str = Field(default="", max_length=1000)
    investigation: str = Field(default="", max_length=2000)
    hypotheses: str = Field(default="", max_length=1500)
    stakeholders: list[str] = Field(default=[], max_length=6)
    disclosure: Disclosure = Disclosure.AFTER_INVESTIGATION
    communication: str = Field(default="", max_length=2000)
    protection: str = Field(default="", max_length=2000)
    resources: str = Field(default="", max_length=1000)
    corrective_action: str = Field(default="", max_length=2000)
    monitoring: str = Field(default="", max_length=1000)


class CrisisCandidate(BaseModel):
    event_id: str
    code: str
    title: str
    severity: Severity
    probability: float
    payer_specific: bool
    governance_lowered: bool
    reason: str


def governance_owned(state: TeamState, content: ContentBundle) -> bool:
    """I10 counts only with a named accountable executive (otherwise it is ceremonial)."""
    ctx = context(state, content)
    return content.config.governance_card in ctx.funded


def evaluate(event: CrisisEvent, state: TeamState, content: ContentBundle) -> CrisisCandidate | None:
    if event.payer_ids and state.payer_id not in event.payer_ids:
        return None
    ctx = context(state, content)
    severity = next((r.severity for r in event.severity_rules if holds(r.when, ctx)), None)
    if severity is None:
        return None
    probability = content.config.crisis_probability[severity]
    lowered = False
    if event.governance_adjusts and governance_owned(state, content):
        probability *= 0.5
        idx = ORDER.index(severity)
        if idx > 0 and ORDER[idx - 1] in event.severities:
            severity = ORDER[idx - 1]
            lowered = True
    if ctx.funded.intersection(event.probability_halved_by):
        probability *= 0.5
    return CrisisCandidate(
        event_id=event.id,
        code=event.code,
        title=event.title,
        severity=severity,
        probability=round(probability, 3),
        payer_specific=bool(event.payer_ids),
        governance_lowered=lowered,
        reason=event.trigger_text,
    )


def rank_crises(
    state: TeamState, content: ContentBundle, *, exclude: set[str] | None = None
) -> list[CrisisCandidate]:
    """Eligible events, most likely first; payer-specific events win ties."""
    out = []
    for event in content.events.values():
        if exclude and event.id in exclude:
            continue
        cand = evaluate(event, state, content)
        if cand:
            out.append(cand)
    out.sort(key=lambda c: (-c.probability, -ORDER.index(c.severity), not c.payer_specific, c.event_id))
    return out


def suggest_crisis(
    response: CrisisResponse, *, literacy_live: bool = False
) -> tuple[dict[str, int], dict[str, str]]:
    s: dict[str, int] = {}
    why: dict[str, str] = {}

    decided = response.decision is not ContainmentDecision.CONTINUE
    s["stop_continue"] = 3 if decided and words(response.restart_criteria) >= 8 else 2 if decided else 1
    if response.decision is ContainmentDecision.CONTINUE and words(response.restart_criteria) < 5:
        s["stop_continue"] = 0
    if literacy_live and s["stop_continue"] < 3:
        s["stop_continue"] += 1
        why["stop_continue"] = "Decision rights from the AI literacy program (I18) sped the decision"
    else:
        why["stop_continue"] = (
            "Decided with restart criteria" if s["stop_continue"] == 3 else "State the criteria for restart"
        )

    owner = response.owner.strip()
    committee = mentions(owner, "committee", "team", "council", "group", "taskforce", "task force")
    if not owner:
        s["owner"] = 0
    elif committee:
        s["owner"] = 1
    elif response.operational_lead.strip() and words(response.authority) >= 4:
        s["owner"] = 3
    else:
        s["owner"] = 2
    why["owner"] = {
        0: "No owner",
        1: "A committee is not an owner",
        2: "Named; add the operational lead and authority",
        3: "Named with authority to act",
    }[s["owner"]]

    inv = depth(response.investigation)
    s["investigation"] = 3 if inv >= 2 and words(response.hypotheses) >= 6 else min(inv, 2)
    why["investigation"] = (
        "Scoped with hypotheses"
        if s["investigation"] == 3
        else "Scope what to verify first, and state hypotheses"
    )

    external = {x for x in response.stakeholders if x in ("members", "regulator", "press", "providers")}
    if response.disclosure is Disclosure.NONE:
        s["communication"] = 0
        why["communication"] = "Concealment scores zero"
    elif not response.stakeholders and not words(response.communication):
        s["communication"] = 0
        why["communication"] = "No communication plan"
    elif not external:
        s["communication"] = 1
        why["communication"] = "Internal only"
    elif (
        "members" in external
        and response.disclosure is Disclosure.IMMEDIATE
        and words(response.communication) >= 20
    ):
        s["communication"] = 3
        why["communication"] = "Sequenced, honest, member-first"
    else:
        s["communication"] = 2
        why["communication"] = "External plan; lead with members and say who hears what, when"

    prot = depth(response.protection)
    s["protection"] = 3 if prot >= 2 and words(response.resources) >= 4 else min(prot, 2)
    why["protection"] = (
        "Specific and resourced" if s["protection"] == 3 else "Make protection steps specific and resourced"
    )

    corr = response.corrective_action
    cosmetic = words(corr) < 6 or (
        mentions(corr, "apolog", "statement", "press release")
        and not mentions(corr, "control", "validat", "review", "process", "monitor", "threshold", "approval")
    )
    if not words(corr):
        s["corrective"] = 0
    elif cosmetic:
        s["corrective"] = 1
    elif words(response.monitoring) >= 6:
        s["corrective"] = 3
    else:
        s["corrective"] = 2
    why["corrective"] = {
        0: "None",
        1: "Cosmetic",
        2: "Control added; say how it is monitored",
        3: "Control added and monitored",
    }[s["corrective"]]

    if response.disclosure is Disclosure.NONE:
        # Pack 7: concealment scores zero.
        s = dict.fromkeys(s, 0)
        why = {k: "Concealment scores zero" for k in s}
    return s, why


def score_crisis(
    content: ContentBundle,
    response: CrisisResponse,
    *,
    literacy_live: bool = False,
    override: dict[str, int] | None = None,
    note: str = "",
) -> RubricScore:
    suggested, why = suggest_crisis(response, literacy_live=literacy_live)
    if response.disclosure is Disclosure.NONE and override:
        override = dict.fromkeys(override, 0)
    return build_score(content.rubrics.crisis, suggested, why, override=override, note=note)
