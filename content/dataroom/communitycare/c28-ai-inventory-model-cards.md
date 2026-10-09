> Simulated, fictional data for executive education. Not real PHI.

# AI Inventory and Model Cards

**Source:** Cascade Valley Health Clinical Governance Committee register, cross-referenced by CommunityCare Alliance Compliance
**Period:** Inventory as of 15 August 2026
**Owner:** Register maintained by Dr. Miriam Stone, Chief Quality Officer, Cascade Valley Health (Committee chair); plan copy held by Hannah Feld, Chief Compliance Officer
**Distribution:** Joint Plan-System Council; Plan Compliance Committee

## Inventory

| # | Model | Purpose | Developer | Data | Uses plan member data | Status | Reviewing body | Business owner (plan side) |
|---|---|---|---|---|---|---|---|---|
| 1 | Clinical Deterioration Risk Model v3 | Ranks members for BP, HbA1c and admission risk | Northbeam Analytics for the plan's Clinical Analytics team | Shared EHR plus plan claims | Yes | Validated; deployment pending | Clinical Governance Committee (system) | None named |
| 2 | Adherence Risk Score v2 | Flags Part D members at risk of PDC under 80% | ClearPath PBM (vendor model) | Pharmacy claims | Yes | In production since 2024; drives pharmacist call list | Clinical Governance Committee (system) | None named |
| 3 | Inpatient Readmission Risk Index | Predicts 30-day readmission at discharge for all payers | Cascade Valley Health analytics | Inpatient EHR | Yes (plan members are 14% of discharges) | In production since 2023; shown to hospital case managers | Clinical Governance Committee (system) | None named |

## Model card summaries

### 1. Clinical Deterioration Risk Model v3
- Performance: AUC 0.84 overall on the temporal holdout; precision 0.62 in the top decile. Full card in C-23.
- Monitoring: drift dashboard drafted; no alert thresholds set.
- Last review: June 2026, "approved for use subject to workflow plan".

### 2. Adherence Risk Score v2
- Performance (vendor-reported): AUC 0.77. The vendor has not provided subgroup results. A plan request for dual-eligible and rural subgroup metrics has been open since March 2026.
- Monitoring: the vendor provides annual attestation only.
- Last review: November 2024 (initial approval). No re-review is scheduled.

### 3. Inpatient Readmission Risk Index
- Performance: C-statistic 0.74; recalibrated in 2025.
- Use: Hospital case managers see the score. Plan transitions-of-care staff do not see it, because they have no EHR access to inpatient case-management views.
- Last review: January 2026.

## Governance arrangements

- **The Clinical Governance Committee** (system) reviews all models that touch patient care. It meets every other month and has 9 members: 7 system clinicians, the system CMIO and a system privacy officer. Plan staff present by invitation.
- The Committee's charter covers patient safety, clinical validity and bias. It does not cover plan uses such as outreach targeting, member communications, or Star Ratings and regulatory reporting.
- The plan has no AI policy of its own. Its compliance program covers vendor oversight under the CMS first-tier, downstream and related entity (FDR) requirements, and Model 2 is reviewed annually under that program.
- **No plan executive is named as accountable owner for any of the three models.** Compliance raised this in the 2026 annual risk assessment (rating: medium).

## Open items

| Item | Raised | Owner | Status |
|---|---|---|---|
| Name a plan-side business owner for each model | Mar 2026 | Not assigned | Open |
| Obtain subgroup performance for Model 2 | Mar 2026 | Pharmacy / vendor | Open |
| Define monitoring thresholds for Model 1 | Jun 2026 | Clinical Analytics | In progress |
| Decide whether generative AI tools (member letters, call summaries) need review | Jul 2026 | Not assigned | Open |
