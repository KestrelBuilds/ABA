# Overview charts

The connected owner Overview puts totals and **Studio at a glance** above attention items and dates. Its dark chart panels use ABA purple/lime accents, normal-case readable headings and the existing local fonts. Clients and owner client previews do not receive this chart interface. No new SQL, service, analytics library or browser storage is required.

## Graphs and controls

- **Project value outlook:** an area/line graph of current project values, grouped by estimated completion month. Choose the next 6 or 12 calendar months, starting with the current UK month. The purple line shows project value; lime shows the portion currently marked received through the existing deposit/final-payment checks. Empty months stay zero. This is a schedule of current values, not monthly revenue, cash receipts or a historical growth series. Past estimates, estimates beyond the selected period and invalid/missing dates are counted separately rather than put into a false month.
- **Where projects stand:** vertical bars count the existing mutually exclusive project phases. Choose a non-empty bar to list its projects, then open one. Counts and the existing verification-based phase rules remain authoritative. Bars share the same count scale, with the largest phase filling its track. Small screens use two rows of three bars to keep labels readable.
- **Project payment progress:** a ring shows the percentage of current project value marked received. Exact GBP totals and a text legend accompany it. Independent deposit/final flags and the existing odd-penny split are used; project progress or creative approval never implies payment. A zero-value view has a neutral ring and an explicit empty state. These figures are planning estimates, not an invoice balance or bank total.
- **Project progress:** clickable bars show completed/total milestones per project using verified stage status. Internal milestones are included in this owner view. Five projects appear initially, with a show-all control. A project without stages shows zero and a clear explanation. Completing milestones alone does not establish final release eligibility.

**Show projects** applies the existing all/branding/websites/combined scope to all four charts. Unarchived records excluding clients pending deletion are used. The value-outlook period applies to that graph only; payment and progress summaries continue to cover the selected service's full active scope. This can produce different totals, labelled by their respective scopes.

## Inspecting a month

The graph's x-axis labels follow their actual chronological positions. **Inspect month** provides a keyboard/touch-friendly list of every month in the period, with full month/year and project count. Its selected summary gives exact project value and marked-received figures; the expandable project list includes names, clients and values. Opening a project uses the existing navigation handler, which clears stale finder filters and targets that project's journey.

The current month is derived in Europe/London and refreshed locally while the panel remains open. It does not poll the database or schedule messages. All chart inputs come from the already permitted workspace DTO; chart interactions do not mutate business records or bypass server/RLS checks.

## Validation

`tests/workspace-insights.test.ts` covers monthly grouping across year boundaries, zero months, odd pennies, independent payment flags, service/archive/deletion scope, invalid dates/months, client exclusion, unchanged source records and verified/internal milestone progress. The fictional browser modes `--dashboard` and `--insights` cover 6/12-month selection, shared filters, keyboard inspection, project links, show-all, empty states, no writes, preview exclusion and 320/390/1440 px layouts. The deadline browser mode checks the reordered Overview still supports its existing workflow. These local fixtures do not establish a hosted deployment or new financial history.
