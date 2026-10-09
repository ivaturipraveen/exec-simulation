# Facilitator guide — MA AI Executive Simulation

> Draft v1 for Content Pack v0.1. Pair it with these:
> - `docs/paper-kit/00-facilitator-pack.md`: run-of-show, cuts, rubrics, register.
> - `docs/answer-keys/`: one per payer.
> - `docs/model.md`: how the simulation works.
> - `docs/calibration.md`: engine vs the pack's reference outcomes.

## What this is, and what it isn't (VIS-001)

Leadership practice in transformation decisions. Teams run a fictional Medicare Advantage plan, use AI as an analytical workforce, place scarce capital, and live with delayed, causal consequences.

It is **not** a prompt-engineering class, a coding lab, a vendor demo or a reproduction of the CMS calculation. Say so in the first five minutes.

Your job:
- Frame the rules and keep the time pressure on.
- Probe reasoning; never hand over answers.
- Score the rubrics. The engine and AI suggest; you decide.
- Adjudicate exceptions, always with an audit note.

## Before the session

1. Run `make setup` once. Then `make start` serves everything on `http://<host>:8800` (or `make dev` for development).
2. Check `.env`:
   - `ANTHROPIC_API_KEY` enables the Claude analyst and AI-suggested pitch scores. Without it, the analyst returns cited passages and the engine suggests scores.
   - Game rules: `ROUND2_MECHANIC=hybrid`, `ROUND2_BASE_MUSD=8.0`, `SIM_MODE=deterministic`, `INCLUDE_TRANSLATION=true`, `CONFIDENCE_BAND=0.20`.
3. Start page → **Facilitate** → create a session. Choose the Round-2 mechanic (hybrid is the pack default), the mode and a seed.
4. Project the **join codes** from the Run tab. One laptop per team is enough; everyone may join with the same code.
5. Print `docs/paper-kit/` as the fallback (pack 9.1, technology failure).
6. Never project the **Answer key** tab. Review the **Edition** tab: assumptions, crisis triggers and workflow notes.

## Running it (pack §9)

The Run tab shows, for every stage:
- the start time;
- the **"Say"** transition line;
- what happens and the output;
- the console actions;
- **Stage actions**: exactly what must happen before you move on.

If you fall 10 minutes or more behind at a checkpoint, the tab shows the pack's **contingency cut**.

| Time | Stage | Console | Probe |
|---|---|---|---|
| 0:00 | Setup | Start session | "Everything you do today is a hypothesis." |
| 0:12 | Meet your company | Next (5 orientation artifacts open) | "Three things are wrong that nobody has written down." |
| 0:27 | Diagnose | Watch *root causes evidenced*; at minute 15 a **Nudge** badge marks teams with no cited evidence | "What evidence would change your mind?" |
| 0:52 | Round 1 | Watch submissions; capacity warnings | "Your thesis in one sentence." |
| 1:10 | Simulate Year 1 | **Lock Round 1** at the time box, run Year 1, check the Results tab, then **Release Year 1 performance review** | "Leading indicators move first; measures lag." |
| 1:18 | Analyze | Teams draft the pitch; release extra evidence if needed | "Ask the AI why. Then ask what it is not sure about." |
| 1:32 | Round 2 + pitch | **Score** each 90-second pitch (rubric /15; flagged unsupported figures) → **Grant Round 2 capital** | "The board funds learning, not loyalty." |
| 1:50 | Simulate Year 2 | Run Year 2, check, **Release Year 2 performance review** | "Did adaptation change the trajectory?" |
| 1:58 | Operating model | Compress to steps 3–6 if behind; review scores | "Defend each line you drew." |
| 2:16 | Crisis | **Release recommended crisis to all**, or choose event and severity per team (note required) | "It is Monday morning." Never reward concealment. |
| 2:32 | Final results | **Release scorecards**, then the Results tab | "Who created sustainable value, and how do we know?" |
| 2:40 | Debrief | Answer key; simplification register lines | "Three things you believed at 9 am that you no longer believe." |
| 3:00 | Translation (optional) | Opportunity map → **Synthesize** | "Now your company. Same questions, real constraints." |

## Scoring you own (OD-08)

- **Board pitch** (5 rows × 0–3):
  - The dialog shows the team's pitch and a suggested score (Claude when configured) with a reason per row. Adjust any row, add a note, save.
  - Earned capital (defaults): 13–15 → +$4M, 10–12 → +$2M, 7–9 → +$1M. Tiers, base and mechanic are settings. A Round 2 base can be set per team (Teams tab) for playtests.
- **Operating model** (4 rows × 0–3): review from the Run tab (Stage actions). Engine findings are shown.
- **Crisis** (6 rows × 0–3): review from the Run tab. Concealment scores zero. Under 6/18, −10 on the total.
- **E6 (hallucinated figure):** if a pitch cites a dollar or percent figure absent from the data room and results, the console flags it and E6 becomes available for that team.

## Other tools (FUN-004)
Every action below needs an audit note and is logged.
- **Adjust capital** (Teams tab), e.g. for board bonuses or penalties.
- **Set the Round 2 base** per team.
- **Re-open** a pitch (before capital is granted), Round 2 (before Year 2), the op model or the crisis response.
- **Apply a curveball**: any applicable event and severity, e.g. E7 for a team whose op model has no human review.
- **Release evidence early** as a hint.
- **Rename a team** (Teams tab).
- **Delete opportunity data** on the organization's request (Opportunity map tab, OD-09).
- **Session settings** tab: change this session's configuration. Model and scorecard parameters lock once Year 1 is simulated.
- **Observation log** for the debrief.

## Results are reviewed before release (pack §9.2)
After each simulation, results stay hidden from teams ("Results are being reviewed") until you release them from the Run tab. Use the gap to check every team on the Results tab. Final scorecards have their own release at Final results.

## Settings
`/settings` (link on the start page; password is `ADMIN_PASSWORD` in `.env`) holds the defaults for new sessions: timings, the AI analyst, model parameters, scorecard weights and pilot targets. Each setting shows where its value comes from (content, `.env` or saved here) and its env var. A running session never changes when a default changes. Settings → **Content review** is where the content owner signs off the §12 checklist and the assumption rows, and the Edition tab shows that status.

## Projector view
Click **Projector** in the console header. It opens a read-only room view in a new window (drag it to the projector, then use the full-screen button in the bottom corner). It shows the stage, the executive question, the clock, the next stage, join codes at setup, each team's progress, and the scoreboard once you release scorecards. It never shows the answer key, scores in progress or overtime: the clock holds at 0:00.

## Playtest report
**Activity & exports → Playtest report** is rebuilt from the event log, including for sessions played before it existed. It shows:
- stage time against plan, with pauses excluded;
- each team's actions, AI questions, artifacts opened and submit times;
- forced submissions, and quiet spells over the stall threshold (8 minutes by default; set it in Settings → Facilitation);
- your observations, placed in the stage they happened in;
- the survey against the pilot targets.

Download the Markdown version after each playtest so the three can be compared.

## Pre-read
`docs/paper-kit/03-stars-primer.md` is the optional two-page Stars primer (OD-12). It is generated from the current settings.

## Debrief prompts
- Which hidden cause did you find, and from which artifacts? (The answer key lists the artifact IDs.)
- Where did a headline number mislead you?
- What did your Round 2 thesis change, and why? What did the board fund?
- Which control would have prevented your crisis?
- Where should a person decide in your real gap-closure workflow?
- What is one opportunity you will act on in 90 days?

## Exports
**Activity & exports** offers:
- **Executive summary** (Markdown): scorecards, pitches, decisions, crisis and the Opportunity Map.
- **Event log** (CSV).

## Troubleshooting
- **A team lost its screen:** re-enter the join code; all state is on the server.
- **A team is stuck before a simulation:** use *Force-submit drafts and simulate*.
- **The analyst is busy:** the limit is 20 questions per 10 minutes per team, and it resets itself.
- **A team has no crisis:** a clean portfolio may trigger none (pack 5.2). Assign a curveball from the Teams tab.
- **Network down:** switch to the paper kit; its forms mirror the software.
