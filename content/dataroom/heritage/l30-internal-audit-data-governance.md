> Simulated, fictional data for executive education. Not real PHI.

# Internal Audit Report: Data Governance

**Report number:** IA-2026-07
**Issued:** July 22, 2026
**From:** Internal Audit (Nadia Brennan, Director, Internal Audit)
**To:** Audit Committee of the Board; Margaret Ellison, Chief Executive Officer
**Rating:** Needs significant improvement

## Scope

The audit reviewed data ownership, member identity standards and data-quality controls across the three books (Heritage core, Lakeshore and Pinecrest) for the period January 2025 to June 2026. It sampled 1,200 member records and interviewed 22 data stewards, analysts and system owners.

## Overall conclusion

Data governance is adequate for the Heritage core book and weak for the acquired books. **There is no enterprise data owner.** Ownership is assigned by system rather than by data domain, and nobody is accountable for the member record as a whole across books.

## Findings

| # | Finding | Rating | Evidence |
|---|---|---|---|
| 1 | No enterprise data owner or data governance charter | High | The data governance council charter lapsed when the OneView program was cancelled in 2024. Nine data owners are named, but none for Lakeshore data. |
| 2 | Identity rules differ by book | High | Core uses Heritage member ID plus Medicare Beneficiary Identifier (MBI). Lakeshore uses the TPA subscriber number. Pinecrest uses a legacy ID with suffix re-use. Matching rules were never harmonized after acquisition. |
| 3 | Address standards differ by book | Medium | Lakeshore and Pinecrest records do not apply USPS address standardization. In the sample, 13% of Lakeshore addresses failed validation, against 2% for core. |
| 4 | Data-quality exceptions are not owned | Medium | 4,900 open exceptions in the warehouse queue, 71% from acquired books; median age 96 days. |
| 5 | Model inputs are not reconciled to source | Medium | Analytics models consume warehouse member keys without a check against CRM keys; mismatches are dropped silently at campaign build. |
| 6 | Change control does not assess data impact | Low | Six-week change cycle reviews technical risk only. |

## Sample results (1,200 records)

| Book | Records sampled | Identity consistent across pharmacy, medical, CRM | Address valid | Duplicate person suspected |
|---|---|---|---|---|
| Heritage core | 600 | 97.8% | 98.0% | 0.7% |
| Lakeshore | 360 | 79.4% | 87.0% | 9.2% |
| Pinecrest | 240 | 85.0% | 91.3% | 6.3% |
| **Weighted to membership** | 1,200 | **89.1%** | 94.4% | 3.4% |

## Management response (Chief Information Officer, Priya Raman)

Management agrees with findings 1 to 4. The CIO notes that "a full enterprise master data program would compete with the claims platform migration for the same engineers" and proposes to bring options to the transformation committee in Q4. No owner has been named for finding 1, and target dates are "to be confirmed."

## Auditor's comment

The core book's strong controls make enterprise-level reporting look healthier than the acquired books are. We recommend that the committee assign an accountable executive data owner before funding further analytics that depend on the member record.
