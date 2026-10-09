# CommunityCare Alliance — team pack
_Simulated, fictional training material. Stars values are illustrative and not predictive._

**Provider-sponsored plan.** Rich clinical data, aligned on paper, not in the clinic.

## Briefing
CommunityCare Alliance is the 94,800-member Medicare Advantage plan of a health system in the four-county Cascade Valley region. Of its members, 82% are attributed to the sponsoring system, which shares its EHR with the plan, so lab, vitals and encounter data are current and complete. Blood pressure and glycemic control are already at 4 Stars and complaints are low. The plan sits at 3.5 Stars, with Getting Appointments at 2 Stars. You have $12.0M of Round 1 capital and only 6 capacity points a quarter, because plan IT is small and system IT has its own queue. The system board is weighing whether to keep the plan at all.

**Board mandate:** Reach 4.0 Stars and prove the plan-provider model to the system board, which is weighing whether to keep the plan. Capital is modest and every dollar is compared against clinical investments the system could make instead.

## Profile
| | |
|---|---|
| Members | 94,800 |
| Geography | One metropolitan region (Cascade Valley, 4 counties); 82% of members attributed to the sponsoring health system |
| Product mix | 74% HMO, 18% PPO, 8% D-SNP |
| Dual-eligible / LIS share | 18% dual, 26% LIS |
| Average member age | 73.9 |
| Starting overall rating | 3.5 Stars (simulated) |
| Revenue | $1.3B illustrative |
| Round 1 capital | $12.0M |
| Round 2 capital | $8.0M base plus up to $4.0M earned at the board pitch |
| Implementation capacity | 6 capacity points per quarter (plan IT is small; system IT has its own priorities) |
| Data readiness score | 3 of 5 (excellent clinical data from the system EHR, weak payer-side operations data) |
| Care management staff | 48 care managers (28 employed by the health system), 5 pharmacists |
| Contact center | 95 agents, abandonment 6% |
| Technology | Shared EHR with the sponsoring system; plan runs a separate core admin and a small warehouse; 6 source systems |
| Provider network | Sponsoring system employs 70% of attributed PCPs (salaried, no Stars-linked compensation); 30% independent |

**Population.** Geographically concentrated, well attributed, with rich clinical context from the shared EHR. Access is the binding constraint: primary care panels are full and third-next-available appointment is 24 days. Rural edges of the region have transport barriers.

**Visible advantages**
- Shared EHR: lab, vitals and encounter data are current and complete for 82% of members
- Trusted clinical relationships; care managers sit inside clinics
- Low complaint rate and strong customer service scores
- Blood pressure and glycemic control already at 4 Stars

**Visible constraints**
- PCP panels are full; outreach generates demand the clinics cannot absorb
- Employed clinicians are salaried with no quality compensation; plan quality is not on their scorecard
- Clinical recommendations go to a plan portal; clinicians work in the EHR inbox
- Plan IT depends on system IT for any EHR-facing change; queue is 2 quarters

## Starting scorecard (simulated)
| Measure | Weight | Thresholds (game constructs) | Start | Stars | Two-year headroom |
|---|---|---|---|---|---|
| M1 Medication Adherence for Diabetes Medications | ×3 | 2 Stars under 82.0 · 3 Stars 82.0 to 85.9 · 4 Stars 86.0 to 89.9 · 5 Stars 90.0 and above | 85 | 3 | +4.0 pts |
| M2 Medication Adherence for Hypertension (RAS antagonists) | ×3 | 2 Stars under 84.0 · 3 Stars 84.0 to 87.9 · 4 Stars 88.0 to 90.9 · 5 Stars 91.0 and above | 87 | 3 | +3.5 pts |
| M3 Controlling Blood Pressure | ×3 | 2 Stars under 62.0 · 3 Stars 62.0 to 70.9 · 4 Stars 71.0 to 78.9 · 5 Stars 79.0 and above | 73 | 4 | +4 pts |
| M4 Glycemic Status Assessment for Patients with Diabetes | ×3 | 2 Stars under 68.0 · 3 Stars 68.0 to 75.9 · 4 Stars 76.0 to 82.9 · 5 Stars 83.0 and above | 78 | 4 | +3 pts |
| M5 Breast Cancer Screening | ×1 | 2 Stars under 64.0 · 3 Stars 64.0 to 71.9 · 4 Stars 72.0 to 78.9 · 5 Stars 79.0 and above | 75 | 4 | +5 pts (only if imaging capacity is added) |
| M7 Plan All-Cause Readmissions | ×3 | 5 Stars under 7.5 · 4 Stars 7.5 to 9.4 · 3 Stars 9.5 to 11.4 · 2 Stars 11.5 and above | 10.5 | 3 | -1.5 |
| M9 Getting Appointments and Care Quickly (CAHPS) | ×2 | 2 Stars under 74.0 · 3 Stars 74.0 to 78.9 · 4 Stars 79.0 to 82.9 · 5 Stars 83.0 and above | 72 | 2 | +6 pts (only with access expansion) |
| M10 Customer Service (CAHPS) | ×2 | 2 Stars under 86.0 · 3 Stars 86.0 to 89.9 · 4 Stars 90.0 to 92.9 · 5 Stars 93.0 and above | 91 | 4 | +1.5 pts |
| M11 Complaints about the Health Plan | ×2 | 5 Stars under 0.10 · 4 Stars 0.10 to 0.24 · 3 Stars 0.25 to 0.49 · 2 Stars 0.50 and above | 0.2 | 4 | -0.05 |
| M12 Reviewing Appeals Decisions | ×2 | 2 Stars under 85.0 · 3 Stars 85.0 to 89.9 · 4 Stars 90.0 to 94.9 · 5 Stars 95.0 and above | 88 | 3 | +4 pts |

## Data room index
| ID | Artifact | Format | Domain | Layer |
|---|---|---|---|---|
| C-01 | Stars scorecard, last 3 cycles | dashboard | stars quality | company |
| C-02 | Measure performance: employed vs independent PCPs | table | stars quality | diagnose |
| C-03 | Quality initiative log | log | stars quality | diagnose |
| C-04 | Gap recommendation delivery statistics | dashboard | stars quality | diagnose |
| C-05 | Membership by county and attribution | table | members | company |
| C-06 | Member access survey | survey | members | diagnose |
| C-07 | Transport and rural access analysis | table | members | diagnose |
| C-08 | Disenrollment reasons | table | members | diagnose |
| C-09 | Adherence program summary | memo | pharmacy | diagnose |
| C-10 | Pharmacy network and mail-order usage | table | pharmacy | diagnose |
| C-11 | Refill reminder results | table | pharmacy | diagnose |
| C-12 | Contact-center operations report | dashboard | experience | diagnose |
| C-13 | CAHPS results and verbatims | survey | experience | diagnose |
| C-14 | Complaint log with root-cause coding | log | experience | diagnose |
| C-15 | Member outreach volume and response | table | experience | diagnose |
| C-16 | Clinician compensation summary (system HR) | memo | providers | diagnose |
| C-17 | Third-next-available appointment by clinic | table | providers | diagnose |
| C-18 | Clinician survey on plan requests | survey | providers | diagnose |
| C-19 | EHR inbox workflow study | memo | providers | diagnose |
| C-20 | Application and data inventory | table | technology | company |
| C-21 | Clinical data completeness report | table | technology | diagnose |
| C-22 | System IT change request queue | log | technology | diagnose |
| C-23 | Predictive model validation report | model card | technology | diagnose |
| C-24 | Capital request and system board memo | memo | finance | company |
| C-25 | Care management staffing and reporting lines | table | finance | diagnose |
| C-26 | 4-Star bonus value estimate | memo | finance | company |
| C-27 | Telehealth and extended-hours pilot results | table | finance | diagnose |
| C-28 | AI inventory and model cards | model card | risk | diagnose |
| C-29 | Joint governance charter (plan and system) | contract | risk | diagnose |
| C-30 | Compliance review of outreach volume | audit | risk | diagnose |

---

## Decision form — Diagnose (top 3 priorities with evidence)
| # | What is actually holding us back | Evidence (artifact IDs) | Why we believe it |
|---|---|---|---|
| 1 | | | |
| 2 | | | |
| 3 | | | |

## Decision form — Round 1 portfolio
Capital available: **$12M** · capacity **6 points per quarter**

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
