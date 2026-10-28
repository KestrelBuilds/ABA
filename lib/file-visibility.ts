import type { DbDocument, DbProject, DbStage } from "./workspace";

// Describes the existing access rules; authorisation stays on the server/in RLS.
export function fileVisibility(
  document: DbDocument,
  project: DbProject,
  stages: DbStage[],
): { available: boolean; message: string } {
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
