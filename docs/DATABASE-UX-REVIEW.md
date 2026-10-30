# Database and workspace usability review

Update: Alex has since chosen Illustrator PDFs exclusively. Native generation/Finance UI has been removed; references to optional generators below describe the reviewed historical schema. Previous records and invoice protections remain.

28 October 2026. Scope: the five committed SQL migrations, workspace loading, owner/client screens, file and finance access paths. This is a schema/code review, not an inspection of the hosted database, its records, migration state, performance statistics or a full security audit. No hosted data was changed.

## Main finding

The application has 20 public application tables. Their separation mostly serves permissions, immutable financial history and different record lifecycles. The practical simplification is to present related records together, while keeping those boundaries underneath.

| Area | Tables | UI implication |
| --- | --- | --- |
| People and access | clients, profiles, invitations | Show access eligibility separately from actual invitation/account status. Passing contract/deposit checks does not create an account. |
| Project journey | projects, stages, stage_resources | Put next milestone, onboarding and delivery requirements together. Stage progress alone is not contractual or financial evidence. |
| Project context | project_details, project_notes, project_handover | Present useful context close to the journey, preserving owner-only notes and separately gated final handover. |
| Questionnaires and tasks | questionnaires, client_actions | Show submitted questionnaires and requested client actions in context. Avoid another parallel progress tracker. |
| Files and reviews | documents, client_assets, feedback | Show owner documents and returned client files together in the journey/library. Preserve private buckets, uploader rules and exact reviewed versions. |
| Optional finance | finance_settings, client_billing, proposal_templates, proposals, invoices | Keep PDF-first work primary. Native invoices and proposal snapshots have their own lifecycle; they are not interchangeable with uploaded PDFs. |
| Audit | audit_events | Retain history privately; do not use generic audit entries as a substitute for detailed payment receipts or signed-contract evidence. |

## Implemented improvements

- Contract/payment/approval confirmations live in the journey; standard verification stages derive displayed completion from verified project records. Side controls are read-only summaries. No fabricated historical payments.
- All project files uses the existing records, labels stage/general files, includes returned copies and explains outstanding access restrictions consistently with stage files.
- The owner project screen now has **Project at a glance**: next milestone, client-access eligibility and final-delivery eligibility. It derives information from existing records rather than introducing another status to maintain.
- Open next step expands the correct milestone, or the built-in invoices section when native invoice payment is required. The summary distinguishes portal eligibility from an actual invitation/sign-in, and includes onboarding requirements in final-delivery readiness.
- Dashboard project rows show their next milestone. The project-balance figure is labelled **Unreceived project value**, rather than suggesting it is an issued-invoice debt total. It remains based on project budgets and manual 50/50 flags; the Finance ledger is the source for native invoice amounts/dates.
- This owner summary is excluded from client and owner-preview layouts. It does not grant access or mutate any records.

## Recommended next changes, in order

1. **Stable stage purpose, independent of its editable name.** Currently recognised template names determine verification UI. Custom names use explicit project verification controls. Introduce an optional constrained stage-purpose key in an additive migration so renaming a stage never changes its behaviour. Map only unambiguous standard stages; require owner choice for custom/ambiguous ones. Do not backfill confirmations from Completed statuses or filenames. Keep old installations usable until the migration is applied.
2. **Archive completed projects.** Add explicit owner-controlled active/archived state and an archive filter. Do not infer archival from final payment alone: delivery/support may still be in progress. Preserve all files, invoices, account ownership and audit history. Decide separately whether archived clients should retain portal access.
3. **Show invitation/account state where projects are managed.** Current workspace DTOs do not include invitation/profile status. Add an owner-only minimal query/view for pending/accepted/revoked access and use it beside eligibility. Avoid sending profile membership or invitation data to client DTOs. Never infer successful email delivery from provider acceptance.
4. **Dated verification evidence for external PDFs/payments.** Project booleans are sufficient for current access checks, but they are not a detailed ledger. A future append-only owner-verification record can capture actor, date, source/reference and revocation, without inventing historical evidence. Native invoices must still use their payment RPC and immutable snapshots.
5. **Workstream-specific approval evidence.** Combined projects currently use one global owner confirmation explicitly covering both streams. Future approval controls could capture brand and website approvals separately before deriving global delivery readiness. Never turn a single document approval into automatic approval of the whole combined project.
6. **Scale queries when measurements justify it.** Workspace loading currently fetches all permitted projects and related records; this is reasonable for a small private workspace. Later add project-scoped loading/pagination, and measure RLS/query plans before selecting indexes. The live row counts and execution plans were unavailable; no performance gain is claimed here.

Do not merge documents/client assets or remove private notes/handover tables merely to reduce the table count. Their different authorisation and lifecycle rules are useful. No SQL migration is required for the changes implemented in this review.

## Validation boundaries

Existing PostgreSQL policy/finance tests exercise the local SQL model. Pure summary tests cover stale stage completion, native invoice routing, reordered/custom/empty workflows and eligibility gates. Browser checks use fictional HTTP services and exercise milestone navigation, automatic expansion, access-summary updates and read-only preview exclusion. These do not establish hosted Supabase/Vercel acceptance.

Later implementation: migration 202610280006 adds one explicit contract_exchanges table (21 public application tables total after activation), while returned contract PDFs reuse client_assets with an original-document reference. This preserves the chosen same-stage/same-file-library organisation and adds no parallel payment/signature status tracker. See CONTRACT-AREA.md.

Implemented follow-up: stable stage purposes now have an additive migration 011, gated workspace loading and explicit owner selection. See [STAGE-PURPOSES.md](STAGE-PURPOSES.md). This supersedes recommendation 1 as an implementation proposal; hosted activation/acceptance remains pending. Other recommendations remain separate work.
