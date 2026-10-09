> Simulated, fictional data for executive education. Not real PHI.

# Member Identity Reconciliation Study

**From:** Kevin Liang, Director, Enterprise Analytics
**To:** Priya Raman, Chief Information Officer; Dr. Renata Okafor, Chief Quality Officer
**Date:** July 30, 2026
**Re:** Results of the cross-book member identity reconciliation (project DQ-114)

## Why we did this

Enrollment Operations and the Stars Program Office reported different member counts for the same month: 431,000 against 437,900. We ran a one-time reconciliation of every member record across the three books, using enrollment, both claims platforms, the PBM feed and the three CRMs (MemberLink, OutreachOne and CareConnect).

## Method

- Assembled 512,600 person-level records from 9 sources for members enrolled at any point from January 2024 to June 2026
- Deterministic matching first, on Medicare Beneficiary Identifier (MBI), internal member ID, and the Tessera subscriber ID with suffix. Then probabilistic matching on name, date of birth, sex and standardized address
- Each record classed as **matched** (one person, consistent across sources), **duplicated** (one person under 2 or more member keys) or **unmatched** (no confident link between enrollment and at least one of pharmacy, medical or CRM)
- Clerical review of 1,200 sampled pairs. The probabilistic precision was 96.4%

## Results

| Book | Members | Duplicated | Unmatched | Total affected | % of book |
|---|---|---|---|---|---|
| Heritage core | 268,000 | 3,900 | 6,800 | 10,700 | 4.0% |
| Lakeshore | 97,000 | 9,200 | 14,100 | 23,300 | 24.0% |
| Pinecrest | 66,000 | 4,700 | 7,300 | 12,000 | 18.2% |
| **Enterprise** | **431,000** | **17,800** | **28,200** | **46,000** | **10.7% (11%)** |

## How the problems arise

| Pattern | Records | Most common in |
|---|---|---|
| MBI blank or outdated (pre-2020 Health Insurance Claim Number still in use) | 11,900 | Lakeshore |
| Tessera subscriber suffix reused after re-enrollment | 8,300 | Lakeshore, Pinecrest |
| Same person re-enrolled in another book after a move | 6,850 | Cross-book |
| Address formats differ (Lakeshore free text; core USPS-standardized) | 9,400 | Lakeshore |
| PBM member key not mapped to enrollment ID | 5,600 | Lakeshore |
| Name variants or transposed date of birth | 3,950 | All |

## Address currency (matched members only)

| Book | Address updated in last 12 months | National Change of Address check in last 12 months |
|---|---|---|
| Heritage core | 96% | Yes (quarterly) |
| Lakeshore | 71% | No (not purchased for this book) |
| Pinecrest | 83% | Annual |

## Notes

- The **core-only** match rate (96%) is what IT reports in its quarterly data-quality KPI. That figure leaves out the acquired books.
- Each book applies its own matching rules. No single rule set is approved across the enterprise.
- This was a one-time study. Nothing keeps it current, and the results have not been loaded back into any source system.
- Remediation was out of scope. We estimate that cleaning up and maintaining Lakeshore alone would take 2 quarters with a dedicated data steward.
