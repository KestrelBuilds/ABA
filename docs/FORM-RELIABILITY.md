# Keeping entries after a failed save

React form actions normally reset uncontrolled inputs once the action resolves. ABA actions return a `Result`, including `{ ok: false }` for validation/provider failures; that resolved failure previously reset the form too. A fictional rejected notes save reproduced the problem by replacing an unsaved multiline draft with the old saved note.

`useSavedFormReset` prevents implicit resets for business forms and permits an explicit reset only after a confirmed successful result. It is used by the connected workspace's shared ActionForm, prospective proposal/contract forms and the older restricted contract-return form. Selected files remain in their existing browser inputs after rejection, so retry does not require choosing them again. Successful creation/upload forms still clear normally, and saved records refresh through the existing route handling. Edit forms receive the saved values on refresh.

The shared ActionForm locks its controls while pending, ignores another submission during that period, marks the form busy and hides stale result messages. Prospective/contract-return forms also keep pending guards and disable their editable inputs. This prevents changes made after the captured submission from being silently lost. Server validation, identity/MFA, RLS, publication, contract/payment and approval checks remain unchanged. A failed request never becomes a successful save merely because the inputs remain filled.

Drafts remain only in the current page's DOM/browser memory. No new browser storage, autosave, logging or external service is introduced. Navigation, reload or a changed project/form can still discard unsaved entries. Password/MFA forms and separate destructive-confirmation forms retain their existing reset behaviour; this hook does not persist credentials or weaken confirmations.

## Validation

- `--form-retry`: fictional provider rejection and interrupted request retain multiline notes; pending controls reject a second submission; retry persists through reload. A failed upload keeps its category and selected bytes, then a successful retry clears the picker and leaves the new file unpublished.
- `--questionnaire-retry`: every multiline answer survives a rejected submission; retry writes one response with the same answers, and its submitted state survives reload.
- `--prospect`: rejected proposal messages/choices and signed-PDF returns remain available for retry. A successful return stays attached to its original contract and does not verify contract/payment flags.
- `--contracts`: invalid and rejected PDFs remain selected until replaced/retried; successful returns preserve the actual bytes and original-document link.
- Existing creation, verification, review-date, enquiry, preview, archive and upload modes exercise successful shared-form behaviour and access boundaries.

All records/files and injected failures are fictional. These browser checks do not establish hosted email delivery, scanner health or production acceptance.
