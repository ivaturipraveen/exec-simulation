"""Command-line entry point.

python -m sim validate                       # validate all content and list design warnings
python -m sim run --portfolio hz-foundation-light
python -m sim run --payer horizon --portfolio my_plan.yaml
python -m sim compare                        # regression suite matrix (section 5)
python -m sim calibrate --out ../docs/calibration.md
python -m sim paperkit                       # paper kit + answer keys into docs/
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import yaml

from sim.content import ContentBundle, ContentError, content_warnings, load_content
from sim.content.models import ReferencePortfolio
from sim.engine import build_scorecard, rank_crises, year_report
from sim.engine.reports import YearReport
from sim.portfolios import regression_suite, run_portfolio

DEFAULT_CONTENT = Path(__file__).resolve().parents[2] / "content"


def _load(path: Path) -> ContentBundle:
    try:
        return load_content(path)
    except ContentError as exc:
        print(exc, file=sys.stderr)
        raise SystemExit(1) from exc


def _portfolio(content: ContentBundle, arg: str, payer: str | None) -> ReferencePortfolio:
    known = {p.id: p for p in regression_suite(content)}
    if arg in known:
        return known[arg]
    path = Path(arg)
    if not path.is_file() or not payer:
        raise SystemExit(f"unknown portfolio '{arg}'. Use one of {sorted(known)} or a YAML file with --payer")
    data = yaml.safe_load(path.read_text())
    return ReferencePortfolio(
        id=path.stem,
        payer_id=payer,
        name=path.stem,
        kind="viable",
        round1=data["round1"],
        round2=data.get("round2", []),
        scopes=data.get("scopes", {}),
    )


def _print_year(r: YearReport) -> None:
    s = r.stars
    print(f"\n── Year {r.year} performance review (simulated) ─────────────────")
    print(
        f"Stars: start {s.baseline:.1f} · Year {r.year} rating {s.year_rating:.1f} · projected {s.projected:.1f} "
        f"(band {s.projected_low:.1f}–{s.projected_high:.1f}) · target {s.target:.1f}"
    )
    for seg in r.segments:
        print(
            f"  {seg.name}: start {seg.baseline:.1f} · rating {seg.year_rating:.1f} · projected {seg.projected:.1f}"
        )
    print(f"{'Measure':48} {'Start':>7} {'Year':>7} {'Proj':>7}  Stars")
    for m in r.measures:
        print(
            f"{m.code + ' ' + m.name[:44]:48} {m.baseline:7.2f} {m.year_value:7.2f} {m.projected:7.2f}  "
            f"{m.baseline_stars}→{m.year_stars}→{m.projected_stars}"
        )
    print(f"Capacity peak {r.capacity_peak:.0%}; overrun quarters {r.overrun_quarters}")
    for i in r.initiatives:
        realized = f"{i.realized_pct:.0f}%" if i.realized_pct is not None else "not live"
        print(f"  {i.code:4} {i.name[:44]:44} live {i.live_label or '—':6} realized {realized}")
        for d in i.drivers[:3]:
            print(f"        {d.impact_pct:+6.1f}%  {d.label}")
    for note in r.unintended:
        print(f"  ! {note}")
    for clue in r.clues:
        print(f"  ? {clue}")


def cmd_validate(args: argparse.Namespace) -> None:
    c = _load(args.content)
    print(
        f"OK: {len(c.payers)} payers, {len(c.measures)} measures, {len(c.investments)} cards, "
        f"{len(c.events)} events, {len(c.stages)} stages ({c.total_minutes} min core), "
        f"{sum(len(r.artifacts) for r in c.datarooms.values())} artifacts"
    )
    for w in content_warnings(c):
        print(f"WARN: {w}")


def cmd_run(args: argparse.Namespace) -> None:
    c = _load(args.content)
    pf = _portfolio(c, args.portfolio, args.payer)
    run = run_portfolio(c, pf, args.seed)
    print(f"{pf.name} — {c.payers[pf.payer_id].name}; funded {run.funded}; dropped by ledger {run.dropped}")
    for y in (1, 2):
        _print_year(year_report(run.state, c, y))
    print(
        "\nRecommended crisis:",
        [f"{x.code} {x.severity.value} (p={x.probability})" for x in rank_crises(run.state, c)[:3]],
    )
    sc = build_scorecard(run.state, c)
    print(f"Scorecard (no op model / crisis scored): {sc.total}")


def _row(c: ContentBundle, pf: ReferencePortfolio, seed: int) -> dict:
    run = run_portfolio(c, pf, seed)
    y1, y2 = year_report(run.state, c, 1), year_report(run.state, c, 2)
    crises = rank_crises(run.state, c)
    return {
        "pf": pf,
        "run": run,
        "y1": y1,
        "y2": y2,
        "crisis": crises[0] if crises else None,
        "score": build_scorecard(run.state, c).total,
    }


def cmd_compare(args: argparse.Namespace) -> None:
    c = _load(args.content)
    print(
        f"{'Portfolio':28} {'Kind':8} {'Start':>5} {'Y2':>5} {'Proj':>5} {'Peak':>6} {'Crisis':>12} {'Score':>6}"
    )
    for pf in regression_suite(c):
        r = _row(c, pf, args.seed)
        cr = f"{r['crisis'].code} {r['crisis'].severity.value}" if r["crisis"] else "—"
        print(
            f"{pf.id:28} {pf.kind:8} {r['y2'].stars.baseline:5.1f} {r['y2'].stars.year_rating:5.1f} "
            f"{r['y2'].stars.projected:5.1f} {r['y2'].capacity_peak:6.0%} {cr:>12} {r['score']:6.1f}"
        )


def calibration_markdown(c: ContentBundle, seed: int = 42) -> str:
    lines = [
        "# Calibration report — engine vs Content Pack section 5.2",
        "",
        "Generated by `make calibrate` (`python -m sim calibrate`). Deterministic mode, seed "
        f"{seed}. Each reference portfolio is funded in order (the ledger drops cards it cannot "
        "afford), Round 2 gets the $8.0M base, and both years run. *Projected* is the full effect "
        "at the end of Year 2; the *Y2 rating* is lagged by each measure's lag share. Crisis "
        "effects are not applied here (they land on the final scorecard).",
        "",
        "Illustrative outcomes are the pack's; where the engine differs, the pack's stated rules "
        "(sections 4 and 5) were followed and the difference is listed for the content owner.",
        "",
    ]
    for payer_id, payer in c.payers.items():
        lines += [f"## {payer.name}", ""]
        lines += [
            "| Portfolio | Kind | Engine: Year 1 leading KPIs | Engine: measure lift (projected) | Stars start → Y2 → projected | Crisis | Pack illustrative |",
            "|---|---|---|---|---|---|---|",
        ]
        for pf in [p for p in regression_suite(c) if p.payer_id == payer_id]:
            r = _row(c, pf, seed)
            y1, y2 = r["y1"], r["y2"]
            kpis = [k for k in y1.kpis if abs(k.delta) >= 1 and k.id != "copilot_adoption"]
            kpi_txt = (
                "; ".join(f"{k.name} {k.baseline:g}→{k.current:g}" for k in kpis[:4]) or "little movement"
            )
            if y1.capacity_peak > 1:
                kpi_txt += f"; capacity peak {y1.capacity_peak:.0%}"
            lifts = (
                "; ".join(
                    f"{m.code} {m.projected - m.baseline:+.2f}"
                    for m in y2.measures
                    if abs(m.projected - m.baseline) >= 0.01
                )
                or "flat"
            )
            seg = "".join(f" ({s.name} {s.baseline:.1f}→{s.projected:.1f})" for s in y2.segments)
            stars = f"{y2.stars.baseline:.1f} → {y2.stars.year_rating:.1f} → {y2.stars.projected:.1f}{seg}"
            crisis = f"{r['crisis'].code} {r['crisis'].severity.value}" if r["crisis"] else "none"
            pack = (
                " / ".join(
                    x for x in (pf.illustrative_year1, pf.illustrative_year2, pf.illustrative_crisis) if x
                )
                or "—"
            )
            dropped = f" (ledger dropped {', '.join(r['run'].dropped)})" if r["run"].dropped else ""
            lines.append(
                f"| {pf.name}{dropped} | {pf.kind} | {kpi_txt} | {lifts} | {stars} | {crisis} | {pack} |"
            )
        lines.append("")
    warnings = content_warnings(c)
    if warnings:
        lines += ["## Content design warnings", ""] + [f"- {w}" for w in warnings] + [""]
    return "\n".join(lines)


def cmd_calibrate(args: argparse.Namespace) -> None:
    c = _load(args.content)
    text = calibration_markdown(c, args.seed)
    if args.out:
        args.out.write_text(text, encoding="utf-8")
        print(f"wrote {args.out}")
    else:
        print(text)


def cmd_paperkit(args: argparse.Namespace) -> None:
    from sim.paperkit import write_paper_kit

    c = _load(args.content)
    docs = Path(__file__).resolve().parents[2] / "docs"
    for path in write_paper_kit(c, docs / "paper-kit", docs / "answer-keys"):
        print(f"wrote {path}")


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        prog="sim", description="Medicare Advantage AI executive simulation engine"
    )
    parser.add_argument("--content", type=Path, default=DEFAULT_CONTENT)
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("validate")
    run = sub.add_parser("run")
    run.add_argument("--portfolio", required=True)
    run.add_argument("--payer")
    run.add_argument("--seed", type=int, default=42)
    cmp_ = sub.add_parser("compare")
    cmp_.add_argument("--seed", type=int, default=42)
    cal = sub.add_parser("calibrate")
    cal.add_argument("--seed", type=int, default=42)
    cal.add_argument("--out", type=Path)
    sub.add_parser("paperkit")
    args = parser.parse_args(argv)
    commands = {
        "validate": cmd_validate,
        "run": cmd_run,
        "compare": cmd_compare,
        "calibrate": cmd_calibrate,
        "paperkit": cmd_paperkit,
    }
    commands[args.cmd](args)


if __name__ == "__main__":
    main()
