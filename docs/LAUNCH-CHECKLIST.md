# Before real client use

The owner has confirmed hosted account/isolation, private file and sign-in-email checks. This is useful development evidence, not approval to use real client data yet.

## Remaining functional acceptance
- Run the expanded automatic check to verify questionnaire submissions and creative feedback/revisions/approvals on the hosted database.
- Test a complete client journey in a separate browser: invitation, questionnaire, presentation, revision, approval, final delivery and goodbye.
- Configure and test the Invite email template before enabling invitation email sending; private links work without it.
- Test edit controls, mobile milestone expansion, navigation shortcuts, sign-out and account recovery.

## Security and operation review
- Apply the owner MFA SQL upgrade, enrol the owner authenticator, test new-session challenge and rehearse recovery. Application and database assurance checks are implemented and locally tested; hosted acceptance is still needed.
- Review Supabase email recipient limits/SMTP, rate limits and abuse protection.
- Review real-user storage policies, existing upload caching, file format limits, malware scanning and total storage/retention limits.
- Establish a backup schedule and perform a restore rehearsal. A schema migration is not a data backup.
- Set a privacy notice, lawful basis, processor agreements, retention periods, subject-access/export and deletion process. Confirm provider locations and transfer safeguards.
- Review production logs for credential redaction, sensitive link exposure and retention; define incident response.
- Confirm permissions with both an owner and two clients using direct requests as well as the UI.
- Obtain Alex's explicit approval for real client use. Payments and signatures need established providers and separate test/live approval.

No purchases, production compliance certification or automatic client communication are authorised merely by this checklist.

## Initial contract area acceptance
After applying migration 202610280006, run docs/CONTRACT-AREA.md hosted acceptance with fictional owner/two-client accounts. Verify early invitation, scoped PDF download/return, no auto-verification, full-portal locking until both confirmations, raw provider isolation and revoke/hide/unpublish/disable behaviour. Local SQL/fixture tests are not hosted acceptance.
