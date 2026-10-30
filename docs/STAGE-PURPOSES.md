# Stage purposes that survive renaming

Stage names are editable labels. After migration 011, each stage has a separate purpose: ordinary progress, signed contract, 50% deposit, contract and deposit, final creative approval, or final payment.

## Activate

Apply only `supabase/migrations/202610300011_stage_purposes.sql` in the Supabase SQL editor after migrations 001–010. Do not rerun earlier migrations. This migration has been tested locally. Alex confirmed it ran successfully on the hosted project on 30 October 2026; hosted behaviour acceptance remains an owner step. No credentials or real records were used in development.

The update adds a nullable constrained column and a capability function, and extends atomic project creation to retain the supplied purpose. Existing row-level permissions, access functions, private file paths, native invoice guards and project verification flags are unchanged. Existing names, streams, positions, progress statuses and verification records are retained. The existing audit trigger records stage updates; no historical verification evidence is invented.

Only exact standard verification names in their expected workstream are mapped. Matching ignores case and surrounding spaces. Duplicate/overlapping candidates in the same project/workstream remain unassigned: for example two Contract stages, Contract plus Contract and Deposit, or Final Approval plus Final Review and Approval in one stream. Separate branding and website approval stages can retain their shared project-wide final-approval check; this does not introduce independent workstream evidence.

Custom names, ordinary existing stages and ambiguous matches require an explicit owner choice. No purpose is inferred from filenames, returned PDFs, Completed status or payment amounts. New project templates explicitly assign Contract and Invoice their separate contract/deposit purposes; other template stages use ordinary progress. Old app versions creating stages without purpose leave them unassigned.

## Use

Open a journey stage → **Stage purpose**. Select its purpose and acknowledge that this choice does not verify anything, then save. Renaming the stage under its normal settings preserves the choice. Added custom milestones start unassigned; choose their purpose deliberately.

Unassigned stages show **choose purpose**, track their saved progress and keep the explicit project verification checks available at the top of the journey. Ordinary progress is an explicit choice even if the name is Contract or Invoice. Assigning a verification purpose changes where its checks appear and how completion is displayed; it does not change the underlying progress status or verification flags. Choosing ordinary progress restores that saved progress; it does not grant access.

Verify signatures, actual payments and final creative approval using their existing explicit checks. Existing generated invoices still require their **Record full payment** action. Final approval always covers all workstreams in a combined project. Purpose changes and ordinary completion never release a client journey, document or final deliverable.

Before migration, capability gating retains the previous name-based behaviour and hides purpose controls. Renamed legacy stages continue using the top-level project verification section. Unexpected capability errors fail rather than being treated as a missing migration.

## Validate

Run `npm test`, `npm run typecheck`, `npm run format:check` and `npm run build`. Run browser fixtures sequentially, with no concurrent Next build/dev server sharing `.next`:

- `node tests/client-journey-browser.cjs --stage-purposes`: fixed-purpose renaming, deliberate purpose changes, independent contract/deposit verification and revocation, unchanged access gates, responsive layouts.
- `node tests/client-journey-browser.cjs --verification`: older-installation fallback.
- `node tests/client-journey-browser.cjs`: client approval/payment/final download journey.
- `node tests/client-journey-browser.cjs --finance`: historical invoice payment routing.

These use fictional services and do not prove hosted acceptance. After applying 011, use a fictional project on the hosted app to rename a Contract stage, confirm its check remains, choose an ambiguous stage purpose explicitly, verify contract/deposit independently, and confirm final release still needs both final approval and payment. Do not change real client records for testing.
