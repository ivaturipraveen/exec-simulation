# Heritage Medicare — facilitator answer key (confidential; never shown to teams)

_Generated from content by `make paper-kit`. Content Pack v0.1 (Oct 8, 2026)._

## Hidden root causes
| ID | Root cause | What is actually happening | Evidence in the data room | Addressed by |
|---|---|---|---|---|
| L-RC1 | Identity mismatch poisons every list | Acquired books use different member IDs and address standards. 11% of members are duplicated or unmatched. Gap lists are wrong for those members, outreach mail goes to old addresses, and predictive models train on fragmented records. The core-book numbers look fine, which hides the problem. | L-04 Gap-closure campaign results<br>L-07 Member identity reconciliation study<br>L-14 Complaint log with root-cause coding<br>L-19 Provider data quality: attribution and NPI mismatches<br>L-21 Identity match rate report by source pair<br>L-23 Data ownership matrix<br>L-30 Internal audit: data governance | I1 |
| L-RC2 | Adherence is capacity-capped, not insight-capped | The pharmacy adherence program is well designed and already targets the right members. Six pharmacists reach 15% of the at-risk list per quarter. A better model adds nothing until outreach capacity or automation of refill reminders is funded. | L-09 Pharmacy adherence program design and results<br>L-10 Pharmacist staffing and call capacity<br>L-25 Operating cost by function | I14, I8 |
| L-RC3 | Readmissions are a data latency problem | Care managers learn of 60% of discharges from claims 9 days later, after the 7-day follow-up window. ADT integration with the three missing health systems would move the readmission measure more than any AI investment. | L-17 ADT feed coverage by health system<br>L-18 Transitions of care audit<br>L-29 Privacy and data-sharing agreements | I13 |

## Misleading surface signals
| ID | Signal | Why it misleads | Evidence |
|---|---|---|---|
| L-MS1 | Enterprise adherence looks like 4 Stars | The blended number is 87.5%. Core book is 89.2%, Lakeshore is 82.1%. Teams that read the enterprise view under-invest in adherence and lose the Lakeshore contract rating. | L-02 Measure performance by book of business<br>L-11 Refill gap analysis by book |
| L-MS2 | CAHPS looks mid-pack and stable | Customer Service at 87 reads as acceptable. Abandonment is 14% and rising since the IVR vendor contract lapsed. Complaints per 1,000 are at 3 Stars now and will drop a star within a year without action, regardless of AI investment. | L-08 Disenrollment analysis<br>L-12 Contact-center operations report<br>L-13 CAHPS trend and verbatims |

## Signature trap: Modernize everything before value
A $6M data modernization plus $5M identity program consumes all capacity for a year, shows no measure movement at the board pitch, and loses Round 2 capital. The lesson is to sequence foundations and near-term value: identity for Lakeshore only, ADT feeds, pharmacy capacity.

## Viable strategies (at least two must work)
- **Sequenced foundation:** Identity resolution scoped to Lakeshore (I1 at partial scope), ADT feeds and transitions program (I13), pharmacy capacity (I14), governance (I10). Round 2 adds predictive adherence (I3) once identity is clean.
- **Operational value first:** Contact-center copilot (I4) with IVR modernization (I17) to stop the complaints slide, appeals intelligence (I9) to fix the 2-Star appeals measure, ADT feeds (I13). Foundations in Round 2 with earned credibility.

## Failure modes
- **Full modernization:** Full modernization (I1 full scope plus I2) in Round 1: capacity overrun 160%, nothing live by the pitch, the data reconciliation crisis fires at high severity.
- **Predictive-heavy:** Predictive-heavy portfolio (I3, I5, I8) on unmatched identity: models look accurate in validation, outreach goes to the wrong members, complaints rise.

## Crises that can fire for this team
- **E2 Acquired-plan member data cannot be reconciled; flagship initiative slips six months** — Fires at high severity if I3, I5 or I8 is funded before or without I1. Medium severity if I1 is funded at partial scope. Low severity if I1 is funded at full scope in Round 1.
- **E4 Model underperforms for a subgroup** — Available to any team with I3 or I6 live and no I12. Facilitator picks one team per session at most.
- **E5 Sensitive data sent to the wrong system** — Available to any team with I2 live and no I10.
- **E6 Hallucinated financial assumption reaches the board pack** — Facilitator may apply to a team whose board pitch cited a figure not present in the data room.
- **E7 Automated member message creates a reputational issue** — Available to any team with I7 live and no human review step in the operating model exercise.
