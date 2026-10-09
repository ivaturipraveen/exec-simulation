> Simulated, fictional data for executive education. Not real PHI.

# Pharmacy Adherence Program: Design and Results

**From:** Dr. Hannah Cho, PharmD, VP Pharmacy
**To:** Dr. Alan Whitfield, Chief Medical Officer; Daniel Whitcombe, VP Stars and Quality Programs
**Date:** August 12, 2026
**Re:** Mid-year review of the Part D adherence program (diabetes, RAS antagonists, statins)

## Program design

1. **Identify.** The Adherence Risk Model v4, hosted by Clearpath Analytics, scores every member on a Part D adherence medication each week. It uses refill history, proportion of days covered (PDC) trajectory, days' supply, number of medications, prior gaps, pharmacy type and dual or low-income subsidy (LIS) status.
2. **Prioritize.** Members with a predicted year-end PDC under 80% and enough days left in the year to recover go onto the at-risk list. In Q2 2026 the list held **14,000 members**.
3. **Outreach.** Pharmacists call the highest-ranked members first. Each call covers barriers, a 90-day supply conversion, a mail-order offer, synchronized refills and a prescriber outreach when a new script is needed.
4. **Follow-up.** The PBM (ScriptBridge) sends a refill-due alert at day 7. A letter goes out at day 14 if there is still no fill.

## Model performance (validation on 2025 data, Heritage core and Pinecrest)

| Metric | Value |
|---|---|
| Area under the curve (AUC) | 0.79 |
| Precision on the at-risk list | **0.71** |
| Recall at the list cutoff | 0.66 |
| Calibration slope | 0.97 |

About 7 in 10 flagged members really do end the year below 80% PDC without intervention. The model was rebuilt in 2025, and Clearpath's independent validation passed (see the AI inventory and model cards).

## Reach

| Quarter | At-risk list | Members reached by pharmacist | % of list reached |
|---|---|---|---|
| 2025 Q3 | 13,600 | 2,080 | 15.3% |
| 2025 Q4 | 13,900 | 2,050 | 14.7% |
| 2026 Q1 | 14,300 | 2,120 | 14.8% |
| 2026 Q2 | 14,000 | 2,100 | **15.0%** |

The outreach queue is worked in rank order. Members below about rank 2,100 receive the PBM alert and letter only.

## Results for members reached versus matched non-reached members (2025)

| Outcome | Reached | Matched comparison | Difference |
|---|---|---|---|
| Year-end PDC of 80% or higher | 78.4% | 61.0% | +17.4 pts |
| Converted to 90-day supply | 52% | 19% | +33 pts |
| Average refill gap (days) | 5.9 | 13.1 | -7.2 |

Members who get a pharmacist call do much better than the comparison group, and the effect has held for three years. Letters alone show no measurable effect over the comparison group.

## Requests from the steering committee

- **Clearpath** has proposed v5 of the model with social-risk features, at an estimated $0.6M. It projects precision of 0.75.
- **Stars Program Office:** "Can the model find members we are missing?"
- **Pharmacy:** Pharmacist and technician requisitions were deferred in the FY2026 cycle (see the staffing table). Pharmacists also carry the Medication Therapy Management (MTM) comprehensive medication reviews, which are a CMS requirement.

## Caveats

- Validation used Heritage core and Pinecrest data. Lakeshore records were left out because the PBM-to-enrollment linkage was incomplete.
- The 2,100 figure counts completed conversations, not dial attempts. In Q2 there were 5,720 attempts.
