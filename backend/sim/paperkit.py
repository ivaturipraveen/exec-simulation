"""Paper / print fallback kit and facilitator answer keys (pack sections 9.1 and 12).

Generated from the same content the software uses, so paper playtests and live-session
fallbacks never drift from the digital game. Sections are separated by horizontal rules so
each prints on its own page.
"""

from __future__ import annotations

from pathlib import Path

from sim.content import ContentBundle
from sim.engine.stars import measure_stars

DISCLAIMER = "_Simulated, fictional training material. Stars values are illustrative and not predictive._"


def _measures_table(content: ContentBundle, payer_id: str | None = None) -> list[str]:
    payer = content.payers[payer_id] if payer_id else None
    head = "| Measure | Weight | Thresholds (game constructs) |" + (
        " Start | Stars | Two-year headroom |" if payer else ""
    )
    sep = "|---|---|---|" + ("---|---|---|" if payer else "")
    rows = [head, sep]
    for m in content.measures.values():
        cells = f"| {m.code} {m.name} | ×{m.weight:g} | {m.thresholds_text} |"
        if payer:
            b = payer.measures[m.id]
            cells += f" {b.value:g} | {measure_stars(m, b.value)} | {b.headroom_text} |"
        rows.append(cells)
    return rows


def team_pack(content: ContentBundle, payer_id: str) -> str:
    p = content.payers[payer_id]
    cfg = content.config
    room = content.datarooms[payer_id]
    lines = [
        f"# {p.name} — team pack",
        DISCLAIMER,
        "",
        f"**{p.archetype}.** {p.tagline}",
        "",
        "## Briefing",
        p.briefing,
        "",
        f"**Board mandate:** {p.board_mandate}",
        "",
        "## Profile",
        "| | |",
        "|---|---|",
        *[f"| {r.label} | {r.value} |" for r in p.profile],
        "",
        f"**Population.** {p.population}",
        "",
        "**Visible advantages**",
        *[f"- {a}" for a in p.advantages],
        "",
        "**Visible constraints**",
        *[f"- {c}" for c in p.constraints],
        "",
        "## Starting scorecard (simulated)",
        *_measures_table(content, payer_id),
        "",
        "## Data room index",
        "| ID | Artifact | Format | Domain | Layer |",
        "|---|---|---|---|---|",
        *[
            f"| {a.id} | {a.title} | {a.format.value.replace('_', ' ')} | {a.domain.value.replace('_', ' ')} | {a.release} |"
            for a in room.artifacts
        ],
        "",
        "---",
        "",
        "## Decision form — Diagnose (top 3 priorities with evidence)",
        "| # | What is actually holding us back | Evidence (artifact IDs) | Why we believe it |",
        "|---|---|---|---|",
        "| 1 | | | |",
        "| 2 | | | |",
        "| 3 | | | |",
        "",
        "## Decision form — Round 1 portfolio",
        f"Capital available: **${p.capital_round1_musd:g}M** · capacity **{p.capacity_per_quarter:g} points per quarter**",
        "",
        "| Card | Scope | Start quarter | Cost $M | Capacity points | Named owner |",
        "|---|---|---|---|---|---|",
        *["| | | | | | |"] * 8,
        "",
        "**Thesis (one paragraph): what we believe will happen and why** ________________________________",
        "",
        "## Board pitch (90 seconds)",
        f"Base ${cfg.round2_base_musd:g}M plus up to ${max(t.earned_musd for t in content.rubrics.pitch_capital):g}M earned on the rubric.",
        "",
        *[f"- **{r.criterion}:** {r.good_answer}" for r in content.rubrics.pitch],
        "",
        "## Decision form — Round 2",
        "| Card | Continue / scale / modify / pause / cancel / fund new | Reason |",
        "|---|---|---|",
        *["| | | |"] * 8,
    ]
    return "\n".join(lines) + "\n"


def investment_cards(content: ContentBundle) -> str:
    lines = ["# Investment catalog — 18 cards", DISCLAIMER, ""]
    for inv in content.investments.values():
        fit = " · ".join(
            f"{content.payers[pid].name}: {f.level.value} ({f.note})" for pid, f in inv.payer_fit.items()
        )
        lines += [
            f"## {inv.code} {inv.name}",
            f"*{inv.class_label}* — {inv.summary}",
            "",
            f"- **Cost:** {inv.cost_text} · **Run cost:** {inv.opex_text}",
            f"- **Implementation:** {inv.duration_quarters} quarter(s); {inv.capacity_points:g} capacity point(s) per quarter while building",
            f"- **Prerequisites:** {inv.prerequisites_text}",
            f"- **Effect at full execution:** {inv.effect_text}",
            f"- **Decay:** {inv.decay_text}",
            f"- **Risk exposure:** {inv.risk.text}",
            f"- **Effectiveness:** {fit}",
            f"- **Synergies:** {', '.join(content.investments[s].code for s in inv.synergies) or 'None'} · **Conflicts:** {inv.conflicts_text}",
            f"- **Reversible:** {inv.reversible_text}",
            "",
            "---",
            "",
        ]
    return "\n".join(lines)


def crisis_packets(content: ContentBundle) -> str:
    lines = ["# Crisis packets (read to the team)", DISCLAIMER, ""]
    for ev in content.events.values():
        applies = ", ".join(content.payers[p].name for p in ev.payer_ids) or "Any team (cross-cutting)"
        lines += [
            f"## {ev.code} {ev.title}",
            f"*Applies to:* {applies} · *Time box:* {ev.minutes} minutes",
            "",
            f"> {ev.packet}",
            "",
            f"**Leadership test:** {ev.leadership_test}",
            "",
            "---",
            "",
        ]
    lines += [
        "## Response rubric (0 to 3 per row, 18 maximum)",
        "| Criterion | What a good answer contains | Scoring |",
        "|---|---|---|",
    ]
    lines += [
        f"| {r.criterion} | {r.good_answer} | {' · '.join(f'{i} {t}' for i, t in enumerate(r.levels))} |"
        for r in content.rubrics.crisis
    ]
    return "\n".join(lines) + "\n"


def facilitator_pack(content: ContentBundle) -> str:
    cfg = content.config
    lines = [
        "# Facilitator pack",
        DISCLAIMER,
        "",
        f"{content.config.edition} edition · {cfg.content_pack} · core {content.total_minutes} minutes plus optional extension",
        "",
        "## Run-of-show",
        "| Start | Stage | What happens | Transition script | Output |",
        "|---|---|---|---|---|",
        *[
            f"| {s.start} | {s.title} ({s.duration_minutes} min){' — optional' if s.optional else ''} | {s.what_happens} | "
            f"{('“' + s.transition_script + '”') if s.transition_script else ''} | {s.primary_output} |"
            for s in content.stages
        ],
        "",
        "## Contingency cuts",
        "| Condition | Cut |",
        "|---|---|",
        *[f"| {c.condition} | {c.cut} |" for c in content.contingency_cuts],
        "",
        "## Console actions by stage",
        *[f"- **{s.title}:** {'; '.join(s.console_actions)}" for s in content.stages if s.console_actions],
        "",
        "## Measures",
        *_measures_table(content),
        "",
        "## Board pitch rubric (15 points) and earned capital",
        *[f"- **{r.criterion}:** {r.good_answer}" for r in content.rubrics.pitch],
        "",
        "| Pitch score | Earned capital added to the base |",
        "|---|---|",
        *[f"| {t.min_score}+ | +${t.earned_musd:g}M |" for t in content.rubrics.pitch_capital],
        "",
        "## Operating model scoring (0 to 3 each)",
        *[f"- **{r.criterion}:** {r.good_answer}" for r in content.rubrics.opmodel],
        "",
        "## Simplification register (say these lines)",
        "| Actual concept | V1 representation | Facilitator disclosure |",
        "|---|---|---|",
        *[f"| {s.actual} | {s.representation} | “{s.disclosure}” |" for s in content.simplifications],
    ]
    return "\n".join(lines) + "\n"


def answer_key(content: ContentBundle, payer_id: str) -> str:
    p = content.payers[payer_id]
    room = content.datarooms[payer_id]
    by_support: dict[str, list[str]] = {}
    for a in room.artifacts:
        by_support.setdefault(a.supports, []).append(f"{a.id} {a.title}")
    events = [e for e in content.events.values() if not e.payer_ids or payer_id in e.payer_ids]
    lines = [
        f"# {p.name} — facilitator answer key (confidential; never shown to teams)",
        "",
        f"_Generated from content by `make paper-kit`. {content.config.content_pack}._",
        "",
        "## Hidden root causes",
        "| ID | Root cause | What is actually happening | Evidence in the data room | Addressed by |",
        "|---|---|---|---|---|",
        *[
            f"| {rc.id} | {rc.title} | {rc.description} | {'<br>'.join(by_support.get(rc.id, ['—']))} | "
            f"{', '.join(content.investments[i].code for i in rc.addressed_by)} |"
            for rc in p.hidden_root_causes
        ],
        "",
        "## Misleading surface signals",
        "| ID | Signal | Why it misleads | Evidence |",
        "|---|---|---|---|",
        *[
            f"| {ms.id} | {ms.title} | {ms.why_misleading} | {'<br>'.join(by_support.get(ms.id, ['—']))} |"
            for ms in p.misleading_signals
        ],
        "",
        f"## Signature trap: {p.trap_title}",
        p.trap_description,
        "",
        "## Viable strategies (at least two must work)",
        *[f"- **{s.title}:** {s.description}" for s in p.viable_strategies],
        "",
        "## Failure modes",
        *[f"- **{f.title}:** {f.description}" for f in p.failure_modes],
        "",
        "## Crises that can fire for this team",
        *[f"- **{e.code} {e.title}** — {e.trigger_text}" for e in events],
        "",
    ]
    return "\n".join(lines)


def stars_primer(content: ContentBundle) -> str:
    """OD-12: the optional two-page Stars pre-read, summarized in the 12-minute briefing."""
    cfg = content.config
    w = cfg.score_weights
    eff = cfg.payer_effectiveness
    dim = ", ".join(f"{x:.0%}" for x in cfg.diminishing_returns)
    measures = list(content.measures.values())
    lag = sorted({m.lag_text for m in measures})
    lines = [
        "# Star Ratings in two pages — optional pre-read",
        DISCLAIMER,
        "",
        "## Page 1 · How the rating works",
        "Medicare Advantage plans are rated from 1 to 5 Stars on quality, member experience and access. "
        "In this simulation a plan's summary rating is the weighted average of the measures below, "
        "rounded to the nearest half Star.",
        "",
        "**Why it matters.** Crossing "
        f"{cfg.target_stars:g} Stars unlocks a quality bonus (illustrative ${cfg.bonus_pmpy_usd:,.0f} per member "
        "per year here). Falling below it costs the bonus and the story you tell your board.",
        "",
        "**Weights.** Outcome and intermediate-outcome measures count most; member experience and "
        "complaints/access next; process measures least.",
        "",
        *_measures_table(content),
        "",
        "**Measures lag.** Leading indicators (call abandonment, gap-closure rate, outreach reach) move "
        "within quarters. Measures move in the next rating year, so most of a Year 1 investment shows "
        "up in Year 2.",
        *[f"- {t}" for t in lag[:4]],
        "",
        "---",
        "",
        "## Page 2 · How the simulation turns decisions into results",
        f"- **Fit matters.** A card's effect depends on your plan: high fit {eff['high']:.0%}, "
        f"medium {eff['medium']:.0%}, low {eff['low']:.0%} of its base effect.",
        f"- **Diminishing returns.** The 1st, 2nd and 3rd card on the same measure deliver {dim} of their effect.",
        f"- **Adoption.** Copilots and agents land at {cfg.adoption_with_workflow:.0%} with workflow redesign "
        f"and {cfg.adoption_with_workflow_and_incentives:.0%} with incentives as well.",
        f"- **Capacity.** Every card uses implementation capacity. Going over slows everything "
        f"(up to {cfg.capacity_overrun_cap:g}× your supply).",
        "- **Prerequisites.** Some cards need a foundation first; without it they deliver little.",
        "- **Crises follow choices.** What you fund (and skip) decides which events can fire.",
        "",
        "**Final scorecard**",
        "| Dimension | Weight |",
        "|---|---|",
        f"| Stars and quality | {w.stars:.0%} |",
        f"| Member outcomes and equity | {w.member:.0%} |",
        f"| Financial value | {w.financial:.0%} |",
        f"| AI and operating-model maturity | {w.maturity:.0%} |",
        f"| Risk and governance | {w.risk:.0%} |",
        "",
        "**Three questions to bring to the table**",
        "1. Which root cause is really holding our rating back, and what is the evidence?",
        "2. What must be in place before AI can help (data, workflow, owners, controls)?",
        "3. What will we see in the first two quarters that tells us it is working?",
        "",
        "_Roles are assigned at the table; no other preparation is needed._",
    ]
    return "\n".join(lines)


def write_paper_kit(content: ContentBundle, out: Path, answer_keys: Path | None = None) -> list[Path]:
    out.mkdir(parents=True, exist_ok=True)
    files = {
        "00-facilitator-pack.md": facilitator_pack(content),
        "01-investment-cards.md": investment_cards(content),
        "02-crisis-packets.md": crisis_packets(content),
        "03-stars-primer.md": stars_primer(content),
        **{f"team-{pid}.md": team_pack(content, pid) for pid in content.payers},
    }
    written = []
    for name, text in files.items():
        path = out / name
        path.write_text(text, encoding="utf-8")
        written.append(path)
    if answer_keys:
        answer_keys.mkdir(parents=True, exist_ok=True)
        for pid in content.payers:
            path = answer_keys / f"{pid}.md"
            path.write_text(answer_key(content, pid), encoding="utf-8")
            written.append(path)
    return written
