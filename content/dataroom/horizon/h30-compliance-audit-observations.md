> Simulated, fictional data for executive education. Not real PHI.

# Compliance Audit Observations: Member Outreach and Consent

**From:** Halvorsen & Pike LLP, independent compliance reviewers (engaged by the Audit and Risk Committee)
**To:** Denise Fairbanks, Chief Compliance Officer; Audit and Risk Committee
**Date:** 15 August 2026
**Scope:** Member outreach channels (SMS, automated calls, app push, mail) and related consent records, January 2025 to June 2026
**Method:** Policy review; walkthroughs with Digital Member Experience, Member Services and Pharmacy; a statistical sample of 400 member records; review of Pulsewise Engage and ClearRx configurations

## Summary rating: Needs improvement

## Observations

### Observation 1 (High): SMS consent capture is incomplete
- **Condition:** Consent for SMS outreach is missing or cannot be verified for **28% of members** who receive SMS outreach. In the 400-record sample, 112 records had no consent timestamp, source or wording on file.
- **Breakdown:** Broker-submitted enrollments 41% incomplete; online enrollments 9%; paper enrollments 33%. New-county members 39%; legacy-county members 21%.
- **Cause:** The enrollment form consent field is optional. Consent is not passed from Apex Core Admin to Pulsewise Engage. Pulsewise treats "phone number present" as "SMS-eligible."
- **Exposure:** Telephone Consumer Protection Act (TCPA) and CMS marketing and communications requirements; reputational risk.
- **Recommendation:** Suppress SMS for members without verified consent until it is captured. Make consent a required enrollment field. Pass consent status to all outreach platforms.

### Observation 2 (Medium): No suppression for shared or stale contact data
- **Condition:** Outreach platforms do not use the data-quality flags for shared phone numbers (2,400 households) or undeliverable addresses (3,100 members).
- **Recommendation:** Pass data-quality flags to Pulsewise Engage and ClearRx. Require identity confidence thresholds before sending health-specific content.

### Observation 3 (Medium): Health content in outbound messages
- **Condition:** 6 of 14 SMS templates reviewed name a specific drug or screening. No minimum-necessary review is documented.
- **Recommendation:** Use generic templates ("You have a message from Horizon") unless identity is verified.

### Observation 4 (Medium): No campaign approval workflow
- **Condition:** Campaigns can be launched by any of 9 Pulsewise users without second-person review. 214 campaigns ran in the review period; 11 had documented approval.
- **Recommendation:** Two-person approval for member-facing campaigns, with Compliance sign-off for new templates.

### Observation 5 (Low): Opt-out processing lag
- **Condition:** SMS opt-outs ("STOP") took a median of 4 days to sync to ClearRx reminders. Under the stated policy, opt-outs must be honored within 1 business day.
- **Recommendation:** Real-time opt-out sync across vendors.

## Management response (preliminary)

Digital Member Experience agrees with Observations 1, 3 and 5 and has asked for budget. It notes that suppressing SMS for 28% of members "would reduce engagement reach." Target dates have not been set. The Committee asked for a remediation plan with owners by the October 2026 meeting.
