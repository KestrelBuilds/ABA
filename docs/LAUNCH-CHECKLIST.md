# ABA Studio: getting ready for real clients

Updated 30 October 2026. The app is already online at https://aba-iota.vercel.app. This checklist concerns using it with real clients, not simply publishing a website.

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
- Explicit project archive retain/suspend/restore, private dated verification evidence and separate combined-project final approvals, ready for owner activation with 012.
- Optional larger/source uploads with quarantine and scanner adapter; 013 is withheld until an approved real scanner is configured/tested.
- Owner Overview charts and clearer brand-colour panels, verified locally with fictional records; hosted review remains pending.

Alex still designs proposals, contracts, invoices and goodbye PDFs in Illustrator. No automatic signing, automatic signature/payment verification, live payments, automatic invitations or Framer launch/transfer is implied.

## What has already been checked

Alex confirmed hosted owner sign-in, project persistence, the expanded account/Storage/isolation/download/revocation diagnostic and sign-in email receipt/callback on 27 October. Alex later confirmed Tally intake, enquiry conversion, limited previews and independent signed-contract/deposit unlocking. Migrations 010 and 011 are owner-confirmed as applied.

Local automated and fictional-browser checks cover newer features, but do not prove those newer workflows on hosted Supabase/Vercel. Live invitation/password setup/recovery acceptance was deferred by Alex and remains outstanding. Do not repeat already-applied migrations or treat the old workspace connection failure as an application defect.

## Before the first real client

### 1. Activate the new stage setting

- [x] Apply `supabase/migrations/202610300011_stage_purposes.sql` after 010. Alex confirmed Success on 30 October 2026. This is owner-reported hosted activation, not hosted behaviour acceptance.
- [ ] On a fictional project, rename a standard stage and confirm its contract/payment check stays attached. Explicitly choose a purpose for custom/ambiguous stages. See [STAGE-PURPOSES.md](STAGE-PURPOSES.md).

This update preserves project verification records and access rules. It does not mark anything signed or paid. The previous behaviour remains available until activation.

### 2. Complete one live client journey

Use fictional projects/accounts only, in separate owner and client browser sessions.

- [ ] Manually share an invitation, set up a new account password and accept access.
- [ ] Check returning-account sign-in, expired/revoked invitations and password recovery. Do not reset/delete accounts to make an invitation work.
- [ ] Verify discovery-only, released proposal and contract/deposit areas; ensure unreleased files/stages remain hidden.
- [ ] Download an original contract PDF and return it with its explicit original-contract reference. Upload/return must never verify a signature automatically.
- [ ] Verify signed contract and deposit separately. Confirm both are needed for the full creative journey.
- [ ] Submit the correct service questionnaire; exercise a presentation revision and creative approval. Website-only clients must not receive branding questions.
- [ ] Check final files/handover remain locked until both verified final creative approval and final payment. Keep historical native-invoice full-payment protections.
- [ ] Check new file search/filtering and stage navigation on a phone, including owner preview restrictions.
- [ ] Rerun the expanded owner diagnostic for newer questionnaire/feedback checks and verify it cleans up its own test records.
- [ ] Confirm another client cannot read the fictional project's private records/files, including direct requests; verify hiding, unpublishing and revocation still deny new access.

Earlier hosted passes are retained as evidence; these steps cover the newer workflows and complete end-to-end acceptance. Invitation status is not proof an email was delivered. Invitations remain manually shared: automatic invitation emails are not a launch requirement.

### 3. Protect access and files

- [ ] Confirm owner authenticator enrolment, a fresh-session challenge and a safe recovery procedure. The MFA code/migration already exists; do not rerun its SQL unnecessarily.
- [ ] Review provider email/recipient limits, recovery delivery, rate limits and abuse protection.
- [ ] Review production storage rules, upload format/size limits, cache settings and sensitive download-link handling. Signed links can remain usable for 60 seconds; downloaded files cannot be recalled.
- [ ] Approve/configure a real scanner and validate it before optional 013 activation and real file exchange. The adapter/quarantine/source-upload code is implemented; no live malware engine is configured or proven by local tests. See SECURE-UPLOADS.md. No new service or purchase is authorised by this checklist.
- [ ] Review production logs for sensitive data/link redaction and retention, and define how to respond to an incident.

### 4. Make backups and privacy arrangements real

- [ ] Confirm what Supabase, Storage and Vercel actually back up, how often and how recovery works. Check current plan/capabilities before proposing purchases.
- [ ] Perform a restore rehearsal that includes the required records and private file bytes. A JSON export or schema migration is not a full backup.
- [ ] Set a privacy notice, retention/deletion rules and subject-access process; review provider agreements, data locations and transfer safeguards.
- [ ] Account/audit history and native financial records have deliberate retention rules; client deletion is not a complete personal-data erasure service.

### 5. Finish client-facing material and approve launch

- [ ] Add Alex's actual Illustrator goodbye PDFs and review the real support/licensing/ownership wording. Writing outlines contain placeholders, not agreed terms.
- [ ] Review the hosted charts/colour improvements, mobile pages, contact/help links and current development warnings. Remove or replace warnings only after the launch requirements are met.
- [ ] Alex explicitly approves using real client records after the checks above. The earlier permission to develop and push updates is not launch/security approval.

## Activate and accept the latest development

- [ ] Apply 012 once after a backup/checkpoint and test fictional archive retain/suspend/restore, evidence privacy and separate combined approvals. No historical flags/dates are invented; existing combined projects opt in explicitly. See PROJECT-LIFECYCLE.md.
- [ ] Keep 013 pending until the real scanner/worker prerequisite and hosted upload/recovery/lease-cleanup checks in SECURE-UPLOADS.md are satisfied. Existing uploads keep their previous 3 MB behaviour before 013.

## Can follow after launch

- General questionnaire/Tally syncing, automatic booking confirmation and other integrations only if Alex wants them.

Automatic payments, embedded legal signing, new services and purchases require separate approval. Do not add them to increase a completion percentage.
