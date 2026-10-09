> Simulated, fictional data for executive education. Not real PHI.

# Model Card: Clinical Deterioration Risk Model v3

**Source:** Clinical Analytics, CommunityCare Alliance, with Northbeam Analytics (model development vendor)
**Model owner:** Dr. Ana Kowalski, Director of Clinical Analytics
**Validation date:** 14 April 2026; card updated 30 July 2026
**Status:** Validated. **Deployment pending clinician workflow.**

## Model details

- **Type:** Gradient-boosted decision trees, retrained quarterly. Version 3 replaces the claims-only v2 model (AUC 0.71).
- **Inputs:** 142 features from the shared Meridian EHR (labs, vitals, medication list, problem list, encounters) and plan data (claims, pharmacy fills, prior authorizations). Survey-linked flags are excluded.
- **Output:** 90-day probability of (a) the member's blood pressure becoming uncontrolled (140/90 or above), (b) HbA1c rising above 8.0, or (c) an unplanned admission. Includes the top 5 drivers per member.
- **Refresh:** Weekly scoring on the Cascade Valley Health analytics service.

## Intended use

Rank system-attributed members for proactive PCP and care manager action on blood pressure, glycemic control and admission risk (measures M3, M4 and M7). It is not intended for coverage, benefit or utilization management decisions.

## Training and validation data

| Item | Value |
|---|---|
| Training cohort | 71,400 attributed members, Jan 2023 to Jun 2025 |
| Holdout validation | 19,800 members, Jul 2025 to Dec 2025 (temporal holdout) |
| Data completeness, attributed members | Labs 96%, vitals 94%, medications 91% (see C-21) |
| Data latency | Under 24 hours from the shared EHR |

## Performance (temporal holdout)

| Metric | Overall | Dual-eligible | Rural edge | Age 80+ |
|---|---|---|---|---|
| **AUC (area under the ROC curve)** | **0.84** | 0.82 | 0.83 | 0.81 |
| Precision, top 10% | 0.62 | 0.59 | 0.61 | 0.57 |
| Recall, top 10% | 0.38 | 0.36 | 0.37 | 0.35 |
| Calibration slope | 0.97 | 0.94 | 0.96 | 0.93 |

Chart review (n = 300 flagged members): 83% of members flagged for uncontrolled BP were confirmed uncontrolled or borderline.

## Comparison

Northbeam reports that 0.84 is "the highest AUC in our provider-sponsored plan book". The 2025 benchmark median is 0.76, and the model's performance reflects the completeness of the shared EHR data.

## Limitations

- Performance for the 17,064 independent-PCP members (claims only) is lower: AUC 0.73.
- No outcome evaluation has been done. The model has not been used to trigger any intervention, so its effect on measures is unknown.
- Scores are visible today only in the GapConnect portal (monthly PDF) and in a warehouse table.

## Deployment status

| Step | Status |
|---|---|
| Technical validation | Complete (April 2026) |
| Bias and subgroup review | Complete; no material gaps on the subgroups tested |
| Clinical Governance Committee review | Presented June 2026; "approved for use subject to workflow plan" |
| EHR integration (score in patient header) | Change request CR-26-0031, not started |
| **Clinician workflow (who acts, where, when)** | **Not defined; deployment pending clinician workflow** |
| Monitoring plan | Drafted; no named plan-side operational owner |

## Cost

Northbeam contract $640,000 over 2 years (2025 to 2026). Renewal decision is due in December 2026.
