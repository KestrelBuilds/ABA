import { prospectDocumentVisible, type ProspectSpace } from "./prospects";
import type { DbDocument, DbProject, DbStage } from "./workspace";

// Describes the existing access rules; authorisation stays on the server/in RLS.
export function fileVisibility(
  document: DbDocument,
  project: DbProject,
  stages: DbStage[],
  exchanges: { project_id: string; stage_id: string; enabled: boolean }[] = [],
  prospects: ProspectSpace[] = [],
): { available: boolean; message: string } {
  if (document.scan_state && !["legacy", "clean"].includes(document.scan_state))
    return {
      available: false,
      message:
        document.scan_state === "rejected"
          ? "File blocked by security checks. It cannot be shared or downloaded."
          : "File awaiting security checks. It cannot be shared or downloaded.",
    };
  if (project.archived_at && project.archived_client_access === "suspend")
    return {
      available: false,
      message: "Client access is suspended for this archived project.",
    };
  const prospect = prospects.find((x) => x.project_id === project.id);
  if (
    prospect &&
    prospectDocumentVisible(document, project, stages, prospect) &&
    !(project.contract_signed && project.deposit_paid)
  )
    return {
      available: true,
      message:
        "Available in the potential-client area at the released step. The full creative journey remains hidden until contract and deposit verification.",
    };
  const restricted =
    !prospect &&
    document.published &&
    document.document_role === "Contract" &&
    document.category === "document" &&
    stages.some(
      (s) =>
        s.id === document.stage_id && s.project_id === project.id && s.visible,
    ) &&
    exchanges.some(
      (x) =>
        x.project_id === project.id &&
        x.stage_id === document.stage_id &&
        x.enabled,
    );
  if (restricted && !(project.contract_signed && project.deposit_paid))
    return {
      available: true,
      message:
        "Available to this project’s invited client in the initial contract area only. The full portal remains locked until contract and deposit verification.",
    };
  const restrictions: string[] = [];
  if (!document.published) restrictions.push("share this private draft");
  if (!project.contract_signed) restrictions.push("verify the signed contract");
  if (!project.deposit_paid) restrictions.push("verify the deposit payment");
  if (document.stage_id) {
    const stage = stages.find(
      (s) => s.id === document.stage_id && s.project_id === project.id,
    );
    if (!stage) restrictions.push("check the file’s stage association");
    else if (!stage.visible)
      restrictions.push("make its internal stage client-visible");
  }
  if (document.category === "final") {
    if (!project.final_approved)
      restrictions.push("verify final creative approval");
    if (!project.final_paid) restrictions.push("verify the final payment");
  }
  return restrictions.length
    ? {
        available: false,
        message: `Client access locked: ${restrictions.join("; ")}.`,
      }
    : {
        available: true,
        message:
          "Available to this project’s client. Existing downloaded copies cannot be recalled; previously issued signed links can remain valid for up to 60 seconds.",
      };
}
