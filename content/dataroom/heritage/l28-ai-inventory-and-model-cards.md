> Simulated, fictional data for executive education. Not real PHI.

# AI Inventory and Model Cards

**Source:** Model Risk Management register, maintained by Enterprise Analytics
**Period:** Register as of August 31, 2026
**Owner:** Kevin Liang, Director, Enterprise Analytics; reviewed by Samuel Adeyemi, Chief Compliance and Privacy Officer

## Inventory

| # | Model | Use | Owner | Vendor | Risk tier | Last validation |
|---|---|---|---|---|---|---|
| 1 | Adherence Risk Model v4 | Ranks Part D members for pharmacist outreach | Pharmacy | Clearpath Analytics | Medium | Mar 2026 (passed) |
| 2 | Readmission Risk Score | Prioritizes post-discharge care manager calls | Care Management | In-house | Medium | Nov 2024 |
| 3 | Gap Prioritization Model | Orders HEDIS gap lists for outreach and providers | Stars Program Office | Clearpath Analytics | Medium | Jan 2025 |
| 4 | Call Reason Classifier | Tags contact-center calls for reporting | Member Services | In-house (natural language processing) | Low | Not validated |
| 5 | Payment Integrity Flagging | Flags claims for pre-payment review | Claims | Halvorsen Analytics | High | Jun 2026 (passed) |

No generative AI tools are in production. A pilot request for an agent-assist copilot is pending governance review. There is no enterprise AI policy. Each model follows its owner's departmental procedure.

## Model card 1: Adherence Risk Model v4

- **Intended use:** Weekly ranking of members on diabetes, RAS antagonist and statin medications by the probability that year-end proportion of days covered (PDC) ends under 80%. Output feeds the pharmacist outreach queue.
- **Out of scope:** Clinical decisions, and members without linked pharmacy and enrollment records.
- **Training data:** 2022 to 2024 prescription drug event and enrollment data for Heritage core and Pinecrest, 182,000 member-years. Lakeshore was excluded because its records were incomplete.
- **Features:** 34 in total, including refill history, days' supply, pharmacy channel, number of chronic medications, LIS status and age.
- **Performance (2025 holdout):** AUC 0.79, precision 0.71 at the list cutoff, recall 0.66, calibration slope 0.97.
- **Validation:** Independent validation by Clearpath in March 2026 passed all criteria.
- **Subgroup analysis:** Done by age band and sex. **Not done for dual-eligible members or LIS members, and not done by book.**
- **Operational note:** About 14,000 members are flagged each quarter. The downstream queue completes about 2,100 outreaches, and flags that are not worked expire at the next weekly refresh.
- **Monitoring:** Quarterly precision check. No drift monitoring on input data.

## Model card 2: Readmission Risk Score

- **Intended use:** Rank members after discharge for care manager outreach order.
- **Inputs:** Diagnoses, prior admissions, number of medications, and discharge date.
- **Performance:** AUC 0.68 (2024).
- **Limitation:** Scores are generated only once the discharge is known in CareFlow. The input data inherits that timing.
- **Subgroup analysis:** None.

## Model card 3: Gap Prioritization Model

- **Intended use:** Order open-gap members for mail, call and provider gap lists.
- **Inputs:** Open gaps, past response, attribution, address and phone status.
- **Performance:** Lift of 1.4x response in the top decile against random selection (core, 2024).
- **Limitation:** It assumes contact data is current. It has not been validated on Lakeshore or Pinecrest.

## Model card 4: Call Reason Classifier

- **Intended use:** Reporting only. **Accuracy:** 82% on 500 hand-labeled core calls. **Limitation:** It has no categories for the 2026 benefit changes.

## Model card 5: Payment Integrity Flagging

- **Intended use:** Pre-payment review queue. **Controls:** Human review on every flag, and monthly overturn monitoring.

## Open governance items

1. There is no enterprise AI governance committee or policy.
2. No model has a subgroup fairness analysis for dual-eligible members.
3. No model has been validated on Lakeshore data.
