"""Create a demo session against a running server (`make dev` or `make start`).

    python scripts/demo_session.py            # fully played session, parked at Real-company translation
    python scripts/demo_session.py --fresh    # clean session, started, for a live walkthrough

Each of the three companies is played by its own executive team (CEO, COO, CFO, CIO/CTO, CMO,
quality, compliance, pharmacy ...): evidence-based priorities, a sequenced Round 1 portfolio with a
named executive owner per card, a board pitch, a Round 2 change, the agent operating model, the
crisis response and, at the end, the executives' real-company AI Opportunity Map with consent.
The session is left running at the translation stage so the facilitator can open the
"Opportunity map" tab and run Synthesize. Play data: scripts/demo_plays.json (+ the extra
opportunities below).

Prints the facilitator link and each team's join code. Uses only the public HTTP API, so it
exercises exactly what a real session does. No AI calls are made by this script (the
facilitator's pitch review may call Claude when PITCH_AI_SUGGEST is on and a key is set).

When sign-in is on, credentials are read from backend/.env (or the environment) by variable name:
LOGIN_EMAIL / LOGIN_PASSWORD for the facilitator and TEAM_LOGINS (a JSON list of
{"payer", "email", "password"}) for the team accounts. They are never printed.
"""

from __future__ import annotations

import argparse
import json
import os
import urllib.error
import urllib.request
from datetime import UTC, datetime
from pathlib import Path

WEB = os.environ.get("DEMO_WEB_URL", f"http://localhost:{os.environ.get('WEB_PORT', '5180')}")
API = f"{WEB}/api"
HERE = Path(__file__).resolve().parent
PLAYS_FILE = HERE / "demo_plays.json"
ENV_FILE = HERE.parent / ".env"
ENV_KEYS = ("LOGIN_EMAIL", "LOGIN_PASSWORD", "TEAM_LOGINS")

MODES = {
    "Human": "human",
    "AI-assisted": "ai_assist",
    "Agent + approval": "agent_approval",
    "Bounded autonomous": "autonomous",
}
CONTROLS = {
    "Validation": "validation",
    "Confidence threshold": "confidence_threshold",
    "Human review": "human_review",
    "Audit log": "audit_log",
    "Exception handling": "exception_handling",
    "Pause / kill switch": "kill_switch",
    "Subgroup monitoring": "subgroup_monitoring",
}

# Opportunities beyond the first per executive: each executive brings two or three real ideas
# (requirements 3.25: "2-3 real opportunities per person"). Readiness is data/workflow/owner/controls.
EXTRA_OPPORTUNITIES = {
    "heritage": [
        {
            "participant": "Margaret Chen",
            "title": "Enterprise AI portfolio board with stage gates and named owners",
            "cls": "Foundation",
            "value": 4,
            "readiness": (4, 4, 5, 4),
            "hypothesis": "Every AI investment has a sponsor, a benefit measure and a stop rule; fewer stalled programs after OneView",
            "dependencies": "Executive team time; one benefit-tracking template",
            "risks": "Governance becomes a bottleneck if every pilot needs board time",
            "owner": "Chief Executive Officer",
            "next90": "Charter the board, inventory live and planned AI work and assign an executive owner to each",
            "foundations": ["Governance", "Adoption capability"],
        },
        {
            "participant": "Laura Whitman",
            "title": "AI benefit ledger tied to the 4-Star bonus and run-rate savings",
            "cls": "Foundation",
            "value": 3,
            "readiness": (4, 4, 4, 4),
            "hypothesis": "The CFO and board see realized value per program each quarter, not projected value",
            "dependencies": "Agreed baseline for each leading KPI; finance partner per program",
            "risks": "Benefits claimed twice across programs",
            "owner": "Chief Financial Officer",
            "next90": "Define the benefit ledger and back-test it on last year's pharmacy and IVR programs",
            "foundations": ["Governance"],
        },
        {
            "participant": "Renee Alvarez",
            "title": "Predictive gap-closure prioritization for Stars measures",
            "cls": "Predictive",
            "value": 5,
            "readiness": (2, 3, 3, 2),
            "hypothesis": "Outreach goes first to the members whose gap closure moves the rating most, per dollar of capacity",
            "dependencies": "Clean identity on the acquired books; pharmacist and care-manager capacity",
            "risks": "Model ranks easy members first and under-serves dual-eligible members",
            "owner": "Chief Quality Officer",
            "next90": "Backtest a ranking on last year's gaps for the core book only, with subgroup results",
            "foundations": ["Data integration", "Governance"],
        },
        {
            "participant": "Samuel Adeyemi",
            "title": "Model risk and subgroup-equity monitoring for member-facing AI",
            "cls": "Foundation",
            "value": 4,
            "readiness": (3, 3, 4, 3),
            "hypothesis": "Any model that contacts members is validated, monitored by subgroup and pausable by a named owner",
            "dependencies": "Model inventory; subgroup definitions agreed with quality",
            "risks": "Monitoring built after launch rather than before",
            "owner": "Chief Compliance Officer",
            "next90": "Publish the model inventory and a pause procedure for every member-facing campaign",
            "foundations": ["Governance", "Data integration"],
        },
        {
            "participant": "Joanne Pierce",
            "title": "Complaint root-cause classification across calls, appeals and surveys",
            "cls": "GenAI",
            "value": 4,
            "readiness": (4, 4, 4, 4),
            "hypothesis": "Complaint themes reach owners weekly instead of quarterly; complaint rate falls where we act",
            "dependencies": "Call transcripts and appeal text access; privacy review",
            "risks": "Misclassified themes send teams after the wrong cause",
            "owner": "VP Member Services",
            "next90": "Classify one quarter of complaints and compare themes with the quality team's manual review",
            "foundations": ["Knowledge architecture", "Governance"],
        },
        {
            "participant": "Grace Holloway",
            "title": "Appeal and grievance summarization for case workers",
            "cls": "GenAI",
            "value": 3,
            "readiness": (3, 3, 4, 3),
            "hypothesis": "Appeals cycle time shortens when case workers start from a sourced summary",
            "dependencies": "Appeals system access; reviewer sign-off on summary format",
            "risks": "Summaries omit a clinical detail that changes the decision",
            "owner": "VP Care Management",
            "next90": "Pilot with one appeals team and measure review time and reversal rate",
            "foundations": ["Knowledge architecture"],
        },
    ],
    "horizon": [
        {
            "participant": "Sam Whitaker",
            "title": "Shared data platform with lineage and quality gates",
            "cls": "Foundation",
            "value": 5,
            "readiness": (3, 3, 4, 3),
            "hypothesis": "Every model reads the same stitched member history with lineage and quality checks",
            "dependencies": "Prior-plan data agreements; engineering capacity",
            "risks": "Platform work crowds out model work for two quarters",
            "owner": "Chief Technology Officer",
            "next90": "Stand up lineage and quality gates on the member history feed first",
            "foundations": ["Data integration", "Governance"],
        },
        {
            "participant": "Omar Haddad",
            "title": "Adherence outreach targeting for thin-history members",
            "cls": "Predictive",
            "value": 4,
            "readiness": (3, 4, 4, 3),
            "hypothesis": "Pharmacist outreach reaches members who are actually non-adherent, not legacy members who already adhere",
            "dependencies": "Stitched prior-plan history; pharmacist capacity",
            "risks": "Thin-history members mis-scored and contacted in error",
            "owner": "VP Pharmacy",
            "next90": "Run the model silently for one quarter and compare its list with pharmacist judgment",
            "foundations": ["Data integration", "Adoption capability"],
        },
        {
            "participant": "Luis Ortega",
            "title": "Provider gap-alert copilot inside new-county practice workflow",
            "cls": "Copilot",
            "value": 5,
            "readiness": (3, 3, 4, 3),
            "hypothesis": "New-county providers act on gap alerts because they arrive in the visit workflow with an incentive",
            "dependencies": "Practice EHR access; incentive contract terms",
            "risks": "Alert fatigue; providers game the incentive measure",
            "owner": "Provider Network Lead",
            "next90": "Pilot in three new-county practices and track alert action rate",
            "foundations": ["Adoption capability", "Governance"],
        },
        {
            "participant": "Dr. Maya Thompson",
            "title": "Clinical review queue for AI-suggested interventions",
            "cls": "Automation",
            "value": 4,
            "readiness": (4, 4, 4, 4),
            "hypothesis": "Clinicians approve or reject suggested interventions in one queue, with the reason logged",
            "dependencies": "Named clinical reviewer; template catalog",
            "risks": "Review becomes a rubber stamp under volume",
            "owner": "Chief Medical Officer",
            "next90": "Stand up the queue for outreach message templates and review every one before send",
            "foundations": ["Governance", "Adoption capability"],
        },
        {
            "participant": "Raj Patel",
            "title": "AI program capital stage gates and benefit tracking",
            "cls": "Foundation",
            "value": 3,
            "readiness": (4, 4, 5, 4),
            "hypothesis": "Capital is released in stages against leading-KPI movement, not at program approval",
            "dependencies": "Baselines for each leading KPI",
            "risks": "Gates set too tight and good programs starve",
            "owner": "Chief Financial Officer",
            "next90": "Define three stage gates and apply them to the next two program requests",
            "foundations": ["Governance"],
        },
        {
            "participant": "Tessa Grant",
            "title": "Subgroup performance dashboard for every Stars measure",
            "cls": "Automation",
            "value": 4,
            "readiness": (4, 4, 5, 4),
            "hypothesis": "Quality sees gap closure by age, dual status, language and county every week",
            "dependencies": "Subgroup definitions; stitched history",
            "risks": "Small subgroups produce noisy signals",
            "owner": "Chief Quality Officer",
            "next90": "Publish the dashboard for adherence and blood-pressure measures",
            "foundations": ["Data integration", "Governance"],
        },
        {
            "participant": "Elena Novak",
            "title": "Contact-center agent assist for new-county members",
            "cls": "Copilot",
            "value": 3,
            "readiness": (2, 2, 3, 2),
            "hypothesis": "Faster answers for new-county members after the IVR fix lands",
            "dependencies": "Rebuilt knowledge base; IVR fix live",
            "risks": "Competes with the IVR program for the same operations capacity",
            "owner": "Chief Operating Officer",
            "next90": "Defer; revisit after the IVR fix shows abandonment below target",
            "foundations": ["Knowledge architecture"],
        },
    ],
    "communitycare": [
        {
            "participant": "Robert Ellis",
            "title": "Clinician Stars scorecard with AI-generated performance feedback",
            "cls": "Automation",
            "value": 4,
            "readiness": (4, 4, 5, 4),
            "hypothesis": "Each affiliated clinician sees their own gap closure and what moves it, tied to the incentive program",
            "dependencies": "Incentive program terms; attribution rules",
            "risks": "Clinicians read the scorecard as punitive and disengage",
            "owner": "Plan CEO",
            "next90": "Pilot the scorecard with two clinics and review reactions with clinic leaders",
            "foundations": ["Adoption capability", "Governance"],
        },
        {
            "participant": "Dr. Sofia Ramirez",
            "title": "Care-gap worklists ranked by predicted closure in the clinic huddle",
            "cls": "Predictive",
            "value": 5,
            "readiness": (4, 3, 4, 3),
            "hypothesis": "Each clinic starts the day with a short, ranked worklist instead of an unread portal",
            "dependencies": "Huddle workflow in each clinic; EHR inbox placement",
            "risks": "Alert fatigue if worklists are too long",
            "owner": "Chief Medical Officer",
            "next90": "Pilot daily worklists in three clinics and track action rate",
            "foundations": ["Adoption capability", "Data integration"],
        },
        {
            "participant": "Michelle Tan",
            "title": "Appointment slot optimization to release same-week access",
            "cls": "Automation",
            "value": 4,
            "readiness": (4, 4, 4, 4),
            "hypothesis": "Third-next-available falls because cancelled and low-value slots are re-offered to members with open gaps",
            "dependencies": "Scheduling system access; clinic rules for overbooking",
            "risks": "Optimization favors easy-to-book members over members with the largest gaps",
            "owner": "Clinic Operations Director",
            "next90": "Pilot re-offer of cancelled slots in two clinics and measure same-week access",
            "foundations": ["Adoption capability"],
        },
        {
            "participant": "Victor Lin",
            "title": "Consent, privacy and AI-use policy for clinic data",
            "cls": "Foundation",
            "value": 4,
            "readiness": (3, 3, 5, 3),
            "hypothesis": "Every AI use of clinic data has a documented basis, a minimum-necessary rule and a named owner",
            "dependencies": "Clinic legal review; affiliation agreements",
            "risks": "Policy written but not applied in clinic workflows",
            "owner": "Chief Compliance & Privacy Officer",
            "next90": "Publish the AI-use policy and inventory every AI data flow",
            "foundations": ["Governance", "Data integration"],
        },
        {
            "participant": "Thomas Greene",
            "title": "Capital model linking AI spend to access capacity and the Stars bonus",
            "cls": "Foundation",
            "value": 3,
            "readiness": (4, 4, 4, 4),
            "hypothesis": "Finance can show which AI and access investments move which measures and the bonus",
            "dependencies": "Agreed baselines; one benefit template across clinics and plan",
            "risks": "Benefits claimed by both the clinic and the plan",
            "owner": "Chief Financial Officer",
            "next90": "Build the model for the access program and the provider copilot",
            "foundations": ["Governance"],
        },
        {
            "participant": "Angela Brooks",
            "title": "Alert-fatigue monitor by clinic: overrides and alert burden",
            "cls": "Foundation",
            "value": 3,
            "readiness": (3, 3, 4, 3),
            "hypothesis": "Quality sees where clinicians stop acting on recommendations and tunes thresholds with them",
            "dependencies": "EHR alert logs; clinic lead participation",
            "risks": "Metric gamed by suppressing alerts",
            "owner": "Chief Quality Officer",
            "next90": "Baseline override rates before the copilot reaches clinicians",
            "foundations": ["Knowledge architecture"],
        },
    ],
}


def load_env_file() -> dict[str, str]:
    """Read only the credential variables this script needs; real environment variables win."""
    values: dict[str, str] = {}
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            key, sep, raw = line.partition("=")
            key = key.strip()
            if sep and key in ENV_KEYS:
                raw = raw.strip()
                if len(raw) >= 2 and raw[0] == raw[-1] and raw[0] in "'\"" and key != "TEAM_LOGINS":
                    raw = raw[1:-1]
                values[key] = raw
    for key in ENV_KEYS:
        if os.environ.get(key):
            values[key] = os.environ[key]
    return values


def call(method: str, path: str, token: str | None = None, body: object | None = None, soft: bool = False):
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
        if soft:
            return None
        raise SystemExit(f"{method} {path} failed: {e.code} {e.read().decode()[:400]}") from e
    except urllib.error.URLError as e:
        raise SystemExit(f"Cannot reach {WEB}. Start the app first with `make dev`.") from e


def sign_in(env: dict[str, str]) -> tuple[str | None, dict[str, str]]:
    """Facilitator account token and per-team account tokens, when the server requires sign-in."""
    status = call("GET", "/auth/status")
    if not status or not status.get("required"):
        return None, {}
    email, password = env.get("LOGIN_EMAIL"), env.get("LOGIN_PASSWORD")
    if not email or not password:
        raise SystemExit("Sign-in is on: set LOGIN_EMAIL and LOGIN_PASSWORD in backend/.env")
    fac = call("POST", "/auth/login", body={"email": email, "password": password})["token"]
    team_tokens: dict[str, str] = {}
    if env.get("TEAM_LOGINS"):
        try:
            entries = json.loads(env["TEAM_LOGINS"])
        except json.JSONDecodeError as e:
            raise SystemExit("TEAM_LOGINS must be a JSON list of {payer, email, password}") from e
        for entry in entries:
            team_tokens[entry["payer"]] = call(
                "POST", "/auth/login", body={"email": entry["email"], "password": entry["password"]}
            )["token"]
    return fac, team_tokens


def op_design(play: dict, steps: list[dict]) -> dict:
    """Operating-model design from the play: mode, controls and owner per step, agent steps fully specified."""
    cast = play["cast"]
    by_name = {s["name"]: s["id"] for s in steps}
    dims = {
        "authority": f"Agent recommends and queues; {cast['opsLead']} approves; {cast['coo']} can pause or shut it down",
        "accountability": f"{cast['cqo']} accountable; {cast['opsLead']} runs it daily",
        "controls": "Validation thresholds, human approval, audit log, exception queue",
        "data": "Claims, pharmacy, lab and ADT feeds; minimum-necessary access; lineage logged; seven-year retention",
        "adoption": "Analysts move from list building to exception review; workload and incentives reviewed quarterly",
        "monitoring": "Weekly error rate, drift, subgroup performance, complaints and realized gap closures",
    }
    out = []
    for s in play["opmodel"]["steps"]:
        mode = MODES[s["mode"]]
        out.append(
            {
                "step_id": by_name[s["name"]],
                "mode": mode,
                "controls": [CONTROLS[c] for c in s["controls"]],
                "owner": s["owner"],
                "dimensions": dims if mode in ("agent_approval", "autonomous") else {},
            }
        )
    return {
        "steps": out,
        "accountable_executive": play["opmodel"]["accountable"],
        "notes": play["opmodel"]["notes"],
    }


def crisis_response(play: dict, template: dict) -> dict:
    cast = play["cast"]
    owner, lead, cco = cast["coo"], cast["opsLead"], cast["cco"]
    stakeholders = ["members", "providers", "regulator", "board", "staff"] + (
        ["press"] if template.get("press") else []
    )
    return {
        "decision": "pause",
        "restart_criteria": f"Restart only after validation passes on a fresh sample, subgroup results are reviewed and {owner} signs off in writing.",
        "owner": owner,
        "operational_lead": lead,
        "authority": "Can stop any campaign, model or vendor feed immediately and approve emergency spend",
        "investigation": template["investigation"],
        "hypotheses": template["hypotheses"],
        "stakeholders": stakeholders,
        "disclosure": "immediate",
        "communication": f"Affected members hear first, today, by phone and letter from {lead}; providers by end of day; "
        f"the regulator within 24 hours from {cco}; the board Thursday from {owner}; staff are briefed before any press statement.",
        "protection": template["protection"],
        "resources": "Twenty service agents, two pharmacists and a data engineer for two weeks",
        "corrective_action": template["corrective"],
        "monitoring": f"Weekly error-rate, complaint and subgroup review by {cco} for two quarters",
    }


def opportunity_item(o: dict) -> dict:
    data, workflow, owner, controls = (
        o["readiness"].values() if isinstance(o["readiness"], dict) else o["readiness"]
    )
    return {
        "participant": o["participant"],
        "title": o["title"],
        "capability_class": o["cls"],
        "value_hypothesis": o["hypothesis"],
        "value": o["value"],
        "readiness": {"data": data, "workflow": workflow, "owner": owner, "controls": controls},
        "dependencies": o["dependencies"],
        "risks": o["risks"],
        "owner": o["owner"],
        "next_step": o["next90"],
        "foundations": o["foundations"],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--fresh", action="store_true", help="create a clean, started session")
    parser.add_argument("--name", default=None)
    args = parser.parse_args()

    data = json.loads(PLAYS_FILE.read_text(encoding="utf-8"))
    plays, crisis_templates = data["plays"], data["crisis"]["CRISIS"]
    fac_account, team_accounts = sign_in(load_env_file())

    name = args.name or ("Live demo" if args.fresh else "Demo — completed session")
    created = call("POST", "/sessions", fac_account, {"name": name, "seed": 42})
    sid, ftok = created["session"]["id"], created["facilitator_token"]
    stages = created["session"]["stages"]
    teams = {t["payer_id"]: t for t in created["session"]["teams"]}
    # Each team joins as its own account when sign-in is on; otherwise with the join code alone.
    tokens = {
        pid: call("POST", "/join", team_accounts.get(pid, fac_account), {"code": t["join_code"]})["token"]
        for pid, t in teams.items()
    }

    def simulate(year: int) -> None:
        # Entering a Simulate stage runs the year itself; only simulate if it has not run yet.
        if call("GET", f"/sessions/{sid}", ftok)["simulated_years"] < year:
            call("POST", f"/sessions/{sid}/simulate", ftok, {"year": year})

    def goto(kind: str) -> None:
        index = next(i for i, s in enumerate(stages) if s["kind"] == kind)
        call("POST", f"/sessions/{sid}/stage", ftok, {"action": "goto", "index": index})

    call("POST", f"/sessions/{sid}/stage", ftok, {"action": "start"})
    if args.fresh:
        goto("company")
    else:
        # Stage 2-3: meet the company, then diagnose with evidence from the data room.
        goto("company")
        goto("diagnose")
        for pid, play in plays.items():
            call("PUT", "/team/priorities", tokens[pid], {"priorities": play["priorities"]})

        # Stage 4: Round 1, each card with a named executive owner and staggered starts.
        goto("invest_r1")
        for pid, play in plays.items():
            items = []
            for line in play["round1"]["lines"]:
                item = {"investment_id": line["code"].lower(), "start_offset": line["start"], "owner": line["owner"]}
                if line.get("scope"):
                    item["scope"] = line["scope"]
                items.append(item)
            call("PUT", "/team/round1", tokens[pid], {"items": items, "thesis": play["round1"]["thesis"]})
            call("POST", "/team/round1/submit", tokens[pid])

        # Stage 5: Year 1 is simulated, reviewed by the facilitator, then released.
        goto("simulate_y1")
        simulate(1)
        call("POST", f"/sessions/{sid}/results/1/release", ftok)

        # Stage 6-7: analyze, board pitch scored on the rubric, Round 2 capital, Round 2 plan.
        goto("analyze")
        for pid, play in plays.items():
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
                    "note": "Board scored the 90-second pitch live and accepted the evidence-based suggestion.",
                },
            )
        call("POST", f"/sessions/{sid}/round2/grant", ftok)
        for pid, play in plays.items():
            actions = [
                {"action": "fund", "investment_id": f["code"].lower(), "start_offset": f["start"], "owner": f["owner"]}
                for f in play["round2"]["fund"]
            ]
            actions += [
                {"action": action, "investment_id": code.lower()}
                for code, action in play["round2"].get("decisions", {}).items()
            ]
            call("PUT", "/team/round2", tokens[pid], {"actions": actions, "thesis": play["round2"]["thesis"]})
            call("POST", "/team/round2/submit", tokens[pid])

        # Stage 8: Year 2.
        goto("simulate_y2")
        simulate(2)
        call("POST", f"/sessions/{sid}/results/2/release", ftok)

        # Stage 9: agent operating model.
        goto("operating_model")
        steps = call("GET", "/catalog")["workflow_steps"]
        for pid, play in plays.items():
            call("PUT", "/team/operating-model", tokens[pid], {"submit": True, "design": op_design(play, steps)})

        # Stage 10: the crisis each team's own choices triggered; a clean portfolio gets its company scenario.
        goto("crisis")
        call("POST", f"/sessions/{sid}/crisis/assign", ftok, {})
        for pid, play in plays.items():
            briefing = call("GET", "/team/crisis", tokens[pid], soft=True)
            if not briefing:
                call(
                    "POST",
                    f"/sessions/{sid}/crisis/assign",
                    ftok,
                    {
                        "team_id": teams[pid]["team_id"],
                        "event_id": play["fallbackCrisis"],
                        "severity": "low",
                        "note": "Clean portfolio: the facilitator applies the company scenario at low severity so the team rehearses incident leadership.",
                    },
                )
                briefing = call("GET", "/team/crisis", tokens[pid])
            call("POST", "/team/crisis/response", tokens[pid], crisis_response(play, crisis_templates[briefing["code"]]))

        # Stage 11-12: final scorecards released, then the debrief.
        goto("results")
        call("POST", f"/sessions/{sid}/scorecards/release", ftok)
        goto("debrief")

        # Stage 13: real-company translation. Each executive adds their own opportunities; the team consents.
        translate = next((s["kind"] for s in stages if "transl" in s["kind"]), None)
        if translate:
            goto(translate)
        now = datetime.now(UTC).isoformat()
        for pid, play in plays.items():
            items = [opportunity_item(o) for o in play["opportunities"] + EXTRA_OPPORTUNITIES[pid]]
            lead = items[0]["participant"]
            call(
                "PUT",
                "/team/opportunities",
                tokens[pid],
                {"consent": {"granted": True, "participant": lead, "at": now}, "items": items},
            )
            call(
                "POST",
                "/team/feedback",
                tokens[pid],
                {
                    "participant": lead,
                    "learning": 5,
                    "judgment_changed": True,
                    "usefulness_vs_presentation": 5,
                    "realism": 4,
                    "would_recommend": 9,
                    "comments": play["feedbackComment"],
                },
            )

    print(f"\nSession '{name}' ready.\n")
    print(f"  Facilitator console:  {WEB}/facilitator/{sid}?token={ftok}\n")
    print("  Team join codes (start page → Join your team):")
    for t in teams.values():
        print(f"    {t['payer_name']:<24} {t['join_code']}")
    if not args.fresh:
        print("\nParked at the translation stage: open Opportunity map → Synthesizer → Synthesize.")
    print("\nThe facilitator link contains a secret token — share it only with the facilitator.\n")


if __name__ == "__main__":
    main()
