> Simulated, fictional data for executive education. Not real PHI.

# Privacy Incident and Near-Miss Log

**Source:** Compliance shared mailbox and Relay CRM grievance notes (there is no incident management system)
**Period:** January 2025 to August 2026
**Owner:** Denise Fairbanks, Chief Compliance Officer (Privacy Officer role held by the Chief Compliance Officer; no dedicated privacy staff)

## Status

Horizon has **no formal privacy incident process**: no intake form, no severity criteria, no risk-assessment template for deciding about breach notification, and no required timeline. Entries below were reconstructed from email in August 2026 at the request of the Audit and Risk Committee.

## Log

| # | Date reported | Reported by | Description | Members affected | Classification | Actions taken | Closed |
|---|---|---|---|---|---|---|---|
| 1 | 2026-02-12 | Contact-center agent (Meridian CX) | **Near-miss: outreach to the wrong household.** A refill reminder text naming a diabetes medication was sent to a phone number now used by an unrelated household. The recipient called the plan. The text named the drug but not the member. | 1 confirmed; Data Engineering found 38 other members on the same campaign whose numbers were shared with another household | Near-miss (informal) | Agent updated the phone number in CRM. The update was overwritten by the nightly core-admin sync 3 days later. Campaign not paused. | Not formally closed |
| 2 | 2026-06-04 | Member's daughter, by email to the CEO's office | **Near-miss: outreach to the wrong household.** Welcome kit and a "your care checklist" letter listing open screenings (mammogram, A1c test) were mailed to a member's former address, now occupied by another Horizon member's family. | 2 members | Near-miss (informal) | Apology letter sent. Address corrected. No check of other members at the same address. Legal consulted informally by phone; no written risk assessment. | 2026-06-20 |
| 3 | 2025-08-19 | Data Engineering | Test campaign in Pulsewise Engage sent a sample message to 14 internal staff. No member data. | 0 | Not an incident | None needed | 2025-08-19 |

## Related signals (not logged as incidents)

| Source | Signal |
|---|---|
| Complaint log (H-14) | 29 complaints coded "wrong household" from January to August 2026 |
| Data quality report (H-23) | 2,400 households share a phone number with an unrelated household |
| Pulsewise Engage | No suppression rule for shared phone numbers or undeliverable addresses |
| Contact center | No call-reason code for "message meant for someone else" until March 2026 |

## Gaps identified by the Chief Compliance Officer

1. No written definition of when a misdirected message is a reportable breach of protected health information.
2. No owner for deciding whether to pause a campaign. Pulsewise can pause sends, but nobody at Horizon has written authority to order it.
3. No root-cause review after either near-miss.
4. Board reporting happens only through ad hoc email.

## Recommendation (pending decision)

Adopt an incident process with a 24-hour intake, a 5-day risk assessment, campaign kill-switch authority, and quarterly reporting to the Audit and Risk Committee. An estimate has not been prepared.
