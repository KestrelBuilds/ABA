# Inviting someone to ABA Studio

Apply `supabase/migrations/202610290010_client_invitations.sql` in the Supabase SQL editor after migrations through 009. This additive, repeatable update preserves existing connected accounts and project/payment flags. Old workspaces keep their projects; invitation controls explain when this update is missing.

## Owner steps

1. Open the client's project. For an early enquiry, enable its potential-client area and choose Discovery, Proposal or Contract & deposit. For the full journey, verify the actual signed contract and deposit.
2. Select **Invite / manage client access** above the project, or open **Clients → the client → Client portal**.
3. Check the saved client email. Select **Create portal invitation**.
4. Select **Copy invitation link**, then send it directly to that client using your usual email or message app. The app does not send an invitation email automatically.
5. After they accept/sign in, select **Refresh access status** to see **Account connected**.

For a connected account, **Get portal sign-in link** supplies the normal login URL. No fresh invitation is needed for another eligible project under the same client record. A client account remains associated with one client record.

## What the client does

A genuinely new account receives a private Supabase invitation link. Opening the page does not consume it: the client selects **Accept invitation & sign in**, then chooses a password of at least 12 characters and opens the portal. Their view follows the owner's released phase and verified contract/deposit flags.

An existing or returning account receives the normal ABA sign-in link with an invitation explanation. This URL is not an authentication token. They must prove ownership by signing in with the saved email and their own password, or by requesting an emailed sign-in link. Their pending invitation is accepted under that authenticated identity. No owner-generated sign-in token, password reset or duplicate account is used for an existing account.

## Status and revocation

The owner sees Not invited, Invitation pending, Account connected, Invitation expired or Access revoked. Status is permission/account state, not proof an email was sent or delivered. Pending permission lasts seven days; a provider's one-use authentication link may expire sooner. **Create fresh invitation** renews a pending/expired/revoked invitation after checking sharing eligibility and account ownership again.

The owner panel also shows recorded invitation creation, portal-permission expiry and account-connection dates in **UK time**, including the British Summer Time change. Missing or invalid timestamps are not invented. Once an account is connected, its old invitation expiry is not presented as an account-access deadline.

**Refresh access status** clears any link/copy confirmation currently displayed. If the client still needs an invitation, use **Create fresh invitation** to obtain a new link to copy; connected clients use **Get portal sign-in link**. Links are also hidden if the displayed account state, client/email or sharing eligibility no longer matches the result. This prevents an earlier invitation from remaining labelled as a current sign-in link after acceptance, expiry or revocation. These are display controls; server-side identity and SQL rules remain authoritative, and clearing a link does not revoke an already-issued provider token.

**Remove portal access** requires an acknowledgement, removes linked client profiles and marks invitations revoked. Auth accounts, passwords, project records and audit history remain. Existing signed file URLs may remain usable for up to 60 seconds. Old links cannot recreate revoked access without a fresh owner-authorized invitation.

Exact normalized saved email, a confirmed Auth email at acceptance, owner/MFA checks, client eligibility and current profile/invitation bindings are enforced in SQL. Other-client and owner accounts cannot be attached by a crafted action. A failed invitation save never deletes an Auth account. A race which registers the email may require retrying once as an existing account. Changing a client's saved email while account/invitation history exists still requires separate account review.

## Passwords and email setup

The login page offers **Forgot your password?** and **Sign in by email instead**. Both return uniform messages; they do not disclose whether an email exists. Recovery uses Supabase's supported reset flow and requires a verified signed-in Auth session before changing that account's password. Confirmation must match, and owner MFA is still required. Changing a password does not grant or restore portal access.

In Supabase Authentication → URL Configuration, retain the production Site URL and allow:

- `https://aba-iota.vercel.app/auth/callback`
- `https://aba-iota.vercel.app/auth/confirm`

The existing PKCE callback recognises recovery from the provider’s stored recovery intent, so no additional recovery redirect URL is required. Default email templates can return through this callback; open the email in the browser where you requested it. For a custom Reset Password email template, use the app's confirmation page with a button, for example:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Choose a new password</a>
```

The direct token template supports opening the email in another browser and requires a button click before verification. Client invitation links generated in ABA already use this confirmation page. Keep links/tokens private and never paste them into logs or chat.

The earlier optional `SUPABASE_INVITE_EMAIL_READY` delivery picker is superseded by the guided copy-and-send invitation flow. Password and sign-in email delivery still depends on configured Supabase email/SMTP settings and allowed recipients. Provider request acceptance is not confirmed inbox delivery. No new email service or paid integration was added.

## Hosted acceptance

Local SQL tests cover identity binding, owner/client isolation, expiry, revocation, repeat application and returning accounts. Fixture browser checks cover owner guidance, copyable links, statuses, authenticated password setup/recovery and expired links; no real email is sent by these checks.

The 3 November link-refresh regression was reproduced in the actual UI before correction. The expanded `--invitations` fixture checks expiry/revocation/reinvitation, clearing old links and copy feedback, and UK dates across BST/GMT in a browser set to America/Los_Angeles. Existing accounts reuse sign-in without creating another provider token. These local checks do not establish hosted email or account behaviour.

After applying 010, test a fictional email you control: new invitation → password setup → restricted view; revoke → no data access; reinvite the same email → existing-account sign-in → intended view only. Check reset/sign-in email delivery, actual recovery in the browser, owner MFA, hidden/final file restrictions and another client's isolation. This coding workspace has no live Supabase credentials and does not establish those hosted results.
