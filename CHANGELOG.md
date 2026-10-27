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
