# Horizon Health — team pack
_Simulated, fictional training material. Stars values are illustrative and not predictive._

**PE-backed challenger.** Fast, modern, thin on history and relationships.

## Briefing
Horizon Health is a private-equity-backed Medicare Advantage plan that has grown from 19,000 to 52,400 members in 30 months by entering nine new counties across Arizona, Texas and Florida. It runs a two-year-old cloud data platform, a single CRM and a modern core admin system, and its leadership team has a strong appetite for AI. The plan sits at 3.0 Stars. Blood pressure control, breast screening and complaints are at 2 Stars, and the six-person quality operations team has never run a full Stars cycle. You have $18.0M of Round 1 capital and 10 capacity points a quarter. The board wants 4.0 Stars within two rating cycles to support the next funding round.

**Board mandate:** Reach 4.0 Stars within two rating cycles to support the next funding round, without slowing county expansion. The board is comfortable with speed and uncomfortable with anything that looks like a two-year foundation program.

## Profile
| | |
|---|---|
| Members | 52,400 (grew from 19,000 in 30 months) |
| Geography | 17 counties across Arizona, Texas and Florida; 9 counties entered in the last 18 months |
| Product mix | 88% MA-PD HMO, 12% PPO; one D-SNP launched this year (3,100 members) |
| Dual-eligible / LIS share | 14% dual, 21% LIS |
| Average member age | 71.2 (younger than market) |
| Starting overall rating | 3.0 Stars (simulated) |
| Revenue | $690M illustrative |
| Round 1 capital | $18.0M |
| Round 2 capital | $8.0M base plus up to $4.0M earned at the board pitch |
| Implementation capacity | 10 capacity points per quarter |
| Data readiness score | 3 of 5 (modern stack, 40% of members have under 12 months of history) |
| Care management staff | 22 care managers, 4 pharmacists, 3 outreach coordinators |
| Contact center | 68 agents, 2 vendors, abandonment 11% |
| Technology | Single cloud data platform (2 years old), one CRM, modern core admin; 4 source systems |
| Provider network | Mostly fee-for-service contracts in new counties; 2 risk-bearing groups in legacy counties |

**Population.** Younger, faster-growing membership with incomplete longitudinal history. Digital engagement rates look strong but are concentrated among healthy members in legacy counties. New-county members skew older, more rural and less reachable by app or SMS.

**Visible advantages**
- Modern cloud data platform; integrations take weeks, not quarters
- Capital is available and the board decides quickly
- Leadership appetite for AI is high; no legacy vendor contracts to unwind
- Low readmission baseline because the population is younger

**Visible constraints**
- 40% of members lack 12 months of claims and pharmacy history, so risk models and gap lists are unstable
- No quality incentives in new-county provider contracts; alerts to those providers are ignored
- Quality operations team is six people and has never run a full Stars cycle
- Complaint rate is already at 2 Stars and rising with growth

## Starting scorecard (simulated)
| Measure | Weight | Thresholds (game constructs) | Start | Stars | Two-year headroom |
|---|---|---|---|---|---|
| M1 Medication Adherence for Diabetes Medications | ×3 | 2 Stars under 82.0 · 3 Stars 82.0 to 85.9 · 4 Stars 86.0 to 89.9 · 5 Stars 90.0 and above | 84 | 3 | +4.5 pts |
| M2 Medication Adherence for Hypertension (RAS antagonists) | ×3 | 2 Stars under 84.0 · 3 Stars 84.0 to 87.9 · 4 Stars 88.0 to 90.9 · 5 Stars 91.0 and above | 86.5 | 3 | +3.5 pts |
| M3 Controlling Blood Pressure | ×3 | 2 Stars under 62.0 · 3 Stars 62.0 to 70.9 · 4 Stars 71.0 to 78.9 · 5 Stars 79.0 and above | 59 | 2 | +12 pts (mostly capture, not control) |
| M4 Glycemic Status Assessment for Patients with Diabetes | ×3 | 2 Stars under 68.0 · 3 Stars 68.0 to 75.9 · 4 Stars 76.0 to 82.9 · 5 Stars 83.0 and above | 70 | 3 | +6 pts |
| M5 Breast Cancer Screening | ×1 | 2 Stars under 64.0 · 3 Stars 64.0 to 71.9 · 4 Stars 72.0 to 78.9 · 5 Stars 79.0 and above | 62 | 2 | +10 pts |
| M7 Plan All-Cause Readmissions | ×3 | 5 Stars under 7.5 · 4 Stars 7.5 to 9.4 · 3 Stars 9.5 to 11.4 · 2 Stars 11.5 and above | 9 | 4 | -1.0 |
| M9 Getting Appointments and Care Quickly (CAHPS) | ×2 | 2 Stars under 74.0 · 3 Stars 74.0 to 78.9 · 4 Stars 79.0 to 82.9 · 5 Stars 83.0 and above | 80 | 4 | +2 pts |
| M10 Customer Service (CAHPS) | ×2 | 2 Stars under 86.0 · 3 Stars 86.0 to 89.9 · 4 Stars 90.0 to 92.9 · 5 Stars 93.0 and above | 88 | 3 | +4 pts |
| M11 Complaints about the Health Plan | ×2 | 5 Stars under 0.10 · 4 Stars 0.10 to 0.24 · 3 Stars 0.25 to 0.49 · 2 Stars 0.50 and above | 0.55 | 2 | -0.30 |
| M12 Reviewing Appeals Decisions | ×2 | 2 Stars under 85.0 · 3 Stars 85.0 to 89.9 · 4 Stars 90.0 to 94.9 · 5 Stars 95.0 and above | 87 | 3 | +5 pts |

## Data room index
| ID | Artifact | Format | Domain | Layer |
|---|---|---|---|---|
| H-01 | Stars scorecard, last 3 cycles | dashboard | stars quality | company |
| H-02 | Measure performance by county cohort | table | stars quality | diagnose |
| H-03 | Quality team initiative log 2024 to 2026 | log | stars quality | diagnose |
| H-04 | Provider gap-alert portal statistics | dashboard | stars quality | diagnose |
| H-05 | Membership growth and tenure distribution | table | members | diagnose |
| H-06 | Segmentation model output | table | members | diagnose |
| H-07 | Member demographics by county | table | members | diagnose |
| H-08 | D-SNP launch readiness memo | memo | members | diagnose |
| H-09 | Adherence PDC distribution by tenure | table | pharmacy | diagnose |
| H-10 | Pharmacy outreach results, Q1 to Q2 | table | pharmacy | diagnose |
| H-11 | PBM refill reminder program summary | memo | pharmacy | diagnose |
| H-12 | Contact-center vendor scorecard | dashboard | experience | diagnose |
| H-13 | CAHPS results and verbatims | survey | experience | diagnose |
| H-14 | Complaint log with root-cause coding | log | experience | diagnose |
| H-15 | App engagement dashboard | dashboard | experience | diagnose |
| H-16 | Provider contract inventory by county | table | providers | diagnose |
| H-17 | Blood pressure reading capture analysis | table | providers | diagnose |
| H-18 | Provider relations call notes, new counties | log | providers | diagnose |
| H-19 | Attribution confidence report | table | providers | diagnose |
| H-20 | Application and data inventory | table | technology | company |
| H-21 | Identity match rate report | table | technology | diagnose |
| H-22 | Prior-plan history ingestion proposal | memo | technology | diagnose |
| H-23 | Data quality exception report | log | technology | diagnose |
| H-24 | Transformation budget and board expectations | memo | finance | company |
| H-25 | Staffing plan: quality and care management | table | finance | company |
| H-26 | 4-Star bonus value estimate | memo | finance | company |
| H-27 | Vendor commitments | table | finance | diagnose |
| H-28 | AI inventory and model cards | model card | risk | diagnose |
| H-29 | Privacy incident log | log | risk | diagnose |
| H-30 | Compliance audit observations | audit | risk | diagnose |

---

## Decision form — Diagnose (top 3 priorities with evidence)
| # | What is actually holding us back | Evidence (artifact IDs) | Why we believe it |
|---|---|---|---|
| 1 | | | |
| 2 | | | |
| 3 | | | |

## Decision form — Round 1 portfolio
Capital available: **$18M** · capacity **10 points per quarter**

| Card | Scope | Start quarter | Cost $M | Capacity points | Named owner |
|---|---|---|---|---|---|
| | | | | | |
| | | | | | |
| | | | | | |
| | | | | | |
| | | | | | |
| | | | | | |
| | | | | | |
| | | | | | |

**Thesis (one paragraph): what we believe will happen and why** ________________________________

## Board pitch (90 seconds)
Base $8M plus up to $4M earned on the rubric.

- **Evidence cited:** Round 1 results and at least two data-room artifacts referenced correctly
- **Causal explanation:** Explains why results differed from the thesis in terms of the causal chain
- **Decision quality:** Scales, modifies, pauses or cancels something specific, with a reason
- **Risk acknowledged:** Names at least one risk the portfolio creates and a control for it
- **Clarity under time:** Delivered in 90 seconds; a board member could repeat the ask

## Decision form — Round 2
| Card | Continue / scale / modify / pause / cancel / fund new | Reason |
|---|---|---|
| | | |
| | | |
| | | |
| | | |
| | | |
| | | |
| | | |
| | | |
