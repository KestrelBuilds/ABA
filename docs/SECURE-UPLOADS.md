# Larger uploads and quarantined security checks

**013 is optional and NOT ready for Alex to paste until an approved scanner is configured and its live acceptance checks pass.** Apply 012 independently for project archiving/history/approvals. Existing installations retain their current 3 MB upload forms until 013 is applied.

## What is implemented

With 013 and server configuration, owners and full-access clients can upload PDF, PNG, JPEG, WebP, Illustrator (.ai) and ZIP source files up to 25 MB directly into the existing private Supabase buckets. Large file bytes bypass the 4 MB Next.js server-action request limit. Contract returns remain PDF-only, 3 MB, explicitly bound to the original contract and stage.

Every new file starts quarantined: no client metadata, ordinary download, signed download or publication while pending/rejected. A narrowly scoped server worker downloads only the caller's reserved UUID path, checks size/SHA-256/signature, safely reads bounded ZIP entries and requests a matching malware verdict. Passing security checks does not publish the file or bypass stage, onboarding, final approval/payment gates. Neither uploads nor checks verify signatures/payments.

ZIP checks limit compressed upload to 25 MB, 2,000 entries, 250 MB total expanded, 50 MB per entry and expansion ratio; encrypted/unsupported archives, unsafe paths, nested archives, common executables/scripts/macros are rejected. No archive contents are written to disk. Signature/ZIP validation is a preliminary check, not a complete file parser or replacement for a malware engine.

Existing files are marked **legacy**, retaining existing access, with no invented scan history. Pending/blocked uploads offer retry and discard. Early client contract areas also show their own pending queue. Scanner outages, malformed/different-hash verdicts and timeouts leave the file quarantined. Expired reservations require discard/reupload. Five pending unexpired reservations per account/project limit accidental queue growth; broader provider limits/rate controls and manual retention remain operational requirements.

## Scanner connection — no service provisioned

The application supplies an adapter, not a malware engine. No scanner account, paid service, deployment, processor agreement or live malware check has been created or approved by this coding work. An operator must select an approved service/owned worker after reviewing cost, confidential-file handling, retention, region and processing terms. Do not send real client files to an unapproved destination.

Configure in Vercel's secure **server-only** environment settings, never in chat/source or NEXT_PUBLIC variables:

- `UPLOAD_SCAN_URL`: fixed trusted HTTPS endpoint (no redirects, URL credentials or fragments).
- `UPLOAD_SCAN_KEY`: private bearer credential for that endpoint.
- `SUPABASE_SERVICE_ROLE_KEY`: existing project service-role credential, only for the scoped server worker. The browser receives an anonymous public key and a single-path upload-only token, never this credential.

The endpoint accepts POST raw file bytes with `Authorization: Bearer …`, `X-File-SHA256`, URL-encoded `X-File-Name`, and `X-Upload-Content-Type`. It must independently hash AND scan the received bytes, await a completed real scan (including supported ZIP/AI content), then return JSON `{ "sha256": "<actual lowercase SHA-256>", "status": "clean" }` or `"infected"`. Never report clean for scanner errors, unsupported formats, archive limits, stale scan signatures or incomplete scans. Unknown verdicts fail closed. Response deadline is 20 seconds; hosting function duration must allow download + validation + scan + save. Loopback HTTP is allowed exclusively in development fixtures.

Before applying 013, validate the endpoint with fictional valid files, a standard harmless antivirus test sample, archives, outages and mismatched digests. A stub returning “clean” is not an acceptable production scanner. Confirm the hosting duration/memory supports 25 MB files and scanner latency on the current plan; no plan purchase is authorized.

Then apply **202610300013_file_security.sql once after 012**, with a provider backup/checkpoint, and deploy the matching code. Missing configuration disables new uploads after 013 rather than falling back to unchecked writes. There is no automatic schema rollback; do not disable RLS/triggers to restore uploads.

## Storage and cleanup boundary

Upload tokens last two hours. Checked objects cannot be overwritten/deleted by ordinary account Storage calls, preventing a live upload token from replacing scanned bytes. Quarantine discard and confirmed client deletion use only validated project-scoped paths through the server worker. Discard preserves a minimal intake tombstone while the token could remain valid; replayed quarantine bytes remain inaccessible and are included in future scoped deletion manifests. There is no automatic sweeper or guaranteed immediate erasure while an upload link remains live.

Confirmed client deletion still needs exact name + acknowledgement and immediately revokes access. The frozen manifest now includes reserved/tombstoned paths. Recent upload capabilities impose a wait of up to two hours plus five minutes before final cleanup. The UI supplies the UK retry-after time. Final database deletion checks the deadline AND absence of all manifest objects, including late uploads. Existing native financial records still block client deletion; Auth/audit records remain.

Service use is limited to checking/removing exact reserved uploads and the already validated frozen deletion manifest. Ordinary reads, document publication, approvals, invitations and project changes continue using the caller's permissions.

## Evidence and remaining acceptance

Local SQL tests cover reservation/worker separation, quarantine at raw Storage and metadata boundaries, legacy preservation, final/hidden-stage gates, cross-client denial and deletion lease/replay safety. File tests cover signatures, unsafe ZIPs, expansion bombs and scanner adapter failure. Chromium `--secure-uploads` exercises a 5 MB direct upload, matching byte/hash processing, outage quarantine, blocked scan, retry/discard and responsive layouts through fictional services.

The existing owner-run diagnostic also uses the secure reservation/check path after 013, while retaining its actual raw/signed byte comparisons and revocation checks. It uses authenticated uploads rather than signed upload tokens so its disposable records can be cleaned up immediately.

These do not establish hosted scanner, Storage, signed-token or malware-engine behaviour. Before real use, repeat on fictional hosted projects: owner/client uploads, early explicit contract return, pending/blocked raw and signed denial for all roles, no-upsert token behaviour, accepted/final/hidden gates, scanner outage/recovery, discard, lease-delayed client deletion and an unrelated client unchanged. Configure a deliberate quarantine/tombstone retention and cleanup process; add monitoring for scanner errors and usage. Do not remove real records during development/testing.
