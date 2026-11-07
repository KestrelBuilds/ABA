# Development handover — 6 November 2026

The agreed core application features are implemented. The final development pass addresses failed-save data loss, upload guidance and stale setup instructions, with automated and fictional-browser checks recorded in CHANGELOG.md. This is completion of the current code scope; real-client launch still depends on the operational gates below.

Final local validation passed: 124 automated tests, 29 fictional browser modes, production build, strict TypeScript, formatting and production demo/privacy/protected-route smoke checks. No unresolved local check failure remained at handover. The work uses fictional records only; no new migration or service is required for these final fixes.

Follow-up on 6 November: the owner Overview totals bar now shows Predicted tax and one combined 20% estimate of active project values. Alex requested removal of the planner, per-project tax copy and explanation banner (latest simplification: 7 November). The privacy notice records Alex's sole-trader seven-year financial-record policy separately from other records. Scanner setup is deferred by owner choice, with current 3 MB checks retained and optional 013 withheld; no PC software or new service is running. See [TAX-RESERVE.md](TAX-RESERVE.md) and the latest CHANGELOG.md validation for this follow-up.

7 November journey follow-up: the owner/client project screen now follows one vertical journey with stage questionnaires and feedback inline and supporting panels collapsed. Goodbye Packet is owner-uploaded. Independent 014 (after 012; skip deferred 013) is required to activate sequential database/Storage/form gates and 3 MB owner AI/SVG handovers alongside PNG/JPEG. No live SQL was applied here. See [STAGE-JOURNEY.md](STAGE-JOURNEY.md).

## Implemented scope

| Area | Implemented behaviour | Local evidence |
| --- | --- | --- |
| Owner Overview | Project-value/phase/payment/progress graphs, filters, month inspection, project links, attention items and deadlines | Calculation tests, dashboard/insights/deadline browser modes, narrow/wide layouts |
| Projects | Brand, Framer website and combined journeys; editable stages/purposes, project/client search, scope, tasks and private notes | Template/search/purpose/management tests and browser journeys |
| Client journey | Released prospective/contract views, questionnaires, file returns, creative responses and handover | Policy tests and prospective/contract/client browser journeys |
| Verification | Independent contract/deposit and final approval/payment; combined-stream approval evidence | Real-SQL tests, verification/lifecycle browser modes; no automatic verification from uploads or progress |
| Accounts | Manual invitations, returning-account sign-in, expiry/revocation, recovery/MFA and contextual help | Account/invitation/policy/diagnostic tests; owner's earlier normal hosted passes remain separately recorded |
| Files | Private signed downloads, stage/file-library views, legacy format/signature checks and optional quarantine adapter | Upload/Storage policy tests, legacy/secure/unconfigured browser modes; no real scanner claimed |
| Data controls | Retain/suspend archives, owner evidence, scoped client deletion, permission-filtered export and public privacy notice | SQL/isolation/deletion tests, lifecycle/preview/public-route checks |
| Save reliability | Failed/interrupted business forms retain entries/files; pending edits/submissions lock; success resets/refreshes normally | Notes, questionnaire, proposal and signed-PDF retry fixtures plus successful-form regressions |

The final review also checked existing server identity/MFA/RLS boundaries, no-store private responses, short-lived attachment downloads, application logging/browser-storage uses and the distinction between normal hosted passes and newer exceptional branches. This does not establish a formal security or legal certification.

## Remaining launch dependencies

1. **Hosted acceptance and deployment outcome.** Inspect the latest Vercel deployment and run the expanded owner diagnostic/exceptional client branches with fictional accounts. The coding environment has no hosted Supabase credential bindings or hosting connector; a GitHub push and local pass do not supply these results. Alex's previously reported normal journey, recovery, MFA and restoration passes remain valid for their stated scope.
2. **Operational privacy/provider review.** Confirm actual retention periods, processor agreements, data locations/transfer safeguards, log/rate-limit settings and incident/removal handling. The public notice and implemented deletion/export boundaries do not make those business decisions.
3. **Upload scanning deferred by owner choice.** Alex accepts the current 3 MB format/signature checks for now and will revisit external hosting as the business grows. These checks are not malware scanning. Select/approve a real engine and configure/test its worker before any future optional migration 013 activation. No provider or PC worker is running, and no purchase is authorised. Keep 013 withheld until its documented prerequisites pass.
4. **Final client material and launch approval.** Alex supplies the actual Illustrator goodbye/handover PDFs with agreed support/licensing/ownership terms, then approves real-client use after the launch review. Starter outlines are not those final assets or agreements.

These dependencies do not require rerunning confirmed migrations 010–012, resetting client accounts, replacing the working cloud environment or sharing secrets in chat. Their authoritative checklist is [GO-LIVE-STATUS.md](GO-LIVE-STATUS.md) and [LAUNCH-CHECKLIST.md](LAUNCH-CHECKLIST.md).

Future automation, general questionnaire editing/sync, embedded legal signing, live payments, new services and native financial-document generation are outside the current agreed core scope. Illustrator PDFs remain the chosen business-document workflow. New product work can be scoped separately after this handover.
