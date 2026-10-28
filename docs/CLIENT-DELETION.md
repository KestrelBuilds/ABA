# Delete a client and its project data

Apply only `supabase/migrations/202610280007_client_deletion.sql` once, after migration 202610280006. Until then the new Delete client control is hidden and server-side deletion refuses to run. No extra secrets or service account are needed.

## Owner use

Go to **Clients → selected client → Delete client permanently**. Review the project/file scope, type the exact business name, tick the acknowledgement and choose **Permanently delete client**. This permanently removes the client record, linked projects, stage resources, notes, questionnaires, reviews, contract exchanges, documents/returned assets and their private uploads. Deletion is not reversible.

The underlying Supabase Auth account and audit history remain. The client’s profiles/invitations are removed so the retained sign-in account has no client access. This is an application-data cleanup, not complete personal-data erasure or Auth-account deletion. Existing-account reinvitation remains a separate limitation: deleting a client does not make its login email a brand-new Supabase account.

Any previous generated proposal/invoice record blocks deletion, including drafts/voids. Keep that history and revoke access instead. Uploaded Illustrator PDFs can be removed as part of the explicitly confirmed project/file deletion; they are not treated as native invoice lifecycle records.

## Cleanup and retry

1. An owner/MFA-checked database function checks the exact confirmation, rejects financial history, marks the client pending and revokes access in one transaction.
2. It saves a frozen manifest of this client’s project IDs and private file paths, including orphaned Storage metadata under those exact project prefixes. New project/file/financial writes and uploads are blocked while deletion is pending.
3. The authenticated owner removes only manifest files through the Storage API, in batches. No raw deletion of Storage database rows is used by the app.
4. A second owner-checked database function verifies the Storage metadata is gone before deleting project/client records in dependency order. Existing audit records are retained and a completion event is added.

If a file operation or final check fails, the remaining records/manifest stay available, access stays revoked and the card shows **Retry client deletion**. Some earlier files may already have been permanently removed; there is no cancel/undo. Reconfirm and retry. The refreshed manifest includes only files still present, avoiding repeat requests for already removed objects. Do not manually clear deletion_pending to bypass cleanup.

Only this client’s UUID-scoped paths are eligible. Other clients, global settings/templates and Auth users are not deleted. Permission helpers reject unrelated clients before taking metadata/storage locks. New signed download URLs are denied after access revocation; previously issued URLs can remain usable for up to 60 seconds or until the object is removed. Downloaded copies cannot be recalled.

## Validation and hosted checks

Local SQL tests cover owner-only/exact-name/MFA checks, dependency deletion, cross-client isolation, orphan cleanup, refusal to finalize with remaining files, write/upload freezing, retries, native financial blocking, audit/Auth preservation and empty clients. Server-helper tests cover scope validation, batching and failures. Browser tests use fictional services for incorrect-name refusal, successful removal and a simulated storage failure followed by a successful retry.

After applying the migration, test on a fictional client in the hosted app: create a project with owner and returned files, delete it, verify files/metadata and access are gone, and verify an unrelated fictional client is unchanged. No real clients have been deleted from this coding workspace. Local fixture tests do not establish hosted Storage behaviour.
