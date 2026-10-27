# ABA Studio

ABA Studio is the operating workspace for Alex Bell Arts, Alex Bell’s independent design business. Services include identity, Framer websites, motion, graphic design and creative assets. It will replace Notion; this is exclusively for ABA, with no SaaS or multi-agency features.

## Architecture and current scope

Next.js App Router, React and strict TypeScript. `components/studio.tsx` owns the interactive Phase 1 demo; `lib/projects.ts` defines typed records and workflow rules; `app/globals.css` defines reusable visual tokens and responsive layouts. Browser localStorage retains fictional records under `aba-demo-v1`. This is not a backend or an authentication system. Future persistence, authentication and private storage should use Supabase/PostgreSQL with server-side authorisation and row-level security. Vercel is the intended hosting option; deployment requires approval.

## Business rules

Shared acquisition: enquiry, discovery call, proposal, contract/deposit, onboarding. Portal onboarding requires both a signed contract and 50% deposit. The final 50% is payable before final delivery. Never implement homemade payment processing or legally binding signatures; use reputable providers and test mode first.
Brand Identity: discovery/questionnaire and AI logo exercise, research, concepts, presentation/feedback, touchpoints, guidelines, final review, final invoice, delivery/goodbye.
Website Design: website discovery, sitemap, wireframes, visual design, Framer development, responsive QA, client revisions, approval, invoice, launch/handover, goodbye. Framer remains the website production tool. Website-only clients must never receive branding questionnaires.
Combined projects share one client, one project and one acquisition workflow, with separate named creative workstreams. Progress derives from completed milestones. Stages remain editable, reorderable and optionally client-visible.

## Design and communication

Premium, quiet neutral interface with warm backgrounds, forest ink, restrained sage accents, clear typography, consistent spacing and reusable tokens. Replace branding through CSS variables. Responsive and accessible interactions; honour reduced motion. All client-facing business copy uses I/me/my, reflecting a sole operator. Explain technical work to Alex in plain English.

## Security

Use fictional records only. Clearly label demonstrations. The client preview is a visual projection, not data isolation; all browser data is available to the local user. No real client records until secure authentication, server-side role and ownership checks, private storage, validation, session handling, audit records and UK data protection review exist. Never commit secrets or expose private service credentials. Do not publish publicly or purchase services without explicit approval.

## Development and validation

Use the existing isolated checkout; do not create worktrees unless requested. Keep strict types, reusable functions and clear limitations. Run `npm test`, `npm run typecheck`, `npm run build` and representative browser checks after functional work. Verify project creation, workflow separation, edits, storage reload, portal visibility and mobile layouts. Fix errors before claiming success; distinguish unimplemented integrations from working features. Maintain README.md, ROADMAP.md and CHANGELOG.md as the product evolves.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Phase 2 implementation

`/` is the welcome page; `/demo` preserves Phase 1 browser-local examples. `/login`, `/auth/callback` and `/auth/confirm` use Supabase Auth. `/workspace` is owner-only; `/portal` requires a client role (owners redirect to their workspace). Never load demo state as connected client records.
`lib/supabase/server.ts` validates identities using `getUser`; the server-only service client is limited to invitation generation. `proxy.ts` refreshes sessions; it is not the authorisation boundary. `app/actions.ts` validates mutations and rechecks access. `lib/workspace.ts` loads explicit DTO columns under row-level policies, excluding notes/audit queries entirely for clients. `components/connected-studio.tsx` renders connected workflows, native questionnaires, feedback and private documents. Every mutation returns a reviewable result and revalidates the relevant route.
Supabase SQL migrations own role/ownership rules, atomic project controls, private storage access, immutable client questionnaire submissions and audit records. Revoke access removes client profiles and pending invitations; bearer download links expire in 60 seconds. Combined workflow approval must be verified by the owner across both streams before marking final approval.
Hosted Supabase authentication/email/Storage acceptance is pending external configuration. Do not describe Phase 2 as production-ready until `docs/PHASE2-SETUP.md` is completed. See `docs/SECURITY.md` for threat boundaries and remaining privacy/security review. No real email is sent merely by generating an invitation; the owner copies a private single-use link. Native questionnaires do not sync Tally responses. Client uploads, automatic invitation resend, native enquiry ingestion, task lists, production MFA enforcement and automated retention remain follow-up work.
`npm test` now executes PostgreSQL RLS/function tests using PGlite with simulated Auth and Storage metadata. This proves SQL policy behaviour, not hosted provider behaviour. `tests/phase2-browser.cjs` verifies unconfigured access fails closed; run against a server without connection settings.
