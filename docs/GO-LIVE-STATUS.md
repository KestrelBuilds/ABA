# ABA Studio: remaining go-live work

Status: 2 November 2026. The core portal workflows and the new archive/history/combined-approval code are implemented. Readiness is tracked by concrete gates; local tests are separate from live acceptance.

## Latest owner confirmation — 2 November 2026

Alex confirmed completion of the full live client journey (invitation, questionnaires, uploads, approvals and final delivery), password recovery, owner MFA and backup restoration. These are owner-reported passes, not new checks run from this coding workspace. No recovery secrets, credentials or client records are needed in this document.

The completed-stage lime ticks are also confirmed live by Alex's mobile screenshot. Earlier pending notes for these confirmed items are superseded. The broader branch-specific checks below (including expired/revoked invitations, archived access, direct cross-client requests and the expanded diagnostic) remain separate unless explicitly recorded as passed. Privacy/retention decisions, real scanner configuration and the final goodbye PDFs remain open. See [PRIVACY-REVIEW.md](PRIVACY-REVIEW.md) for the technical review and remaining decisions.

## Next update for Alex

1. **Done — Alex confirmed migration 012 applied successfully.** 011 was already confirmed successful. Do not rerun either migration. Activation is owner-reported; Alex also confirmed the owner archive/list/restore steps worked on a test project. Client archive restrictions, verification privacy and combined-approval behaviour still need hosted acceptance testing. 013 remains pending until an approved real scanner is configured and tested.
2. In the cloud setup panel, use **Finish review**, save the reviewed settings and publish the environment. Saving the assistant's setup draft alone does not publish it.
3. Run My account → Check client portal access → Run automatic portal checks for the expanded archive, evidence and combined-approval checks. This specific run is not yet owner-confirmed. See PORTAL-CHECKS.md. The normal live journey and password recovery are owner-confirmed; use fictional hosted accounts for any outstanding branch-specific checks such as archived access, evidence privacy, expired/revoked invitations and direct cross-client denial. Invitation links are manually copied/sent; pending status is not email delivery.
4. Design and upload the actual goodbye-packet PDFs, with agreed wording for each project. Starter outlines contain placeholders, not agreed licence/support/ownership promises.

## Remaining operational gates

- **Recovery — owner-confirmed:** Alex reports backup restoration completed. Keep the private record of what was restored and when, including database records AND private Storage bytes, sample byte hashes and permissions. Workspace JSON export is not a full backup; database backups must not be assumed to include uploaded bytes. No restore has been performed from this workspace.
- **Account continuity — owner-confirmed:** Alex reports owner MFA and password recovery completed. Keep provider recovery instructions and a second trusted recovery method securely outside the repository; never remove the only working authenticator to test recovery or share recovery secrets in chat.
- **Privacy/retention:** document what enquiries, project questionnaires, client files, verification evidence, audit/Auth records and quarantine are retained, why, for how long and how removal requests are handled. Set privacy notices and processor terms for existing providers and any proposed scanner. Deletion preserves audit/Auth/financial restrictions; it is not full personal-data erasure. Obtain appropriate professional review where needed.
- **Upload protection:** choose/approve and configure a real scanner before optional migration 013. The adapter/quarantine/source-upload code is implemented, but no live scanner or new service is provisioned. Follow SECURE-UPLOADS.md for configuration and acceptance. Existing 3 MB uploads continue without malware-scan history until 013; decide whether that limitation is acceptable for the intended launch.
- **Production review:** verify owner/client isolation, provider rate limits, security headers, private download/revocation behaviour, error monitoring and a fictional end-to-end project from enquiry through final handover. Previous owner-run checks passed specific hosted behaviours; newer changes require their own acceptance.

No live credentials were available in this coding environment. It has not changed real Supabase records, sent client emails, purchased services, applied SQL or completed hosted acceptance. GitHub pushes can trigger the existing Vercel deployment; inspect the deployment outcome before describing a release as live.
