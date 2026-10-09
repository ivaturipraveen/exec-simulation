> Simulated, fictional data for executive education. Not real PHI.

# Claims Platform Migration Plan: HCP Classic to Halyard Claims Cloud

**Source:** IT Program Office, steering committee deck v3.2
**Period:** Program timeline September 2025 to August 2027
**Owner:** Priya Raman, Chief Information Officer; program director Ben Castellano
**Date presented:** August 20, 2026

## Slide 1: Why we are migrating

- HCP Classic (on premise, in place since 2009) processes claims for the 268,000 Heritage core members. Vendor support ends December 31, 2027.
- Halyard Claims Cloud offers real-time adjudication, configurable benefits and a native API layer.
- The contract was signed September 2025: $11.5M fixed-fee implementation over two years.
- Lakeshore and Pinecrest stay on Tessera (TPA-hosted) for now. Consolidating them is a Phase 2 decision, not before 2028.

## Slide 2: Timeline

| Phase | Dates | Key milestones |
|---|---|---|
| Design and configuration | Sep 2025 to Sep 2026 | Benefit configuration 92% complete |
| Build and integration | **Q4 2026 to Q2 2027** | 38 interfaces rebuilt; EDW, PBM, CareFlow, EnrollPro, ProviderHub |
| Parallel run | Q2 2027 | 3 cycles of parallel adjudication |
| Cutover | July 2027 | Go-live for plan year 2027 claims run-out |
| Decommission | Q4 2027 | HCP Classic retired |

## Slide 3: Integration capacity

| | Q4 2026 | Q1 2027 | Q2 2027 | Q3 2027 |
|---|---|---|---|---|
| Integration engineers (FTE) | 42 | 42 | 42 | 42 |
| Claims migration demand | 25 | 26 | 25 | 12 |
| **Share of capacity consumed** | **60%** | **62%** | **60%** | 29% |
| Regulatory and run work | 11 | 11 | 11 | 11 |
| Available for new initiatives | 6 | 5 | 6 | 19 |

For three quarters, the migration takes about 60% of integration capacity. About 5 to 6 engineers remain for everything else, including any transformation-envelope work that touches interfaces.

## Slide 4: Change control

- Standard change-control cycle is **6 weeks**, from request to production.
- A change freeze applies to the HCP Classic and Halyard interfaces from January 15 to July 31, 2027. Exceptions need sign-off from the Chief Information Officer.
- Any new interface must be built twice, once to HCP Classic and once to Halyard, or wait until after cutover.
- New outbound and inbound feeds that do not touch claims, such as ADT messages into CareFlow or PBM files into pharmacy outreach tools, are **not** subject to the freeze. They still go through the 6-week cycle.

## Slide 5: Risks

| Risk | Rating | Mitigation |
|---|---|---|
| Parallel run defects push cutover past plan-year boundary | High | Contingency cutover window October 2027 |
| Halyard fixed-fee penalties if Heritage delays integration testing | Medium | Protect migration team from reassignment |
| Transformation initiatives compete for the same engineers | High | Portfolio board to prioritize; no OneView-style parallel build |
| Key-person risk on HCP Classic knowledge (4 engineers) | Medium | Retention bonuses approved |

## Slide 6: Ask of the executive team

1. Confirm that the migration keeps first call on integration engineers through Q2 2027.
2. Ask transformation teams to scope their Round 1 work to fit about 5 to 6 integration FTE, or to use vendor-supplied integration.
3. Approve $0.3M for two contract interface developers, so ADT and pharmacy feeds can proceed outside the claims freeze.
