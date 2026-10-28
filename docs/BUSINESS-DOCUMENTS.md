# PDF-first stage work and optional business documents

Apply `supabase/migrations/202610280005_business_documents.sql` once after the four previous setup/upgrade files. It is transactional and additive. Existing records, uploaded files and submitted questionnaires are preserved. The UI checks capability and keeps existing workflows available before the upgrade. No extra secret, payment account or paid service is needed.

## Use your own Illustrator PDFs
The primary workflow is **Projects → project → Your project journey → expand a stage**.
- Discovery Call has Alex's supplied public Calendly link by default: https://calendly.com/alex-bell-arts/new-meeting. This opens Calendly; it does not expose account credentials, synchronise availability into ABA or book anything automatically. Owner instructions/booking URL can be overridden per stage.
- Relevant discovery/goodbye stages link to their native questionnaire, and branding/goodbye stages retain the external Tally forms. Goodbye links keep the final approval/payment gate.
- Upload a proposal, contract, invoice, presentation or handover PDF directly to its stage. Set a version/review date and choose document vs final-deliverable release rules.
- Uploads begin as private drafts. Use **Share file with client** to publish. Files attached to hidden/internal stages remain inaccessible to clients, including raw Storage requests. A stage with attached files cannot be deleted, preventing accidental re-exposure or loss of its history; keep/hide it instead.
- Clients with portal access can open the stage and upload a completed/signed PDF copy. It is a returned file, not an automatically verified legal signature. The owner verifies the actual agreement and payment separately.
- Portal access still starts after signed contract and deposit. Before that, download/email the proposal, contract and deposit PDFs through your normal process and upload records here. A narrowly scoped pre-booking signature portal is not implemented.
- Files currently support PDF/PNG/JPEG/WebP up to 3 MB. Larger Illustrator PDFs need compression or an agreed external sharing method. Source/ZIP/font files and malware scanning are not implemented.

## Optional built-in proposals/invoices
Inside a project, expand **Optional built-in proposals & invoices**. Owner Finance contains the invoice ledger, seller settings and reusable proposal templates.

### Proposals
Create a draft from a saved internal template or blank fields. Fill scope, deliverables, timeline, revision allowance, exclusions and notes. The value snapshots the project budget when the draft is created. Share freezes the revision and client/seller snapshot; create a new draft for subsequent changes. Record Accepted/Declined only after receiving the actual client decision. This is not legal signing, and acceptance does not automatically satisfy the contract or deposit conditions. Download and manually email PDFs before onboarding if needed.

### Invoices
Create a deposit/final pair from the project value. Odd pennies go to the deposit; the two amounts sum exactly to the total. Previously recorded manual payments block automatic pair creation until reconciled: do not clear genuine payment records just to bypass the guard. A latest accepted native proposal with a different price also blocks pair creation.

Before issue, complete seller legal/trading name, business address/email and client billing name/address. Confirm no VAT is being charged only if correct for the business; VAT calculation is not supported. Review accounting/legal details before real invoices. Currency is GBP. Issued invoices get unique numbers and frozen party/amount snapshots. Later settings edits do not rewrite prior documents. Final invoices require verified creative approval.

Record only verified full payments with the received date. The RPC updates the corresponding project deposit/final payment flag; manual project payment edits are guarded once native invoices exist. No money moves, no card credentials are stored and Stripe is not connected. Partial payments, refunds, credit notes, late fees and automated reminders are not implemented. Project price changes are blocked while current invoices exist; revise/void unpaid documents or seek accounting review for paid ones.

Void unpaid drafts/issued invoices without deleting history. Replacements retain the original amount but receive new billing snapshots/number on issue. Paid invoices cannot be voided here. Ledger totals cover built-in invoices only, not external PDF invoices/project-only manual payment flags; drafts and voids are excluded.

## PDFs and privacy
PDF downloads authenticate every request and use row policies: owner sees own business records, clients see only published/shared eligible project records. Drafts/internal templates/seller settings are not exposed to clients. Responses are private/no-store attachments. PDFs include the A logo and embedded DejaVu Sans under its bundled licence for readable £/European characters; unsupported scripts may need additional licensed fonts. Long sections wrap and paginate. Draft PDFs are labelled DRAFT. The files are generated on demand, not stored publicly or emailed automatically.

## Verification status
Local PostgreSQL tests exercise full lifecycle, snapshots, rounding, client isolation, phase gates, stage-resource privacy and no accidental stage-deletion release. PDF tests use text extraction to verify real content, prices, Unicode and pagination. Browser tests cover the actual finance and stage/returned-copy UI through fictional services (`--finance`, `--stages`); they are not hosted provider proof. After applying the upgrade, run the hosted acceptance steps with fictional records before real client use. Existing automatic portal checks remain valuable but do not cover the entire new finance lifecycle.
