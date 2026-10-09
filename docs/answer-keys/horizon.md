# Horizon Health — facilitator answer key (confidential; never shown to teams)

_Generated from content by `make paper-kit`. Content Pack v0.1 (Oct 8, 2026)._

## Hidden root causes
| ID | Root cause | What is actually happening | Evidence in the data room | Addressed by |
|---|---|---|---|---|
| H-RC1 | History gap mis-targets everything | Members enrolled under 12 months are excluded from or mis-scored in adherence and gap models. Outreach lists over-represent legacy-county members who are already adherent and miss the new-county members driving the shortfall. Any predictive investment inherits this unless identity and history stitching from prior-plan data is funded first. | H-02 Measure performance by county cohort<br>H-05 Membership growth and tenure distribution<br>H-09 Adherence PDC distribution by tenure<br>H-10 Pharmacy outreach results, Q1 to Q2<br>H-19 Attribution confidence report<br>H-22 Prior-plan history ingestion proposal | I1 |
| H-RC2 | Digital-first engagement mis-segments | The engagement platform defaults to app and SMS. 61% of new-county members over 75 have never opened the app. Outreach reports show high 'reach' because the message was sent, not because anyone read it. Complaints are rising from members who receive messages intended for other households (shared phone numbers, address churn). | H-06 Segmentation model output<br>H-07 Member demographics by county<br>H-11 PBM refill reminder program summary<br>H-14 Complaint log with root-cause coding<br>H-21 Identity match rate report<br>H-23 Data quality exception report<br>H-28 AI inventory and model cards<br>H-29 Privacy incident log<br>H-30 Compliance audit observations | I1, I10 |
| H-RC3 | Providers in new counties have no reason to act | New-county contracts are fee-for-service with no quality incentive. Gap alerts go to a portal with 9% open rate. Blood pressure control sits at 2 Stars mainly because readings are not captured, not because members are uncontrolled. | H-04 Provider gap-alert portal statistics<br>H-16 Provider contract inventory by county<br>H-17 Blood pressure reading capture analysis<br>H-18 Provider relations call notes, new counties | I15 |

## Misleading surface signals
| ID | Signal | Why it misleads | Evidence |
|---|---|---|---|
| H-MS1 | App engagement looks excellent | A 44% monthly active rate is real but comes from healthy legacy-county members. Teams that invest in more digital engagement will see leading KPIs rise and measures barely move. | H-15 App engagement dashboard |
| H-MS2 | Call volume per member is low | Low volume reads as low demand. It is actually 11% abandonment and a vendor IVR that drops calls after 4 minutes. Complaints and CAHPS customer service are the downstream cost. | H-12 Contact-center vendor scorecard<br>H-13 CAHPS results and verbatims |

## Signature trap: Automate everything
Speed outpaces validation, governance and organizational readiness. The signature failure is a personalized engagement agent launched on bad identity data that sends inappropriate outreach to thousands of members.

## Viable strategies (at least two must work)
- **Foundation-light:** Fund identity resolution and prior-plan history stitching (I1), then predictive adherence (I3) and pharmacy capacity (I14) with governance (I10). Slower Year 1, strong Year 2.
- **Provider-first:** Fund provider incentives (I15) and provider performance intelligence (I5) to unlock blood pressure and screening in new counties, with contact-center copilot (I4) to arrest complaints. Faster Year 1 on clinical measures.

## Failure modes
- **Engagement-heavy:** Engagement-heavy portfolio (I7 plus I8) without I1 or I10: triggers the eligibility crisis at high severity and complaints fall to 1 Star.
- **Modernization-heavy:** Modernization-heavy portfolio (I2 plus I1) consumes all capacity and shows nothing by the board pitch; Round 2 capital is cut.

## Crises that can fire for this team
- **E1 Eligibility assumption drives inappropriate outreach to 11,400 members** — Fires at high severity if I7 or I8 is live and neither I1 nor I10 is funded. Medium severity if one of I1 or I10 is funded. Low severity (facilitator optional) otherwise.
- **E4 Model underperforms for a subgroup** — Available to any team with I3 or I6 live and no I12. Facilitator picks one team per session at most.
- **E5 Sensitive data sent to the wrong system** — Available to any team with I2 live and no I10.
- **E6 Hallucinated financial assumption reaches the board pack** — Facilitator may apply to a team whose board pitch cited a figure not present in the data room.
- **E7 Automated member message creates a reputational issue** — Available to any team with I7 live and no human review step in the operating model exercise.
