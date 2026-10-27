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
