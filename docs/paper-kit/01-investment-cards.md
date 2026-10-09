# Investment catalog — 18 cards
_Simulated, fictional training material. Stars values are illustrative and not predictive._

## I1 Member 360 and identity resolution
*Data foundation* — Resolve member identity across pharmacy, medical and CRM data into one governed record, including prior-plan history.

- **Cost:** $5.0M full scope; $2.5M scoped to one book or region · **Run cost:** $0.4M per year stewardship
- **Implementation:** 3 quarter(s); 4 capacity point(s) per quarter while building
- **Prerequisites:** None. Executive data owner named.
- **Effect at full execution:** No direct measure effect. Multiplies I3, I7, I8 by 1.4 and removes the identity penalty (0.6) on outreach-based investments.
- **Decay:** None if stewardship funded; identity drifts 2% per year otherwise
- **Risk exposure:** Scope creep; match-rule errors create new duplicates; source-system owners resist
- **Effectiveness:** Horizon Health: medium (Few systems, but prior-plan history stitching is the real need) · Heritage Medicare: high (The binding constraint for Lakeshore and Pinecrest) · CommunityCare Alliance: low (Identity is already clean on the shared EHR)
- **Synergies:** I2, I3, I7, I8 · **Conflicts:** Competes with I2 for the same data engineers (capacity)
- **Reversible:** Yes, but sunk cost

---

## I2 Data modernization and integration
*Data foundation* — Modern integration layer and near-real-time feeds that cut data latency for every later initiative.

- **Cost:** $6.0M · **Run cost:** $0.8M per year platform
- **Implementation:** 4 quarter(s); 5 capacity point(s) per quarter while building
- **Prerequisites:** None. Realistically needs I1 to deliver value.
- **Effect at full execution:** No direct measure effect. Reduces data latency; multiplies I5, I6, I8 by 1.3 from the quarter after completion. Lab feed coverage +30 pts (M4 leading KPI).
- **Decay:** None
- **Risk exposure:** Time to value; scope creep; competes with core platform migrations
- **Effectiveness:** Horizon Health: low (Stack is already modern; this is money spent twice) · Heritage Medicare: high (But four quarters is longer than the board will wait) · CommunityCare Alliance: medium (Payer-side data is weak, but system IT controls the EHR side)
- **Synergies:** I1, I5, I6, I8, I13 · **Conflicts:** I1 (capacity); Heritage claims platform migration
- **Reversible:** No

---

## I3 Predictive adherence intelligence
*Predictive AI* — Model that ranks members by risk of non-adherence so outreach reaches the right members before refills lapse.

- **Cost:** $1.75M · **Run cost:** $0.2M per year
- **Implementation:** 2 quarter(s); 2 capacity point(s) per quarter while building
- **Prerequisites:** 12 months of pharmacy history for the target population; I12 recommended
- **Effect at full execution:** M1 +2.5 pts, M2 +2.0 pts at full execution, only when outreach capacity (I14 or I8) exists. Without capacity, +0.5 pts.
- **Decay:** Model drift: effect falls 25% per year without I12
- **Risk exposure:** Bias against members with thin history; drift; targets the wrong members on bad identity data
- **Effectiveness:** Horizon Health: low (40% of members lack history; mis-targets without I1) · Heritage Medicare: medium (Right members are already known; capacity is the limit) · CommunityCare Alliance: medium (Good data, transport barriers limit response)
- **Synergies:** I1, I12, I14, I8 · **Conflicts:** None
- **Reversible:** Yes

---

## I4 AI contact-center copilot
*Copilot* — Real-time knowledge retrieval, guidance and summarization for member-services agents.

- **Cost:** $2.0M · **Run cost:** $0.35M per year
- **Implementation:** 2 quarter(s); 2 capacity point(s) per quarter while building
- **Prerequisites:** Knowledge base current (I17 or 1 quarter of cleanup); human review of generated responses
- **Effect at full execution:** M10 +2.5 pts; M11 -0.10; first-contact resolution +12 pts; handle time -15%. Halved without I17 or knowledge cleanup.
- **Decay:** Effect falls 30% per year if knowledge base is not maintained
- **Risk exposure:** Wrong answers to members on benefits; agent over-reliance; needs oversight sampling
- **Effectiveness:** Horizon Health: medium (Two vendors, two knowledge bases; abandonment is the IVR, not the agents) · Heritage Medicare: high (540 agents, legacy knowledge, biggest leverage) · CommunityCare Alliance: low (Service is already 4 Stars)
- **Synergies:** I17, I10 · **Conflicts:** None
- **Reversible:** Yes

---

## I5 Provider performance intelligence
*Predictive AI and analytics* — Attribution-aware provider scorecards and gap lists that focus provider relations where variation is greatest.

- **Cost:** $3.0M · **Run cost:** $0.3M per year
- **Implementation:** 2 quarter(s); 3 capacity point(s) per quarter while building
- **Prerequisites:** Attribution confidence above 85%; I2 improves latency
- **Effect at full execution:** M3 +3 pts, M4 +2 pts, M5 +2 pts when paired with I15 or value-based contracts; +0.5 pts each without.
- **Decay:** Low
- **Risk exposure:** Attribution disputes; provider trust; data latency makes reports stale
- **Effectiveness:** Horizon Health: low (Fee-for-service providers have no reason to look) · Heritage Medicare: high (35% of members under value-based contracts) · CommunityCare Alliance: medium (Rich data, no incentive; needs I15)
- **Synergies:** I15, I6, I2 · **Conflicts:** None
- **Reversible:** Yes

---

## I6 Provider copilot at point of care
*Copilot* — Gap and medication prompts delivered inside the clinician's EHR workflow at the point of care.

- **Cost:** $2.5M · **Run cost:** $0.4M per year
- **Implementation:** 3 quarter(s); 3 capacity point(s) per quarter while building
- **Prerequisites:** EHR integration path (system IT at CommunityCare; vendor at others); I11 for adoption
- **Effect at full execution:** M3 +4 pts, M4 +3 pts at full adoption. Adoption baseline 15%; 60% with I11; 85% with I11 plus I15. Effect scales with adoption.
- **Decay:** Alert fatigue: effect falls 20% per year without tuning (I12)
- **Risk exposure:** Alert fatigue; liability; clinicians ignore it; integration queue delays
- **Effectiveness:** Horizon Health: low (No EHR access to new-county providers) · Heritage Medicare: medium (Works for value-based groups only) · CommunityCare Alliance: high (Shared EHR; the only payer where this can be embedded in the inbox)
- **Synergies:** I11, I15, I5, I12 · **Conflicts:** CommunityCare system IT queue (2 quarters)
- **Reversible:** Yes

---

## I7 Personalized member engagement
*Generative AI and automation* — Generated, personalized outreach across app, SMS, mail and voice, tuned to each member's barriers.

- **Cost:** $2.25M · **Run cost:** $0.3M per year plus channel costs
- **Implementation:** 2 quarter(s); 2 capacity point(s) per quarter while building
- **Prerequisites:** Consent and channel preferences captured; I10 for message review; identity match above 95% or outreach misfires
- **Effect at full execution:** M1 +1.0, M2 +1.0, M5 +4 pts at full execution. On identity match under 90%: effect halved and M11 +0.15 (complaints rise).
- **Decay:** Response rates fall 15% per year without refresh
- **Risk exposure:** Inappropriate outreach; consent violations; channel mismatch for older or dual members; reputational incidents
- **Effectiveness:** Horizon Health: medium (Strong platform, wrong channels for new-county members; dangerous without I1) · Heritage Medicare: medium (Wrong addresses for 11% of members without I1) · CommunityCare Alliance: medium (Reach is not the problem; access is)
- **Synergies:** I1, I10, I3 · **Conflicts:** Raises demand that I16 must absorb at CommunityCare
- **Reversible:** Yes

---

## I8 Quality-gap orchestration agent
*Agent* — Agent that identifies open gaps, picks the intervention and triggers outreach and provider actions across channels.

- **Cost:** $4.0M · **Run cost:** $0.5M per year
- **Implementation:** 3 quarter(s); 4 capacity point(s) per quarter while building
- **Prerequisites:** Identity match above 95% (I1); defined decision rights (I10); integration to outreach and provider channels
- **Effect at full execution:** M1 +1.5, M2 +1.5, M3 +2, M5 +3 pts at full execution with prerequisites. Without I1 or I10: 40% of effect and a crisis trigger.
- **Decay:** Low with monitoring
- **Risk exposure:** Acts on bad data at scale; unclear ownership; member harm if autonomy is set too high
- **Effectiveness:** Horizon Health: medium (Modern integrations help; identity and provider inaction hurt) · Heritage Medicare: medium (Highest upside after I1; worst outcome before it) · CommunityCare Alliance: low (Orchestrates outreach into clinics that have no capacity)
- **Synergies:** I1, I10, I12, I14 · **Conflicts:** I7 (duplicate outreach if both run without coordination)
- **Reversible:** Partly; member-facing actions are not

---

## I9 Appeals and document intelligence
*Generative AI and automation* — Extraction, summarization and consistency checks for appeals case files before the Independent Review Entity sees them.

- **Cost:** $1.25M · **Run cost:** $0.15M per year
- **Implementation:** 2 quarter(s); 1 capacity point(s) per quarter while building
- **Prerequisites:** Human review on every decision; I12 for accuracy monitoring
- **Effect at full execution:** M12 +5 pts; appeals cycle time -40%; admin cost -$0.6M per year at Heritage scale.
- **Decay:** Low
- **Risk exposure:** Extraction errors; privacy; over-automation of decisions
- **Effectiveness:** Horizon Health: medium (Small volume) · Heritage Medicare: high (Two appeals systems, 2-Star measure) · CommunityCare Alliance: medium (Small volume)
- **Synergies:** I12, I10 · **Conflicts:** None
- **Reversible:** Yes

---

## I10 Enterprise AI governance and controls
*Governance* — Decision rights, model inventory, message review, kill switches and an accountable executive for every AI capability.

- **Cost:** $1.25M · **Run cost:** $0.3M per year
- **Implementation:** 1 quarter(s); 1 capacity point(s) per quarter while building
- **Prerequisites:** Named accountable executive; otherwise the investment is ceremonial (effect zero)
- **Effect at full execution:** No direct measure effect. Reduces crisis probability by 50% and severity by one level. Required for I8 full effect. Scores directly in Risk and Governance (15%).
- **Decay:** None if owned
- **Risk exposure:** Becomes a committee without authority
- **Effectiveness:** Horizon Health: high (No controls exist today) · Heritage Medicare: high (Many systems, many owners) · CommunityCare Alliance: medium (Fewer systems; clinical governance already exists)
- **Synergies:** I3, I4, I5, I6, I7, I8, I9 · **Conflicts:** None
- **Reversible:** Yes

---

## I11 Workflow redesign and change management
*Operating model* — Redesign the workflows where AI lands, with sponsors, role changes and reinforcement, so people actually use it.

- **Cost:** $3.0M · **Run cost:** $0.2M per year
- **Implementation:** 2 quarter(s); 2 capacity point(s) per quarter while building
- **Prerequisites:** Executive sponsor per redesigned workflow
- **Effect at full execution:** No direct measure effect. Sets adoption to 60% for I4, I6, I8 (baseline 15 to 30%). Scores in AI Transformation Maturity (15%).
- **Decay:** Adoption falls 10 pts per year without reinforcement (I18 reinforces)
- **Risk exposure:** Sponsorship fades; incentives conflict; treated as training instead of redesign
- **Effectiveness:** Horizon Health: medium (Small teams change fast; provider side untouched) · Heritage Medicare: medium (Large, slow, but value-based groups respond) · CommunityCare Alliance: high (The missing piece for everything clinical)
- **Synergies:** I4, I6, I8, I15 · **Conflicts:** None
- **Reversible:** Yes

---

## I12 Model validation and monitoring
*Governance* — Independent validation, drift and subgroup monitoring for every model in production.

- **Cost:** $1.0M · **Run cost:** $0.25M per year
- **Implementation:** 1 quarter(s); 1 capacity point(s) per quarter while building
- **Prerequisites:** At least one model in production
- **Effect at full execution:** No direct measure effect. Removes drift decay on I3, I6; halves probability of the subgroup-bias crisis; required for I9 full effect.
- **Decay:** None
- **Risk exposure:** Skills shortage; independence from the model builders
- **Effectiveness:** Horizon Health: high (Thin history makes bias likely) · Heritage Medicare: high (Dual-eligible subgroup risk) · CommunityCare Alliance: medium (Clinical governance already reviews models)
- **Synergies:** I3, I6, I8, I9 · **Conflicts:** None
- **Reversible:** Yes

---

## I13 ADT feeds and transitions-of-care program
*Data foundation and operations (non-AI)* — Real-time admission, discharge and transfer feeds from health systems plus transition nurses for 48-hour follow-up.

- **Cost:** $1.5M · **Run cost:** $0.4M per year (transition nurses)
- **Implementation:** 2 quarter(s); 2 capacity point(s) per quarter while building
- **Prerequisites:** Health system data-sharing agreements (1 quarter)
- **Effect at full execution:** M7 -1.5 at full coverage; 48-hour follow-up contact +35 pts; ADT latency to under 1 day.
- **Decay:** None
- **Risk exposure:** Health systems decline to share; follow-up capacity
- **Effectiveness:** Horizon Health: low (Readmissions already 4 Stars) · Heritage Medicare: high (The readmission lever) · CommunityCare Alliance: medium (Shared system covers most discharges already; gain is on the 18% outside it)
- **Synergies:** I2, I8 · **Conflicts:** None
- **Reversible:** Yes

---

## I14 Pharmacy outreach capacity and 90-day fill program
*Operations (non-AI)* — More pharmacists and outreach staff plus a 90-day fill conversion program.

- **Cost:** $1.2M per year · **Run cost:** Included
- **Implementation:** 1 quarter(s); 1 capacity point(s) per quarter while building
- **Prerequisites:** None
- **Effect at full execution:** M1 +2.0, M2 +1.5 pts on its own; doubles the realized effect of I3. Reaches 45% of at-risk members per quarter instead of 15%.
- **Decay:** Effect stops if funding stops
- **Risk exposure:** Hiring time; pharmacist labor market
- **Effectiveness:** Horizon Health: medium (Small at-risk list; new-county members hard to reach by phone) · Heritage Medicare: high (Capacity is the root cause (L-RC2)) · CommunityCare Alliance: medium (Transport, not calls, is the barrier for rural members)
- **Synergies:** I3, I8 · **Conflicts:** None
- **Reversible:** Yes

---

## I15 Provider quality incentive program
*Operating model (non-AI)* — Quality-linked incentive pool and contract amendments that give providers a reason to act on gaps.

- **Cost:** $2.0M per year (incentive pool and administration) · **Run cost:** Included
- **Implementation:** 2 quarter(s); 1 capacity point(s) per quarter while building
- **Prerequisites:** Contract amendments (2 quarters at Horizon; 1 quarter at CommunityCare via the system)
- **Effect at full execution:** M3 +3, M4 +2, M5 +2 pts; provider alert action rate +40 pts. Required for I5 and I6 to reach full effect at Horizon and CommunityCare.
- **Decay:** None while funded
- **Risk exposure:** Providers game measures; cost grows with success
- **Effectiveness:** Horizon Health: high (New-county contracts have no incentive today (H-RC3)) · Heritage Medicare: low (Already in place for 35%; marginal gain) · CommunityCare Alliance: high (Salaried clinicians have nothing tied to Stars (C-RC3))
- **Synergies:** I5, I6, I11 · **Conflicts:** None
- **Reversible:** Contractually slow

---

## I16 Access expansion: extended hours, telehealth, NP visit slots
*Operations (non-AI)* — Extended clinic hours, telehealth and nurse-practitioner slots, plus imaging capacity where needed.

- **Cost:** $2.5M · **Run cost:** $1.0M per year
- **Implementation:** 2 quarter(s); 2 capacity point(s) per quarter while building
- **Prerequisites:** Clinic or network agreement
- **Effect at full execution:** M9 +5 pts, M5 +3 pts (imaging slots), M11 -0.05 at CommunityCare; M9 +1.5 elsewhere. Third-next-available from 24 to 11 days.
- **Decay:** None while funded
- **Risk exposure:** Clinician recruitment; system priorities
- **Effectiveness:** Horizon Health: low (Access is not the constraint) · Heritage Medicare: low (Broad network; access varies by county) · CommunityCare Alliance: high (The root cause for appointments and screening (C-RC2))
- **Synergies:** I7, I8 · **Conflicts:** None
- **Reversible:** Yes

---

## I17 Member services knowledge base and IVR modernization
*Automation* — Replace the lapsed or failing IVR and rebuild the member-services knowledge base.

- **Cost:** $1.5M · **Run cost:** $0.2M per year
- **Implementation:** 2 quarter(s); 2 capacity point(s) per quarter while building
- **Prerequisites:** None
- **Effect at full execution:** Abandonment -7 pts; M10 +1.5 pts; M11 -0.08. Doubles the effect of I4.
- **Decay:** Low
- **Risk exposure:** Vendor transition; IVR cutover incidents
- **Effectiveness:** Horizon Health: high (Vendor IVR drops calls at 4 minutes (H-MS2)) · Heritage Medicare: high (Legacy IVR, lapsed contract (L-MS2)) · CommunityCare Alliance: low (Abandonment is 6%)
- **Synergies:** I4 · **Conflicts:** None
- **Reversible:** Yes

---

## I18 AI literacy and decision-rights program for leaders and managers
*Adoption* — Practical AI literacy plus explicit decision rights for leaders and managers who will own AI-enabled work.

- **Cost:** $0.5M · **Run cost:** $0.1M per year
- **Implementation:** 1 quarter(s); 0.5 capacity point(s) per quarter while building
- **Prerequisites:** None
- **Effect at full execution:** No direct measure effect. Adds 10 pts adoption to every copilot and agent; counts toward AI Transformation Maturity; reduces crisis response time (one rubric point).
- **Decay:** Refresh every year
- **Risk exposure:** Becomes a one-off training event
- **Effectiveness:** Horizon Health: medium (Lean leadership team; quick to train) · Heritage Medicare: high (Many managers, many hand-offs) · CommunityCare Alliance: medium (Joint plan-system leadership needs shared language)
- **Synergies:** I11, I10 · **Conflicts:** None
- **Reversible:** Yes

---
