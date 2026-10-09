> Simulated, fictional data for executive education. Not real PHI.

# AI Inventory and Model Cards

**Source:** AI and analytics inventory compiled for the Audit and Risk Committee
**Period:** Status as of 1 September 2026
**Owner:** Denise Fairbanks, Chief Compliance Officer (compiled with Data Science). Model owner fields as recorded by the business.

## Inventory summary

| Model | Type | In production since | Business use | Named owner | Independent validation | Monitoring |
|---|---|---|---|---|---|---|
| Engagement Segmentation v2 | Gradient-boosted classifier (vendor-configured in Pulsewise Engage) | Aug 2025 | Assigns every member to one of four segments and a default outreach channel | None recorded | None | None |
| Adherence Risk Score v1 | Logistic regression (in-house) | Mar 2025 | Ranks members for pharmacist outreach lists | None recorded (built by a data scientist who left in Jan 2026) | None | None |
| (Pilot) Call summarization | Generative AI (vendor) | Not in production | VoxBridge proposal | n/a | n/a | n/a |

**Two models are in production. Neither has been validated, and neither has a named owner.** Horizon has no AI governance policy or model risk standard.

---

## Model card 1: Engagement Segmentation v2

**Intended use:** Assign members to a segment (Digitally engaged, Digital-ready, Assisted, High-need) and set a default outreach channel for campaigns in Pulsewise Engage.

**Training data:** 18,400 members enrolled for at least 6 months between January 2024 and June 2025. At that time, Horizon operated only in its 8 legacy counties, so **the training data come entirely from legacy-county members.** Average age in the training data was 68.7.

**Features (22):** Age, app registration and session counts, SMS response history, email on file, prior campaign clicks, claims count, plan type, zip-code density, language field.

**Label:** Responded to a digital campaign within 30 days (yes or no).

**Performance (vendor-reported, held-out legacy data):** AUC 0.81; precision for "Digitally engaged" 0.77.

**Performance on new counties:** Not measured.

**Outputs and use:** Segments 1 and 2 (37,400 members, 71% of the plan) default to app and SMS. Members are re-scored nightly. Segment assignment can only be overridden by Pulsewise support ticket.

**Known limitations (vendor documentation):** "Model assumes reliable phone and app identifiers. Members with missing or shared contact data are assigned using population averages." Language field missing for 13% of members, defaulted to English.

**Fairness review:** None performed. No subgroup reporting by age, dual status or county.

---

## Model card 2: Adherence Risk Score v1

**Intended use:** Predict which members will fall below 80% PDC in the measurement year for diabetes medications, RAS antagonists and statins. The top decile goes to pharmacist outreach.

**Eligibility rule:** Members with **12 months or more of continuous Horizon Part D claims history**. Members not meeting the rule receive no score and do not appear on the ranked list.

**Training data:** Measurement years 2023 and 2024, 11,900 members with a qualifying history (legacy counties only).

**Features (14):** Prior-year PDC, refill gap days, number of chronic drugs, mail-order use, copay tier, LIS status, age, pharmacy type.

**Performance (development, 2024 holdout):** AUC 0.74. Top-decile precision 0.58.

**Production performance:** Not tracked since launch. Data Science notes that prior-year PDC is the strongest feature, which favors members with long, stable fill histories.

**Coverage, August 2026:** Scored 31,440 members (60% of the plan). Unscored: 20,960.

**Fairness review:** None performed.

---

## Compliance observations

1. Neither model has documentation that meets a basic model-risk standard: no validation report, no drift monitoring, no change log, no owner.
2. The engagement model controls who receives member-facing messages, so its errors reach members directly.
3. The product team plans a generative "personalized engagement agent" for 2027 that would use Segmentation v2 outputs as input.
