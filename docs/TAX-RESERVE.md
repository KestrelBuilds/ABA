# Sole-trader tax reserve planning

At Alex's request on 7 November, the owner Overview totals bar shows only **Predicted tax** and a single amount: the sum of 20% estimates for active project values. For one £1,000 active project it shows £200. Archived projects are excluded. The existing Clients and other summary figures remain.

Each saved project value is converted to integer pence, divided by five and rounded to the nearest penny before summing. The estimate uses full project values, independently of payment receipt and costs. This is Alex's chosen planning rule, not statutory tax owed: annual profit, other income, allowances and National Insurance affect actual liability.

The manual planner, inputs, separate panel, per-project tax labels and explanation banner are removed. There are no new tax controls, extra visible copy, inputs or writes. Project values, invoices, payment verification and release gates stay unchanged. Clients/previews do not see the owner totals bar.

## Financial-record policy

On 6 November 2026 Alex confirmed sole-trader status and chose seven years after the relevant tax-year end for invoices and supporting accounting/tax records, longer where HMRC, an unresolved enquiry or legal requirements need it. This is Alex's policy, not a universal seven-year legal minimum. HMRC's normal sole-trader minimum is generally five years after the relevant 31 January Self Assessment filing deadline, with exceptions: https://www.gov.uk/self-employed-records/how-long-to-keep-your-records.

The public privacy notice records this financial policy separately from other enquiry/project/files/audit/Auth/provider/backup records, whose operational schedules still need confirmation. The software does not calculate legal expiry or automatically retain/delete files. Keep authoritative financial copies in a separate accounting archive before deleting portal PDF copies. The client-deletion screen now reminds Alex of this; existing native financial-history protections remain unchanged.

## Validation

Two existing arithmetic tests cover the fixed proportion and whole-penny rounding. `node tests/client-journey-browser.cjs --tax-reserve` checks the combined amount, archive exclusion, unchanged existing summary figures, removal of older tax copy, reload stability, no writes, client-preview exclusion and 320/390/1440 px layouts using fictional records.
