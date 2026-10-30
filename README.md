# ABA Studio

A considered workspace for Alex Bell Arts. Phase 1 is an interactive application using **fictional demo data**, with admin management and a client journey preview.

## Latest development update — 30 October 2026

Project archiving with an explicit client-access decision, dated private verification history and separate combined-project approvals are implemented behind additive migration **012**. Existing flags/workflows stay unchanged until the owner deliberately acts. See [PROJECT-LIFECYCLE.md](docs/PROJECT-LIFECYCLE.md).

Optional **013** adds quarantined, directly uploaded 25 MB PDF/image/Illustrator/ZIP files. **Do not apply 013 until an approved real scanner is configured and tested.** No new service is provisioned. Existing uploads retain their old behaviour before 013. See [SECURE-UPLOADS.md](docs/SECURE-UPLOADS.md) and [GO-LIVE-STATUS.md](docs/GO-LIVE-STATUS.md) for the exact activation and remaining hosted/operational work.

The owner-run **My account → Check client portal access** diagnostic now includes archive retain/suspend/restore, private dated verification history and separate combined-project final release. Results show each group and verify temporary-file cleanup before reporting success. It requires no new SQL beyond already-applied 012. See [PORTAL-CHECKS.md](docs/PORTAL-CHECKS.md); the expanded hosted run remains pending.

Owner **Projects → Find a project** now combines project/client-name search, service and archive filters, and estimated-completion/name sorting. Clear filters restores the active view; overview shortcuts clear stale filters before opening a project. No SQL is required. See [PROJECT-BROWSING.md](docs/PROJECT-BROWSING.md).

## Run locally

Requires Node.js 22 or later and npm. The PDF content tests also require `pdftotext` (Poppler utilities; on Debian/Ubuntu install `poppler-utils`). This is a development test dependency only.

```sh
npm ci
npm run dev
```

Open the application on port 3000 using your development environment's supported preview mechanism. For production build validation: `npm run build`, then `npm start`. No accounts or secrets are required for Phase 1. Do not publish this demo as a real client portal.

## What works

- Overview with calculated project and payment totals, deadlines and enquiries.
- Client creation and searching; enquiry status changes and conversion to clients.
- Project creation with Brand Identity, Website Design or Both templates.
- Shared acquisition plus independent creative workstreams for combined projects.
- Rename, add, remove and reorder milestones; six statuses; client visibility controls.
- Progress from completed milestones, manual demo payment/contract records, internal notes and activity history.
- Client preview with contract/deposit gates, visible milestones, relevant Tally links and final delivery gate.
- Browser storage preserves changes on the same browser and origin. Clear site storage to reset the fictional examples.

## Demonstration limitations (`/demo` only)

The separate connected workspace is described below. In `/demo`, there is no authentication, database, secure file storage, email, invoice generation, payment processing, signing, Tally submission sync or real feedback/approval submission. All browser records are accessible to the local user. Visibility controls affect presentation only. Portal access and delivery gates are demonstration business logic, not security. No files are provided for download. Currency is GBP; demo snapshot dates are explicitly labelled. Recorded payment totals are all-time, not monthly revenue. Native questionnaires and internal task lists remain on the roadmap.

The external Tally enquiry form is public acquisition; the AI Logo Direction Exercise appears only for branding projects; goodbye feedback appears after demo delivery conditions. Existing external forms may send real submissions to their owner; use fictional details during testing.

## Structure

- `app/`: Next.js page, metadata, layout, visual tokens and responsive CSS.
- `components/studio.tsx`: interactive admin and portal demo.
- `lib/projects.ts`: domain types, templates and gating/progress functions.
- `tests/`: workflow rule tests.

Run `npm test`, `npm run typecheck`, and `npm run build`. Phase 2 will move state behind secure Supabase access before real client use. See AGENTS.md for business rules and ROADMAP.md for delivery stages.

## Browser validation

With the app running on port 3000 and system Chromium installed, run `node tests/browser.cjs`. This uses an isolated browser session and fictional test records; screenshots are written under `/tmp`.

## Phase 2 — Private workspace (hosted development checks passed)

The secure workspace is now implemented separately from the fictional demo:

- `/`: welcome page; `/demo`: Phase 1 examples.
- `/login`: Supabase account sign-in; `/workspace`: owner management; `/portal`: private client projects.
- Native project questionnaires, creative feedback/approvals, private documents and owner-controlled final delivery.
- Database-enforced ownership, admin-only notes/controls, invitation acceptance/revocation and action audit records.

Follow [the connection guide](docs/PHASE2-SETUP.md) to create a Supabase development project, apply migrations, provision your owner account and configure authentication/storage. `.env.example` lists settings; never commit actual keys. No Supabase credentials are currently configured in this environment, so connected routes fail safely to sign-in/setup.

The earlier “What works” and “Demonstration limitations” sections describe `/demo`. Phase 2 is persisted in Supabase once connected; it does not import or write private records to demo browser storage. Production build/type checks and local SQL policies can be validated now; hosted sign-in, email and Storage require the acceptance checklist. See [security notes](docs/SECURITY.md). Do not use real client data or publish until that review passes.

### Hosted verification — 27 October 2026
The owner confirmed successful password sign-in, saved client/project creation and milestone updates on the deployed app. The expanded owner-run automatic check returned Passed (screenshot provided): two client sign-ins, invitation acceptance, project isolation, hidden milestones/internal notes, payment protection, document visibility, actual PDF uploads/downloads, signed downloads, private-file restrictions, final-payment/approval gates and access revocation. Temporary accounts/files/records were removed and audit history retained.

The owner separately confirmed receipt of a fresh test sign-in email and successful return to the dashboard after correcting Supabase Auth URL settings. The earlier generic revoked-file failure no longer reproduces in the hosted check after the uncached transport changes; this does not independently prove which caching/error condition caused the original result. No additional SQL rerun is required for that code change.

These are development checks, not full launch approval. Client invitation links are still manually shared; automated invitation email delivery is not implemented. MFA enforcement, backup/restore, privacy/retention, upload scanning and the remaining hosted acceptance checklist still require review before real client use. The coding workspace has no Supabase credentials; hosted validation ran through the owner's signed-in Vercel app.

## Everyday workspace update
The connected workspace now has expandable milestone editors, mobile section shortcuts and owner editing of client/project details. Client email changes after invitations are blocked pending an identity review. The automatic hosted check also exercises questionnaire submission and creative feedback/approvals; rerun it to validate those added checks. Supabase invitation email sending is implemented but disabled until the Invite template and readiness flag are configured; see the connection guide. No migration rerun is needed for this update. See [the remaining launch checklist](docs/LAUNCH-CHECKLIST.md) before real client use.

### Account protection upgrade
The new authenticator screen and permission-filtered JSON data export are implemented. Apply only `supabase/migrations/202610270003_owner_mfa.sql` as the next SQL upgrade; do not rerun the initial setup files. Then open My account → Protect my account with an authenticator to enrol and verify your own device. The database and app require high-assurance owner sessions once a factor is verified. Hosted MFA and recovery remain unverified until this setup is completed. See the connection guide for recovery and the remaining launch checklist for provider backup/privacy requirements.

### Automated client-screen journey
Run `node tests/client-journey-browser.cjs` with system Chromium available. It starts/stops its own local Next.js dev server and fictional Supabase HTTP fixture on ports 35431/35432, without real credentials, clients or email. It exercises actual sign-in screens/server actions, questionnaire submission, revisions, creative approval, payment-only final-file restriction, final release/download and mobile overflow. This verifies UI integration against a fixture, not hosted provider behaviour or live email invitations. It uses `.next` as the normal development cache, so do not run it alongside another local Next.js build/dev process.

### Notion reference received and implemented
The owner supplied a client-free master portal export. The client home and six navigation sections, native branding/website questions, review checklists and handover/help guidance now follow it. Existing responses remain unchanged. Shared business questions are asked once for combined projects. See [the reference mapping](docs/reference/NOTION-MAPPING.md) for implementation details and remaining gaps; linked Tally form internals were not part of the export. No SQL upgrade is required for this update.

### Reviewing the Notion-style portal as the owner
Open the owner workspace, choose a project and click **Preview client portal**. It renders the actual client layout with submissions/account actions disabled and internal records excluded. If contract/deposit conditions are not met, it explicitly previews the planned layout without granting client access or showing locked documents. Use **Back to owner workspace** to leave. The fictional demo remains separate.

## Project-management and brand update
The supplied Alex Bell Arts logo and purple/lime palette are now applied. New project tools require the one-time SQL upgrade described in [PROJECT-MANAGEMENT-UPGRADE.md](docs/PROJECT-MANAGEMENT-UPGRADE.md): dated client actions, editable briefs/support, protected handover, versioned reviews and private client asset upload. The app keeps existing workflows usable until that upgrade is applied. Asset uploads currently support PDF/PNG/JPEG/WebP up to 3 MB; larger/source files need an agreed external method. See [BRANDING.md](docs/BRANDING.md) for supplied assets and outstanding typography details.

## Illustrator PDF documents
Open a journey stage to upload your own proposal, contract, invoice, presentation or handover PDF. Clients with portal access can download shared files and return completed/signed copies in the same stage. Built-in generation and Finance navigation have been removed. Only projects with previous generated records show a collapsed history section, retaining downloads and payment protections. No SQL update is needed. See [document guidance](docs/BUSINESS-DOCUMENTS.md).

### Journey confirmations
Confirm the actual signed contract and received deposit inside Contract and Deposit to unlock client access. Final approval and final payment use the same explicit verification pattern. A progress change or returned PDF never confirms a signature/payment. Built-in invoices use their Record full payment action. Custom/renamed stages keep their own progress; use the verification section at the top of the journey for the project’s access records. All project files collects the same stage documents, labelled by stage, plus any project-wide files.

Both file views show why a shared file is still locked, including missing contract/deposit verification, an internal stage or final delivery requirements. Publication alone does not unlock access.

All project files now groups those records in journey order, with search by file name/stage/version and combined file-type/stage filters. Clear filters restores the list. Open journey stage opens and focuses the existing stage for owners and clients. Project-wide uploads sit in a collapsed section; upload stage-specific work in its stage. Client upload and explicitly linked contract-return labels remain distinct from verified signatures/payments. Creative approval choices apply to presentations; other files accept comments/revision requests. Filters use only records already returned by the current account's permissions or read-only preview, including their available filter choices. No SQL upgrade or duplicate uploads.

### Simpler owner project overview
Project at a glance shows the next milestone, portal eligibility and final-delivery requirements together. Open next step expands the relevant stage or built-in invoices. Eligibility does not mean an invitation was sent. See [the database/UI review](docs/DATABASE-UX-REVIEW.md) for the schema review and next recommendations.

### Initial contract signing and return
A restricted contract-only area now supports invited clients before full onboarding, after applying migration 202610280006. Explicitly enable it inside a client-visible stage with shared Contract PDFs. Clients sign externally in Acrobat and return the PDF; Alex reviews it and verifies contract/deposit before the full portal opens. See [activation and hosted checks](docs/CONTRACT-AREA.md). No automatic signatures, payment confirmations or historical opt-ins.

### New project templates
New branding projects follow Alex’s supplied 10-folder layout plus Goodbye Packet. Website projects use the same five opening stages, then Website Brief & Content, Page Structure & Layout, Website Design, Framer Build & Review, Launch & Handover and Goodbye Packet. Combined projects share acquisition and one goodbye stage. Existing projects/files are unchanged. See [exact folder lists](docs/PROJECT-TEMPLATES.md). No extra SQL is needed for templates.

### Removing fictional clients
After applying migration 202610280007, use Clients → Delete client permanently. Exact-name confirmation is required. Linked projects/uploads are removed with retry support; financial records block deletion and audit/sign-in-account history is retained. See [deletion setup and behaviour](docs/CLIENT-DELETION.md).

### Potential clients and automatic enquiries
The pre-onboarding view now starts with discovery booking and shows proposal/contract/deposit PDFs only as the owner releases each step. Full creative stages stay hidden until verified contract/deposit. Track non-proceeding enquiries without deleting them. The owner Enquiries inbox supports manual word-of-mouth records and authenticated Tally webhooks; no invitation is automatic. See [single setup update and Tally connection steps](docs/POTENTIAL-CLIENTS-AND-TALLY.md). Hosted configuration/acceptance remains required.

### Clearer everyday screens
The connected enquiry inbox, potential-client area and project journey now use grouped settings, distinct document cards and clearer action labels. Enquiry answers expand separately from project creation; sharing, verification and stage progress have separate visual treatments. Mobile controls are larger, and download labels work for both PDFs and supported images. No additional SQL is required.

### Owner-confirmed hosted checks — 29 October 2026
Alex reported the combined SQL update succeeded, supplied a screenshot showing a fictional Tally submission with its answers in the live Enquiries inbox, and confirmed enquiry conversion, restricted discovery/agreement previews and independent contract/deposit unlocking worked. This establishes those owner-run checks; actual invited-client signing/return, webhook retry/invalid-signature hosted checks and the remaining security/privacy acceptance are still pending. The subsequent interface update is verified locally, not yet accepted on the hosted app.

### Clear invitations and returning accounts
Projects now include **Invite / manage client access**. Under Clients, **Client portal** shows invitation/account status, explains sharing eligibility and provides a copyable invitation link. Returning clients reuse their own account; existing accounts are never reset/deleted to make an invitation work. The login page now includes password recovery, and invitation acceptance leads to clear password setup. Apply [migration 010](supabase/migrations/202610290010_client_invitations.sql) after 009. See [owner steps and email setup](docs/CLIENT-INVITATIONS.md). Hosted invitation/recovery acceptance is still required.

### Attention dashboard and handover preparation
Overview now brings together new enquiries, proposal replies, referenced contract returns, overdue client actions, invitation follow-ups and final files needing sharing review. Each item opens its existing project/client section; nothing is auto-verified or sent. The project summary separates the released potential-client area, account connection and full journey gates.

In a project, expand **Prepare handover & goodbye packet** for file/support/release checks and a copyable branding, Framer or combined writing outline. Design the actual PDF in Illustrator, then upload it to the relevant stage. Drafts contain placeholders and do not save/share themselves. New standard proposal/contract/invoice uploads suggest their document type; Goodbye Packet and Framer Launch & Handover suggest final release. No extra SQL is needed. See [handover guidance](docs/HANDOVER-GUIDE.md).

Owner confirmed migration 010 succeeded. Live invitation/password-recovery acceptance is postponed at the owner's request; local/fixture checks are separate from hosted evidence.

### Stage purposes independent of names
After [migration 011](supabase/migrations/202610300011_stage_purposes.sql), stages have a separate **Stage purpose** setting. Renaming preserves their contract/payment/approval checks. Only unambiguous standard verification stages are mapped; choose purposes explicitly for custom/ambiguous stages. Existing verification records, progress, native invoice protections and access rules remain unchanged. Before activation the previous workflow remains usable. See [activation and validation](docs/STAGE-PURPOSES.md).

### Overview charts and clearer panels
The owner Overview now shows projects by their next phase and project-value payment progress. Filter by branding, websites or combined work, then select a phase bar to open its projects. Payment figures use current project values and explicit payment checks; they are not an invoice ledger or bank total. The purple/lime/black palette now gives panels, stages and nested controls clearer separation. No extra database update is needed for charts or colours. See [the current launch checklist](docs/LAUNCH-CHECKLIST.md) for what remains before real client use.

To check charts and responsive panel styling with fictional records, run `node tests/client-journey-browser.cjs --insights` on its own, without another Next server/build sharing `.next`.

### ABA creative direction
The Studio follows Alex's selected **Moodboard 02**: bold display headings, mono labels, a black/white foundation and purple/lime accents. “Loyalty is key” and the personalised, research-led design approach now inform the welcome/client copy and shared signature. Fonts are served locally with open licences. See [creative-direction mapping](docs/reference/ABA-CREATIVE-DIRECTION.md); no SQL or external font service is required.
