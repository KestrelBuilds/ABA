"use client";
import { useState } from "react";
import { Copy, Check, ArrowRight } from "lucide-react";
import type { DbProject, WorkspaceData } from "@/lib/workspace";
import { goodbyeOutline, handoverPreparation } from "@/lib/handover";
import { openProjectSection } from "./project-focus";
export default function HandoverPreparation({
  data,
  project,
}: {
  data: WorkspaceData;
  project: DbProject;
}) {
  const [copied, setCopied] = useState(false),
    [notice, setNotice] = useState("");
  if (data.role !== "admin" || !data.managementReady) return null;
  const preparation = handoverPreparation(data, project),
    draft = goodbyeOutline(project.type);
  const rows = [
    {
      label: "Final files",
      detail: preparation.finals.length
        ? `${preparation.finals.length} uploaded · ${preparation.readyFiles.length} available to the client`
        : "No files are marked as final deliverables yet.",
      href: preparation.finals[0]?.stage_id
        ? "#stage-" + preparation.finals[0].stage_id
        : "#documents",
      action: "Review final files",
    },
    {
      label: "Goodbye packet",
      detail: preparation.packets.length
        ? `${preparation.packets.length} ${preparation.packets.length === 1 ? "file" : "files"} in the Goodbye Packet stage. Check the content before release.`
        : "No files found in the Goodbye Packet stage. If you use a different name, check that stage in your journey.",
      href: preparation.packetHref,
      action: "Open goodbye stage",
    },
    {
      label: "Handover notes & support",
      detail: `${preparation.hasHandoverNotes ? "Handover notes saved" : "No handover notes saved"} · ${preparation.hasSupport ? "support details saved" : "support details not saved"}.`,
      href: "#edit-project-brief",
      action: "Edit handover details",
    },
    {
      label: "Release checks",
      detail: preparation.missing.length
        ? "Still needed: " +
          preparation.missing
            .map(([, label]) => label.toLowerCase())
            .join(", ") +
          "."
        : "Contract, deposit, final approval and final payment are verified. Review which files you want to share.",
      href: preparation.missing.length ? preparation.checksHref : "#journey",
      action: "Review release checks",
    },
  ];
  return (
    <details className="panel handover-preparation" id="handover-preparation">
      <summary>Prepare handover & goodbye packet</summary>
      <p>
        Bring the final delivery together before sharing it. This is a
        preparation guide; uploaded files and saved notes still need your
        review.
      </p>
      <div className="handover-readiness">
        {rows.map((row) => (
          <div key={row.label}>
            <b>{row.label}</b>
            <p>{row.detail}</p>
            <a
              className="text-button"
              href={row.href}
              onClick={() => openProjectSection(row.href)}
            >
              {row.action} <ArrowRight size={14} aria-hidden="true" />
            </a>
          </div>
        ))}
      </div>
      {preparation.packetNeedsReleaseRule && (
        <p className="helper-note">
          Some files in the goodbye stage use an ordinary document rule.
          Unpublish any that should stay private, and choose Final deliverable
          for the next upload if it must wait for final approval and payment.
          Existing uploads have not been changed.
        </p>
      )}
      <details className="settings-disclosure packet-draft">
        <summary>
          Copy a{" "}
          {project.type === "Both"
            ? "branding & Framer"
            : project.type === "Website Design"
              ? "Framer website"
              : "brand identity"}{" "}
          goodbye packet outline
        </summary>
        <p>
          Use this draft as writing material for your Illustrator PDF. Replace
          the bracketed details, remove anything outside scope and review the
          wording. Copying it does not save, upload or share anything.
        </p>
        <label>
          Goodbye packet draft
          <textarea
            aria-label="Goodbye packet draft"
            readOnly
            value={draft}
            onFocus={(e) => e.target.select()}
          />
        </label>
        <button
          type="button"
          className="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(draft);
              setCopied(true);
              setNotice(
                "Draft copied. Review and personalise it before designing your PDF.",
              );
            } catch {
              setCopied(false);
              setNotice("Select the draft above and copy it manually.");
            }
          }}
        >
          {copied ? (
            <Check size={16} aria-hidden="true" />
          ) : (
            <Copy size={16} aria-hidden="true" />
          )}
          {copied ? "Outline copied" : "Copy packet outline"}
        </button>
        {notice && <p role="status">{notice}</p>}
      </details>
      <p className="helper-note">
        For now, the portal accepts PDFs and supported images up to 3 MB. Use
        your agreed sharing method for ZIP, source and font files, and include
        only licences and support covered by the agreement.
      </p>
    </details>
  );
}
