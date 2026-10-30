# Finding owner projects

Open **Projects → Find a project** in the owner workspace.

- **Search projects** searches project names, client business names and service names. Words can match across those fields; case, extra spaces and accents do not prevent a match.
- **Project type** limits the result to Brand Identity, Website Design or combined work. It combines with search and archive scope.
- **Show projects** selects active, archived or all records. This control appears only when the lifecycle database capability is available. Alex already confirmed 012 applied. Archiving remains an explicit owner action; verified payments or completed milestones do not automatically archive anything.
- **Sort projects** keeps the original order or sorts by estimated completion, project name or client name. Equal values preserve their prior order. Estimated completion is the project's existing planning date, not proof of actual delivery.
- **Clear project filters** restores the active, all-service view in original order and clears search. Counts refer to the selected active/archive scope before search/type filters.

Choose a matching record from **Your project**. Sorting preserves the selected project if it is still included. If a filter excludes it, the first matching record is selected; zero matches show guidance and leave the finder available for reset. Overview project rows, chart drill-down and attention links clear old finder restrictions before opening their target. Successfully creating a project clears the finder filters so the new record is visible in the selector/current project list.

The finder is owner-only. Clients and read-only owner previews keep their existing permitted project selectors. Filtering operates on the existing supplied workspace records and makes no server mutations or additional data requests. It does not change stage order, verification, publication or client access. Client search remains separate.

No SQL, service, browser-storage copy or new persisted project status is required. Local tests cover combined filtering, stable sorts, role exclusion and unchanged source records. The fictional browser scenario covers multiple clients/project types, archived results, shortcuts, preview exclusion, successful creation and 320/390/1440 px layouts. These checks do not establish hosted acceptance; the live diagnostic and other launch items remain pending as recorded in GO-LIVE-STATUS.md.
