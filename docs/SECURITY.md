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

### Cache and revocation follow-up
A hosted automatic test reported a revoked-client Storage failure. That generic result did not identify whether cached bytes or an unexpected provider error caused it; the owner subsequently provided a Passed hosted rerun on 27 October 2026. The original cause is not independently established. Supabase server transports now explicitly use no-store plus an abort signal (Next.js memoization opt-out). Storage probes also use unique cache nonces, and new private uploads set `cacheControl: '0'`. The same raw file and signed-link denial requirements remain; the test is not skipped or weakened. Existing uploads with previous caching metadata may require re-uploading under a new path before real private use. Signed bearer links retain their documented 60-second lifetime. Files already downloaded to a person's device cannot be recalled.


### Hosted verification evidence — 27 October 2026
Owner screenshot confirms the expanded check passed real Storage access, signed downloads, final-delivery gates and revoked-client denial, with cleanup completed. The owner also confirmed email receipt and successful email-link sign-in after Supabase redirect correction. These observations close those specific checks; they do not establish complete production security or GDPR compliance. The full remaining review above still applies.

### Owner MFA implementation
The owner security screen uses Supabase TOTP enrollment/challenge/verification, with sensitive QR data confined to the authenticated owner response and browser memory. After a verified factor exists, server identity checks require `aal2`; the additional migration 202610270003 also enforces that condition inside `is_admin`, protecting direct API/Storage calls. Before that migration, enrollment through ABA Studio is blocked. Existing data is not rewritten. The setup screen can be reached at low assurance solely to verify a code or begin first enrollment; it cannot read project records or bypass an existing factor. Confirm hosted setup and recovery before real use.

### Project-management upgrade 202610280004
Client action updates are restricted to the status column at the privilege level; owner title/date changes use an owner-checked function. General brief fields are readable under project ownership, but final handover content is held in a separate table with approval/payment gating. Client assets use their own private bucket, project ownership and authenticated uploader binding. Feedback snapshots get the actual account contact name and current immutable document version from the database rather than trusting submitted names/version strings. Historical feedback without those snapshots is labelled accordingly. All features require the additive migration and hosted acceptance. Upload malware scanning/retention quotas and larger source-file formats still need review.

### Restricted contract-only access
Migration 202610280006 is an explicit, scoped exception to the earlier blanket onboarding requirement for all file reads. It permits only authenticated invited-client access to shared Contract/document files in an opted-in visible stage and their own linked returns. Full project and creative-feedback access still requires contract/deposit. Existing signed-link expiry and downloaded-copy limitations remain. No automatic signature validity is claimed; see CONTRACT-AREA.md for isolation rules and required hosted checks.

### Owner-confirmed client deletion
Migration 202610280007 adds a scoped prepare/finish workflow. Exact-name confirmation and owner MFA are checked on the server/database. Profiles/invitations are revoked before file removal. Private retry manifests are owner-readable, non-client-writable, and Storage deletion is restricted to frozen project paths. Pending clients reject metadata/storage writes. Finalization verifies Storage metadata absence; audit/Auth users and native financial records are retained. This is not a full personal-data erasure service. See CLIENT-DELETION.md for retry/hosted acceptance limits.

### Potential clients and Tally intake
008 scopes prospective project metadata through a minimal DTO and explicit released document bindings; it does not broaden full projects/stages/briefs/financial tables. Prospect configurations override legacy early-contract permissions. Proposal responses record non-contractual intent and cannot alter payment/contract flags. 009 authenticates inbound Tally bodies with HMAC before a server-only fixed-table intake. Private enquiry content is removed with its converted client; minimal non-contact webhook receipt IDs persist to prevent replay recreation. See POTENTIAL-CLIENTS-AND-TALLY.md for precise boundaries and hosted checks.

### Invitation/account lifecycle update
Migration 010 binds invitations to the saved normalized client email and rejects owner/other-client profiles or live invitations. Acceptance requires a confirmed email, active eligibility and an unexpired/unrevoked pending invitation, under the authenticated user ID. Owner statuses/lookups remain admin/MFA-only; no general Auth directory or browser-selected target email is exposed. Existing accounts receive only an ordinary login URL and must authenticate themselves. Generated invite tokens are limited to new unconfirmed matching accounts and are returned only after the SQL binding succeeds. Invitation failures never delete or reset Auth users. Revocation removes profiles and retains invitation/audit history; client deletion can still remove its dependent invitation rows. Password recovery uses Supabase, uniform anonymous responses and a verified Auth session; owner password changes still require MFA. Callback success targets the configured origin and accepts only the fixed reset-password next destination. Hosted email, MFA and isolation acceptance remains outstanding.

## Lifecycle and optional quarantined upload update

012 enforces explicit archive retain/suspend decisions and read-only retained archives at database/Storage boundaries. New evidence is owner-only/append-only with no invented historical dates. Both workstream checks are required once combined-project separate approvals are deliberately enabled.

013 optionally replaces new uploads with mandatory quarantine and scoped server checks/removal. The previous statement that normal operations never use service bypass is superseded ONLY for exact reserved upload bytes and validated frozen deletion manifests. Ordinary reads/writes still use caller permissions. Pending/rejected bytes cannot be read even by an owner through ordinary/signed routes; accepted files retain usual sharing/final gates. Token replay cannot replace checked bytes; reserved/discarded paths remain in deletion scope until issued upload tokens expire.

No live malware engine has been configured or tested here. The scanner adapter is not itself an antivirus service. Legacy files have no scan history; no historical claims are fabricated. See SECURE-UPLOADS.md for service prerequisites, bounds, retention/lease limitations and hosted acceptance. GO-LIVE-STATUS.md records remaining recovery/privacy/production gates.
