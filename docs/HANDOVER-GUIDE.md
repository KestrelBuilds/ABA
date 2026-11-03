# Handover and goodbye packet

The app already gates final-deliverable files and handover notes using contract, deposit, final approval and final payment. This update adds preparation guidance around those existing records; it does not replace them with another completion tracker.

## In ABA Studio

Open a project and expand **Prepare handover & goodbye packet**, or follow the link inside Goodbye Packet or Framer Launch & Handover. It shows uploaded final files, how many are currently accessible under existing release rules, files in a recognised Goodbye Packet stage, saved handover/support text and outstanding verification checks.

Expand **Review delivery files** to inspect the final deliverables and files attached to recognised Goodbye Packet stages. Each file appears once, with its stage, private/shared state and release status. Locked files explain the current blocker using the same rules as the file library: verification/payment, internal or missing stages, quarantine, or suspended archive access. **Review in stage** opens the matching stage; unattached/unresolved files lead to the file library. Only the current project's permitted owner records are used.

“Release rules met” is not proof that the client has accepted an invitation, that the PDF contents are correct or that delivery has happened. A retained archive remains read-only for clients. A suspended archive keeps all client files locked even if payment and approval checks are verified. This panel never changes publication, account access or verification flags.

These are presence/access checks, not a review of a PDF's contents or confirmation that external delivery, licences, domain transfer or support have been completed. Custom/renamed goodbye stages are not guessed from filenames. Review any project-specific arrangements yourself.

Expand the writing outline, copy it and use it in Illustrator. Replace all bracketed fields, remove out-of-scope sections and review the terms. Copying an outline does not save project notes, upload a PDF, share a file or mark anything paid/approved.

The same draft outlines are available here:

- [Brand identity](templates/BRAND-GOODBYE-PACKET.md)
- [Framer website](templates/FRAMER-GOODBYE-PACKET.md)
- [Combined project](templates/COMBINED-GOODBYE-PACKET.md)

## Uploading the finished PDF

1. Upload the designed packet to its stage. The owner can change all document-type and release-rule suggestions before upload.
2. For final handover material, choose **Handover → Final deliverable**. Goodbye Packet and Framer Launch & Handover suggest this combination for new uploads.
3. Uploads remain private drafts until you share them. Hidden stages remain private. Final files remain gated by verified approval/payment regardless of progress status.
4. Confirm the actual agreement, support terms and licence/ownership arrangements. Verify the final checks through their existing actions, including the protected payment action for historical native invoices.
5. Review the client view, then share the appropriate files. Before optional 013, the portal supports PDFs and approved images up to 3 MB; use a separate agreed method for ZIP/source/font files. With 013 and a configured approved scanner, PDF/image/Illustrator/ZIP uploads can be up to 25 MB and must pass security checks before download/sharing. Contract returns remain PDF-only, up to 3 MB. If 013 is active but its checker is unconfigured, new uploads are unavailable. The handover panel now shows the guidance matching the actual capability/configuration; this update does not activate 013 or provision a scanner.

Existing uploads keep their original category and publication state. If an existing ordinary document should stay private, unpublish it; choose the correct final rule for the next upload. No file classification or milestone status is silently rewritten.

## Overview attention items

The attention panel is owner-only and derives from existing records. Contract returns require an explicit original Contract reference and disappear from this view once the contract flag is verified. General uploads are never labelled signed contracts. Proposal responses remain prompts to review intent; they do not sign a contract or record payment. Closed non-active prospects, deleting clients, deliberately revoked invitations and completed tasks are not chased automatically. Expired invitations are shown separately from pending accounts and never imply email delivery.

No new SQL is needed. Existing authentication, row-level policies, file checks and client preview filtering remain authoritative. Local fictional tests do not establish live email delivery or hosted acceptance.

The delivery review was checked with `--workspace-help`, `--secure-uploads`, `--secure-unconfigured` and `--lifecycle` browser modes, run sequentially. These cover actual app navigation/copying, client-preview exclusion, private/unapproved/pending/blocked file explanations, missing checker configuration and retained/suspended archive guidance at phone/desktop widths. The scanner is fictional in these tests; no hosted scanner or SQL was configured by this update.
