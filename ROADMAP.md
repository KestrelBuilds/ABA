# ABA Studio roadmap

## Phase 1 — Interactive foundation

Implemented: Next.js/TypeScript foundation, responsive design tokens, admin navigation and calculated overview, fictional clients and projects, client creation/search, enquiries with status and conversion, three project templates, workflow editing/reordering/visibility, milestone progress, project notes/activity, manual payment tracking and client preview. Browser persistence only.
Follow-up polish: native task lists, editable client profiles and project settings, richer deadline management, keyboard accessibility audit and further component extraction. Real form submissions and secure portals are not part of this demo.

## Phase 2 — Secure client workspace

1. Create Supabase development project and configure secure account bindings.
2. Design schema/migrations, admin and client roles, ownership policies, server-side validation and audit records.
3. Test isolation using two client accounts and an admin before real data.
4. Invite clients after contract/deposit verification; implement safe account recovery and sessions.
5. Add private files with controlled signed downloads, questionnaire responses, feedback and approvals.
6. Verify signed Tally webhooks, deduplication, consent and enquiry ingestion.
7. Establish backups, retention/deletion policies, privacy notices and UK GDPR review.

## Phase 3 — Business management

Proposal/contract templates and established signing provider, invoice generation, Stripe test-mode integration, verified payment webhooks, 50/50 payment tracking, financial reporting, controlled final delivery and goodbye packs. Separate approval before live payments or public deployment.

## Phase 4 — Automation

Email notifications, invoice reminders, automatic onboarding, native forms, client discussions/attachments, calendar integration and deeper analytics. Keep costs proportionate for one independent designer.

## Phase 2 status — code built, hosted verification pending

Implemented: Supabase Auth adapters and protected routes, persistent owner/client workspace, role/ownership policies, separate internal notes, configurable workflows with workstream progress, gated client invitations and revocation, native discovery/goodbye submissions, private document upload/publication/download, creative feedback/revision/approval records and database audit triggers. PostgreSQL policies are locally tested with two clients and an owner.
Required next: connect a Supabase development project, provision owner, configure email/redirects and run hosted isolation/auth/storage checks. Then address owner MFA enforcement, account recovery, invite resend for existing accounts, client file attachments, larger deliverable formats/malware scanning, production retention/export/deletion, and final privacy/deployment review. Native enquiry ingestion/Tally webhook sync is not implemented.


### Hosted checks confirmed — 27 October 2026
Owner supplied a Passed screenshot for the expanded account/Storage diagnostic: client isolation, actual PDF/signed downloads, protected/final files and access revocation all passed; temporary records/accounts/files were removed. Owner separately confirmed test-email receipt and successful dashboard return after correcting Supabase Auth URL settings. These checks ran on the deployed Vercel app, not from this credential-free coding workspace. Earlier pending/failure notes are superseded for these specific checks. Full production security/privacy review remains outstanding; automatic client-invitation emails remain unimplemented. The original generic revoked-file failure's cause is not independently proven.

## Everyday workspace update
Implemented compact editable workflows, mobile project-section navigation, client/project edits, shared questionnaire completeness validation and expanded hosted creative-journey tests. Supabase invitation-email API support is gated on explicit email-template setup; delivery testing is pending. Remaining launch work is tracked in docs/LAUNCH-CHECKLIST.md, including owner MFA enforcement, recovery, backups/restore, privacy/retention and full client browser acceptance.

Owner MFA enrollment/challenge and database assurance enforcement are implemented, pending the additional SQL upgrade and owner authenticator setup. Permission-filtered JSON data export is implemented. Provider backups/restore, email-template configuration, MFA recovery rehearsal and privacy/retention decisions remain required launch prerequisites.

## Project management and supplied branding
Implemented dated client actions, editable scope/support, gated handover records, presentation versions/review deadlines, account-name/version approval snapshots and private PDF/image client assets. These await migration 202610280004 and hosted acceptance; existing projects remain usable beforehand. Applied the supplied Alex Bell Arts logo/favicons and four-colour palette; owner/client areas are named ABA Owner Dashboard and ABA Client Portal. Exact fonts remain pending font names/files. Expanded design/ZIP uploads, malware scanning, individual stage deadlines and provider backup/privacy completion remain follow-up work.

Phase 3 foundation implemented: PDF-first stage workspaces, public Calendly link, per-stage documents/returns, reusable native proposals, 50/50 invoice lifecycle, invoice ledger and private PDF downloads. Apply migration 202610280005 and perform hosted acceptance before real use. Remaining: full signing-provider integration, pre-booking client document access, larger/source uploads, VAT/tax handling, partial payments/credit notes/refunds and live payment integration. External PDF invoices do not automatically populate the native invoice ledger.

Journey controls follow-up: implemented verified contract/payment/approval records with standard journey status and clarifies the shared file library. Automated tests, browser journeys and production build passed; hosted acceptance remains pending. No new migration is required. Custom workflow stages retain ordinary progress and use the explicit journey verification section.

File visibility explanations are now shared between stage files and All project files, with preview-parity regression coverage. Live-site checks from the coding environment need the app hostname allowed in environment network settings; hosted owner/client acceptance still requires authenticated access.

Database/UI review: implemented an owner-only project-at-a-glance summary using existing records. Next recommended work is stable stage-purpose keys, explicit archival, invitation-state visibility, dated verification evidence and per-workstream approval evidence. These require separate additive schema/access design; see docs/DATABASE-UX-REVIEW.md.

Owner scope decision: built-in proposal/invoice generation and Finance navigation removed. Illustrator PDFs in journey stages are the chosen workflow. Do not expand native finance generation; retain previous generated records and protected payment/download/void paths only. No database migration or data deletion.

Restricted contract-only workflow implemented behind additive migration 202610280006 and explicit owner opt-in. Clients can be invited to download externally signable PDFs and return signed copies without full project access. Owner verifies contract plus deposit to unlock full portal. Local tests cover isolation; hosted activation/acceptance remain pending. Embedded signing-provider integration, automatic signature verification and general sequential stage gates remain out of scope.

Folder-aligned templates implemented for newly created live projects: 11-stage branding, 11-stage Framer website and 16-stage combined (one shared goodbye). Existing projects remain intact. Alex will provide the actual goodbye packet later; no content is fabricated. No additional migration required for template changes.

Owner client deletion implemented behind migration 202610280007: confirmed project/file cleanup, immediate access revocation, resumable Storage cleanup and audit/Auth preservation. Native financial history blocks deletion. Hosted activation/acceptance remains pending. Archival and complete retention/erasure workflows remain separate follow-ups.

Implemented a staged prospective-client area (discovery → proposal → contract/deposit → verified full journey), private enquiry inbox, manual conversion and signed/deduplicated Tally intake. Owner preview hides the planned full journey before onboarding. Source form delivery and hosted Storage/acceptance require setup; no Calendly API booking confirmation, automatic invitations, signing-provider execution or live payments are claimed.

Interface clarity update: grouped enquiry answers and conversion controls, separate client next-step/document/verification cards, action-specific verification buttons, clearer stage file areas and responsive touch controls. No schema changes or altered access rules. Owner confirmed hosted Tally intake, conversion, restricted previews and contract/deposit gates on 29 October; actual invited-client PDF return and remaining hosted checks still require acceptance.
