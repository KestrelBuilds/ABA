# Uploaded PDFs and previous document records

Apply `supabase/migrations/202610280005_business_documents.sql` once after the four previous setup/upgrade files. It is transactional and additive. Existing records, uploaded files and submitted questionnaires are preserved. The UI checks capability and keeps existing workflows available before the upgrade. No extra secret, payment account or paid service is needed.

## Use your own Illustrator PDFs
The primary workflow is **Projects → project → Your project journey → expand a stage**.
- Discovery Call has Alex's supplied public Calendly link by default: https://calendly.com/alex-bell-arts/new-meeting. This opens Calendly; it does not expose account credentials, synchronise availability into ABA or book anything automatically. Owner instructions/booking URL can be overridden per stage.
- Relevant discovery/goodbye stages link to their native questionnaire, and branding/goodbye stages retain the external Tally forms. Goodbye links keep the final approval/payment gate.
- Upload a proposal, contract, invoice, presentation or handover PDF directly to its stage. Set a version/review date and choose document vs final-deliverable release rules.
- Uploads begin as private drafts. Use **Share file with client** to publish. Files attached to hidden/internal stages remain inaccessible to clients, including raw Storage requests. A stage with attached files cannot be deleted, preventing accidental re-exposure or loss of its history; keep/hide it instead.
- Clients with portal access can open the stage and upload a completed/signed PDF copy. It is a returned file, not an automatically verified legal signature. The owner verifies the actual agreement and payment separately.
- Full portal access still starts after verified signed contract and deposit. After migration 202610280006, an explicitly enabled initial contract area supports downloading/returning shared Contract PDFs before onboarding. Proposals and deposit invoices are not exposed in that area; share those through your usual process. See [initial contract setup](CONTRACT-AREA.md).
- Files currently support PDF/PNG/JPEG/WebP up to 3 MB. Larger Illustrator PDFs need compression or an agreed external sharing method. Source/ZIP/font files and malware scanning are not implemented.

## Illustrator PDFs are the document workflow

The Finance navigation, generation forms, seller/billing settings, templates and new native proposal/invoice actions have been removed at Alex’s request. Upload PDFs into the relevant journey stage, share them, and let eligible clients download/return their completed copies. Verify the signed contract/payment separately inside the journey. Electronic signing and automatic payment collection are not provided.

No SQL rerun is needed. Keep migration 202610280005: it also supplies stage attachments and privacy rules used by uploaded files.

## Previous records, only if any exist

A collapsed **Previous generated documents** section appears only on projects that already contain generated records. It preserves downloads and history; it has no creation, replacement, issuing or template tools. The normal PDF workflow has no such section.

If a previously issued native invoice exists, its payment must still use **Record full payment** after verifying full receipt and the date. Unpaid unused drafts/issued invoices can be explicitly voided without deleting their history. Paid records cannot be voided. Do not clear project payment flags or remove financial records to bypass these guards. Ordinary uploaded Illustrator invoice PDFs use manual verified project payment records, as before.

The schema and PDF download code for previous records remain for compatibility. New-record application actions were removed; historical SQL migrations remain unchanged. This is not a destructive database cleanup.

## PDFs and privacy
PDF downloads authenticate every request and use row policies: owner sees own business records, clients see only published/shared eligible project records. Drafts/internal templates/seller settings are not exposed to clients. Responses are private/no-store attachments. PDFs include the A logo and embedded DejaVu Sans under its bundled licence for readable £/European characters; unsupported scripts may need additional licensed fonts. Long sections wrap and paginate. Draft PDFs are labelled DRAFT. The files are generated on demand, not stored publicly or emailed automatically.

## Verification status
Local PostgreSQL tests exercise full lifecycle, snapshots, rounding, client isolation, phase gates, stage-resource privacy and no accidental stage-deletion release. PDF tests use text extraction to verify real content, prices, Unicode and pagination. Browser tests cover existing-invoice preservation and stage/returned-copy UI through fictional services (`--finance`, `--stages`); they are not hosted provider proof. After applying the upgrade, run the hosted acceptance steps with fictional records before real client use. Existing automatic portal checks remain valuable but do not cover the entire new finance lifecycle.

## Acrobat-signed PDFs
Alex’s intended workflow is an externally fillable/signable PDF, downloaded and completed in Acrobat, uploaded back to the same stage, and explicitly reviewed/verified by the owner. Uploads never mark the contract verified automatically. Alex chose a restricted contract-only area. Its implementation requires migration 202610280006 and the explicit owner opt-in described in CONTRACT-AREA.md. Full portal access remains gated by contract/deposit verification; general stage-by-stage access gating is not implemented. Hosted acceptance is pending.
