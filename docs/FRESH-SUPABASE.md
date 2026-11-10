# Fresh ABA Supabase project

Prepared 10 November 2026 after Alex confirmed the current project contains only test data. This is a replacement-project setup, not a reset of `ztbrnviocdoexmtttkih`. The app code and `portal.alexbellarts.com` stay in place. No new hosted project has been created and no live database, Vercel setting or existing record has been changed from this coding session.

## 1. Prove a new project can connect

Create a separate project (suggested name **ABA Fresh**) in the existing organisation, in London where available. Use the existing free allowance only; stop if a paid upgrade is required or there is no spare free project slot. Keep the old project intact. Keep the new database password in a password manager, not in chat.

In the **new project's** SQL Editor, run:

```sql
SELECT 1;
```

Continue only if it returns `1`. A new project is an alternative to try, not a proven fix for the old project's authentication failure. If the new project also reports PAM authentication failure, stop and ask Supabase Support to investigate before changing any hosting settings.

## 2. Install the clean database

Copy all of [ABA-new-project.sql](../supabase/bootstrap/ABA-new-project.sql) into the **new project's** SQL Editor and run it once. This combines the canonical migrations 001–012 and 014 in one transaction. **013 is excluded; do not apply it.** There are no copied test clients, real records, files, account credentials or fabricated verification dates.

The script refuses to proceed if ABA tables already exist. A failed transaction is rolled back rather than leaving a partially installed ABA schema. It creates the existing owner/client access rules, private file buckets, owner MFA enforcement, manual invitations, Tally intake, project lifecycle and stage locks, including owner AI/SVG handovers at the existing 3 MB cap. It does not create an owner Auth account.

This is a manual bootstrap of a new database, not a Supabase CLI migration-history repair. Do not run `supabase db push` blindly afterward: canonical 013 remains deferred and the CLI history must be reconciled deliberately before adopting that workflow.

## 3. Recreate the owner account

In the new project, use Authentication → Users to create Alex's own owner account with an email/password Alex controls. Enter passwords privately. Copy only that user's UUID, then run:

```sql
insert into public.profiles(id, role, client_id)
values ('YOUR_NEW_OWNER_AUTH_UUID', 'admin', null);
```

Create no test clients automatically. Disable public sign-ups and check the owner can sign in. Configure email/recovery delivery and enrol a new owner authenticator through the portal. Existing test accounts, passwords, MFA factors and invitations from the old project are not transferred.

## 4. Configure sign-in URLs and hosting

In the new project's Auth URL configuration:

- Site URL: `https://portal.alexbellarts.com`
- Redirect URL: `https://portal.alexbellarts.com/auth/callback`
- Redirect URL: `https://portal.alexbellarts.com/auth/confirm`

Copy any still-required exact recovery/preview URLs from the working configuration; avoid broad wildcards. Configure the new project's required email settings separately.

Save the current Vercel values securely for rollback, then update its **Production** connection settings to the **same new project**:

| Setting | New value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | New project's HTTPS URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | New project's publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | New project's server-only legacy service_role key |
| `APP_ORIGIN` | Keep `https://portal.alexbellarts.com` |

If using `NEXT_PUBLIC_SUPABASE_ANON_KEY` instead of the publishable key, set the new project's anon key and ensure an older publishable key is not still taking precedence. Likewise `SUPABASE_URL` is only a fallback to `NEXT_PUBLIC_SUPABASE_URL`. Integration-managed values must be updated through their integration connection where necessary; never combine an old URL with new keys or leave higher-priority values pointing at the old project. Enter keys only in secure hosting/environment fields, never chat, Git or public variables for the service_role key.

Keep unrelated settings, including the Tally form/signing configuration, unchanged. The current app does not use raw `POSTGRES_*` connection variables for its Supabase Auth/REST workflow; do not rewrite unrelated integrations as part of this change.

Redeploy after changing public connection values. This switches the backend for everyone using that deployment, so finish the preceding setup first. Existing domain DNS and the Framer website do not need changing.

## 5. Verify before retiring anything

Use the new owner account. Check sign-in/recovery/MFA, create a fictional project, check owner completion releases the next client stage, then check a private handover upload/download and final approval/payment gates. Run the existing owner diagnostic with disposable data and inspect cleanup results. Check Tally intake against the new project if using it. New email/provider/storage settings require their own hosted acceptance.

Keep the old project until the replacement works. If the hosting switch fails, restore its saved connection values and redeploy while investigating. Do not delete/reset either project merely to retry SQL. The old project's PAM issue remains a separate provider problem.

## Local validation

The combined file was applied to an empty PGlite database with simulated Supabase Auth/Storage schemas. It created the complete schema without 013; an authenticated fictional owner successfully created the 16-stage combined journey, with contract/deposit before onboarding and client uploads disabled for Goodbye. A second application was rejected before altering the existing fictional project. This validates the bundled DDL and guards, not Supabase's hosted authentication or a live deployment.
