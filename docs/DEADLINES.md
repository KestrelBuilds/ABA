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

## Privacy and validation

This is an owner-only derived view of records already loaded under the current account's permissions. It performs no extra API reads/writes, creates no stored deadline table or browser-storage key, and sends no reminders or external messages. It does not change client visibility or substitute for server/RLS checks.

Unit tests cover range boundaries, invalid/leap dates, UK midnight and BST changes, role/privacy exclusion, completed responses and immutable source data. `node tests/client-journey-browser.cjs --deadlines` uses fictional projects in a non-UK browser timezone to exercise filters, overdue/show-all controls, project/task/stage navigation, removal after an explicit task/review response and client-preview exclusion at phone/desktop widths. This is local UI evidence, not hosted launch acceptance.
