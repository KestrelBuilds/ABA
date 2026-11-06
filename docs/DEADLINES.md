# Dates and deadlines

The connected **owner Overview → Dates & deadlines** panel brings together dates already saved in the permitted workspace. It is not shown in the client portal, owner client preview or fictional Phase 1 demo. No SQL, external calendar, email service or notification setup is required.

## What appears

- **Project estimate:** the project's estimated completion date. An estimate is not proof of actual delivery, payment or approval. Active projects keep their estimate until it is changed or the project is archived.
- **Client action:** the due date of an existing action still marked To do. Mark it done through the normal project controls to remove it from this planning view; opening a date does not complete it.
- **Presentation review:** a valid review date on a published, accessible presentation file. Drafts, hidden/unresolved stages, quarantined/blocked files and onboarding restrictions are respected through the shared file-visibility explanation. An existing approval or revision-request response for that file completes its scheduled review; a comment alone does not. Overall creative approval and final-payment flags are not changed.

Archived projects, deleting clients, closed pre-onboarding prospects, missing-client/project associations, completed actions and invalid/missing dates are excluded. A legacy “closed” prospect setting does not suppress an otherwise active project whose contract and deposit are verified. Ordinary project documents and final deliverables are not treated as presentation review requests.

## Ranges and navigation

The default **Next 7 days (including today)** includes today through six calendar days later. **Next 30 days** ends 29 days after today. **Overdue only** contains earlier dates; **All dates** includes every eligible date. The overdue shortcut shows the number across all eligible records, independently of the selected range. Entries are sorted chronologically, with stable ordering on ties. Six are shown initially; **Show all** expands the current range without loading more records.

Calendar calculations use date-only values and the Europe/London current day, including GMT/BST boundaries. The panel updates its local notion of today while it remains open; it does not poll the database. Newly changed project records still use the app's normal save/refresh behaviour.

Choose a card to open its existing project and relevant section: journey for an estimate, Client actions for a task, or the presentation's own stage/file library for a review. The existing project-opening handler resets stale finder filters and preserves the correct project target. No item is automatically shared, rescheduled, approved or marked paid.

## Changing dates

Project estimates remain editable under **Project controls → Edit project details**. Client-action dates remain editable under **Client actions → Edit action**.

For a presentation, open its journey stage or **All project files**, then choose **Change review date**. Save a new feedback date, or leave the field empty to clear it. The saved date is shown in both locations and in the client view. Agree changes directly with the client; saving sends no notification. A shared, accessible presentation awaiting a response moves to its new date in the owner planner, or leaves the planner when its date is cleared. Private/locked files remain subject to the same visibility rules.

Changing a date keeps the same file, version, publication state and feedback. If that version already has an approval or revision-request response, the date does not reopen its completed review in the planner. Upload a new document for a new design revision. Project-level final approval/payment remain separate explicit checks.

The editor requires the existing project-management capability (migration 004); no new migration is needed. Every submission authenticates the owner, including existing MFA enforcement, before checking that capability. It validates the document UUID and real date/empty value, then updates only `review_due` on a matching presentation through the normal authenticated database client. Ordinary documents/final deliverables cannot be targeted through this action. Database RLS and existing audit/version/deletion guards remain authoritative; it uses no service credential.

## Privacy and validation

The planning panel is an owner-only derived view of records already loaded under the current account's permissions. The panel performs no extra API reads/writes, creates no stored deadline table or browser-storage key, and sends no reminders or external messages. It does not change client visibility or substitute for server/RLS checks. The separate explicit date-edit action uses the existing document record and permissions described above.

Unit tests cover range boundaries, invalid/leap dates, UK midnight and BST changes, role/privacy exclusion, completed responses and immutable source data. `node tests/client-journey-browser.cjs --deadlines` uses fictional projects in a non-UK browser timezone to exercise filters, overdue/show-all controls, project/task/stage navigation, removal after an explicit task/review response and client-preview exclusion at phone/desktop widths. This is local UI evidence, not hosted launch acceptance.

`tests/presentation-review.test.ts` uses the existing SQL to verify owner date changes/clearing, denied same-/other-client writes, unchanged feedback/version/project flags and normal audit entries. `node tests/client-journey-browser.cjs --review-dates` checks both editors, reload persistence, planner updates, invalid/forged submissions, repeated owner/capability checks, save failures, preserved completed responses and read-only client display at phone/desktop widths. No real records, email or hosted acceptance is involved.
