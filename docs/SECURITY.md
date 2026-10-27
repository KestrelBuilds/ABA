# Security and data protection notes

## Current boundary

The `/demo` route uses fictional localStorage records. The connected workspace `/workspace` and `/portal` uses verified Supabase identities and database row-level policies on every request. Nothing from the demo is automatically imported. Protected UI state never acts as an access check. No live client data is authorised until hosted acceptance testing is complete.

## Data controls implemented

- Admin role is explicitly provisioned; users cannot assign roles or client membership.
- Client account assignment is accepted from a pending Supabase Auth user ID; invitations require a signed contract and recorded deposit.
- Contract/deposit requirements apply to every client project read, questionnaire, document, feedback and storage access.
- Internal notes are a separate admin-only table; they are never loaded by client pages.
- Hidden milestones, unpublished documents and other clients' records are filtered by PostgreSQL policies, including direct API access.
- Private files use opaque paths and short-lived signed download URLs with attachment disposition. Final files additionally require final payment and an owner-verified final approval.
- Server actions validate input, re-check identity/role and rely on Next.js same-origin action protections. Supabase limits/rate controls need configuring before launch.
- Cookies are HTTP-only, SameSite=Lax and Secure in production. Proxy refreshes sessions; private responses are not cached.
- Database triggers create non-client-writable audit records for significant changes. Audit events record actor/entity/action without copying private record contents. Internal note contents are never logged.
- Service credentials are confined to the server-only invitation helper; normal operations never use service-role bypass.

## Remaining review

This is not a claim of GDPR compliance. Alex is the data controller; establish lawful basis, privacy notices, processor agreements and transfer safeguards with Supabase/Vercel/email providers. Choose and document retention periods, subject-access/export and deletion handling; audit/feedback foreign keys require a deliberate deletion process. Define incident handling, access reviews, backups/restore and owner MFA enforcement. Do not collect unnecessary sensitive information in free-text answers.

Upload validation limits types and size but does not scan for malware or verify every file's binary format. All files download as attachments; add malware scanning/retention limits before real file exchange. Signed URLs are bearer links until their 60-second expiry. Supabase email links and invitations are sensitive credentials; never log or publish them. Production logs and provider logs need a redaction/retention review.

No payments, legal signatures or automatic external messages are implemented. Creative approvals are project feedback only. Payment/contract status is recorded manually by the owner and does not independently prove a payment or legal agreement.
