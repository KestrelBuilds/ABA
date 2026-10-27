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
