# Initial contract area

This implements Alex’s chosen workflow: share an Acrobat-fillable/signable contract PDF, let the invited client download and sign it externally, return the completed PDF inside ABA, then have Alex review it and verify contract/deposit before opening the full portal.

## One-time activation

1. In the existing Supabase project, run only `supabase/migrations/202610280006_contract_area.sql`, once, after migrations through 202610280005 have been applied. Do not rerun earlier migrations. The new migration is transaction-wrapped, does not change existing payment/contract flags, and does not opt existing projects into early access.
2. Use the deployed app version containing this feature. Without the migration the app keeps the old workflow, hides early-sharing controls and refuses early invitations/returns.
3. Use fictional clients/files for the hosted acceptance steps below before real use. No new paid service or signing-provider API is required.

## Owner workflow

1. Open the contract stage in the project journey. Stage names may be customised; early access is explicitly bound to the selected stage ID.
2. Upload the contract PDF as **Document type: Contract**, **Release rule: Project document**. Make the stage client-visible and share the file. Unpublished files, final-deliverable files, invoices/proposals and files in other stages are never included in early access.
3. Expand **Initial contract area**. Confirm the scope and choose **Enable initial contract area**. There is one initial contract stage per project. No invitations or emails are sent by this action.
4. **Preview initial contract area** opens a read-only owner preview. This does not impersonate the client and cannot return a file.
5. Go to **Clients**, create the client’s private invitation link, and share it manually. Invitation email delivery remains disabled unless separately configured. Existing clients can sign in normally; no new invitation is required for an already-linked client account. Existing-account invitation resend remains a separate limitation.
6. The client completes/signs the PDF outside ABA (for example in Acrobat), saves it and uploads the returned PDF. The existing client-assets private bucket stores its bytes unchanged, linked to the exact original document and its stage. It is visible in that stage and All project files. Keep PDFs within 3 MB.
7. Download/review the returned PDF. Only after checking it, use the journey’s explicit **Contract signed** verification. Independently verify the received deposit (through an existing invoice’s full-payment action where applicable). Only both verified records open full project access. The client refreshes/reopens the portal to see the change.

Uploading a PDF does not legally execute a contract inside ABA, validate a cryptographic signature or automatically set any project gate. ABA has no embedded Acrobat session/signature-service integration. Agreement execution and signing requirements are handled through the external method chosen by Alex.

## Client experience

Invited clients without an onboarded project are sent from `/portal` to `/contracts`. They see project/stage names, contract/deposit verification status, explicitly shared contracts and their own returned copies. They can set their sign-in password and sign out. Project briefs, questionnaires, other stages, proposals/invoices, notes, final files and owner controls remain inaccessible. Clients with both an onboarded project and a restricted project retain their full-project portal and get a link to the initial contract area for the other project.

## Privacy and failure handling

- New contract-specific permissions allow exact Contract/document/shared/visible-stage records under an enabled exchange and an authenticated profile belonging to the project’s client. Full project access rules remain unchanged.
- Minimal contract DTOs are returned by a scoped database function. The project table itself does not become readable before onboarding.
- Returned copies use existing client-assets records with `contract_document_id`. Cross-client, wrong-project, wrong-stage and unrelated-document references are rejected. Clients cannot set contract/payment verification flags.
- Creative feedback permissions explicitly remain behind full onboarding, even though the contract itself is downloadable early.
- Turning off the exchange, unsharing its contract, hiding its stage or revoking the client prevents new restricted reads/download links. Existing signed links can remain usable for up to 60 seconds; already downloaded files cannot be recalled. Full onboarding access, if already granted, follows its normal rules.
- Files are private attachments; PDF header/type/size validation is not malware scanning or signature verification. Owner review remains necessary. Failed uploads attempt to remove their metadata; report any unresolved storage failures before claiming a returned copy is available.
- No historical records are backfilled or reclassified. The new stage relationship also prevents accidental deletion of a configured contract stage; keep/disable it instead of deleting its history.

## Hosted acceptance (not yet confirmed)

With fictional records, verify the complete lifecycle in the deployed app after applying the migration:

- Owner can share the selected contract stage, enable/disable early access and preview it read-only.
- A newly invited client accepts the private link and sees only the restricted area; another client/anonymous session cannot download the contract or returned copy.
- The client downloads and externally completes a fictional PDF, uploads it and can download identical bytes. Invalid/non-PDF/oversize uploads are rejected without verifying the contract.
- Owner sees the returned copy in its original stage and the full file library. No upload or ordinary stage status changes contract/deposit flags.
- Contract verification alone does not open the full portal. Deposit verification as well opens it; internal/final files still retain their separate restrictions.
- Unsharing/hiding/disabling/revoking denies new restricted downloads and direct provider API reads; distinguish old signed links from new requests. Test full-project access separately when onboarding has already completed.
- Existing fully onboarded clients, standard invitations, questionnaires, feedback, file delivery and any previous native invoice protections still work.

Local evidence is documented in CHANGELOG.md. SQL tests use PGlite and Auth/Storage metadata; Chromium tests use fictional HTTP services. Neither establishes hosted Supabase email/Storage behaviour or a production security review.
