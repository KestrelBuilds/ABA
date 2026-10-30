# Owner-run portal checks

Open **My account → Check client portal access → Run automatic portal checks** in the deployed owner workspace. Keep the page open until it finishes; it may take a couple of minutes. Do not click again while it runs. Owner sign-in/MFA and the existing server-only service key are required. No new service, SQL update or client email is needed. Alex confirmed 012 applied and the owner archive/filter/restore flow works; the expanded live diagnostic has not yet been confirmed.

## What is checked

The result shows six groups, each Passed, Needs attention, Not run or Update unavailable:

1. **Accounts & project privacy:** two temporary client sign-ins, invitation acceptance, project isolation, hidden stages, owner notes and protected payment writes.
2. **Questionnaires & feedback:** correct-workflow submission, owner review, other-client isolation, revision/comment/creative approval and unchanged final-release flags.
3. **Private files & final delivery:** actual byte-identical PDFs, raw and signed downloads, unpublished/other-client/anonymous denial and independent final payment/approval gates.
4. **Archives, evidence & combined approvals:** retained archive reads with feedback writes blocked; suspended project/document/raw/signed access denied; restored access with original flags and ordinary feedback preserved; new owner evidence dated/linked/private/client-write-protected; combined final files blocked until branding approval AND website approval AND final payment, then locked again when either approval is removed. An unrelated client is denied throughout. Old signed links are allowed to expire normally; the test checks denial of freshly requested links.
5. **Access removal:** project access and new raw/signed file requests denied after the disposable client's access is revoked.
6. **Temporary data cleanup:** only this run's allocated private paths/accounts/projects are targeted; successful Storage removal is followed by an absence check before project/client metadata deletion. Audit history, including minimal detached verification history, is retained.

Lifecycle checks require 012; older installations keep their existing diagnostic and explicitly show those checks unavailable, rather than claiming they passed. On optional 013 installations, fictional PDFs must also pass the configured real scanner. Diagnostics use authenticated uploads instead of signed upload URLs, avoiding two-hour upload capabilities surviving immediate cleanup. New 013 scanning configuration is still a separate prerequisite; this check is not proof that a malware engine detects malicious files.

## Scope and cleanup failures

The owner-only server action takes no client IDs, paths, email recipients or passwords from the browser. Each run allocates random IDs and creates its own confirmed fictional Auth accounts at example.com; no email is sent. Permission assertions use ordinary owner/client sessions. Service access only scaffolds/removes the run's disposable Auth accounts and removes/verifies its exact allocated Storage paths and metadata. Existing clients/Auth accounts are never selected for cleanup.

A timeout, network failure or unexpected provider 5xx response must not count as a successful denial. If Auth account creation times out or returns an ambiguous server error, its outcome is also treated as unknown: cleanup needs attention and reports the run ID instead of claiming that an untracked account was removed. No account lookup/reset/deletion of existing clients is attempted to resolve that uncertainty. If any assertion fails, later groups remain Not run and cleanup still runs. A file-removal error, unreadable file listing or remaining object makes cleanup fail. The runner then keeps the fixture project/client records, revokes its disposable profiles/invitations and reports the run ID. Auth accounts whose retained records prevent deletion can remain for review; no success is claimed for them.

If **Temporary cleanup needs attention** appears, or the browser loses the action result, the run button stays disabled on that page. Stop and retain the reported run ID; reload only after the reported cleanup has been reviewed. Review only that run's Automatic portal check / Automatic combined-approval check projects and exact private paths in Supabase before another run. The retained metadata identifies remaining files; do not clear records first or delete real client accounts to make a check pass. There is no automatic sweeper or general-purpose cleanup endpoint accepting a browser-supplied run ID. Failed-run recovery needs a deliberate scoped review.

## Limits

This check does not establish browser invitation delivery, password setup/recovery, owner MFA recovery, every early-discovery/contract-return screen, backup/restore coverage, retention/privacy compliance, production rate limits or malware-engine effectiveness. Those launch items remain separate in GO-LIVE-STATUS.md and LAUNCH-CHECKLIST.md.

Local integration tests run this diagnostic against the actual SQL migrations/RLS with fictional Auth/Storage adapters and local byte-serving URLs. They include deliberately broken archive write policies and Storage deletion failures/false-success responses. Chromium checks verify the real owner result UI against fictional services. Neither proves the expanded hosted result. Only record hosted checks as passed after Alex runs the deployed tool and confirms its results and cleanup.
