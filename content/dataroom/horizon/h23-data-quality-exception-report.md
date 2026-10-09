> Simulated, fictional data for executive education. Not real PHI.

# Data Quality Exception Report

**Source:** Horizon Data Cloud data-quality rules engine (monthly run) plus USPS returned-mail scans from the print vendor
**Period:** September 2025 to August 2026 (12 months)
**Owner:** Data Engineering (Kofi Mensah, Data Quality Lead); reviewed with Member Operations

## Key figures

| Metric | Value |
|---|---|
| Annualized address change rate (members with 1 or more address changes in 12 months) | **18%** (legacy counties 12%, new counties 28%) |
| Members flagged undeliverable mail (2+ returned pieces, no updated address) | **3,100** (5.9% of members) |
| Members with no valid phone number | 2,050 (3.9%) |
| Members whose phone number is shared with an unrelated household | 5,300 (2,400 households) |
| Members missing a language preference | 6,800 (13%) |
| Open exceptions older than 90 days | 4,420 |

## Exception log

| Date | Rule | Records | Severity | Disposition |
|---|---|---|---|---|
| 2025-09-30 | ADDR-02 returned mail, 2 or more pieces | 1,240 | Medium | Sent to Member Operations queue; 310 resolved |
| 2025-11-03 | PHONE-05 same phone across different households | 1,410 | Low | No owner; logged only |
| 2025-12-01 | ADDR-04 address differs between Apex and Relay CRM | 2,980 | Medium | CRM is overwritten nightly by Apex; agent-entered updates lost |
| 2026-01-31 | ENRL-01 broker-submitted enrollment with placeholder phone (555 or all zeros) | 640 | High | 212 corrected by welcome-call team before reassignment |
| 2026-02-28 | ADDR-02 returned mail, 2 or more pieces | 2,210 | Medium | Annual Election Period volume; queue backlog 6 weeks |
| 2026-03-31 | PHONE-05 same phone across different households | 2,060 | Low | Rule threshold raised; still no owner |
| 2026-04-30 | DSNP-03 Medicaid eligibility file mismatch | 112 | High | Manual review by D-SNP team |
| 2026-05-29 | ADDR-02 returned mail, 2 or more pieces | 2,740 | Medium | 380 resolved through outbound calls |
| 2026-06-30 | LANG-01 language preference missing | 6,800 | Low | Defaulted to English in Pulsewise Engage |
| 2026-07-31 | PHONE-05 same phone across different households | 2,400 households (5,300 members) | Low | Escalation requested by Member Experience; pending |
| 2026-08-31 | ADDR-02 returned mail, 2 or more pieces | 3,100 | Medium | 3,100 members currently flagged undeliverable; 64% in new counties |

## Downstream use of flagged records

| Process | Uses the flag? |
|---|---|
| Print and mail vendor | Yes: suppresses mail to undeliverable addresses |
| Pulsewise Engage (SMS, app push) | No: flags are not passed to the engagement platform |
| ClearRx refill reminders | No: uses the monthly eligibility file |
| Pharmacist and care manager call lists | No |
| CAHPS sample frame | Not applicable (CMS draws the sample) |

## Data Engineering note

The exception rules work. The process after the rules does not. Most exceptions have no business owner. Member Operations resolves address issues only when a queue item is opened, and the queue has 4,420 items older than 90 days. Address churn in the new counties is more than twice the legacy rate. Many of these members move between family homes or seasonal addresses.
