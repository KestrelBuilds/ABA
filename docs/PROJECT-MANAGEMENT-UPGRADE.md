# Project management upgrade

Apply `supabase/migrations/202610280004_project_management.sql` once through the Supabase SQL Editor, after the previous three setup files. This is an additive, transactional upgrade; it does not reset existing projects, answers or files. New tools are capability-gated so existing workspaces remain usable before the upgrade. A failure is reported rather than silently disabling new tools, except the expected missing-upgrade function.

## What becomes available
- **Dated client actions**: the owner creates/edits/removes tasks; the assigned client can toggle completion. PostgreSQL restricts client updates to the status column even through direct API calls. Task completion never changes payments or design approval.
- **Agreed brief**: editable goal, deliverables, exclusions, nominated approver and support terms. Clients can read but cannot edit them.
- **Private handover**: separate protected data, readable by the client only after final payment and final approval. Do not put final-delivery links into the general brief fields.
- **Presentation versions**: set the version and review deadline when uploading a new document. New feedback binds to that document's version and the authenticated client account's contact name. Prior feedback stays unchanged and is labelled when its historical name/version is unavailable. Reviewed files cannot be renamed or relabelled; upload a separate file for a new revision. These remain creative decisions, not legal signatures.
- **Client asset upload**: private PDF/PNG/JPEG/WebP files up to 3 MB. Assets use their own bucket and cannot be used to bypass final-deliverable controls. Source/ZIP/font files still need an agreed external sharing method. Malware scanning and expanded formats remain a launch review item.

Audit records cover brief/action/asset changes and existing document/review actions. The JSON workspace export now includes these records visible to the current account; it still excludes file bytes and is not a full backup.

## Hosted checks after applying
Use fictional data. Add a dated action and brief, switch to the read-only owner client preview, then use separate client sessions to verify action completion and asset upload. Confirm another client cannot read or change them. Upload a v2 presentation and record a creative approval; verify the actual contact name/version/time is shown. Confirm handover data stays hidden with payment alone and becomes readable only with both approval and payment. Revoke access and verify assets and project details disappear. Local PostgreSQL tests cover these policies; hosted Storage/real-user acceptance remains pending until run.

The interface names are **ABA Owner Dashboard** and **ABA Client Portal**, as approved by Alex. The supplied branding remains Alex Bell Arts. Branding and page-title changes do not require this SQL upgrade; the new persistence features do.
