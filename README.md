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

## Phase 2 — Private workspace (connection pending)

The secure workspace is now implemented separately from the fictional demo:

- `/`: welcome page; `/demo`: Phase 1 examples.
- `/login`: Supabase account sign-in; `/workspace`: owner management; `/portal`: private client projects.
- Native project questionnaires, creative feedback/approvals, private documents and owner-controlled final delivery.
- Database-enforced ownership, admin-only notes/controls, invitation acceptance/revocation and action audit records.

Follow [the connection guide](docs/PHASE2-SETUP.md) to create a Supabase development project, apply migrations, provision your owner account and configure authentication/storage. `.env.example` lists settings; never commit actual keys. No Supabase credentials are currently configured in this environment, so connected routes fail safely to sign-in/setup.

The earlier “What works” and “Demonstration limitations” sections describe `/demo`. Phase 2 is persisted in Supabase once connected; it does not import or write private records to demo browser storage. Production build/type checks and local SQL policies can be validated now; hosted sign-in, email and Storage require the acceptance checklist. See [security notes](docs/SECURITY.md). Do not use real client data or publish until that review passes.
