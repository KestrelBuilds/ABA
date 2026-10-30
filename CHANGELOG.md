# Changelog

## 0.1.0 — 27 October 2026

- Created ABA Studio’s first working Phase 1 demonstration with Next.js, React and strict TypeScript.
- Added a responsive neutral design system, studio dashboard, clients, enquiries, finance and documents roadmap view.
- Added fictional Forma Objects brand identity and Fieldwork Coffee website projects.
- Added project creation with shared acquisition and brand, website or combined workstreams.
- Added configurable milestones, completion-based progress, client visibility, local notes and action history.
- Added browser persistence, demo onboarding/payment records and client portal preview with relevant Tally links.
- Documented security boundaries, future architecture and delivery roadmap.
- Validation: five domain tests passed, strict type check and production build passed, plus Chromium checks for combined creation, persistence, onboarding, website portal separation, mobile layout and client creation.

## 0.2.0 — Phase 2 implementation (hosted connection pending)

- Separated the fictional demo (`/demo`) from the sign-in and connected owner/client workspaces.
- Implemented Supabase-backed identity checks, explicit owner/client roles, session refresh and protected routes/actions.
- Added PostgreSQL schema, row-level ownership rules, private note separation, audit triggers and atomic workflow/project controls.
- Added owner client/project creation, milestone edits/reordering, manual onboarding and final delivery controls.
- Added single-use invitation link generation/acceptance and client access revocation without automatic email dispatch.
- Added native discovery/goodbye questionnaires, document feedback, revision requests and creative approval records.
- Added private PDF/image uploads, controlled publication and short-lived download URLs with final-payment/approval gates.
- Added local PostgreSQL isolation tests, validation tests, protected-route browser checks, connection instructions and security review documentation.
- Hosted Supabase Auth/email/Storage operation remains unverified until a development project is connected. No public deployment or real client use is approved.

### Connection compatibility fix
- Accept Vercel's `NEXT_PUBLIC_SUPABASE_ANON_KEY` alongside the newer publishable key name, and `SUPABASE_URL` as a server-side URL fallback.
- Share connection resolution between authentication and session refresh; service-role keys remain excluded from user-session configuration.

### Owner-run hosted portal checks
- Added My account → Check client portal access, which creates two temporary confirmed test accounts without sending email.
- Checks real hosted client sessions, invitation acceptance, separate projects, hidden notes/milestones, protected payment writes, document metadata visibility and access revocation.
- Automatically removes this run's temporary records/accounts and retains audit history; reports cleanup failures explicitly. Requires the existing server-only service key. Does not claim to test email delivery or actual file downloads.

### Live storage and owner email checks
- Extended owner diagnostics with actual temporary PDF uploads, byte-checked downloads and signed-link requests under regular client sessions.
- Checks anonymous/other-client/unpublished/final-delivery restrictions and file access after revocation; removes temporary files before metadata cleanup.
- Added a separate owner-only email test using the verified owner's account address, with provider rejection/rate-limit feedback. Accepted email requests are explicitly distinguished from confirmed delivery.
- Use the platform's production hostname as an email/invitation origin fallback when APP_ORIGIN is absent; reject insecure or credential-bearing redirect configuration.

### File revocation investigation
- Hosted owner diagnostics reported an unresolved revoked-client file check; no readiness claim is made from that failure.
- Added no-store transport with explicit abort signals for all server Supabase clients, avoiding Next.js request memoization for permission-sensitive reads.
- Storage probes use fresh cache nonces; new private uploads use zero-second cache lifetime and generated download links include a nonce.
- Denial checks distinguish unexpected file bytes, unexpected signed-link issuance and network/provider failures, and recognise nonnumeric Storage error codes using the actual HTTP status.
- Owner confirmed test-email delivery; its destination was localhost. The required Supabase Site URL/redirect allowlist correction is documented; successful callback remains pending.


### Hosted checks confirmed — 27 October 2026
Owner supplied a Passed screenshot for the expanded account/Storage diagnostic: client isolation, actual PDF/signed downloads, protected/final files and access revocation all passed; temporary records/accounts/files were removed. Owner separately confirmed test-email receipt and successful dashboard return after correcting Supabase Auth URL settings. These checks ran on the deployed Vercel app, not from this credential-free coding workspace. Earlier pending/failure notes are superseded for these specific checks. Full production security/privacy review remains outstanding; automatic client-invitation emails remain unimplemented. The original generic revoked-file failure's cause is not independently proven.

## 0.3.0 — Everyday workspace improvements
- Compact expandable milestone editors and mobile shortcuts to project sections.
- Added validated owner editing for client contact details and project name, budget and deadline. Client email changes are blocked after invitation/account creation to avoid mismatched identity.
- Shared questionnaire prompts between UI and required-answer validation.
- Expanded hosted checks to submit/review branding and website questionnaires, revision requests and creative approvals, and confirm approvals do not bypass payment/delivery controls.
- Added owner-requested Supabase invitation emails behind an explicit email-template readiness flag; private links remain the default. Hosted email invitation testing is pending configuration.
- Validation: 23 local tests, strict type checks and production build passed. Browser regression checks passed for demo interactions, mobile overflow and unauthenticated route/file protection. Newly expanded hosted questionnaire/approval checks await an owner-run result; invitation-email delivery awaits template configuration.

### Owner account protection and data portability
- Added provider-backed authenticator enrollment and challenge screens, session assurance checks and the owner MFA database upgrade.
- Added database tests for low-assurance owner denial, high-assurance owner access and unchanged client access.
- Added permission-filtered JSON workspace export with no credentials/file bytes; it is explicitly not a full backup.
- Hosted MFA setup/recovery and actual provider backup/restore require owner/project settings access.
- Final validation: 26 local tests passed, including PostgreSQL MFA enforcement and QR rendering; strict types and production build passed. Browser checks confirmed signed-out security/export denial. Hosted MFA enrollment/recovery remains pending the owner's SQL upgrade and device setup.

### Client journey browser verification
- Automated Chromium test passed actual app screens/actions for client sign-in, questionnaire submission, revision request, creative approval, payment-only delivery lock and final release/download at mobile size, using a fictional HTTP service fixture.
- Notion questionnaire/template fidelity remains pending the owner's client-free source content; starter prompts are not represented as copied Notion content.

### Notion master export alignment
- Read the supplied master portal and subpages; excluded Alex-only setup material from client-facing content.
- Replaced discovery starter questions with the shared and service-specific questions from the export, avoiding duplicate shared questions in combined projects.
- Added the six-section client home, content/handover/support guidance and relevant review checklists.
- Preserved prior submitted answers; documented remaining Notion feature gaps and external Tally question definitions in docs/reference/NOTION-MAPPING.md.
- Validation: 28 local tests, strict type checks and production build passed. The real client screens/actions passed the automated fictional-service browser journey with the expanded Notion brief and mobile layout. No new database migration is required. Remaining feature gaps are explicitly mapped rather than represented as complete.

### Owner access to Notion-style preview
- Added Preview client portal to the owner workspace so reviewing the Notion updates does not require a client account.
- Reuses the client layout with read-only forms, no account actions and filtered project data; planned layout remains previewable before onboarding without granting access or releasing documents.
- Added projection/access-gate tests and a browser owner-preview flow.
- Validation: 31 local tests, strict types and production build passed, plus browser checks for owner preview and the real client journey against fictional services. No database upgrade required.

### Notion project management and Alex Bell Arts branding
- Added capability-gated dated client actions, editable agreed briefs/support, protected handover records and private client PDF/image assets.
- Added presentation version/deadline fields and database-bound named creative approval snapshots; existing historical reviews are preserved.
- Added transactional database upgrade 202610280004 and PostgreSQL tests for permissions, asset isolation, immutable versions and final-handover gates.
- Applied supplied Alex Bell Arts wordmark/favicons and Hyper Purple/Acid Lime/Carbon Black/Stark White palette. Font files/names were not supplied; readable fallbacks remain.
- Named the signed-in experiences ABA Owner Dashboard and ABA Client Portal, including browser titles.
- Validation: 31 local tests, strict TypeScript and production build passed. Chromium tests covered dated action completion, private asset upload, protected handover visibility, branded logo rendering, the creative journey and owner preview using fictional services. Hosted activation/acceptance of the added project tools awaits the SQL upgrade.

### Higher-resolution brand artwork
- Replaced the deployed wordmark, primary mark and favicon sources with the matching original PNGs from the owner's 4x.zip.
- Kept displayed logo dimensions and colour tokens unchanged; versioned image URLs refresh previously cached artwork.

### Standalone A branding
- Changed the shared interface logo to the supplied black standalone A mark and removed the adjacent STUDIO text, following Alex's preference.
- Adjusted responsive logo dimensions for the square artwork; original high-resolution image is unchanged.

## 0.5.0 — PDF-first stage work and optional Phase 3 finance
- Added expandable stage workspaces with instructions, supplied Calendly booking link, per-stage PDF roles, sharing controls and returned client files.
- Kept Illustrator-authored proposal/contract/invoice PDFs as the primary supported workflow; built-in generation is optional.
- Added reusable proposal templates, immutable shared revisions and manual decision recording.
- Added exact-pence 50/50 invoices, seller/client billing settings, invoice numbering/snapshots, verified full-payment recording, void/replacement flow and invoice finance overview.
- Added private on-demand multi-page PDFs with the supplied black A logo and licensed Unicode font.
- Added transactional upgrade 202610280005, local database/PDF tests and browser finance/stage journeys. Hosted activation/acceptance remains pending the upgrade.

## Journey verification and file clarity — 28 October 2026
- Put explicit contract, deposit, final approval and final payment verification inside standard journey stages; show verified status instead of contradictory ordinary progress.
- Added journey verification access for renamed/custom stages without guessing their meaning; existing progress records and payment evidence are preserved.
- Changed Project controls to read-only access/verification summaries with independent note saving. Built-in invoice payment protections remain authoritative.
- Renamed the secondary library All project files, labelled each file’s stage and clarified stage/publication/onboarding/final-release restrictions. Both views use the same records.
- No database migration required. Validation: 42 automated tests, strict types and production build passed. Chromium checks passed for explicit journey verification/revocation, client journey, owner preview, stage files and finance using fictional services. Hosted acceptance remains unverified.

### Consistent file-access explanations
- Stage files and All project files now show the same list of outstanding access requirements, including publication, contract/deposit, stage visibility and final approval/payment. Published no longer implies accessible.
- Verification confirmations reset after each change, requiring fresh acknowledgement before removal. Empty custom-workflow verification panels are hidden; renamed-stage behaviour is explained.
- Added 128 publication/stage/onboarding/delivery combinations checked against owner-preview filtering, and browser assertions for matching file notices before/after verification and revocation.
- Validation: 45 automated tests, strict type checking and production build passed; Chromium verification/revocation, stage files, client journey and owner preview passed with fictional services. Hosted acceptance remains pending.

### Database and workspace usability review
- Reviewed the 20-table schema and documented retained permission/lifecycle boundaries and prioritised improvements in docs/DATABASE-UX-REVIEW.md. No live database inspection or changes.
- Added an owner-only project-at-a-glance panel with next-milestone navigation, onboarding/delivery requirements and invitation-management shortcut. Stage/invoice links expand their collapsed sections and move keyboard focus.
- Dashboard project rows show the next milestone; clarified the budget-based balance as Unreceived project value. No new migration required.
- Validation: 49 automated tests, production build and strict type check passed. Fictional-service Chromium checks passed verification/revocation with next-stage navigation, client journey, owner-preview exclusion, mobile layouts and finance shortcut expansion/keyboard focus. Hosted acceptance remains pending.

### Remove unused document-generation tools
- Removed Finance navigation, optional generator panels, proposal/invoice creation, issuing/replacement actions, templates and seller/billing forms. Stopped fetching unused finance settings/templates for the workspace.
- Kept Illustrator PDF uploads/sharing/returns and journey verification as the intended workflow.
- Preserve previous generated documents in a collapsed history section only where records exist; downloads, verified invoice payments and voiding unused unpaid invoices remain protected. No records or migrations deleted.
- Clarified external Acrobat PDF completion/return and manual verification; pre-onboarding access rules are unchanged. A restricted initial contract area is not yet implemented.
- Validation: 49 automated tests, type checking and production build passed. Browser checks passed removal of generation controls, previous-invoice downloads/payment/voiding, journey verification, stage PDF returns, client journey and owner preview using fictional services.

### Restricted initial contract area
- Added explicit owner opt-in for one visible contract stage per project, early invitation eligibility, private contract downloads and PDF returns linked to their exact source document/stage. No automatic opt-ins, signatures or payment verification.
- Added `/contracts`, safe portal routing for restricted/mixed client projects, client password setup, read-only owner preview and stage/library access notices. Returned files reuse the existing private client-assets records and bucket.
- Added transaction-wrapped migration 202610280006; full project, brief, questionnaire, finance, feedback and final-delivery policies remain gated. Tightened feedback permissions so early contract downloads cannot open creative approval.
- Tested early invite acceptance, SQL/raw-storage isolation, wrong-client/stage rejection, hide/unpublish/disable/revoke restrictions and contract-plus-deposit unlocking. Existing security/finance suites also run against the new migration. Hosted migration/application acceptance remains pending.
- Validation: 51 automated tests, strict types and production build passed. Chromium passed client byte-identical PDF return and two-verification unlocking, owner opt-in/read-only preview, existing verification, stage files, client journey, invoice history and full owner preview using fictional services. New migration has not been applied to hosted Supabase.

### Folder-aligned branding and Framer website templates
- New live Brand Identity projects follow Alex’s supplied folder order, plus Goodbye Packet. Website Design uses the same shared opening and a shorter design/Framer-focused workflow. Combined projects share acquisition and one goodbye stage.
- Preserved existing projects and the separate older fictional demo. Added relevant enquiry booking/onboarding questionnaire links, stage instructions, distinct contract/deposit confirmations and explicit final verification checks. Actual goodbye-packet content is pending Alex’s supplied file.
- Added exact external folder lists and scope/access explanations in docs/PROJECT-TEMPLATES.md. No extra SQL migration needed for templates.
- Validation: 55 automated tests, strict types and production build passed. Chromium verified branding/website/combined layouts, relevant questionnaires/booking links, separate contract/deposit controls, gated goodbye links, mobile overflow and the existing restricted contract return. Hosted application acceptance remains pending.

### Confirmed client/project/file deletion
- Added owner-only Delete client permanently with exact-name/acknowledgement confirmation, scope explanation, financial-history protection and a retry state. Pending cards disable normal editing/invitation actions.
- Added transaction-wrapped migration 202610280007: freeze metadata/uploads, revoke client access, snapshot UUID-scoped Storage paths and verify API cleanup before deleting dependent records. Preserve audit history, Auth accounts and all native proposal/invoice records; protect other clients.
- No hosted client data was deleted during development. Activation and hosted Storage acceptance require the new migration and a fictional test.
- Validation: 59 automated tests, strict type checking and production build passed. Chromium checks passed exact-name confirmation, removal of linked files/records, simulated Storage failure with successful retry, and the existing restricted-contract/combined-template flows using fictional services. Hosted activation/acceptance remains pending.

### Prospective clients, phased documents and Tally enquiries
- Replaced the locked full-journey preview with the actual limited prospective layout. Added owner opt-in/released steps and enquiry tracking, including Not proceeding; early invites can now begin at discovery before any proposal/contract exists.
- Shared proposal, contract and deposit invoice PDFs are restricted to explicit selected stages/types and release phase. Legacy early-contract access cannot bypass prospective restrictions. Full creative work still requires verified contract+deposit; proposal responses are intent only.
- Added private Enquiries inbox with manual records, explicit atomic conversion and a signed/size-limited, form-scoped Tally webhook. Transactional minimal receipts deduplicate retries even after source content deletion. No automatic invitation/email/access changes.
- Added canonical migrations 008/009 and a tested convenience setup that applies only missing 007/008/009, preserving existing data and flags. Hosted setup and acceptance remain pending.
- Validation: 66 automated tests, strict type checking and production build passed. Chromium verified discovery/proposal/agreement progression, owner release controls and restricted preview, explicit enquiry conversion, and existing deletion-retry/contract-return/website-template flows with fictional services. No live Tally delivery, secret configuration or hosted migration was performed.

## Clearer everyday interface — 29 October 2026

- Reworked potential-client screens with a compact welcome, clear next step, individual document cards and separate contract/deposit status checks. Download labels no longer incorrectly call JPG/image uploads PDFs.
- Grouped owner sharing/status and next-step settings; moved document-stage mappings behind an expandable section while preserving saved selections and form submission.
- Gave enquiry cards readable status badges, an inbox count, expandable answers and distinct conversation/project-creation controls.
- Added explicit signed-contract, deposit, final-payment and approval verification button labels; separated verification removal, shared files and returned files visually. Stage editing/reordering now sits in an expandable settings section after the stage’s main work. Improved contrast, focus states, mobile text/control sizes and spacing. No migration, payment/signature inference or permission changes.
- Owner confirmed the prior hosted combined SQL, fictional Tally delivery, conversion, limited previews and independent contract/deposit gates. Actual invited-client returns and remaining hosted acceptance are still pending.
- Validation: all 66 automated tests, strict TypeScript and production build passed. Fictional Chromium journeys covered prospective phases, owner release/preview, enquiry conversion, contract/deposit verification and revocation, Framer stages and client file returns. Layout captures checked 320/390/1440 px widths with no horizontal page overflow on the updated screens. Hosted acceptance of this interface update remains pending.

## Guided client invitations and account recovery — 29 October 2026

- Added a project shortcut and visible Client portal section with eligibility guidance, saved recipient email, copyable links, status refresh and confirmed access removal.
- Added additive, repeatable migration 010: owner-only exact-email lookup/recording/status, invitation expiry and revocation, safe same-email reinvitation, confirmed-email acceptance and unchanged discovery/full-project gates. Preserve existing connected profiles and Auth/audit/project records.
- Existing accounts use their own password or emailed sign-in link. New accounts alone receive generated private invite tokens. Failed saves never delete/reset Auth accounts or return an unusable token.
- Added invitation-to-password setup, password confirmation, Forgot your password, provider-supported recovery, clear unavailable-access/expired-link screens and configured-origin callback redirects. Owner MFA remains required for password changes.
- Guided copy-and-send replaces the earlier optional invitation-email picker; no invitation emails are sent automatically. Supabase sign-in/reset email settings and hosted delivery still require acceptance. See docs/CLIENT-INVITATIONS.md.
- Validation: all 70 automated tests passed, including local PostgreSQL invitation binding, expiry/revocation, repeat application and deletion with new metadata. Fictional Chromium checks passed guided invitation/status/reinvitation, password setup/recovery, fixed redirect destinations, restricted owner preview and deletion retry. Hosted delivery and acceptance remain pending SQL activation.
- Final strict TypeScript, production build and production signed-out/private-route/mobile checks passed. The copy-link browser check read back the fictional link from the clipboard. No live SQL, real invitation, password change or email delivery was performed from this workspace.

## Attention dashboard and handover guidance — 29 October 2026

- Added owner-only Needs your attention with links to new enquiries, referenced contract returns, proposal responses, overdue client actions, invitation follow-ups and final files needing sharing review. Derives from current records without a duplicate task/status table or automatic mutations.
- Updated Project at a glance to distinguish released discovery/proposal/agreement access, actual invitation/account state and full-journey verification.
- Added collapsed handover preparation with record-based file/note/support/release checks and copyable branding, Framer and combined goodbye writing outlines. Terms, licences, ownership and support stay editable placeholders; actual client PDFs remain owner-designed/uploaded.
- New exact-template uploads suggest Proposal/Contract/Invoice types and final-release defaults for Goodbye Packet and Framer Launch & Handover. Existing files and confirmations are untouched.
- Fixed reused sibling component keys that could duplicate project panels after navigation/rerendering; added browser duplicate-key detection.
- No new migration or services. Alex confirmed SQL 010 succeeded; hosted invitation/recovery acceptance is deferred at his request.
- Validation: all 77 automated tests, strict TypeScript, formatting and production build passed. Chromium checked branding and Framer attention-to-stage navigation, clipboard copying, final-upload defaults, owner-only preview filtering, independent verification/revocation and full read-only client preview at mobile/desktop widths. Tests used fictional services; no hosted records were changed.

## Searchable files in journey order — 29 October 2026

- Reworked All project files into a same-record library grouped by journey stage, with combined search/type/stage filters, result counts, reset and empty states. Kept project-wide uploads secondary to journey-stage uploads.
- Added clear owner sharing badges, distinct ordinary client uploads and explicitly linked contract returns, and links that open/focus the existing owner or client journey stage. Fixed missing client-stage anchor targets.
- Kept feedback and secure download/publication actions on their existing routes. Presentation approval choices now appear only for presentations in this UI; other files retain comments/revision requests and historical feedback. Return/upload/progress actions never verify signatures or payments.
- Extracted the library into its own component. Client and preview filter choices use only their already permitted records; no permission changes, duplicate uploads, schema migration or new service.
- Validation: all 80 automated tests, strict TypeScript, formatting and production build passed. Fictional-service Chromium checked owner/client filtering, private/final-file exclusion from client choices, journey navigation, preview restrictions, 320/390/1440 px layouts, independent contract/deposit verification and the full client questionnaire/revision/approval/final-release/download journey. Hosted deployment acceptance remains unverified; no real records or emails were changed.

### Stable stage purposes — 30 October 2026
- Added an independent owner-selected purpose so stage renames retain contract, deposit, final approval and final payment checks.
- Added migration 011 with conservative exact-name mapping; custom and duplicate/overlapping stages require explicit owner choice. New templates retain their purposes through atomic project/enquiry creation.
- Kept older installations usable before migration, with unexpected capability failures surfaced. Preserved progress and verification records, client access rules, publication and native invoice payment guards.
- Added SQL, logic and fictional-browser regression coverage. Hosted SQL activation and acceptance remain pending; no live records or emails changed.
- Validation: 83 automated tests passed, including the additive upgrade and existing native invoice guards. Fictional Chromium checks passed fixed-purpose renaming and purpose selection, legacy fallback, historical invoice actions and client final release/download; layout checks covered 320/390/1440 px widths. Strict TypeScript, formatting, production build and a production-server rendered-demo request also passed.

## Overview charts and clearer brand colours — 30 October 2026

- Added owner-only projects-by-phase bars with project drill-down, service filters and empty states. Uses next stages plus verified access checks without assuming completed milestones mean delivery.
- Added project-value payment progress using verified deposit/final-payment flags, with integer-penny 50/50 splits. Clearly labelled as planning figures, not bank totals or invoice balances; no invented monthly payment dates.
- Applied purple workspace/stage tints, stronger panel borders, lime highlights and a black totals strip across the connected owner/client UI. Graph data uses the brand palette, with independent text labels and amounts.
- Corrected next-step routing for renamed fixed contract/deposit stages: check the contract first, then use historical native-invoice full-payment actions.
- Replaced the stale launch checklist with current evidence, remaining hosted/operational requirements and a clearly subjective 80% planning estimate. No new service, database migration or automatic record changes for charts/colours.
- Validation: 87 automated tests passed. Strict TypeScript, formatting and production build passed. Fictional Chromium checked Overview filtering/empty states/drill-down, owner-only chart visibility, client preview, stage verification and the client approval/final-download journey at 320/390/1440 px. Hosted acceptance remains separate.
