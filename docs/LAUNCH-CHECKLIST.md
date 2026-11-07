# ABA Studio: getting ready for real clients

Updated 6 November 2026. The app is already online at https://aba-iota.vercel.app. This checklist concerns using it with real clients, not simply publishing a website. The outcome of the latest individual deployment still needs checking.

**Core portal development is implemented; real-client launch is not yet cleared.** The earlier 80% figure was only a planning estimate. Track the remaining hosted acceptance, recovery/privacy and scanner prerequisites in [GO-LIVE-STATUS.md](GO-LIVE-STATUS.md); a percentage is not a security sign-off.

## What is built

- Owner dashboard, enquiries, manual conversion, clients and projects.
- Brand Identity, Framer Website Design and combined project journeys.
- Stage documents, client returns, questionnaires, feedback and creative approvals.
- Explicit signed-contract/deposit checks, restricted early access and separate final approval/payment checks.
- Manual invitation sharing, account status, password setup/recovery tools and access removal.
- Private file downloads, read-only owner previews, project attention items and handover preparation.
- Confirmed client deletion with scoped file cleanup and historical invoice protection.
- Owner authenticator tools and permission-filtered export (not a full backup).
- Stable stage purposes; Alex confirmed 011 applied.
- Explicit project archive retain/suspend/restore, private dated verification evidence and separate combined-project final approvals, 012 activation confirmed by Alex; hosted behaviour checks remain pending.
- Optional larger/source uploads with quarantine and scanner adapter; 013 is withheld until an approved real scanner is configured/tested.
- Owner Overview charts and clearer brand-colour panels, verified locally with fictional records; hosted review remains pending.
- Editable presentation review dates, visual value/phase/payment/progress charts and retained form entries after rejected/interrupted saves; successful saves still refresh normally.

Alex still designs proposals, contracts, invoices and goodbye PDFs in Illustrator. No automatic signing, automatic signature/payment verification, live payments, automatic invitations or Framer launch/transfer is implied.

## What has already been checked

Alex confirmed hosted owner sign-in, project persistence, the expanded account/Storage/isolation/download/revocation diagnostic and sign-in email receipt/callback on 27 October. Alex later confirmed Tally intake, enquiry conversion, limited previews and independent signed-contract/deposit unlocking. Migrations 010 and 011 are owner-confirmed as applied.

On 2 November Alex confirmed the full live client journey (invitation, questionnaires, uploads, approvals and final delivery), password recovery, MFA and backup restoration. These are owner-reported passes, superseding earlier deferred notes. Detailed exceptional branches and the expanded hosted diagnostic are listed separately below; they are not inferred from a normal journey pass. Alex's mobile screenshot also confirms the lime completion ticks are live. Local automated and fictional-browser checks do not independently establish hosted provider behaviour.

## Before the first real client

### 1. Activate the new stage setting

- [x] Apply `supabase/migrations/202610300011_stage_purposes.sql` after 010. Alex confirmed Success on 30 October 2026. This is owner-reported hosted activation, not hosted behaviour acceptance.
- [ ] On a fictional project, rename a standard stage and confirm its contract/payment check stays attached. Explicitly choose a purpose for custom/ambiguous stages. See [STAGE-PURPOSES.md](STAGE-PURPOSES.md).

This update preserves project verification records and access rules. It does not mark anything signed or paid. The previous behaviour remains available until activation.

### 2. Complete one live client journey

Use fictional projects/accounts only, in separate owner and client browser sessions.

- [x] Normal live invitation/access journey — owner-confirmed 2 November. Exceptional invitation branches remain below.
- [ ] Check returning-account sign-in and expired/revoked invitations. Password recovery is owner-confirmed; do not reset/delete accounts to make an invitation work.
- [ ] Verify discovery-only, released proposal and contract/deposit areas; ensure unreleased files/stages remain hidden.
- [ ] Download an original contract PDF and return it with its explicit original-contract reference. Upload/return must never verify a signature automatically.
- [ ] Verify signed contract and deposit separately. Confirm both are needed for the full creative journey.
- [x] Live questionnaires, uploads, approvals and final delivery — owner-confirmed 2 November. Presentation-revision, website-only separation and locked-access denial branches remain part of the detailed acceptance review.
- [ ] Check final-file denial before both verified final creative approval and final payment, including historical native-invoice full-payment protections. Successful final delivery alone does not establish denial before release.
- [ ] Check new file search/filtering and stage navigation on a phone, including owner preview restrictions.
- [ ] Rerun the expanded owner diagnostic for newer questionnaire/feedback checks and verify it cleans up its own test records.
- [ ] Confirm another client cannot read the fictional project's private records/files, including direct requests; verify hiding, unpublishing and revocation still deny new access.

Earlier hosted passes are retained as evidence; these steps cover the newer workflows and complete end-to-end acceptance. Invitation status is not proof an email was delivered. Invitations remain manually shared: automatic invitation emails are not a launch requirement.

### 3. Protect access and files

- [x] Owner MFA and password recovery — owner-confirmed 2 November. Keep recovery instructions securely; do not rerun MFA SQL or remove a working factor to repeat this check.
- [ ] Review provider email/recipient limits, recovery delivery, rate limits and abuse protection.
- [ ] Review production storage rules, upload format/size limits, cache settings and sensitive download-link handling. Signed links can remain usable for 60 seconds; downloaded files cannot be recalled.
- [x] Initial upload-security decision recorded 6 November: Alex deferred malware scanning and chose current 3 MB PDF/image format/signature checks for now, with external hosting to be revisited as the business grows. These checks do not establish malware-free files. Keep optional 013/larger-source uploads disabled until a real approved scanner is configured and validated; see SECURE-UPLOADS.md. No PC installation, service or purchase was authorised/activated.
- [ ] Review production logs for sensitive data/link redaction and retention, and define how to respond to an incident.

- [ ] Apply independent migration 014 after confirmed 012 (skip deferred 013) and check sequential stage locks, hidden predecessors, Goodbye upload restrictions and owner AI/SVG handover upload/download with a fictional hosted client. See STAGE-JOURNEY.md. No live SQL was applied from the coding workspace.

### 4. Make backups and privacy arrangements real

- [ ] Confirm what Supabase, Storage and Vercel actually back up, how often and how recovery works. Check current plan/capabilities before proposing purchases.
- [x] Backup restoration — owner-confirmed 2 November. Retain the private scope/date/result, including whether private file bytes were restored. A JSON export or schema migration is not a full backup.
- [x] Add the public Privacy & cookies page and links before sign-in/from the portal, using Alex's supplied contact and source-audited cookie explanation. See PRIVACY-NOTICE.md.
- [ ] Finalise and operate retention/deletion rules and a subject-access process; confirm provider agreements, actual data locations and transfer safeguards, then update the public notice where needed. Adding the page does not complete this operational review.
- [ ] Account/audit history and native financial records have deliberate retention rules; client deletion is not a complete personal-data erasure service.

### 5. Finish client-facing material and approve launch

- [ ] Add Alex's actual Illustrator goodbye PDFs and review the real support/licensing/ownership wording. Writing outlines contain placeholders, not agreed terms.
- [ ] Review the hosted charts/colour improvements, mobile pages, contact/help links and current development warnings. Remove or replace warnings only after the launch requirements are met.
- [ ] Alex explicitly approves using real client records after the checks above. The earlier permission to develop and push updates is not launch/security approval.

## Activate and accept the latest development

- [x] Apply 012 once. Alex confirmed successful activation; do not rerun.
- [x] Owner archive/archived-list/restore UI test: Alex confirmed it worked after 012.
- [ ] Test retained/suspended client access, evidence privacy and separate combined approvals using the expanded owner diagnostic (PORTAL-CHECKS.md) and actual client screens. No historical flags/dates are invented; existing combined projects opt in explicitly. See PROJECT-LIFECYCLE.md.
- [ ] Keep 013 pending until the real scanner/worker prerequisite and hosted upload/recovery/lease-cleanup checks in SECURE-UPLOADS.md are satisfied. Existing uploads keep their previous 3 MB behaviour before 013.

## Can follow after launch

- General questionnaire/Tally syncing, automatic booking confirmation and other integrations only if Alex wants them.

Automatic payments, embedded legal signing, new services and purchases require separate approval. Do not add them to increase a completion percentage.
