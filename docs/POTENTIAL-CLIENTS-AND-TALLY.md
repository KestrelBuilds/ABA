# Enquiries, potential clients and Tally

## One setup update

Run `supabase/updates/20261029_potential_clients_and_tally.sql` once in Supabase’s SQL Editor. It requires the existing 006 contract-area update and applies only missing 007, 008 and 009 upgrades. It safely skips already installed upgrades and does not opt existing projects into sharing or change signed/payment flags. Canonical migrations remain in `supabase/migrations`; standard migration runners should use those in order instead of the convenience update.

Local SQL tests exercise the convenience update starting at both 006 and 007 and repeating it. Hosted application/Storage/Tally delivery still require the checks below.

## Intended workflow

1. Enquiries arrive from Alex’s public Tally form or are entered manually for word-of-mouth contacts. They are private owner records, not client accounts or signed projects.
2. In **Enquiries**, review the submitted answers. Use **Create a potential project** to confirm contact/project details or reuse an existing client record. Conversion is atomic and refuses a second conversion. It creates ordinary stages but no contract/deposit flags, sharing or invitation.
3. In the potential project, open **Potential client · discovery, proposal & onboarding**. Enable the potential-client area, leave its released step at **Discovery-call booking only**, and save. Configure the public Calendly link. Create/share a private invitation from Clients when ready.
4. The invited prospect signs in and sees only the discovery view, not the full project journey, branding/website work, internal information or final files. Calendly is a public booking link; no automatic booking confirmation is claimed.
5. After discovery, upload a proposal PDF into its stage as **Proposal → Project document**, share it, select that stage in the potential-client controls and release **Discovery + proposal PDFs**. A client may send interest, a question or a decline. The response is tied to that uploaded proposal and does not sign a contract, verify payment or move the released step automatically.
6. If proceeding, upload/share the Contract and deposit Invoice PDFs in their stages, select those stages and release **Discovery + proposal + contract/deposit PDFs**. Only shared Project document files of the corresponding types in the selected client-visible stages are included. Draft, general, presentation, internal, unselected-stage and final-deliverable files stay hidden.
7. The client signs the contract externally (e.g. Acrobat) and returns it in the limited area. Alex reviews and explicitly verifies the contract and deposit. Only both records open the full creative journey. Final files retain their final-approval/payment gates.
8. Track owner statuses New enquiry, Discovery, Proposal sent, Considering or Not proceeding. Not proceeding closes early access while retaining the record; it sends no email. Full onboarding labels the relationship Active client, independently of the enquiry status. Active projects cannot be marked Not proceeding through these controls.

Owner **Preview client portal** now uses the restricted potential-client layout before onboarding. It no longer presents a planned full journey. The preview is read-only, never impersonates a client, and omits individual returned copies/responses. Real clients see their own returns/responses through their authenticated account. Fully onboarded projects keep their full preview.

Existing initial contract areas continue to work until a potential-client configuration is explicitly saved for that project. The prospective configuration then supersedes legacy early contract access, including when disabled/closed; old contract URLs cannot bypass the released step. Full project permissions remain separate and unchanged.

## Automatic Tally connection

The application endpoint is:

`https://aba-iota.vercel.app/api/tally`

Configure the following in **Vercel → this project → Settings → Environment Variables**, for Production (and redeploy after changes):

- `TALLY_FORM_ID`: `mOLMrk`, the public enquiry form currently linked from Alex’s website. Use the actual form ID if it changes.
- `TALLY_WEBHOOK_SIGNING_SECRET`: the same signing secret configured/shown for the webhook in Tally. Enter its value only in the secure settings, never chat, source or a NEXT_PUBLIC variable.
- Existing Supabase URL and `SUPABASE_SERVICE_ROLE_KEY`: the server-only key already used for invitations. Do not expose it publicly. No new paid service is required by this code; provider feature availability is controlled by Tally/Vercel.

In **Tally → the enquiry form → Integrations → Webhooks**, add the endpoint and signing secret. Use Tally’s test delivery or send a fictional enquiry, then confirm it appears once in ABA’s Enquiries inbox. This workspace could not read Tally’s current help page because of network restrictions; exact provider menu wording and hosted delivery must be confirmed during setup.

The endpoint expects `Tally-Signature` as base64 HMAC-SHA256 of the exact UTF-8 JSON body and a `FORM_RESPONSE` event for the configured form ID. It fails closed when configuration/signature/form/body checks fail. Do not disable signature verification to make a test pass. An ordinary browser GET is not a webhook test and can return Method Not Allowed.

Successful submissions are stored privately and do not create accounts, send emails, invite people or enable project access. Labels and supported field values appear as plain text for owner review. Contact-name/business-name suggestions use common field labels and INPUT_EMAIL; confirm them before conversion if the form uses different wording. File-upload URLs, hidden fields and unknown nested objects are not fetched or stored. The implementation is not a general Tally form editor or a synchronization of the separate logo/goodbye forms.

Duplicate form/response IDs are ignored transactionally. Minimal non-contact receipt IDs remain after deliberate deletion so a delayed webhook retry cannot recreate deleted enquiry content. Storage/database failures return a retryable error; a receipt is not committed without its enquiry.

Incoming payloads are limited to 64 KiB, 100 fields and bounded text. Enquiries remain owner-only; the limited webhook service client can call only the fixed intake function in the endpoint code, with no browser-controlled table, role, URL or invitation action. Normal application sessions cannot execute the service-only intake RPC. This is a narrow extension of server-key use, not permission for generic service-role client queries.

## Hosted acceptance still required

- Verify a Tally test submission and retry produce exactly one new private inbox entry, with correct contact suggestions and displayed answers. Confirm missing/invalid signature and a different form cannot create entries. Do not log secrets or full submission bodies.
- Review/convert a fictional enquiry, enable discovery and create a private invite. Sign in as that prospect in a private browser window. Confirm no full journey or future documents are shown.
- Release a shared proposal, send a response, then release contract/deposit PDFs. Validate download/return with real private Storage. Cross-client/anonymous and hidden/unpublished/unselected/final file reads must be denied through direct provider APIs as well as screens.
- Verify proposal interest and PDF return do not confirm a contract/payment. Signed-only keeps the client restricted; contract plus deposit opens the full journey. Check final delivery separately.
- Mark another fictional prospect Not proceeding and confirm new early reads/links are denied without changing unrelated active projects. Existing signed URLs can last up to 60 seconds; downloaded copies cannot be recalled.
- Confirm deletion still removes linked prospect spaces/responses and converted enquiry content before deleting dependent stages; audit/Auth records and minimal webhook receipt IDs remain.

Local SQL tests cover these database boundaries; Chromium and webhook route tests use fictional services. They do not establish hosted delivery, booking completion or production privacy/security approval.

## Owner-confirmed checks — 29 October 2026

Alex confirmed the combined SQL completed and supplied a live Enquiries screenshot showing the fictional Tally submission and answers. He also confirmed conversion, discovery and agreement owner previews, and separate contract/deposit verification unlocking. Tally and Vercel secrets were configured by Alex; no secrets were supplied to the coding workspace. These confirmations do not establish webhook retries, hosted rejection of invalid signatures, a real invited-client contract return or the remaining isolation/privacy checks.

The interface follow-up groups answers, release settings and document cards and uses larger mobile controls; it requires no additional SQL. Owner preview remains read-only.
