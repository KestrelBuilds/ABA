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
- `SUPABASE_SERVICE_ROLE_KEY`: the server-only legacy service_role key. Used to generate client invitation links and scaffold/clean up owner-requested automatic portal checks. Never put it in a `NEXT_PUBLIC_` variable or paste it in chat. Regular data reads/writes use the signed-in user's session and database policies, not this key.

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

### Vercel integration variable names
The application also accepts `NEXT_PUBLIC_SUPABASE_ANON_KEY` (legacy anonymous key) instead of `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_URL` as a URL fallback. The newer publishable key takes precedence when both exist. Connection variables must be assigned to the ABA Vercel project and the Production environment. After adding them, redeploy; earlier deployments do not receive new build settings automatically. Never use a service-role key as either public key.

### Automatic account-isolation check
As the owner, open **My account → Check client portal access → Run automatic portal checks**. This requires `SUPABASE_SERVICE_ROLE_KEY` in Vercel's server environment. It creates two temporary confirmed Supabase users directly (no email), signs them in using the regular public client, accepts pending invitations and exercises hosted row-level permissions. Test records are scoped to random IDs and cleaned up in a finally block; audit history is retained with temporary actor references cleared. A failure or interrupted server execution may leave records prefixed **Automatic portal check**; inspect these and the reported run ID before retrying. A successful result does not replace email, real Storage API, browser-session and launch security checks. The owner session remains separate from test sessions.

### Live file and email verification
The automatic portal check now uploads small fictional PDFs to the real private bucket. It verifies exact downloaded bytes and signed URLs, denies other-client/anonymous/unpublished access, checks final approval/payment gates and access after revocation, then removes the files before metadata cleanup. It does not use service-role credentials for the client permission checks. A provider/network failure is not a successful denial.

Separately, **My account → Check client portal access → Send test sign-in email to me** requests a real Supabase sign-in email only for the verified owner. No recipient is accepted from the browser. It never creates new users or emails clients. A successful API response means the provider accepted the request, not that it arrived. Check the owner's inbox/spam and open the link in the same browser to validate PKCE callback/session handling. Configure Supabase Auth Site URL and redirect allowlist to your application's origin and `/auth/callback`. The app accepts an explicit `APP_ORIGIN` or Vercel's trusted `VERCEL_PROJECT_PRODUCTION_URL`; request headers never determine this destination. Default Supabase email limits and SMTP recipient restrictions can require configuration. Existing client invitations are still private links shared manually; automatic invitation emails are not implemented or verified by this test.

### Optional client invitation emails
Private invitation links remain the default. To enable owner-requested invitation emails:
1. In Supabase Authentication → Email Templates → Invite user, set the invitation link to `<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}">Accept my ABA Studio invitation</a>`. Keep any desired branding/text around it. This lets the app verify the one-time token on its invitation screen rather than relying on unsupported URL fragments.
2. Add `https://aba-iota.vercel.app/auth/confirm` to Supabase's allowed Redirect URLs. Use your own application origin if different.
3. Ensure Auth email delivery/SMTP supports your intended recipients. A successful owner sign-in email alone does not establish external client delivery.
4. Set the server environment variable `SUPABASE_INVITE_EMAIL_READY=true` in Vercel only after completing those settings, then redeploy.
5. In Clients, select **Send invitation email** for an eligible fictional client with an email you control. The app uses Supabase's established invitation API. The owner explicitly submits the request; no background emails are sent. Confirm receipt, invitation acceptance and isolation before real client use. Existing auth accounts/resends still require account review in Supabase.

Without that flag the email option is disabled, and server requests are refused before sending anything. Private links remain usable. On rare failures between provider acceptance and database setup, an email may arrive whose access cannot be completed; the app removes the newly created auth account and reports the error.

### Owner authenticator protection
Apply `supabase/migrations/202610270003_owner_mfa.sql` once in the SQL Editor. Unlike the first-time setup files, this is an additional upgrade: it does not recreate or delete client/project records. It updates database admin permission checks to require `aal2` when the owner has a verified MFA factor. Low-assurance owner sessions then cannot bypass the website by calling the database or Storage directly. Client ownership rules are unchanged.

In ABA Studio, open **My account → Protect my account with an authenticator**. Scan the QR with an authenticator you control and enter the current code. QR data is sensitive: never send it in chat or store it in screenshots. Back up your authenticator/recovery method before enabling it. Setup is blocked until the SQL upgrade is present. Merely starting an unverified enrollment does not activate the extra restriction; completing verification does. Future sign-ins prompt for a six-digit code. There is no email-only bypass.

If the authenticator is lost, recover it through its backup method. If necessary, use your separately secured Supabase project administrator account and the provider-supported MFA administration tools to remove the lost factor after verifying ownership, then reenrol immediately. Test recovery before real clients. The app does not provide homemade recovery codes or silently disable MFA. Hosted enrollment, challenge, new-session rejection and recovery testing remain pending owner setup.

### Workspace data export
My account includes **Download my workspace data**. It exports only data visible to the current verified account, with no auth credentials, file bytes or service keys. Client exports exclude private notes/admin activity. Owner export requires MFA if enabled. This is a portable JSON export with a limited recent activity log, not a full/restorable database backup. Provider backups, retention and a restore rehearsal still need to be configured separately.

### Initial contract area upgrade
After migrations through 202610280005, apply only 202610280006_contract_area.sql once to enable the optional restricted pre-onboarding contract area. No existing projects are opted in. Follow CONTRACT-AREA.md for explicit stage setup, invitations, PDF returns and hosted acceptance. No new secrets or signing-service account are required.

### Client deletion upgrade
After migration 202610280006, apply only 202610280007_client_deletion.sql once. It adds the confirmed client/project/file cleanup workflow without new credentials. Follow CLIENT-DELETION.md and verify it on fictional hosted data before real client use.

### Potential-client / Tally setup
Use supabase/updates/20261029_potential_clients_and_tally.sql after 006. It safely installs only missing 007/008/009, or apply canonical migrations in order through your usual runner. Configure the Tally form ID/signing secret in Vercel and the webhook in Tally as documented in POTENTIAL-CLIENTS-AND-TALLY.md. No live webhook connection has been confirmed from the coding workspace.

### Guided invitation/account update (supersedes the earlier email picker instructions)
After 009, apply 202610290010_client_invitations.sql. Use Projects → Invite / manage client access or Clients → Client portal to create/copy an invitation and send it yourself. Existing accounts sign themselves in; no passwords/accounts are reset or removed. The optional SUPABASE_INVITE_EMAIL_READY picker is superseded. Keep the existing callback URL allowed and verify provider email settings as described in CLIENT-INVITATIONS.md. No additional credentials or paid service are required. Hosted acceptance remains pending.
