# ABA Studio: remaining go-live work

Status: 30 October 2026. The core portal workflows and the new archive/history/combined-approval code are implemented. A completion percentage would hide the remaining external checks, so readiness is tracked by concrete gates instead. Local tests are separate from live acceptance.

## Next update for Alex

1. **Done — Alex confirmed migration 012 applied successfully.** 011 was already confirmed successful. Do not rerun either migration. Activation is owner-reported; hosted archive/history/combined-approval behaviour still needs acceptance testing on fictional projects. 013 remains pending until an approved real scanner is configured and tested.
2. In the cloud setup panel, use **Finish review**, save the reviewed settings and publish the environment. Saving the assistant's setup draft alone does not publish it.
3. Use fictional hosted projects to verify the new controls: archive retained read-only/suspended/restored; private evidence and combined approvals; new-account invitation/password setup, returning-account sign-in and password recovery; contract returns and restricted/full/final downloads. Invitation links are manually copied/sent; pending status is not email delivery.
4. Design and upload the actual goodbye-packet PDFs, with agreed wording for each project. Starter outlines contain placeholders, not agreed licence/support/ownership promises.

## Remaining operational gates

- **Recovery:** confirm current provider backup coverage and retention for database AND private Storage bytes. Keep an encrypted, access-controlled file inventory/backup and perform a restore into an isolated non-production project. Check record counts, relationships, sample byte hashes and permissions, record the date/result and delete only the disposable restore afterwards. Workspace JSON export is not a full backup. Never assume a database backup contains uploaded file bytes. No backup plan purchase or real restore has been performed here.
- **Account continuity:** enable/test owner MFA, record provider recovery steps securely, test a second trusted recovery method under the provider's supported process and document who can recover hosting/Supabase access. Do not remove the only working authenticator to test recovery. Never share recovery secrets in chat.
- **Privacy/retention:** document what enquiries, project questionnaires, client files, verification evidence, audit/Auth records and quarantine are retained, why, for how long and how removal requests are handled. Set privacy notices and processor terms for existing providers and any proposed scanner. Deletion preserves audit/Auth/financial restrictions; it is not full personal-data erasure. Obtain appropriate professional review where needed.
- **Upload protection:** choose/approve and configure a real scanner before optional migration 013. The adapter/quarantine/source-upload code is implemented, but no live scanner or new service is provisioned. Follow SECURE-UPLOADS.md for configuration and acceptance. Existing 3 MB uploads continue without malware-scan history until 013; decide whether that limitation is acceptable for the intended launch.
- **Production review:** verify owner/client isolation, provider rate limits, security headers, private download/revocation behaviour, error monitoring and a fictional end-to-end project from enquiry through final handover. Previous owner-run checks passed specific hosted behaviours; newer changes require their own acceptance.

No live credentials were available in this coding environment. It has not changed real Supabase records, sent client emails, purchased services, applied SQL or completed hosted acceptance. GitHub pushes can trigger the existing Vercel deployment; inspect the deployment outcome before describing a release as live.
