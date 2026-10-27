# Connect the private workspace

Phase 2 code is implemented but a hosted Supabase connection is not yet configured. Local PostgreSQL policy tests do not prove the hosted authentication, email or storage service is working. Use fictional information until the checklist below passes.

## 1. Create your development database

Create an account at https://supabase.com and a new development project. Choose a UK region when available. A free development tier is sufficient to start; review current limits before choosing a paid plan. Keep the database password in a password manager. Do not send it or secret keys in chat.

Open the SQL Editor. Run these files in order (once each):

- `supabase/migrations/202610270001_workspace.sql`
- `supabase/migrations/202610270002_storage.sql`

The first creates application tables, permissions, audit triggers and workflow functions. The second creates a private `project-files` bucket and access policies. For subsequent environments use Supabase CLI migrations; do not rerun an already-applied migration. Existing unrelated storage policies need separate review; start with a dedicated development project.

## 2. Add connection settings securely

In the hosting/environment settings, or in an ignored `.env.local` for local development, set:

- `NEXT_PUBLIC_SUPABASE_URL`: the project's HTTPS URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: the project's publishable key (public by design; access still depends on database policies).
- `APP_ORIGIN`: the exact origin of this application, e.g. an approved HTTPS preview domain. For local `npm run dev` only, `http://localhost:3000`.
- `SUPABASE_SERVICE_ROLE_KEY`: the server-only legacy service_role key. Used only to generate client invitation links. Never put it in a `NEXT_PUBLIC_` variable or paste it in chat. Regular data reads/writes use the signed-in user's session and database policies, not this key.

The optional invitation key can remain absent while testing existing users. It must be a real server-side credential in the app's secure hosting settings, not a browser key. Proxy-held credentials are not a general-purpose replacement for Supabase Auth's bearer token.

Rebuild after adding `NEXT_PUBLIC_` variables. In a restricted cloud environment, add your exact project hostname (e.g. `your-project.supabase.co`) to allowed domains; the application cannot contact it before that network setting is applied. No wildcard or unrestricted network access is required.

## 3. Create the owner account

In Supabase Authentication → Users, create your own owner user securely. Copy that user's UUID (not a password/token). Run this in the SQL editor, replacing the placeholder UUID:

```sql
insert into public.profiles(id, role, client_id)
values ('YOUR_AUTH_USER_UUID', 'admin', null);
```

This explicit step prevents public sign-ups or editable profile metadata from becoming administrators. There is no public registration screen. Disable public sign-ups in Supabase Auth; verify administrative invitations still work with your provider settings. Create no other admin roles unless Alex authorises them.

## 4. Configure sign-in and email

In Supabase Auth URL settings, set the Site URL to `APP_ORIGIN` and allow the exact `APP_ORIGIN/auth/callback` redirect. Avoid broad redirect wildcards. Use the same browser to request and open passwordless links (PKCE verification). Password login works for accounts with a password. Invited clients may set a password from My account after accepting an invitation.

Configure verified email delivery/SMTP before sending to clients; Supabase's default email service has recipient and rate restrictions. Enable suitable provider rate limits and review CAPTCHA/MFA requirements before real launch. Secure the owner account with provider-supported MFA before production; app-level MFA enforcement and account recovery need a further pass.

## 5. Test a fictional client journey

1. Sign in at `/login`; your owner account should open `/workspace`.
2. Create two fictional clients with email addresses you control, and a Brand Identity project for one and Website Design for the other. Also create a combined project to verify separate workstreams.
3. In project controls, mark contract signed and deposit received for each test project. These are manual records, not an e-signature or payment integration.
4. In Clients, create a private invitation. This creates a Supabase invite and displays a sensitive, single-use link. No email is sent automatically. Copy it privately into a separate test browser/session. Do not include it in screenshots or public messages. Expired or already-existing Auth accounts need management in Supabase; automatic resend/reinvite is not implemented.
5. Accept the invitation. Client role and ownership come from the database's pending invitation, never from a URL client ID or editable user metadata.
6. Complete the appropriate discovery questionnaire. Website-only projects must not show the logo exercise. Responses are immutable after submission; ask Alex for corrections. Structured editing/versioning is a follow-up.
7. As owner, upload a fictional PDF/image; publish it. Check the client can download it, comment, request revisions and record a creative approval. Uploads are PDF/PNG/JPEG/WebP, up to 3 MB. Clients currently provide attachments outside ABA; client-side uploads are a follow-up.
8. A published final file must stay inaccessible until both final payment and final approval are verified in owner controls. Creative feedback does not automatically mark the project approved. The owner explicitly confirms final approval after checking all workstreams.
9. Revoke the client's portal access from Clients. Open sessions must lose data access. Previously issued signed download URLs expire within 60 seconds. This feature revokes all accounts attached to that client.

## Hosted security acceptance checklist — required before real data

- Test unauthenticated requests, client A, client B and owner with separate sessions.
- Use direct database/API requests, not only visible menus: verify cross-client IDs, hidden stages, unpublished files and internal notes are inaccessible.
- Verify no client can modify roles, project/payment controls, document publication, invitations or audit records.
- Verify forged author IDs and questionnaires from the wrong workflow are rejected.
- Verify contract/deposit revocation removes project, questionnaire and storage access.
- Verify expired/replayed invites, login/session refresh, sign-out, revoked accounts and sign-in recovery.
- Verify real Supabase Storage policies and signed downloads; PGlite tests emulate its metadata schema, not the hosted Storage service.
- Review email configuration/rate limits, credentials, owner MFA, backup/restore, privacy notices, retention/deletion, secure headers and upload abuse/malware controls.
- Document this review and obtain Alex's approval before public deployment or real client use.

## Local validation

`npm ci`, `npm test`, `npm run typecheck`, `npm run build`.

`npm test` includes real PostgreSQL execution using PGlite with fictional auth users and Storage metadata. This verifies the migration's actual row-level rules and SQL functions. Auth and Storage API behaviour still require the hosted checks above.

Run `npm run dev`, then `node tests/browser.cjs` for the fictional demo and `node tests/phase2-browser.cjs` for missing-connection/fail-closed screens (the latter assumes no Supabase environment settings). Production server: `npm run build && npm start`. Local HTTP development should use `npm run dev`; production authentication cookies require HTTPS.
