"""Create a demo session against a running server (`make dev` or `make start`).

    python scripts/demo_session.py            # fully played session, parked at Final results
    python scripts/demo_session.py --fresh    # clean session, started, for a live walkthrough

Prints the facilitator link and each team's join code. Uses only the public HTTP API, so
it exercises exactly what a real session does. No AI calls are made by this script (the
facilitator's pitch review may call Claude when PITCH_AI_SUGGEST is on and a key is set).
"""

from __future__ import annotations

import argparse
import json
import os
import urllib.error
import urllib.request
from datetime import UTC, datetime

WEB = os.environ.get("DEMO_WEB_URL", f"http://localhost:{os.environ.get('WEB_PORT', '5180')}")
API = f"{WEB}/api"

# Three contrasting plays (Content Pack v0.1 section 5.2) make the debrief interesting.
PLAYS = {
    "heritage": {  # Sequenced foundation: identity for Lakeshore only, ADT, pharmacy capacity
        "priorities": [
            ("Identity mismatch in the acquired books corrupts our lists", ["L-07", "L-21", "L-04"]),
            ("Pharmacists reach only 15% of the at-risk list each quarter", ["L-09", "L-10"]),
            ("We learn about most discharges nine days late", ["L-17", "L-18"]),
        ],
        "r1": [
            {"investment_id": "i1", "scope": "scoped", "owner": "Priya Raman, CIO (Lakeshore data owner)"},
            {"investment_id": "i13"},
            {"investment_id": "i14"},
            {"investment_id": "i10", "owner": "Samuel Adeyemi, Chief Compliance Officer"},
            {"investment_id": "i17", "start_offset": 1},
            {"investment_id": "i9", "start_offset": 1},
            {"investment_id": "i12", "start_offset": 2},
        ],
        "thesis1": "Fix identity for Lakeshore only, get discharge data on time and add pharmacy reach; "
        "stop the abandonment slide. Foundations scoped so the board sees movement in 12 months.",
        "pitch": {
            "evidence": ["L-02", "L-10", "L-17"],
            "results": "Year 1: Lakeshore identity match rose, ADT latency fell below one day and 48-hour follow-up "
            "more than doubled; abandonment is down.",
            "causal": "Readmissions lag because care managers heard about discharges nine days late; adherence is "
            "capped by pharmacist reach, not by the model, so capacity moved first.",
            "decision": "Fund I3 predictive adherence now because identity is clean and I14 gives it reach; keep I1 "
            "scoped to Lakeshore.",
            "risk": "The model may under-serve dual-eligible members; I12 monitors subgroups and the governance "
            "owner can pause outreach.",
            "ask": "Approve $1.75M for predictive adherence on the clean Lakeshore book.",
        },
        "r2": [{"action": "fund", "investment_id": "i3"}],
        "thesis2": "Identity is clean and pharmacy capacity exists, so predictive adherence now pays back.",
        "disclosure": "immediate",
    },
    "horizon": {  # Foundation-light: identity and history stitching first, then predictive + capacity
        "priorities": [
            ("Members with under 12 months of history are invisible to our models", ["H-05", "H-09", "H-10"]),
            ("New-county providers have no reason to act on alerts", ["H-04", "H-16"]),
            ("Low call volume hides 11% abandonment", ["H-12", "H-13"]),
        ],
        "r1": [
            {"investment_id": "i1", "owner": "Dana Ruiz, Chief Data Officer"},
            {"investment_id": "i10", "owner": "Marcus Lee, Chief Compliance Officer"},
            {"investment_id": "i14"},
            {"investment_id": "i17"},
            {"investment_id": "i4", "start_offset": 1},
            {"investment_id": "i3", "start_offset": 2},
            {"investment_id": "i12", "start_offset": 2},
        ],
        "thesis1": "Stitch prior-plan history before predicting anything; fix the IVR that drops calls; add pharmacy reach.",
        "pitch": {
            "evidence": ["H-09", "H-12", "H-22"],
            "results": "Year 1: identity match improved, abandonment fell and at-risk outreach coverage rose; measures lag.",
            "causal": "Outreach had been going to already-adherent legacy members because new members had no history; "
            "that is why adherence was flat.",
            "decision": "Fund I15 provider incentives because new-county contracts give providers no reason to act, and "
            "pause nothing.",
            "risk": "Providers may game measures; the incentive pool is audited by quality operations.",
            "ask": "Fund provider incentives for the nine new counties.",
        },
        "r2": [{"action": "fund", "investment_id": "i15"}],
        "thesis2": "Foundations are live; now give new-county providers a reason to act on blood pressure.",
        "disclosure": "immediate",
    },
    "communitycare": {  # The trap: insight without workflow or incentives, then concealment
        "priorities": [("Our models are excellent; clinicians just need better insight", ["C-23", "C-21"])],
        "r1": [{"investment_id": "i5"}, {"investment_id": "i6"}, {"investment_id": "i2"}],
        "thesis1": "Our affiliated doctors will use AI recommendations if we put better insight in front of them.",
        "pitch": {
            "evidence": ["C-23"],
            "results": "Models validate well.",
            "causal": "Adoption was slow.",
            "decision": "Add an agent.",
            "risk": "",
            "ask": "The agent will deliver a $22M benefit next year.",
        },
        "r2": [{"action": "fund", "investment_id": "i8"}],
        "thesis2": "Doctors were slow to adopt; an agent can close gaps without them.",
        "disclosure": "none",
    },
}

LONG = "Named owner, clear timeline and measurable outcome; reviewed weekly by the executive team with a written log."


def call(method: str, path: str, token: str | None = None, body: object | None = None):
    req = urllib.request.Request(
        API + path,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={
            "Content-Type": "application/json",
            **({"Authorization": f"Bearer {token}"} if token else {}),
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            raw = r.read()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raise SystemExit(f"{method} {path} failed: {e.code} {e.read().decode()[:400]}") from e
    except urllib.error.URLError as e:
        raise SystemExit(f"Cannot reach {WEB}. Start the app first with `make dev`.") from e


def opmodel_design(steps: list[dict], careful: bool) -> dict:
    out = []
    for s in steps:
        if not careful:
            out.append({"step_id": s["id"], "mode": "autonomous", "controls": ["audit_log"]})
            continue
        if s["sensitive"]:
            mode, controls = "ai_assist", ["audit_log", "human_review"]
        elif s["risk_level"] == "low":
            mode = "agent_approval"
            controls = ["human_review", "audit_log", "kill_switch", "validation", "exception_handling"]
        else:
            mode, controls = "ai_assist", ["audit_log", "subgroup_monitoring"]
        dims = {}
        if mode == "agent_approval":
            dims = {
                "authority": "Agent recommends and queues; quality lead approves; ops lead can pause or shut down",
                "accountability": "Chief Quality Officer accountable; quality operations lead owns daily running",
                "controls": "Validation thresholds, human approval, audit log, exception queue",
                "data": "Claims, pharmacy and lab feeds; minimum-necessary access; lineage logged; 7-year retention",
                "adoption": "Analysts move from list building to exception review; no incentive conflict",
                "monitoring": "Weekly drift, error rate, subgroup and complaint review against realized closures",
            }
        out.append(
            {
                "step_id": s["id"],
                "mode": mode,
                "controls": controls,
                "owner": "Quality operations lead",
                "dimensions": dims,
            }
        )
    return {"steps": out, "accountable_executive": "Chief Quality Officer" if careful else ""}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--fresh", action="store_true", help="create a clean, started session")
    parser.add_argument("--name", default=None)
    args = parser.parse_args()

    name = args.name or ("Live demo" if args.fresh else "Demo — completed session")
    created = call("POST", "/sessions", body={"name": name, "seed": 42})
    sid, ftok = created["session"]["id"], created["facilitator_token"]
    stages = created["session"]["stages"]
    teams = {t["payer_id"]: t for t in created["session"]["teams"]}
    tokens = {pid: call("POST", "/join", body={"code": t["join_code"]})["token"] for pid, t in teams.items()}

    def goto(kind: str) -> None:
        index = next(i for i, s in enumerate(stages) if s["kind"] == kind)
        call("POST", f"/sessions/{sid}/stage", ftok, {"action": "goto", "index": index})

    call("POST", f"/sessions/{sid}/stage", ftok, {"action": "start"})
    if args.fresh:
        goto("company")
    else:
        goto("diagnose")
        for pid, play in PLAYS.items():
            call(
                "PUT",
                "/team/priorities",
                tokens[pid],
                {
                    "priorities": [
                        {"title": t, "rationale": "", "evidence": ev} for t, ev in play["priorities"]
                    ]
                },
            )
        goto("invest_r1")
        for pid, play in PLAYS.items():
            call("PUT", "/team/round1", tokens[pid], {"items": play["r1"], "thesis": play["thesis1"]})
            call("POST", "/team/round1/submit", tokens[pid])
        goto("simulate_y1")
        call("POST", f"/sessions/{sid}/simulate", ftok, {"year": 1})
        call("POST", f"/sessions/{sid}/results/1/release", ftok)  # after facilitator review
        goto("analyze")
        for pid, play in PLAYS.items():
            call("PUT", "/team/pitch", tokens[pid], {"pitch": play["pitch"], "submit": True})
        goto("invest_r2")
        for t in teams.values():
            review = call("GET", f"/sessions/{sid}/teams/{t['team_id']}/pitch", ftok)
            call(
                "PUT",
                f"/sessions/{sid}/teams/{t['team_id']}/pitch-score",
                ftok,
                {
                    "rows": review["score"]["suggested"],
                    "note": "Accepted the suggested score after the pitch.",
                },
            )
        call("POST", f"/sessions/{sid}/round2/grant", ftok)
        for pid, play in PLAYS.items():
            call("PUT", "/team/round2", tokens[pid], {"actions": play["r2"], "thesis": play["thesis2"]})
            call("POST", "/team/round2/submit", tokens[pid])
        goto("simulate_y2")
        call("POST", f"/sessions/{sid}/simulate", ftok, {"year": 2})
        call("POST", f"/sessions/{sid}/results/2/release", ftok)
        goto("operating_model")
        steps = call("GET", "/catalog")["workflow_steps"]
        for pid in PLAYS:
            design = opmodel_design(steps, careful=pid != "communitycare")
            call("PUT", "/team/operating-model", tokens[pid], {"submit": True, "design": design})
        goto("crisis")
        call("POST", f"/sessions/{sid}/crisis/assign", ftok, {})
        for pid, play in PLAYS.items():
            honest = play["disclosure"] != "none"
            call(
                "POST",
                "/team/crisis/response",
                tokens[pid],
                {
                    "decision": "pause" if honest else "continue",
                    "restart_criteria": "Restart only after validation passes on a sample and the owner signs off."
                    if honest
                    else "",
                    "owner": "Chief Operating Officer",
                    "operational_lead": "VP Quality Operations" if honest else "",
                    "authority": "Can stop any campaign or model immediately" if honest else "",
                    "investigation": LONG,
                    "hypotheses": "Unvalidated eligibility rule; stale identity crosswalk; missing review step"
                    if honest
                    else "",
                    "stakeholders": ["members", "regulator", "board", "providers"] if honest else ["board"],
                    "disclosure": play["disclosure"],
                    "communication": "Members first by phone and letter today, regulator within 24 hours, board Thursday, "
                    "press statement on request; the COO signs every message."
                    if honest
                    else "",
                    "protection": "Call back every affected member, correct records and brief providers."
                    if honest
                    else "We will look into it.",
                    "resources": "Twenty agents and two pharmacists for two weeks" if honest else "",
                    "corrective_action": "Add validation and human approval before any campaign restarts; change the release process."
                    if honest
                    else "Issue a statement.",
                    "monitoring": "Weekly complaint and error-rate review by the governance owner for a quarter"
                    if honest
                    else "",
                },
            )
        goto("results")
        call("POST", f"/sessions/{sid}/scorecards/release", ftok)
        now = datetime.now(UTC).isoformat()
        call(
            "PUT",
            "/team/opportunities",
            tokens["horizon"],
            {
                "consent": {"granted": True, "participant": "Pat", "at": now},
                "items": [
                    {
                        "participant": "Pat",
                        "title": "Predictive adherence for dual-eligible members",
                        "capability_class": "Predictive",
                        "value_hypothesis": "Diabetes adherence +2 points for duals in one region within a year",
                        "value": 5,
                        "readiness": {"data": 3, "workflow": 3, "owner": 4, "controls": 2},
                        "dependencies": "Identity resolution; pharmacist capacity",
                        "risks": "Bias against members with thin history",
                        "owner": "VP Pharmacy",
                        "next_step": "90-day pilot in one region with subgroup monitoring",
                        "foundations": ["Data integration", "Governance"],
                    },
                    {
                        "participant": "Pat",
                        "title": "Enterprise AI governance and model inventory",
                        "capability_class": "Foundation",
                        "value_hypothesis": "Every model owned, validated and pausable",
                        "value": 4,
                        "readiness": {"data": 4, "workflow": 4, "owner": 5, "controls": 4},
                        "owner": "Chief Risk Officer",
                        "next_step": "Name owners; inventory models",
                        "foundations": ["Governance"],
                    },
                    {
                        "participant": "Sam",
                        "title": "Contact-center copilot",
                        "capability_class": "Copilot",
                        "value_hypothesis": "First-contact resolution +10 points",
                        "value": 3,
                        "readiness": {"data": 4, "workflow": 4, "owner": 4, "controls": 4},
                        "owner": "VP Member Services",
                        "next_step": "Rebuild the knowledge base first",
                        "foundations": ["Knowledge architecture", "Governance"],
                    },
                ],
            },
        )
        call(
            "PUT",
            "/team/opportunities",
            tokens["heritage"],
            {
                "consent": {"granted": True, "participant": "Lee", "at": now},
                "items": [
                    {
                        "participant": "Lee",
                        "title": "Member identity resolution across acquired books",
                        "capability_class": "Foundation",
                        "value_hypothesis": "Unlocks every outreach program for 97,000 Lakeshore members",
                        "value": 5,
                        "readiness": {"data": 2, "workflow": 2, "owner": 3, "controls": 3},
                        "owner": "CIO",
                        "next_step": "Match-rate baseline and a named data owner",
                        "foundations": ["Data integration"],
                    },
                    {
                        "participant": "Lee",
                        "title": "Discharge follow-up agent with nurse approval",
                        "capability_class": "Agent",
                        "value_hypothesis": "48-hour follow-up from 23% to 60%",
                        "value": 4,
                        "readiness": {"data": 3, "workflow": 3, "owner": 4, "controls": 3},
                        "owner": "VP Care Management",
                        "next_step": "Sign the three pending data-sharing agreements",
                        "foundations": ["Data integration", "Adoption capability"],
                    },
                ],
            },
        )
        for pid, (learn, changed, useful) in {
            "horizon": (5, True, 5),
            "heritage": (4, True, 5),
            "communitycare": (4, False, 4),
        }.items():
            call(
                "POST",
                "/team/feedback",
                tokens[pid],
                {
                    "learning": learn,
                    "judgment_changed": changed,
                    "usefulness_vs_presentation": useful,
                    "realism": 4,
                    "would_recommend": 9,
                    "comments": "Realistic trade-offs.",
                },
            )

    print(f"\nSession '{name}' ready.\n")
    print(f"  Facilitator console:  {WEB}/facilitator/{sid}?token={ftok}\n")
    print("  Team join codes (start page → Join your team):")
    for t in teams.values():
        print(f"    {t['payer_name']:<24} {t['join_code']}")
    print("\nThe facilitator link contains a secret token — share it only with the facilitator.\n")


if __name__ == "__main__":
    main()
