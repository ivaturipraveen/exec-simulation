"""Executive session summary and AI Opportunity Map as Markdown (T-082)."""

from __future__ import annotations

from typing import TYPE_CHECKING

from app.schemas.workspace import Workspace
from sim.engine import TeamState

if TYPE_CHECKING:
    from app.services.game import GameService

QUADRANT_LABELS = {
    "act_now": "Act now — prioritized pilot or productivity win (value 4+, readiness 4+)",
    "strategic": "Strategic initiative — foundation, operating model or phased roadmap (value 4+, readiness 3 or under)",
    "quick_win": "Selective quick win — only if learning or capacity benefit is clear",
    "defer": "Defer",
}


def session_summary_markdown(game: GameService, session_id: str) -> str:
    content = game.content
    session = game.session_view(session_id)
    lines = [
        f"# {session.name} — executive simulation summary",
        "",
        f"_{content.config.content_pack} · content v{session.content_version} · seed {session.seed} · "
        f"{session.sim_mode} mode · Round-2 mechanic: {session.round2_mechanic}. All figures are simulated "
        "and illustrative; they do not predict real contract performance._",
        "",
    ]
    board = {b.team_id: b for b in game.scoreboard(session_id)}
    for t in session.teams:
        detail = game.team_detail(session_id, t.team_id)
        state = TeamState.model_validate(detail["state"])
        ws = Workspace.model_validate(detail["team"]["workspace"])
        payer = content.payers[t.payer_id]
        lines += [f"## {t.team_name} — {payer.archetype}", ""]
        entry = board.get(t.team_id)
        if entry:
            card = entry.scorecard
            lines.append(
                f"**Scorecard {card.total:.1f}/100** · Stars {card.stars_start:.1f} → {card.stars_year:.1f} "
                f"(projected {card.stars_projected:.1f}; target {card.stars_target:.1f})"
            )
            lines += ["", "| Dimension | Weight | Score | Key driver |", "|---|---|---|---|"]
            for d in card.dimensions:
                lines.append(
                    f"| {d.label} | {d.weight:.0%} | {d.score:.0f} | {d.drivers[0] if d.drivers else ''} |"
                )
            for flag in card.flags:
                lines.append(f"\n> ⚑ {flag}")
            lines.append("")
        if ws.priorities:
            lines.append("**Diagnosis — top priorities**")
            lines += [
                f"{i}. {p.title} ({', '.join(p.evidence) or 'no evidence cited'})"
                for i, p in enumerate(ws.priorities, 1)
            ]
            lines.append("")
        if ws.thesis_r1:
            lines += [f"**Round 1 thesis:** {ws.thesis_r1}", ""]
        for rnd in (1, 2):
            cards = [
                f"{content.investments[i.investment_id].code} {content.investments[i.investment_id].name}"
                + (f" ({i.status.value})" if i.status.value != "active" else "")
                for i in state.initiatives
                if i.funded_round == rnd
            ]
            if cards:
                lines += [f"**Round {rnd} portfolio:** " + "; ".join(cards), ""]
        if ws.pitch_score:
            lines += [
                f"**Board pitch:** {ws.pitch_score.total}/{ws.pitch_score.max} → Round 2 capital ${state.capital_round2_musd:.1f}M",
                "",
            ]
        if ws.thesis_r2:
            lines += [f"**What we learned / changed (Round 2):** {ws.thesis_r2}", ""]
        if ws.opmodel_score:
            lines += [f"**Operating model:** {ws.opmodel_score.total}/{ws.opmodel_score.max}", ""]
        if ws.crisis_event_id:
            ev = content.events[ws.crisis_event_id]
            score = f" — response {ws.crisis_score.total}/18" if ws.crisis_score else ""
            sev = f" ({ws.crisis_severity.value} severity)" if ws.crisis_severity else ""
            lines += [f"**Crisis:** {ev.code} {ev.title}{sev}{score}", ""]
    opp = game.opportunity_map(session_id)
    lines += ["## AI Opportunity Map (participants who consented)", ""]
    if not opp.items:
        lines += ["_No consented opportunities captured yet._", ""]
    for quadrant, label in QUADRANT_LABELS.items():
        items = [o for o in opp.items if o.quadrant == quadrant]
        if items:
            lines += [f"### {label}", ""]
            lines += [
                f"- **{o.title}** ({o.capability_class}) — value {o.value}/5, readiness {o.readiness_avg}/5; "
                f"first 90 days: {o.next_step or 'tbd'}; owner: {o.owner or 'tbd'}"
                for o in items
            ]
            lines.append("")
    if opp.foundational:
        lines += ["### Foundational band (enables 3 or more opportunities)", ""]
        lines += [f"- **{b.theme}** — {b.links} opportunities" for b in opp.foundational]
        lines.append("")
    fb = game.feedback_summary(session_id)
    if fb.responses:

        def pct(x: float | None) -> str:
            return f"{x:.0%}" if x is not None else "n/a"

        lines += [
            "## Pilot indicators (participant feedback)",
            "",
            f"- Responses: {fb.responses}",
            f"- Learning (rated 4–5 of 5): {pct(fb.learning_4plus_pct)} — target ≥ 80%",
            f"- Changed a decision based on evidence: {pct(fb.judgment_changed_pct)} — target ≥ 75%",
            f"- More useful than a conventional AI presentation (4–5): {pct(fb.usefulness_4plus_pct)} — target ≥ 85%",
            f"- Realism (average of 5): {fb.realism_avg}",
            "",
        ]
    lines += [
        "---",
        "_Follow-on support (assessment → roadmap → pilot) is optional diligence, not a predetermined conclusion._",
    ]
    return "\n".join(lines) + "\n"
