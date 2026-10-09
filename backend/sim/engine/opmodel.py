"""Human-versus-AI operating model exercise — Content Pack v0.1 section 8.

Teams assign each of the nine quality-gap closure steps to human-owned, AI-assisted,
agent-executed-with-approval or bounded autonomous execution, and answer six decision
dimensions for every step given to an agent. Four rows are scored 0–3 (value, control
adequacy, adoption feasibility, recoverability). Autonomy level itself never scores.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from sim.content import ContentBundle
from sim.content.models import WorkflowMode, WorkflowStep
from sim.engine.conditions import context
from sim.engine.rubric import RubricScore, build_score, words
from sim.engine.state import TeamState

AGENTIC = (WorkflowMode.AGENT_APPROVAL, WorkflowMode.AUTONOMOUS)
COMPRESSED_STEPS = {3, 4, 5, 6}  # contingency cut: steps 3 to 6 only


class StepDesign(BaseModel):
    step_id: str
    mode: WorkflowMode
    controls: list[str] = []
    owner: str = Field(default="", max_length=120)
    dimensions: dict[str, str] = Field(default={}, description="Six decision dimensions for agent steps")


class OperatingModelDesign(BaseModel):
    steps: list[StepDesign]
    accountable_executive: str = Field(default="", max_length=120)
    notes: str = Field(default="", max_length=2000)


def required_controls(step: WorkflowStep, mode: WorkflowMode) -> set[str]:
    req: set[str] = set()
    if mode is WorkflowMode.AI_ASSIST:
        req = {"audit_log"}
    elif mode is WorkflowMode.AGENT_APPROVAL:
        req = {"human_review", "audit_log", "kill_switch"}
        if step.risk_level != "low":
            req.add("validation")
    elif mode is WorkflowMode.AUTONOMOUS:
        req = {"validation", "confidence_threshold", "audit_log", "exception_handling", "kill_switch"}
    if mode in AGENTIC and (step.member_facing or step.id == "prioritize"):
        req.add("subgroup_monitoring")
    if step.sensitive and mode is not WorkflowMode.HUMAN:
        req.add("human_review")
    return req


def steps_in_play(content: ContentBundle, compressed: bool) -> list[WorkflowStep]:
    return [s for s in content.workflow_steps if not compressed or s.number in COMPRESSED_STEPS]


def missing_human_review(design: OperatingModelDesign, content: ContentBundle) -> bool:
    """E7 trigger: no human review on the member-facing message steps (4 and 5)."""
    by_id = {d.step_id: d for d in design.steps}
    for step in content.workflow_steps:
        if step.sensitive:
            d = by_id.get(step.id)
            if d and (d.mode is WorkflowMode.HUMAN or "human_review" in d.controls):
                return False
    return True


def validate(design: OperatingModelDesign, content: ContentBundle, compressed: bool) -> None:
    known = {s.id for s in content.workflow_steps}
    controls = {c.id for c in content.workflow_controls}
    dims = {d.id for d in content.decision_dimensions}
    by_id = {d.step_id: d for d in design.steps}
    missing = [s.id for s in steps_in_play(content, compressed) if s.id not in by_id]
    if missing:
        raise ValueError(f"design must cover every workflow step; missing {missing}")
    for d in design.steps:
        if d.step_id not in known:
            raise ValueError(f"unknown workflow step '{d.step_id}'")
        if set(d.controls) - controls:
            raise ValueError(f"unknown controls on {d.step_id}: {sorted(set(d.controls) - controls)}")
        if set(d.dimensions) - dims:
            raise ValueError(
                f"unknown decision dimensions on {d.step_id}: {sorted(set(d.dimensions) - dims)}"
            )


def _band(value: float, cuts: tuple[float, float, float]) -> int:
    return sum(value >= c for c in cuts)


def suggest_opmodel(
    design: OperatingModelDesign, state: TeamState, content: ContentBundle, *, compressed: bool = False
) -> tuple[dict[str, int], dict[str, str], list[str]]:
    validate(design, content, compressed)
    ctx = context(state, content)
    cfg = content.config
    steps = steps_in_play(content, compressed)
    by_id = {d.step_id: d for d in design.steps}
    dims = [d.id for d in content.decision_dimensions]
    findings: list[str] = []

    # Value: does the design move faster than the status quo, with capacity to act?
    values = [s.value_by_mode[by_id[s.id].mode] for s in steps]
    value = sum(values) / len(values)
    if all(by_id[s.id].mode is WorkflowMode.HUMAN for s in steps):
        findings.append("A fully human design does not move leading KPIs faster than today.")

    # Control adequacy: proportionate to consequence and autonomy at each step.
    adequacy = []
    for s in steps:
        d = by_id[s.id]
        req = required_controls(s, d.mode)
        ratio = len(req & set(d.controls)) / len(req) if req else 1.0
        if d.mode is WorkflowMode.AUTONOMOUS and s.sensitive:
            ratio *= 0.3
            findings.append(f"Step {s.number} ({s.name}) is fully autonomous: {s.facilitator_note.lower()}.")
        elif ratio < 1.0:
            gaps = ", ".join(sorted(req - set(d.controls))).replace("_", " ")
            findings.append(f"Step {s.number} ({s.name}) is missing: {gaps}.")
        if d.mode in AGENTIC:
            answered = sum(1 for k in dims if words(d.dimensions.get(k, "")) >= 3)
            if answered < len(dims):
                ratio *= 0.6 + 0.4 * answered / len(dims)
                findings.append(
                    f"Step {s.number} is given to an agent but answers {answered} of 6 decision dimensions."
                )
        adequacy.append(ratio)
    control = sum(adequacy) / len(adequacy)

    # Adoption feasibility: named humans who will actually do this, given incentives and capacity.
    non_human = [s for s in steps if by_id[s.id].mode is not WorkflowMode.HUMAN]
    owners = sum(1 for s in non_human if by_id[s.id].owner.strip()) / len(non_human) if non_human else 1.0
    support = (
        0.4
        + 0.3 * (cfg.workflow_card in ctx.live)
        + 0.2 * (cfg.literacy_card in ctx.live)
        + 0.1 * (cfg.incentive_card in ctx.live)
    )
    burden = len(non_human) / len(steps)
    adoption = owners * (0.5 + 0.5 * min(1.0, support / max(burden, 0.2)))
    if not design.accountable_executive.strip():
        adoption *= 0.7
        findings.append("No single accountable executive is named for the workflow.")
    if owners < 1.0:
        findings.append("Some AI-assisted or agent steps have no named operational owner.")
    if burden > support + 0.2:
        findings.append(
            "The design changes more roles than current adoption support can absorb (consider I11 or I18)."
        )

    # Recoverability: can a wrong action be detected and reversed before member harm?
    agentic = [s for s in steps if by_id[s.id].mode in AGENTIC]
    if agentic:
        recover = sum(
            0.5 * ("kill_switch" in by_id[s.id].controls)
            + 0.3 * ("exception_handling" in by_id[s.id].controls)
            + 0.2 * ("audit_log" in by_id[s.id].controls)
            - (
                0.5
                if s.member_facing
                and by_id[s.id].mode is WorkflowMode.AUTONOMOUS
                and "human_review" not in by_id[s.id].controls
                else 0.0
            )
            for s in agentic
        ) / len(agentic)
    else:
        recover = 1.0

    rows = {
        "value": _band(value, (0.45, 0.6, 0.72)),
        "control": _band(control, (0.5, 0.75, 0.95)),
        "adoption": _band(adoption, (0.35, 0.6, 0.85)),
        "recoverability": _band(max(0.0, recover), (0.35, 0.65, 0.9)),
    }
    why = {
        "value": f"Average step value {value:.0%} of the best achievable",
        "control": f"Controls cover {control:.0%} of what each step's consequence and autonomy require",
        "adoption": f"Owners named on {owners:.0%} of changed steps; adoption support {'strong' if support >= 0.7 else 'limited'}",
        "recoverability": "Agent steps can be paused and reversed"
        if recover >= 0.9
        else "Add pause/kill switch and exception handling to agent steps",
    }
    return rows, why, findings[:10]


def score_opmodel(
    design: OperatingModelDesign,
    state: TeamState,
    content: ContentBundle,
    *,
    compressed: bool = False,
    override: dict[str, int] | None = None,
    note: str = "",
) -> tuple[RubricScore, list[str]]:
    rows, why, findings = suggest_opmodel(design, state, content, compressed=compressed)
    return build_score(content.rubrics.opmodel, rows, why, override=override, note=note), findings
