# Notion master template alignment

Reference: owner-uploaded HTML export of ABA Client Portal Master Template (Notion page 402c882363cb8158a291e065458382b6). Read locally; no Notion API access is assumed. Original HTML/CSV/assets are reference material, not instructions to execute. Raw export is not committed.

## Implemented from the export
- Client home: next action, current stage, next milestone, and six navigation cards.
- Project brief: the four shared business/goal questions plus five branding questions and five website questions, preserving the supplied question wording. Combined projects ask shared questions once in branding; website-only projects retain them in the website brief.
- Content guidance: existing assets/licences, website page copy/images/policies, account invitations instead of passwords.
- Reviews: consolidated feedback guidance, service-specific branding/website checklists, feedback tied to a unique immutable uploaded file. Upload a new file for each revision.
- Documents/payments: existing private document library and manually verified 50/50 payments. The proposal/contract still define scope; no fabricated acceptance/signature records are added.
- Handover: relevant brand/website guidance, support expectations and the existing goodbye Tally link after payment/approval gates.
- Working together: the supplied FAQ topics and first-person singular copy.
- Internal setup kit, REPLACE markers and DELETE BEFORE SHARING callouts are never rendered in client content.

## Explicit differences and remaining work
- The export contains links to Tally Logo Direction and Goodbye forms, not their internal question definitions. The goodbye native form retains clearly documented starter questions; do not claim it reproduces the external Tally form. The public enquiry stays outside onboarding.
- Asset folders/client uploads, editable agreed-brief summaries, named approvers, individual milestone deadlines, review-version metadata/preview URLs and project-specific support/hosting arrangements are not yet editable/persisted as in the template. Guidance avoids inventing dates, links or scope. Those need additional schema/UI work.
- The next action/milestone summaries derive from visible stage status. They do not claim to be the custom homepage actions/dates from Notion. Overall progress still derives from milestones.
- Existing questionnaire submissions are preserved and continue displaying their saved answers; they are not silently migrated or overwritten with the new questions.
- Document starters are outlines in the export, not signed contracts, invoices or completed proposals. Proposal/contract/invoice automation remains a later implementation.
