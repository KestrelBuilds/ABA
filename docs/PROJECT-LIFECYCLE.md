# Project archiving and verification history

Apply **202610300012_project_lifecycle.sql once, after 011**, following a provider backup/checkpoint. Alex confirmed both 011 and 012 were applied successfully; do not rerun either. This is owner-reported activation, not completed hosted behaviour testing. No new secrets or services are needed for 012. The app checks capability before querying new columns; earlier installations keep their existing controls.

## Archiving

Projects → Project history & archiving → Archive this project. Explicitly select **retain existing access, read-only** or **suspend access to this project**, then acknowledge. Archives disappear from active lists, attention items and overview charts. Use Show projects → Archived projects to find them. Files, questionnaires, stages, verification flags and invitation/account records stay intact.

Retaining access keeps only what that client could already see. Hidden stages, unpublished files, other clients and protected final delivery stay restricted. Client submissions, uploads, questionnaire changes, feedback and proposal responses stop. Suspension also denies project files through direct Storage reads and early discovery/contract views. Owner previews respect this decision and stay read-only. Previously issued download links can last up to 60 seconds; downloaded copies cannot be recalled.

Restore requires an explicit acknowledgement that the usual existing access rules resume. It does not invite anybody, publish a file, verify a signature/payment or reset workflow statuses. Owners can still maintain archived records; restore before adding new scanned uploads.

## Verification history

New changes to signed-contract, deposit, final-payment and final-approval flags append private owner history with the actual time and actor. An optional reference, known signature/payment date and related project document can accompany an explicit verification. Leave dates blank when unknown. References are private notes, not receipts or automatic legal verification.

Existing flags are preserved, with an explicit “no recorded date” explanation. No historical events are backfilled. History cannot be edited/deleted by ordinary authenticated accounts and clients cannot read it. A project deletion retains a detached minimal history entry under the existing audit retention limitation; this is not complete personal-data erasure. Payment checks controlled by previous native invoices still require their existing full-payment action; its invoice ID and known paid date are captured.

## Combined projects

New combined projects use separate pending branding and website final-approval checks. Both must be verified for overall final creative approval; final payment remains independently required. Removing either check restores final-file restrictions. Optional document evidence must be a presentation attached to a stage in that same workstream.

Existing combined projects retain their previous overall flag. The owner may explicitly enable separate checks, acknowledging that this clears overall approval and can relock final deliverables until both streams are verified. No earlier branding/website evidence is invented. Once enabled, separate checks cannot be silently disabled through project edits.

## Validation

Local PostgreSQL tests exercise raw API/storage access, unrelated accounts, append-only history, explicit opt-in and approval revocation. Chromium `--lifecycle` exercises real app forms against fictional services, including 320/390/1440 px layouts. These checks do not establish hosted acceptance. Test archive retain/suspend/restore, evidence privacy and both combined checks on fictional hosted projects after 012.
