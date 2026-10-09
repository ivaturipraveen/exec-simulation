# Medicare Advantage AI Executive Simulation — Project Guide

> **Source documents**
> 1. `docs/source/Medicare_Advantage_AI_Executive_Simulation_Requirements_v0.1.docx` (Aug 20, 2026): the concept baseline, i.e. *what* to build.
> 2. `docs/source/MA_AI_Executive_Simulation_Content_Pack_v0.1.docx` (Oct 8, 2026, Brightcone.ai for Girish Balsavar): the *game content and model rules*. It covers the payer bibles, measure model, 18-card catalog, model parameters, data rooms, crises, operating-model exercise, run-of-show, rubrics, simplification register and review checklist. Plain-text copy: `docs/source/content-pack-v0.1.txt`.
>
> **This guide** explains the whole project in plain language: what the documents ask for, what has been built, what is done (✅) and what is still open, and how to demo it. **Last updated:** 2026-10-09.
> The task tracker is [Part 7](#part-7--task-tracker); the demo script is [`DEMO_FLOW.md`](DEMO_FLOW.md).

**How to read this**

| If you want to… | Read |
|---|---|
| Understand the idea in 5 minutes | [Part 1](#part-1--the-project-in-plain-english) |
| See what exists today | [Part 2](#part-2--what-we-built) |
| See how the Content Pack was applied, section by section | [Part 3](#part-3--content-pack-v01-cross-check) |
| Check every requirement in the original docx | [Part 4](#part-4--requirement-checklist-docx-v01) |
| Know what is left and what needs a decision | [Part 5](#part-5--whats-pending-and-next-steps) |
| Run a demo | [`DEMO_FLOW.md`](DEMO_FLOW.md) |
| See every task | [Part 7](#part-7--task-tracker) |

**Status legend:** ✅ done and working · 🟡 built, needs an expert review or business decision · ⏳ pending · ❌ not started / out of scope

---

## Part 1 — The project in plain English

### 1.1 The one-paragraph version

This is a **3-hour, hands-on workshop game for senior healthcare executives**:
1. Teams of 3–5 leaders each run a **fictional US Medicare Advantage health plan**.
2. They investigate a **30-file data room** with an **AI analyst** (Claude) to find three hidden problems, past two misleading headline numbers.
3. They spend scarce capital on **18 investment cards**: AI, data foundations, governance, operations, incentives and access.
4. They live with **delayed, simulated results**, pitch the board for more capital, and change course.
5. They design **who does what between humans, AI and agents**, handle a **crisis their own choices triggered**, and finish by mapping **real AI opportunities for their own company**.

The aim is better judgment about AI investment. The workshop also opens a consulting conversation: assessment → roadmap → pilot.

> **The central challenge (docx):** *You are the leadership team of a Medicare Advantage plan. Improve Stars performance and enterprise value using AI, with limited capital, limited time, imperfect data, organizational constraints, and regulatory responsibilities. What will you do?*

### 1.2 Key terms (no healthcare background needed)

| Term | Meaning |
|---|---|
| **Medicare Advantage (MA)** | Private health plans that cover US seniors on the government's behalf. Each team plays one plan ("payer"). |
| **Star Ratings ("Stars")** | The government's 1–5 star quality score. **Crossing 4.0 Stars earns a bonus**: illustratively $600 per member per year (Horizon $31.4M, Heritage $258.6M, CommunityCare $56.9M). |
| **Measure (M1–M12)** | One of the 10 quality measures we model (out of 40+ real ones), e.g. M1 diabetes medication adherence, M7 readmissions, M11 complaints. Weights are 3 (outcomes), 2 (experience, complaints) or 1 (process). |
| **Threshold** | The value needed for each star on a measure. Ours are **game constructs**, not real CMS cut points. |
| **Leading KPI** | An operational signal that moves first (identity match rate, call abandonment, 48-hour follow-up). Measures follow a rating year later. |
| **Card (I1–I18)** | An investment option, from "Member 360 identity resolution" to "Provider quality incentives". |
| **Payer fit** | How well a card suits *this* company: High = 100%, Medium = 60%, Low = 30% of its effect. |
| **Capacity points** | Implementation bandwidth. A company has 10, 8 or 6 points per quarter; each card uses points while it is being built. Above 150% of supply, everything moves at half speed. |
| **Adoption** | For copilots and agents only: the share of people actually using the tool (15–30% baseline, 60% with workflow redesign, 85% with workflow plus incentives). |
| **Rating-year value vs projected path** | A measure realizes part of the effect in the next rating year (50–70%) and the rest the year after. The *projected path* is where it converges. |
| **Board pitch** | A 90-second pitch after Year 1, scored 0–15. It earns $0–4M on top of the $8M Round 2 base. |
| **Crisis (E1–E7)** | An event fired by the team's own portfolio (e.g. outreach on bad identity data). The response is scored on a 0–18 rubric. |
| **Facilitator** | The person running the workshop (Girish, as content owner and facilitator). |

### 1.3 Who it is for, and what they should walk away with

**Audience:** CEO, CFO, CIO/CTO, CMO, quality/Stars, operations, compliance, member experience and pharmacy leaders. No coding or AI expertise is needed.

**Participant promise (docx):** *"I understand where AI can materially change a Medicare Advantage business, what must be true for it to work, what risks I must manage, and how to prioritize investments."*

| Learning outcome | How the game teaches it |
|---|---|
| AI literacy (GenAI, predictive, copilot, automation, agent) | Every card is labelled with its class; the primer explains each one. |
| Value vs interesting technology | The same card is worth 30%–100% depending on payer fit, prerequisites and adoption. |
| Systems thinking | Results show the chain: card → leading KPI → measure (lagged) → Stars → bonus. |
| Transformation awareness | Cards need identity data, outreach capacity, incentives, workflow, named owners and governance. |
| Adaptability | The board pitch and Round 2 reward learning: pause, cancel or fund based on evidence. |
| Applying it to their own company | The Opportunity Map: 2–3 real opportunities per person, with readiness scores and a first 90-day step. |

### 1.4 The three fictional companies (Content Pack §2)

| | **Horizon Health** | **Heritage Medicare** | **CommunityCare Alliance** |
|---|---|---|---|
| Archetype | PE-backed challenger | 15-year legacy incumbent | Provider-sponsored plan |
| Members | 52,400 | 431,000 (three books) | 94,800 |
| Starting Stars | 3.0 | 3.5 (Lakeshore contract 3.0) | 3.5 |
| Round 1 capital | $18.0M | $15.0M | $12.0M |
| Capacity per quarter | 10 points | 8 points | 6 points |
| Hidden root causes | History gap mis-targets everything; digital-first engagement mis-segments; new-county providers have no reason to act | Identity mismatch poisons every list; adherence is capacity-capped, not insight-capped; readmissions are a data-latency problem | Recommendations land where nobody works; access (not awareness) caps screening; affiliation is assumed to mean alignment |
| Misleading signals | App engagement looks excellent; low call volume | Enterprise adherence looks like 4 Stars; CAHPS looks stable | Clinical data completeness is best-in-class; Customer Service at 4 Stars |
| Signature trap | **Automate everything** | **Modernize everything before value** | **Assume affiliation guarantees adoption** |
| Viable strategies | Foundation-light; Provider-first | Sequenced foundation; Operational value first | Adoption-first; Capacity-first |

### 1.5 The workshop journey: 180 minutes plus an optional 25 (Content Pack §9)

```
 0:00 ─ 0:12   SETUP & BRIEFING      "You are the leadership team… Everything you do today is a hypothesis."
 0:12 ─ 0:27   MEET YOUR COMPANY     briefing + first 5 data-room files
 0:27 ─ 0:52   DIAGNOSE              full data room + AI analyst → top 3 priorities WITH cited artifact IDs
 0:52 ─ 1:10   INVESTMENT ROUND 1    cards · scope · start quarter · named owners · capacity check · thesis
 1:10 ─ 1:18   SIMULATE YEAR 1       engine runs → performance review (leading KPIs move; measures lag)
 1:18 ─ 1:32   ANALYZE               explainer + challenger agents; draft the board pitch
 1:32 ─ 1:50   ROUND 2 + BOARD PITCH 90-sec pitch → rubric /15 → $8M base + up to $4M earned → reallocate
 1:50 ─ 1:58   SIMULATE YEAR 2       results with a projected path to 4.0 (±20% band)
 1:58 ─ 2:16   AGENT OPERATING MODEL 9-step gap closure: human / AI-assisted / agent+approval / autonomous
 2:16 ─ 2:32   CRISIS                engine picks the event YOUR choices triggered → 15-min response /18
 2:32 ─ 2:40   FINAL RESULTS         five-dimension scorecard, cross-team comparison
 2:40 ─ 3:00   DEBRIEF               lessons by dimension and archetype; simplification register
 3:00 ─ 3:25   TRANSLATION (opt.)    each participant: 2–3 real opportunities → organizational Opportunity Map
```

If the session runs late, the console suggests the pack's **contingency cuts**:
- Analyze cut to 8 minutes.
- Operating model compressed to steps 3–6.
- One shared crisis for all teams.
- Skip the cross-team comparison.

### 1.6 How the simulation decides what happens (Content Pack §5)

```
                     EVERY QUARTER, FOR EVERY CARD
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │ BUILD   progress += 1/duration × capacity multiplier                         │
 │         (capacity multiplier = supply ÷ demand, capped at 1; 0.5 if > 150%)  │
 │                                                                              │
 │ LIVE    the quarter after go-live, the card moves its leading KPIs and:      │
 │                                                                              │
 │   effect = base × payer fit × rule multipliers × adoption × owner            │
 │                 (H 1.0/M 0.6/L 0.3)  (e.g. I14 ×2 on I3)  (copilots/agents)  │
 │            × capacity × decay × variable-mode draw                           │
 │                                                                              │
 │ STACK   cards on the same measure: 100% / 60% / 30%, capped at headroom     │
 │ UNINTENDED  side effects (complaints, appointment demand) and drift          │
 └──────────────────────────────────────────────────────────────────────────────┘
          │                                                      │
          ▼                                                      ▼
 Leading KPIs (quarterly)                       Measures: rating year = lag share × this
 identity match · at-risk contacted ·           year's effect + rest of last year's;
 abandonment · 48-h follow-up · …               projected path = full effect
          │                                                      │
          └──────────────────────────────┬───────────────────────┘
                                         ▼
          Stars (weighted 3/2/1, rounded to ½) → bonus progress → scorecard
          After Year 2 the engine recommends a crisis (E1–E7) from the portfolio.
```

**Worked example: Heritage and predictive adherence (I3, base effect M1 +2.5)**

| Portfolio | Effect on M1 | Why |
|---|---|---|
| I3 alone | **+0.18** | Fit Medium ×0.6; no outreach capacity ×0.2 (L-RC2); identity under 95% without I1 ×0.6 (L-RC1) |
| I3 + I14 (pharmacy capacity) | **+1.8** | Capacity unlocks it: ×2.0 instead of ×0.2 |
| I3 + I14 + I1 (identity) | **+2.0** (capped) | Identity penalty removed, ×1.4; capped at Heritage's two-year headroom of +2.0 |
| Plus I12 (validation) | holds +2.0 | Without I12 the model drifts −25% a year |

The lesson the pack wants: **sequence foundations and capacity before the AI.**

### 1.7 How teams win (Content Pack §10)

| Dimension | Weight | What it captures |
|---|---|---|
| Stars trajectory | 30% | Lift ÷ two-year headroom across the 10 measures, plus the projected path to 4.0 |
| Member outcomes & experience | 20% | M3, M4, M7, M9, M10, M11 lift; equity modifier (dual-eligible share of the lift); member-harm incidents |
| Financial performance | 20% | Progress to the 4-Star bonus; run-rate savings; spend discipline and write-offs |
| AI transformation maturity | 15% | Foundations live, adoption, decision rights; the operating-model exercise is 40% |
| Risk & governance | 15% | Owned governance, validation, subgroup monitoring, privacy; the crisis rubric is 50% |

**Guardrails:**
- A crisis rubric under 6/18 costs **−10 points**.
- Member harm with no corrective action caps Risk at **20**.
- Capacity above **150%** caps AI maturity at **50**.
- **Concealment scores zero** on the crisis rubric.
- Overspend is impossible: the ledger blocks it.

### 1.8 Out of scope by design (docx)
Not a prompt-engineering or coding class, a vendor demo, an exact CMS formula, a tool for real patients, an autonomous AI platform, a video game, or a final investment recommendation.

---

## Part 2 — What we built

### 2.1 The system at a glance

```
     PEOPLE                         THE APP (runs on one laptop)                   BEHIND THE SCENES
 ┌──────────────┐          ┌──────────────────────────────────────┐       ┌─────────────────────────┐
 │ Facilitator  │─────────▶│ Facilitator console                  │       │ Simulation engine       │
 │ (laptop /    │          │ run-of-show · scripts · cuts · clock │       │ Content Pack §5 formula,│
 │  projector)  │          │ pitch & crisis rubrics · answer key  │       │ deterministic/variable  │
 └──────────────┘          └────────────────┬─────────────────────┘       ├─────────────────────────┤
 ┌──────────────┐          ┌────────────────▼─────────────────────┐       │ AI (Claude)             │
 │ Team 1 ──────┼─────────▶│ Game server (FastAPI)                │──────▶│ analyst · challenger ·  │
 │ Team 2 ──────┼─────────▶│ sessions · ledger · rubrics · audit  │       │ explainer · pitch coach │
 │ Team 3 ──────┼─────────▶│ live updates (WebSocket)             │       │ · pitch scoring · synth │
 └──────────────┘          └────────────────┬─────────────────────┘       ├─────────────────────────┤
  (browser + join code)    ┌────────────────▼─────────────────────┐       │ Content (YAML)          │
                           │ Team workspace (React)               │       │ 3 payers · 10 measures ·│
                           │ briefing · data room · analyst ·     │       │ 18 cards · 14 KPIs · 7  │
                           │ diagnose · invest · pitch · results ·│       │ crises · 13 stages · 90 │
                           │ op model · crisis · scorecard · map  │       │ data-room files         │
                           └──────────────────────────────────────┘       ├─────────────────────────┤
                                                                          │ SQLite (local file)     │
                                                                          └─────────────────────────┘
```

### 2.2 The nine building blocks

| # | Block | What it does | Status |
|---|---|---|---|
| S1 | **Content** | The whole Content Pack as validated YAML: payers, measures, cards with rule-based effects, KPIs, crises with severity rules, run-of-show, rubrics, assumptions, simplifications and data rooms. Every cross-reference is checked, and design-rule warnings are reported. | ✅ |
| S2 | **Simulation engine** | The §5 formula: capacity, go-live lag, payer fit, dependency multipliers, adoption, owners, diminishing returns, headroom caps, decay, drift, side effects, lag shares, Lakeshore sub-rating, crisis selection, three rubrics and the scorecard. Deterministic or variable mode. | ✅ |
| S3 | **Game server** | Sessions, join codes, stage clock and schedule tracking, ledger, Round 1/2, board pitch and hybrid capital, operating model, crisis, overrides with audit notes, and env-configurable rules. | ✅ |
| S4 | **AI layer** | Grounded analyst with four scripted roles plus free-form. It refuses unsourced figures (OD-07), suggests pitch scores (OD-08) and synthesizes the Opportunity Map. Live-tested. | ✅ |
| S5 | **Team workspace** | 12 screens (2.3); refreshed executive design; light and dark; works on laptops and phones. | ✅ |
| S6 | **Facilitator console** | Run, Teams, Answer key, Results, Opportunity map, Activity and Edition tabs. | ✅ |
| S7 | **Activity log** | Every question, document view, decision, score and override, as learning evidence. | ✅ |
| S8 | **Exports** | Executive summary (Markdown) and event log (CSV). | ✅ |
| S9 | **Paper kit + answer keys** | Team packs, 18 card sheets, crisis packets with rubric, facilitator pack (run-of-show, cuts, rubrics, register) and answer keys, all generated from content. | ✅ |

### 2.3 Screens

**Team workspace**

| Screen | What it's for |
|---|---|
| Company briefing | Hero header, current-stage banner (question, transition line, output), key numbers, profile table, mandate, advantages and constraints, starting scorecard with thresholds and headroom, leading KPIs, leadership tensions |
| Stars & AI primer | Stars basics, scoring, five AI classes, the 10 measures with leading indicators and lag, glossary, simplification register |
| Data room | 30 artifacts per company in 8 domains, with IDs (H-01…), formats (memo, table, dashboard, log, survey, model card, audit, deck, contract), filter and viewer; five open at Meet your company, all at Diagnose |
| AI analyst | Analyst, Challenger, Explainer, Pitch coach and Translator roles; cites artifact IDs |
| Diagnose | Top 3 priorities, each with cited artifacts |
| Invest | 18 cards with payer fit, effect text, prerequisites, risks, decay and scopes; cart with scope, start quarter and named owner; live ledger; quarter-by-quarter capacity chart; warnings |
| Board pitch | Five structured fields, cited evidence, word count and 90-second timer, unsupported-figure check, rubric and capital tiers, final score |
| Results | Year rating vs projected path (±20% band), Lakeshore sub-rating, clues, unintended consequences, KPI chart and table, drivers per card (multipliers in plain words), measures table with stars and gap to next star, capacity, financials |
| Operating model | 9 steps, four modes, seven controls and an owner per step; six decision dimensions for every agent step; rubric score and findings; compressed mode |
| Crisis | Packet text, severity, time box, six-part response form mapped to the rubric; afterwards "what actually happened" and best practice |
| Scorecard | Total, five dimensions with drivers, crisis effects and guardrails |
| Results (gated) | Each year's review appears only after the facilitator releases it ("Results are being reviewed" until then); scorecards after the explicit release at Final results |
| Opportunity map | Pack 10.3 fields: value hypothesis, value 1–5, readiness (data, workflow, owner, controls), dependencies, risks, owner, first 90-day step, foundations. Quadrant grid, foundational band, consent, feedback survey |

**Facilitator console**
- **Run:**
  - Timeline with start times.
  - Review before release (pack §9.2): release each year's performance review, then the final scorecards.
  - Lock a round at the time box (applies every team's valid draft).
  - "Say" transition script, console actions and notes.
  - Behind-schedule tracker with contingency cuts.
  - Year simulation.
  - Pitch scoring dialog (AI or engine suggestion, 0–3 per row, audit note, capital preview) and the grant.
  - Op-model compression toggle and rubric review.
  - Crisis recommendation per team (event, severity, probability) with override note.
  - Team cards with a minute-15 "no evidence yet" nudge.
- **Teams:** diagnosis, theses, portfolio with owners and start/live quarters, pitch, overrides (capital, Round 2 base, rename team, re-open, manual curveball), evidence release.
- **Answer key:** root causes with their supporting artifact IDs, misleading signals, trap, viable strategies, failure modes.
- **Results:** scoreboard and dimension profile.
- **Opportunity map:** organizational map plus the AI synthesizer; delete all opportunity data on request (OD-09, audit note).
- **Activity:** pilot indicators, exports, log.
- **Edition:** assumptions log with sign-off status, §12 review checklist status, simplification register, content warnings, crisis triggers, contingency cuts, workflow facilitator notes.
- **Session settings:** this session's configuration snapshot. Changes need an audit note; model and scorecard parameters lock after Year 1.

**Settings (`/settings`, admin password from `backend/.env`)**
- About 70 settings in six groups: Session defaults, Facilitation, AI analyst, Model parameters (§5), Scorecard (§10.1 weights), Pilot targets.
- Each setting shows its source (content file, `backend/.env`, or saved in the UI), its env var name, and whether it applies live or to new sessions. Reset returns it to the `backend/.env`/content value.
- Content review: confirm or change each §12 checklist item and each assumption row, with a note.
- Sessions: every session with an "Open console" link. System: version, database (masked), AI model, whether a key is set (never the key).
- Precedence: `content/game.yaml` → `backend/.env` → saved in Settings. Secrets (`ANTHROPIC_API_KEY`, `SECRET_KEY`, `ADMIN_PASSWORD`) are `backend/.env`-only.

**Start page:** agenda built from the run-of-show; create a session with the payers to include and team names, and defaults taken from Settings.

### 2.4 Content that exists

| Item | Count | Where |
|---|---|---|
| Payers | 3 (3 root causes, 2 misleading signals, trap, 2 viable strategies, 2 failure modes each) | `content/payers/` |
| Measures | 10 (M1–M5, M7, M9–M12) + 2 in reserve | `content/measures.yaml` |
| Leading KPIs | 14 | `content/kpis.yaml` |
| Investment cards | 18 (I1–I18) | `content/investments.yaml` |
| Crisis events | 7 (E1–E7) with severity rules and effects | `content/events.yaml` |
| Stages + contingency cuts | 13 (180 + 25 min) + 5 | `content/stages.yaml` |
| Workflow steps / controls / dimensions | 9 / 7 / 6 | `content/workflow.yaml` |
| Rubrics | crisis (6 rows), pitch (5 + capital tiers), op model (4) | `content/rubrics.yaml` |
| Assumptions, simplifications, Opportunity Map rules, reference portfolios | 25 / 10 / 1 / 12 | `content/reference.yaml` |
| Data-room artifacts | 90 (30 per payer) | `content/dataroom/` |
| Answer keys, paper kit, calibration report | 3 / 6 / 1 | `docs/` |

### 2.5 Quality and safety

**Automated checks**
- `make check`: 56 backend tests (content fidelity to the pack, every §5 rule, section 5.2 reference outcomes, crisis triggers, viable-beats-failure for every payer, no single card dominates, full API session, security, WebSocket) plus 10 frontend tests, strict types, lint and formatting.
- `make e2e`: a browser test that plays a session through the real UI, including the board pitch and facilitator scoring.
- `make test-live`: live Claude checks (grounding, no cross-company leaks, resists prompt extraction, refuses unsourced figures).
- `make calibrate`: writes `docs/calibration.md`, the engine vs the pack's illustrative outcomes.

**Security**
- Signed, scoped tokens; never in URLs or logs. WebSocket authenticates in-band.
- Teams never receive root causes, rules or triggers.
- Every override needs an audit note.
- Secrets live only in `backend/.env`.

**Configuration (`backend/.env`):**
- Ports and storage.
- Secret and AI key, model, effort and limits.
- Game rules: `SIM_MODE`, `ROUND2_MECHANIC`, `ROUND2_BASE_MUSD`, `CONFIDENCE_BAND`, `SIM_DEFAULT_SEED`, `INCLUDE_TRANSLATION`, `PITCH_AI_SUGGEST`, `OPPORTUNITY_RETENTION_DAYS`.

Blank values fall back to `content/game.yaml`.

---

## Part 3 — Content Pack v0.1 cross-check

Every section of the Content Pack, where it lives, and its status.

| § | Content Pack section | Implemented as | Status |
|---|---|---|---|
| 1 | Assumptions log (OD-01…OD-12, A-13…A-18) | `content/reference.yaml`; Edition tab; facilitator pack. All 18 rows applied (180+25 run-of-show; hybrid capital; 10 measures; normalized scoring; hybrid AI; AI-suggested pitch score; Opportunity Map privacy; deterministic plus variable mode; no pre-work) | ✅ |
| 2 | Payer bibles | Full profile table, population, mandate, advantages, constraints, 3 root causes, 2 misleading signals, trap, starting scorecard with headroom and root-cause links, viable strategies, failure modes | ✅ |
| 3 | Measure model (10 measures) | Units, thresholds, data period, lag share, leading indicators, causal pathway; starting values and stars match the pack exactly (tested) | ✅ (1-Star floor added, see B-01) |
| 4 | Investment catalog (18 cards) | Every field: class, cost (scoped I1, per-year I14/I15), quarters, capacity, prerequisites, effect, run cost, decay, risk, payer fit with reason, synergies, conflicts, reversibility. Effects encoded as rules (e.g. "I3 without I14 or I8: +0.5 only") | ✅ |
| 5 | Model parameters | Quarterly state machine; progress × capacity; go-live then KPIs the next quarter; effect formula; dependency multipliers (I1 ×1.4, I2 ×1.3, I14 ×2, I17 ×2, I15 unlock); diminishing 100/60/30; headroom caps; decay; crisis logic; hybrid capital; uncertainty (deterministic midpoint, variable ±20%, displayed ±20% band) | ✅ |
| 5.1 | Payer effectiveness matrix | `payer_fit` per card (High 1.0 / Medium 0.6 / Low 0.3) | ✅ |
| 5.2 | Reference portfolios + regression suite | 12 named portfolios plus 6 generic per payer (do-nothing, all-foundation, all-AI, all-operations, max-overrun, balanced); `make calibrate` compares with the pack | ✅ (differences listed in 3.1) |
| 6 | Data rooms (30 per payer, 8 domains) | 90 artifacts written from the spec in the formats listed, each tagged to its root cause, signal or neutral; release layers; design rules checked (no warnings after the R-03 draft) | ✅ |
| 7 | Crisis events E1–E7 and rubric | Severity rules exactly as written; I10 halves probability and lowers severity; E4 one team per session; E6 when the pitch cites an unsupported figure; E7 when op-model human review is missing; effects on the final scorecard; 6-row 0–3 rubric; concealment scores zero | ✅ |
| 8 | Operating-model exercise | 9 steps with facilitator notes; 4 options; 6 decision dimensions per agent step; 4 rows scored 0–3; autonomy never scores; compressed mode for the contingency cut | ✅ |
| 9 | Run-of-show and console actions | 13 stages with start times, transition scripts, outputs and console actions; 24 lecture minutes; contingency cuts with a live behind-schedule tracker; Diagnose minute-15 nudge | ✅ |
| 10 | Scorecard, pitch rubric, Opportunity Map | Five dimensions and normalization as written; guardrails; 15-point pitch rubric and capital tiers; Opportunity Map fields, quadrant rules, foundational band, consent, 12-month retention, synthesizer | ✅ |
| 11 | Simplification register | Primer (teams), Edition tab and facilitator pack (with the lines to say) | ✅ |
| 9.2 | "Review before release" | Results and scorecards are held until the facilitator releases them (B-10); teams see "being reviewed" | ✅ |
| 4 (I6, I13) | Lead times ("2-quarter IT queue", "data-sharing agreements") | `lead_quarters` per card and payer delays the build without using capacity (B-08) | ✅ |
| 4 (I11) | Adoption decays without reinforcement | −10 points a year unless I18 literacy is live (configurable) | ✅ |
| 4 (I12) | "Halves E4 probability" | `probability_halved_by` on the event, not hardcoded | ✅ |
| OD-09 | Deletion on request | Console button deletes every captured opportunity and consent, with audit note | ✅ |
| OD-12 | Two-page Stars primer | `docs/paper-kit/03-stars-primer.md`, generated from the live config | ✅ |
| — | Everything configurable | No game numbers hardcoded in the UI: pitch limits, nudge minute, capacity cap, fit and diminishing returns, score weights, pilot targets and quadrant cut-offs all come from content/Settings | ✅ |
| 12 | Review checklist for Girish | RC-1…RC-9 in `content/reference.yaml`; sign off in Settings → Content review; status shown in the Edition tab | ⏳ owner review |

### 3.1 What we found while implementing the pack (review items for Girish)

| # | Finding | What we did |
|---|---|---|
| R-01 | Measures have thresholds for 2–5 Stars only, but the pack expects "complaints fall to 1 Star" | Added a 1-Star floor per measure (e.g. complaints ≥ 0.80) — **B-01** |
| R-02 | Heritage's starting values compute to a 3.08 summary (3.0 Stars), not the stated 3.5 | +0.20 "unmodelled measures" adjustment so the baseline is 3.5 and Lakeshore 3.0 — **B-02**. Alternative: change a threshold |
| R-03 | L-RC2 has only two supporting artifacts, both in pharmacy (design rule: 3+ across 2+ domains) | **Draft applied, pending review:** L-25 *Operating cost by function* (finance) now supports L-RC2. It shows adherence runs on 6 pharmacists and $3.4M against a $41M contact center. No artifact text changed; revert by setting `supports: neutral`. L-11 was not used because it backs L-MS1 |
| R-04 | Some §5.2 illustrative outcomes can't come from the pack's own rules (e.g. CommunityCare adoption-first "overall 4.0": M3/M4 would need more than their headroom to gain a star; Heritage "full modernization… E2 high" vs the E2 rule "low if I1 full scope in Round 1") | Rules followed as written; E2 "before I1" read as "I1 not live by end of Year 1". Full comparison in `docs/calibration.md` |
| R-05 | I4: card says "halved without I17"; §5 says "I17 ×2.0 on I4" | Applied §5 (×2.0 with I17). This makes Horizon provider-first reach 3.5, as illustrated |
| R-06 | Adoption scales only copilots and agents (I4, I6, I8) | Per the card texts — **B-05** |
| R-07 | The pack doesn't say when the crisis happens relative to Year 2 | Crisis effects land on the final scorecard — **B-04** |
| R-09 | The pack names what each scorecard dimension captures but not the weights inside it | Weights are build assumptions, editable in Settings → Scorecard (must sum to 1) — **B-09** |
| R-10 | Lead times in card text (I6 IT queue, I13 agreements) had no engine field | `lead_quarters` added — **B-08** |
| R-08 | Drifts (Heritage abandonment slide, Horizon complaints) | Heritage complaints +0.125/yr and Customer Service −0.75/yr; Horizon complaints +0.05/yr, unless I17 or I4 is live — **B-07**. Heritage do-nothing slips to 3.0, as the pack's L-MS2 implies |

---

## Part 4 — Requirement checklist (docx v0.1)

Every requirement ID in the original document. Content Pack decisions are marked "pack".

### 4.1 Vision, audience, learning (§2–4)

| ID | The doc asks for… | Where it's met | Status |
|---|---|---|---|
| VIS-001 | Leadership and decision practice, not prompt or code training | Landing page, primer, facilitator guide | 🟡 copy review |
| VIS-002 | Credible MA context; document simplifications | Pack measure model and payer bibles; simplification register in app and kit | 🟡 SME review |
| VIS-003 | Front door to a consulting journey | Opportunity Map, synthesizer, summary; optional-follow-up framing | ✅ |
| AUD-001 | Mixed business and IT leaders, no technical knowledge | Plain-language primer, glossary, card summaries | ✅ |
| AUD-002 | Functional priorities conflict | 3 leadership tensions per payer | ✅ |
| LRN-001 | Assess through decisions and artifacts | Cited priorities vs root causes, thesis v1/v2, pitch, rubrics, log | ✅ |
| LRN-002 | Concepts as trade-offs and consequences | Rules, side effects, drift, crises, guardrails | ✅ |

### 4.2 Companies and Stars engine (§5–6)

| ID | The doc asks for… | Where it's met | Status |
|---|---|---|---|
| PAY-001 | Briefing, visible pros and cons, hidden causes discoverable | Pack bibles + 30-artifact data rooms + answer keys | ✅ |
| PAY-002 | Population changes difficulty and response | Dual share drives the equity modifier; channel responsiveness; payer fit | ✅ |
| PAY-003 | No universally superior payer; several viable strategies | Two viable strategies per payer beat failures and do-nothing (tested) | ✅ |
| STR-001 | 8–12 selected measures with rationale | 10 per pack OD-04 | 🟡 SME |
| STR-002 | Leading indicators; Stars don't move immediately | 14 KPIs; go-live then next quarter; lag shares | ✅ |
| STR-003 | Methodology note + simplifications | `docs/model.md`, register | 🟡 SME |
| STR-004 | SME review and refresh process | — | ⏳ N-3 |

### 4.3 Data room and AI (§7)

| ID | The doc asks for… | Where it's met | Status |
|---|---|---|---|
| DAT-001 | ≥ 3 hidden causes and ≥ 1 misleading signal per payer | 3 causes and 2 signals each across 30 artifacts | ✅ |
| DAT-002 | AI grounded, states uncertainty and gaps | Cited artifact IDs; evidence/inference/uncertainty; refuses unsourced figures | ✅ |
| DAT-003 | Log questions, evidence, decisions | Event log + CSV | ✅ |
| DAT-004 | No real PHI | All fictional and labelled | ✅ |

### 4.4 Investments and capital (§8–9)

| ID | The doc asks for… | Where it's met | Status |
|---|---|---|---|
| INV-001 | 15–20 investments beyond technology | 18 cards, 6 non-AI operational | ✅ |
| INV-002 | Cost, time, prerequisites, capacity, benefit, risk, fit | Every pack field | ✅ |
| INV-003 | Conditional, non-fixed benefits | Rules, adoption, capacity, diminishing returns, ranges | ✅ |
| CAP-001 | Two rounds separated by evidence | Round 1 → Year 1 → Analyze → pitch → Round 2 | ✅ |
| CAP-002 | Scale, modify, pause, cancel, redirect | Fund, pause, resume, cancel (with reversibility), name an owner, scope, stagger | ✅ |
| CAP-003 | Record the thesis change | Required Round 2 thesis; pitch | ✅ |
| CAP-004 | Test Round-2 mechanics | Hybrid (pack default), fixed, differentiated; base per team | ✅ pack OD-02 |

### 4.5 Flow, operating model, governance, crisis (§10–13)

| ID | The doc asks for… | Where it's met | Status |
|---|---|---|---|
| FLW-001 | Timeboxes, countdowns, scripts, cuts | Pack run-of-show; transition scripts; cut tracker | ✅ |
| FLW-002 | Lecture ≤ 20–30 min | 24 minutes | ✅ |
| FLW-003 | 180-minute boundary | 180 + optional 25 (pack OD-01); `INCLUDE_TRANSLATION` toggle | ✅ pack |
| OPS-001 | Human/AI roles and decision rights per step | 9 steps × 4 modes + 6 dimensions per agent step | ✅ |
| OPS-002 | Score value, controls, adoption, recoverability, not autonomy | 4-row rubric; fully autonomous at step 4 scores low (tested) | ✅ |
| GOV-001 | Governance as mechanics | I10/I12 rules; owner-less I10 is ceremonial; crisis probability and severity | ✅ |
| GOV-002 | Controls vary by consequence, autonomy, sensitivity, reversibility | Required controls by mode, risk, member-facing and sensitive steps | ✅ |
| GOV-003 | ≥ 1 effective investment that harms without controls | I7 and I8 (complaints, E1), I3/I6 (E4), I2 (E5) | ✅ |
| CRS-001 | Crisis tied to prior decisions; facilitator control | Severity rules; recommend → confirm/override with note | ✅ |
| CRS-002 | Timed response | Time box per event; 6-part form | ✅ |
| CRS-003 | Never reward concealment | Concealment = 0 on every row; −10 if under 6 | ✅ |

### 4.6 Scorecard and consulting (§14–15)

| ID | The doc asks for… | Where it's met | Status |
|---|---|---|---|
| SCO-001 | Multi-dimensional, traceable, with uncertainty | Five dimensions with drivers; ±20% band on measures and the projected Stars | ✅ |
| SCO-002 | Penalties for critical risk, harm, invalid plans | Pack guardrails | ✅ |
| SCO-003 | Fair comparison across payers | Lift ÷ headroom; benefit ÷ bonus value | ✅ |
| CON-001 | Capture ideas during the workshop | Opens at session start | ✅ |
| CON-002 | 2–3 per person plus organization view | Per-participant capture; aggregate map; foundational band; synthesizer | ✅ |
| CON-003 | Follow-on optional | Wording in app and summary | ✅ |

### 4.7 Platform, model, methodology (§16–18)

| ID | The doc asks for… | Status |
|---|---|---|
| FUN-001 Save and recover state · FUN-002 Ledger (no overspend) · FUN-003 Explain without formulas · FUN-004 Overrides with audit note · FUN-005 Paper fallback · FUN-006 Content separate from engine | ✅ |
| MOD-001 Documented equations · MOD-002 Dependency multipliers · MOD-003 Diminishing returns, delay, capacity, subgroups, side effects · MOD-004 Regression suite | ✅ |
| CMS-001 Measure memo · CMS-002 Simplification register · CMS-003 Dated baseline and owner | 🟡 SME / owner |
| CMS-004 "Simulated / projected" labels | ✅ |
| CMS-005 SME review before external pilots | ⏳ N-3 |

### 4.8 Design acceptance (§21)

| V1 is ready when… | Status |
|---|---|
| Three complete payer profiles with causes, evidence maps and traps | ✅ |
| 8–12 measure model on a dated baseline with a register | 🟡 SME |
| Balanced 15–20 card catalog with conditional effects and non-tech options | ✅ |
| Two-round, ~3-hour run of show that **survives three paper playtests** | ⏳ playtests (T-094) |
| Model and test suite with multiple viable strategies | ✅ |
| Guide, briefs, data rooms, forms, reviews, workflow exercise, packets, scorecards, Opportunity Map template | ✅ |

---

## Part 5 — What's pending and next steps

### 5.1 Needs from you / Girish (Content Pack §12 review checklist)

| # | Item | Status |
|---|---|---|
| N-1 | Anthropic API key | ✅ done |
| N-2 | Confirm or change the 18 assumption rows, especially OD-01 (duration), OD-02 (capital) and OD-07 (AI boundaries); and the B-01…B-10 build assumptions. Sign off in **Settings → Content review** | ⏳ |
| N-3 | Confirm the ten measures, weights and names against current CMS Technical Notes; decide on colorectal or ED follow-up; name the independent Stars reviewer (CMS-005) | ⏳ |
| N-4 | Adjust thresholds and starting values so each payer sits where the narrative needs it (see R-02) | ⏳ |
| N-5 | Check that the root causes ring true and that no archetype is obviously superior | ⏳ |
| N-6 | Sanity-check card magnitudes and payer multipliers against `docs/calibration.md` (see R-04, R-05) | ⏳ |
| N-7 | Adjust crisis-packet tone; add missing real-world events | ⏳ |
| N-8 | Rehearse transition scripts; cut what doesn't sound like you | ⏳ |
| N-9 | Approve the 90 data-room artifacts for realism, and the R-03 draft (L-25 → L-RC2) | ⏳ |
| N-10 | Product name/branding; consent and retention legal wording | ⏳ |

### 5.2 Remaining product gaps
- A Postgres option for hosted pilots (T-102). Migrations are in place (T-101), so this is now a driver and a URL.
- Hosting, sign-in and HTTPS, only if the app runs beyond one laptop.

Decision for now (2026-10-09): the current assumption values (OD, A and B rows) stay as the working defaults until Girish's review. Nothing waits on that review except the content edits themselves.

### 5.3 Recommended next steps
1. Girish works through 5.1 in Settings → Content review, with `docs/calibration.md` and the paper kit.
2. Run **3 internal playtests** (app or paper). Open the projector view for the room, log observations in the console, and download the **Playtest report** from Activity & exports after each one.
3. Apply content edits; they are YAML changes, not code.
4. SME review, then a friendly-client pilot.

---

## Part 6 — Demo

The step-by-step demo script is **[`DEMO_FLOW.md`](DEMO_FLOW.md)**.

```bash
make dev    # http://localhost:5180
make demo   # fully played session (prints the facilitator link + join codes)
```

---

## Part 7 — Task tracker

The single place where work is tracked. Pick the next unchecked task, build it, run `make check`, tick it off.
Legend: `[x]` done · `[~]` draft · `[ ]` to do · `(C)` content or expert task · `★` added after the original list.

**▶ Current focus:** internal playtests (T-094) with the projector view and playtest report. Girish's review (5.1) runs in parallel; current values stay as defaults until then.

### Phase 0–8 — V1 build (docx)
- [x] T-001…T-004 Local foundation (repo, tooling, `.env`, API conventions)
- [x] T-010…T-019 Content model, payers, measures, conflict hooks, catalog, data rooms, crises, run-of-show, workflow, game config
- [x] T-020…T-027 Engine, effects, lag, risk, scorecard, regression suite, CLI
- [x] T-030…T-038 DB, stage machine, ledger, Round 2, event log, overrides, access control, evidence release
- [x] T-050…T-058 Participant app, briefing, data room, invest, results, pitch form, countdown, primer, diagnose
- [x] T-056 Facilitator console
- [x] T-060…T-064 AI analyst, modes, adversarial tests, guardrails
- [x] T-070…T-074 Learning evidence, workflow canvas, crisis, scorecard, equity
- [x] T-080…T-086 Opportunity capture and map, exports, feedback, consent, paper kit, analytics

### Phase 9 — Content, credibility, playtest
- [~] **T-090** (C) Positioning copy + facilitator guide *(VIS-001)*
- [x] **T-091** Simplification register (pack §11) in app, kit and Edition tab
- [ ] **T-092** (C) SME reviews, dated baseline owner *(STR-004, CMS-003, CMS-005)* — N-3
- [x] **T-093** Run-of-show, scripts and contingency cuts (pack §9; OD-01 assumed)
- [ ] **T-094** Internal playtest ×3 (app + paper)
- [x] ★ T-095…T-110 E2E tests, production build, code-split, traversal guard, live AI evals, `.env` config, demo tooling, docs

### Phase 10 — Content Pack v0.1 alignment ★ (2026-10-09)
- [x] **T-111** Content schema v1: conditions vocabulary, card rules, KPIs, severity rules, rubrics, stages with scripts, reference data
- [x] **T-112** Payer bibles (§2) with profiles, root causes, signals, strategies, failure modes, drifts, Lakeshore segment
- [x] **T-113** Measure model (§3): 10 measures, thresholds, lag shares, leading indicators
- [x] **T-114** 18-card catalog (§4) with rule-based effects, scopes, per-year costs, owners
- [x] **T-115** Engine port to §5: capacity, go-live lag, formula, multipliers, adoption, diminishing returns, headroom, decay, drift, side effects, lag shares, variable mode, ±20% band *(closes T-107)*
- [x] **T-116** 90 data-room artifacts (§6) with manifests, release layers, design-rule warnings
- [x] **T-117** Crisis events E1–E7 (§7): severity rules, I10 adjustment, effects, 6-row rubric, concealment zero
- [x] **T-118** Operating-model exercise (§8): 6 decision dimensions, 0–3 rubric, compressed mode, E7 trigger
- [x] **T-119** Run-of-show (§9): 13 stages, transition scripts, console actions, contingency tracker, minute-15 nudge *(supersedes T-108)*
- [x] **T-120** Scorecard (§10.1) with guardrails; board pitch (§10.2) with rubric, capital tiers, AI-suggested score, unsupported-figure check (E6)
- [x] **T-121** Opportunity Map (§10.3): readiness dimensions, quadrant rules, foundational band, retention purge, synthesizer
- [x] **T-122** Assumptions log and simplification register in app, kit and Edition tab
- [x] **T-123** Regression suite + `make calibrate` (§5.2) and review findings R-01…R-08
- [x] **T-124** Env-configurable game rules (`SIM_MODE`, `ROUND2_*`, `CONFIDENCE_BAND`, `INCLUDE_TRANSLATION`, `PITCH_AI_SUGGEST`, `OPPORTUNITY_RETENTION_DAYS`, `AI_EFFORT`)
- [x] **T-125** UI refresh: navy shell, company hero, stage banner, card redesign, capacity chart, rubric views, workflow designer, crisis packet, answer key, Edition tab
- [x] **T-126** Paper kit and generated answer keys for v1 content; demo script, e2e and API tests updated
- [x] ★ **T-099** Projector mode (polish after playtest feedback still to come)
- [x] ★ **T-101** DB migrations with Alembic · [ ] ★ **T-102** Postgres option

### Phase 11 — Settings and re-check ★ (2026-10-09)
- [x] **T-130** Settings screen (`/settings`): ~70 settings, source badges, env var names, reset, admin login (`ADMIN_PASSWORD`, rate-limited)
- [x] **T-131** Per-session config snapshot + Session settings tab (audit note, locks after Year 1)
- [x] **T-132** Review before release (§9.2): release per year, release scorecards, team "being reviewed" state
- [x] **T-133** Lock round at the time box; rename team; delete opportunity data (OD-09)
- [x] **T-134** Engine: lead quarters (I6, I13), I11 adoption decay, I12 → E4 from content, paused-card shares and scoring weights in config
- [x] **T-135** Hardcoding sweep: UI reads `rules` (capacity, pitch, fit, weights, targets, nudge), quadrant cut-offs, agenda, segment target
- [x] **T-136** §12 review checklist (RC-1…RC-9) with sign-off; B-08…B-10 assumptions
- [x] **T-137** Two-page Stars primer in the paper kit (OD-12)

### Phase 12 — Playtest readiness ★ (2026-10-09)
- [x] **T-101** Alembic migrations: baseline `0001`, run on start, existing local databases adopted without data loss, `make db-upgrade` / `db-current` / `db-revision`; a test fails if models change without a migration
- [x] **T-140** Playtest report (T-094 support): stage time vs plan (pauses excluded), team actions, AI questions, artifacts, submit times, forced submissions, stalls, observations, pilot targets, auto findings; JSON and Markdown export. Stall and overrun thresholds are settings
- [x] **T-099** Projector view (`/projector/:id`, **Projector** button in the console): stage, executive question, clock that holds at 0:00 instead of showing overrun, next stage, join codes at setup, team progress, final scoreboard once released. Read-only, no hidden mechanics
- [x] **T-141** R-03 draft: L-25 supports L-RC2; content warnings now empty
- [ ] **T-094** Internal playtest ×3, using the above

---

## Appendix — commands and file map

| Command | What it does |
|---|---|
| `make dev` | Start the app (web :5180, API :8800); Settings at `/settings` |
| `make start` | Production-style single server on :8800 |
| `make demo` / `make demo-fresh` | Create a played / clean demo session |
| `make check` | All automated checks |
| `make e2e` | Browser end-to-end test (real AI calls when a key is set) |
| `make test-live` | Live AI checks (uses API credits) |
| `make sim-compare` | Regression-suite matrix |
| `make calibrate` | Engine vs pack §5.2 → `docs/calibration.md` |
| `make paper-kit` | Printable kit + answer keys |
| `make validate-content` | Validate content, list design warnings |
| `make db-upgrade` / `make db-current` | Apply / show database migrations (the app also migrates on start) |
| `make db-revision m="…"` | Create a migration after changing a table model |

```
Exec Simulation/
├── README.md · Makefile · .editorconfig
├── backend/.env                 ← API configuration (game rules, AI, ADMIN_PASSWORD); never committed
├── frontend/.env                ← dev port, API proxy target, VITE_API_URL; never committed
├── content/                     ← game.yaml · measures · kpis · investments · events · stages · workflow ·
│                                  rubrics · reference · payers/ · dataroom/ (90 artifacts)
├── backend/app/                 ← game server (FastAPI)
├── backend/sim/                 ← simulation engine (Content Pack §5)
├── backend/migrations/          ← Alembic schema history
├── frontend/src/                ← team workspace, facilitator console, projector, settings (React)
├── docs/                        ← REQUIREMENTS.md · DEMO_FLOW.md · facilitator-guide.md · model.md ·
│                                  calibration.md · paper-kit/ · answer-keys/ · source/ (v0.1 docx + text)
└── data/                        ← local SQLite database
```
