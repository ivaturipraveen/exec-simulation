# CommunityCare Alliance — facilitator answer key (confidential; never shown to teams)

_Generated from content by `make paper-kit`. Content Pack v0.1 (Oct 8, 2026)._

## Hidden root causes
| ID | Root cause | What is actually happening | Evidence in the data room | Addressed by |
|---|---|---|---|---|
| C-RC1 | Recommendations land where nobody works | The plan's gap and risk recommendations are delivered to a plan portal with a 6% clinician open rate. The sponsoring system's clinicians live in the EHR inbox. Until recommendations are delivered inside the EHR workflow with an agreed owner, insight quality is irrelevant. | C-03 Quality initiative log<br>C-04 Gap recommendation delivery statistics<br>C-18 Clinician survey on plan requests<br>C-19 EHR inbox workflow study<br>C-22 System IT change request queue | I6, I11 |
| C-RC2 | Access, not awareness, caps screening and appointments | Breast screening outreach already reaches 78% of eligible members. Third-next-available appointment is 24 days and imaging slots are booked 6 weeks out. Getting Appointments and Care Quickly sits at 2 Stars for the same reason. More outreach raises complaints, not screening. | C-06 Member access survey<br>C-07 Transport and rural access analysis<br>C-09 Adherence program summary<br>C-10 Pharmacy network and mail-order usage<br>C-11 Refill reminder results<br>C-14 Complaint log with root-cause coding<br>C-15 Member outreach volume and response<br>C-17 Third-next-available appointment by clinic<br>C-27 Telehealth and extended-hours pilot results<br>C-30 Compliance review of outreach volume | I16 |
| C-RC3 | Affiliation is assumed to mean alignment | Plan and system leadership believe the shared ownership guarantees adoption. Clinicians receive no Stars-linked compensation and see plan requests as administrative burden. Care managers employed by the system report to clinic directors, not the plan. | C-02 Measure performance: employed vs independent PCPs<br>C-16 Clinician compensation summary (system HR)<br>C-25 Care management staffing and reporting lines<br>C-29 Joint governance charter (plan and system) | I15, I11 |

## Misleading surface signals
| ID | Signal | Why it misleads | Evidence |
|---|---|---|---|
| C-MS1 | Clinical data completeness is best-in-class | Predictive models validate beautifully on this data. Teams conclude that insight is the gap. It is not; action is. | C-20 Application and data inventory<br>C-21 Clinical data completeness report<br>C-23 Predictive model validation report |
| C-MS2 | Customer Service CAHPS at 4 Stars | Members like the people they reach. The problem is the appointment they cannot get, which shows up in a different CAHPS measure and in disenrollment. | C-08 Disenrollment reasons<br>C-12 Contact-center operations report<br>C-13 CAHPS results and verbatims |

## Signature trap: Assume affiliation guarantees adoption
Value comes from coordinated action (workflow placement, incentives, capacity), not from data possession. The signature failure is a provider copilot that produces excellent recommendations which clinicians ignore.

## Viable strategies (at least two must work)
- **Adoption-first:** Provider incentives (I15), workflow redesign (I11), provider copilot embedded in the EHR (I6) and access expansion (I16). Slower to show in leading KPIs, large Year 2 effect on access and screening.
- **Capacity-first:** Access expansion (I16), pharmacy capacity (I14), personalized engagement tuned to transport barriers (I7), governance (I10). Lifts appointments and adherence without depending on system IT.

## Failure modes
- **Insight-heavy:** Insight-heavy portfolio (I5, I6, I3) without I11 or I15: the ignored-recommendations crisis fires, adoption stays under 10%, measures flat.
- **Outreach-heavy:** Outreach-heavy portfolio (I7, I8) without I16: appointment demand rises, access measure falls a star, complaints rise.

## Crises that can fire for this team
- **E3 Clinically sound recommendations are ignored by providers** — Fires at high severity if I5 or I6 is live and neither I11 nor I15 is funded. Medium if one is funded. Low if both are funded.
- **E4 Model underperforms for a subgroup** — Available to any team with I3 or I6 live and no I12. Facilitator picks one team per session at most.
- **E5 Sensitive data sent to the wrong system** — Available to any team with I2 live and no I10.
- **E6 Hallucinated financial assumption reaches the board pack** — Facilitator may apply to a team whose board pitch cited a figure not present in the data room.
- **E7 Automated member message creates a reputational issue** — Available to any team with I7 live and no human review step in the operating model exercise.
