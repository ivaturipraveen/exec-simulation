> Simulated, fictional data for executive education. Not real PHI.

# Proposal: Ingest Prior-Plan Claims and Pharmacy History for New Enrollees

**From:** Dr. Hannah Lindqvist, Director, Data Science and Analytics
**To:** Arjun Mehta, Chief Information Officer; Tom Rasmussen, Chief Financial Officer
**Cc:** Jordan Whitaker, Vice President, Quality and Stars; Dr. Samuel Osei, Director of Pharmacy
**Date:** 3 February 2026 (resubmitted 21 August 2026)
**Status:** Not funded in the 2026 operating budget. Resubmitted for Round 1 transformation planning.

## Problem

Horizon has grown from 19,000 to 52,400 members in 30 months. On the 2026-08 snapshot, **20,960 members (40%) have under 12 months of history** on our data platform, and 11,528 (22%) have under 6 months. Our analytics only see claims and pharmacy fills from the date a member joins Horizon. For these members we cannot reliably see:

- chronic conditions diagnosed before they joined (diabetes, hypertension, prior mastectomy);
- medication history, including whether a member was already non-adherent;
- the primary care provider they actually see;
- screenings completed in the lookback window before enrollment.

## Who the new enrollees are

| Group | Members under 12 months | Share |
|---|---|---|
| Switched from another Medicare Advantage or Part D plan | 14,700 | 70% |
| New to Medicare (age-ins) or from Original Medicare without Part D | 6,260 | 30% |

## The offer

Continuum Claims Exchange, a health information network vendor, aggregates historical claims and pharmacy data from participating plans and pharmacy networks with member authorization handled through its network agreements.

| Item | Vendor statement |
|---|---|
| Coverage | Claims history for **70% of switchers** (about 10,300 of 14,700 current members) |
| Lookback | Up to 36 months of medical claims and 24 months of pharmacy fills |
| Format | Standard claims extract with Medicare Beneficiary Identifier keys |
| Time to first load | 8 to 10 weeks after contract |
| Ongoing | Monthly feed for new enrollees |

## What it would change

1. Members could be scored for adherence risk from their first month instead of after 12 months.
2. Diagnosis and screening history would correct gap lists (for example, mammogram reminders to members with a documented mastectomy).
3. Attribution could use prior visits, which raises confidence in new counties (currently 68%; see H-19).

## Dependencies and risks

- Matching depends on clean member identity. Our CRM match rate is 84% in new counties (H-21), so some history would land on the wrong record or none.
- History is useful only if the models and gap lists are rebuilt to use it. No owner is assigned for that work.
- Privacy and data-use review is required. There is no formal data-sharing review process today.

## Funding history

| Date | Decision |
|---|---|
| Feb 2026 | Deferred: "not a 2026 priority; growth first" (Finance) |
| Aug 2026 | Finance asked that it be considered alongside any Member 360 and identity resolution program in Round 1 rather than as a standalone purchase |

## Recommendation

Decide in Round 1 whether to fund prior-plan history ingestion together with identity resolution. Without one of the two, we expect the new-county gap lists and adherence targeting to stay unstable through the next rating cycle.
