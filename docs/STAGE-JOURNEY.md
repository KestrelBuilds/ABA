# Stage-by-stage project journey

Alex requested a simpler project screen, stages released by owner completion, no client file upload for Goodbye Packet, and AI/SVG/PNG/JPEG handover uploads on 7 November 2026.

## Interface

The project screen follows one vertical journey. The current client stage opens by default; its questionnaire, files, version-bound feedback and permitted returns live inside that stage. Owner ordinary stages have a Mark stage complete button; verification stages retain their existing contract/payment/approval checks. Owner editing remains available for preparation at any stage.

The file library, project details/tasks/brief, supporting guidance, owner settings/notes and account controls remain available in closed disclosures instead of a competing column of open panels. Owner preview uses the same client layout, restrictions and read-only action handling. Unattached historical files remain in the collapsed All project files library; no document associations or historical records are rewritten.

## Database activation — apply only 014 after 012

Apply `supabase/migrations/202611070014_stage_journey.sql` once through the existing Supabase SQL editor after the owner-confirmed 012. **Skip optional 013**: a scanner is still deferred, and 014 works without it. No live SQL or real client data was changed from the coding environment. The application capability-checks `stage_access_ready`; until 014 is applied, existing access rules continue and the owner sees an activation note. The simpler layout and Goodbye Packet form removal work independently.

014 adds a durable `stages.client_uploads_allowed` flag, sets it false on Goodbye stages and keeps it false across renames. New Goodbye stages receive the same setting. It adds sequential read/upload/form policies and allows owner document Storage to accept PostScript/Illustrator and SVG MIME types without increasing current size limits or making a bucket public. It changes no completion, verified payment/contract/approval flag or publication decision.

New templates order enquiry → proposal → contract → deposit invoice → onboarding → creative work → goodbye, preventing a contract/onboarding access deadlock. Existing saved stage orders are preserved. For an unfinished existing project with Onboarding before Contract/Invoice, use the owner stage Move controls to put Onboarding after both before inviting the client; an owner reminder appears in that stage. In older combined workflows, put project-wide final-approval/payment verification stages after both creative workstreams so a global final check does not block the unfinished stream. Owner stage editing remains available before and after activation.

Stages follow the saved project-wide position order, across workstreams. Equal positions use UUID order. Every earlier stage must be effectively complete, so an out-of-order completed stage cannot bypass an unfinished earlier one. Internal stages also block progress; their names/content remain private. Ordinary completion is owner-only under existing stage RLS. Contract/deposit/final checks derive completion from their verified project records; a raw Completed label never overrides missing verification. Reopening/reordering/hiding an earlier stage can relock later content. Clients can see visible stage titles and lock states, while future instructions, files, feedback and questionnaire submissions remain unavailable.

SQL enforces these rules on document metadata, actual/signed Storage access, early prospect/contract helpers, assets and questionnaire read/insert paths. Existing ownership, onboarding, archive read-only/suspension, scan quarantine (where already activated), and final approval AND payment restrictions remain cumulative. Existing signed URLs can remain valid for their 60-second lifetime; previously downloaded files cannot be recalled. Client action checkboxes and feedback never complete a stage or verify a payment.

014 supports an installation that already has 013, but **do not apply 013 later on top of 014** without a compatible follow-up: the older optional migration replaces shared access helpers. Future scanner activation still requires approval, configuration and acceptance under SECURE-UPLOADS.md.

## Handover formats

Owner stage documents support PDF, PNG/JPEG/WebP and, after 014, `.ai` and `.svg` up to **3 MB per file** under the existing legacy cap. Use Handover or Final deliverable for AI/SVG. Goodbye/Framer handover defaults remain final-gated; all uploads start private. Sharing a file or completing a stage never releases final content without verified approval and payment.

AI validation accepts PDF-compatible or PostScript Illustrator exports, handles common browser MIME variants and stores canonical PostScript MIME. SVG is parsed without rendering or fetching resources; malformed XML, DTD/entities, scripts, event handlers and external resources are rejected. Export a static SVG without a DOCTYPE. SVG/AI are offered as downloads, not inline previews. Signature/XML validation is not malware scanning; no scanner, new provider, PC process or purchase is introduced. Optional 013 keeps its quarantine path if it was already enabled.

Clients have no Goodbye stage file-return form. Other stage uploads retain their current file limits and checks. Historical client returns are retained; the update does not delete existing assets.

## Verification

Local PostgreSQL tests apply 014 after 012 with and without pre-existing 013, exercise raw Storage and metadata denial, owner-only completion, internal predecessors, durable Goodbye upload restrictions, service questionnaires and payment verification. Fictional browser mode `--journey` checks the vertical screen, inline questionnaire, next-stage unlock, preview isolation, all four requested owner formats, final/private defaults and phone/desktop widths. Existing client questionnaire/review/release, owner preview, owner/client file libraries, verification/contract checks, form/questionnaire retries, asset management, combined template, archive read-only access and optional quarantined uploads also pass their fictional browser modes. All 131 automated tests pass. Hosted activation and a fictional hosted client acceptance remain separate from these local results.
