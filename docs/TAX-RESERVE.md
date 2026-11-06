# Sole-trader tax reserve planning

The owner Overview includes a manual tax reserve planner. It estimates money to set aside using a percentage Alex chooses; it does not calculate tax owed or supply a statutory/default rate. Annual profit, other income, allowances and National Insurance affect actual liability.

Choose an active project, check the full saved project value excludes VAT where applicable, enter expected allowable costs and choose a reserve percentage. The value is not limited to payments received. Costs start at zero until changed. For example, £1,000 income minus £200 costs gives £800 projected profit; a chosen 30% reserve gives £240 to set aside and £560 after that reserve. This 30% is illustrative, not a recommendation.

Money and percentages accept up to two decimal places. Arithmetic uses bounded integer pence, with the reserve rounded once to the nearest penny. A zero-profit or loss-making project reserves £0; this does not establish a refund or remove tax due on other income. Review allowable costs and the chosen percentage with an accountant. The planner links to HMRC's Income Tax rates and allowances.

Inputs live only in React memory. Switching projects resets income/costs and keeps the chosen percentage until the component is unmounted; reloading clears it. The selector is independent of chart filters. No API, database or browser-storage writes occur, and project values, invoices, payment verification and release gates are unchanged. Clients/previews do not see this planner.

## Financial-record policy

On 6 November 2026 Alex confirmed sole-trader status and chose seven years after the relevant tax-year end for invoices and supporting accounting/tax records, longer where HMRC, an unresolved enquiry or legal requirements need it. This is Alex's policy, not a universal seven-year legal minimum. HMRC's normal sole-trader minimum is generally five years after the relevant 31 January Self Assessment filing deadline, with exceptions: https://www.gov.uk/self-employed-records/how-long-to-keep-your-records.

The public privacy notice records this financial policy separately from other enquiry/project/files/audit/Auth/provider/backup records, whose operational schedules still need confirmation. The software does not calculate legal expiry or automatically retain/delete files. Keep authoritative financial copies in a separate accounting archive before deleting portal PDF copies. The client-deletion screen now reminds Alex of this; existing native financial-history protections remain unchanged.

## Validation

Four arithmetic tests cover profit versus turnover, pennies and rounding, zero/100% rates, losses and invalid/bounded inputs. `node tests/client-journey-browser.cjs --tax-reserve` checks the owner interface, project switching, no default rate or persistence, no writes, client-preview exclusion and 320/390/1440 px layouts against fictional records.
