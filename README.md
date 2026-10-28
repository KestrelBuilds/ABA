# ABA Studio

A considered workspace for Alex Bell Arts. Phase 1 is an interactive application using **fictional demo data**, with admin management and a client journey preview.

## Run locally

Requires Node.js 22 or later and npm.

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

## Demonstration limitations

There is no authentication, database, secure file storage, email, invoice generation, payment processing, signing, Tally submission sync or real feedback/approval submission. All browser records are accessible to the local user. Visibility controls affect presentation only. Portal access and delivery gates are demonstration business logic, not security. No files are provided for download. Currency is GBP; demo snapshot dates are explicitly labelled. Recorded payment totals are all-time, not monthly revenue. Native questionnaires and internal task lists remain on the roadmap.

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

### Notion reference pending
The current native questionnaires are starter prompts. The owner wants the existing Notion client portal and its questionnaires used as the reference; no Notion connector is currently available. Exact structure/questions remain pending a viewable client-free template or supplied content. The three Tally links from the original brief are available; they are not a copy of the full Notion portal.
