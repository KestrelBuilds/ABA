# Sole-trader tax reserve planning

At Alex's request, **Current projects** on the owner Overview shows each saved project value and a fixed **20% tax set-aside**. For example, a £1,000 project shows £200 to set aside. The manual planner, project selector, costs/percentage inputs and separate panel have been removed.

The percentage applies to the full saved project value, independently of payment receipt or costs. Convert the saved value to integer pence, take one fifth and round to the nearest penny. This is Alex's chosen planning rule, not a claim that 20% is the tax owed: annual profit, other income, allowances and National Insurance affect actual liability. A short estimate note appears above the project list.

The display has no inputs or writes and does not change project values, invoices, payment verification or release gates. It is visible only in the owner Overview. Archived projects are excluded from the existing Current projects list. Client previews do not show the set-aside labels.

## Financial-record policy

On 6 November 2026 Alex confirmed sole-trader status and chose seven years after the relevant tax-year end for invoices and supporting accounting/tax records, longer where HMRC, an unresolved enquiry or legal requirements need it. This is Alex's policy, not a universal seven-year legal minimum. HMRC's normal sole-trader minimum is generally five years after the relevant 31 January Self Assessment filing deadline, with exceptions: https://www.gov.uk/self-employed-records/how-long-to-keep-your-records.

The public privacy notice records this financial policy separately from other enquiry/project/files/audit/Auth/provider/backup records, whose operational schedules still need confirmation. The software does not calculate legal expiry or automatically retain/delete files. Keep authoritative financial copies in a separate accounting archive before deleting portal PDF copies. The client-deletion screen now reminds Alex of this; existing native financial-history protections remain unchanged.

## Validation

Two arithmetic tests cover the fixed proportion and whole-penny rounding. `node tests/client-journey-browser.cjs --tax-reserve` checks saved project values, immediate estimates without inputs, archive exclusion, reload stability, no writes, client-preview exclusion and 320/390/1440 px layouts against fictional records.
