import type { DbProject, WorkspaceData } from "./workspace";
import { stageVerification, verifiedStageStatus } from "./journey-verification";
import { fileVisibility } from "./file-visibility";

export function projectFocus(data: WorkspaceData, project: DbProject) {
  const stages = data.stages
    .filter((s) => s.project_id === project.id)
    .map((s) => ({ ...s, status: verifiedStageStatus(s, project) }))
    .sort((a, b) => a.position - b.position);
  const next = stages.find((s) => s.status !== "Completed");
  const invoiceManaged = Boolean(
    data.finance?.invoices.some(
      (i) => i.project_id === project.id && i.status !== "Void",
    ),
  );
  const portalMissing = [
    !project.contract_signed && "signed contract",
    !project.deposit_paid && "deposit payment",
  ].filter(Boolean) as string[];
  const space = data.prospectSpaces?.find((s) => s.project_id === project.id);
  const deletionPending = Boolean(
    data.clients?.find((c) => c.id === project.client_id)?.deletion_pending,
  );
  const earlyArea =
    !deletionPending && portalMissing.length
      ? space
        ? space.enabled && space.enquiry_status !== "closed"
          ? space.release_step
          : null
        : (data.documents ?? []).some(
              (d) =>
                d.project_id === project.id &&
                fileVisibility(
                  d,
                  project,
                  stages,
                  data.contractExchanges,
                  data.prospectSpaces,
                ).available,
            )
          ? "contract"
          : null
      : null;
  const portalStatus = data.portalStatuses?.find(
    (s) => s.client_id === project.client_id,
  );
  const deliveryMissing = [
    ...portalMissing,
    !project.final_approved && "final creative approval",
    !project.final_paid && "final payment",
  ].filter(Boolean) as string[];
  const paymentStep =
    next &&
    stageVerification(next).some(
      (f) => f === "deposit_paid" || f === "final_paid",
    );
  return {
    portalMissing,
    earlyArea,
    deletionPending,
    portalStatus,
    deliveryMissing,
    next,
    nextHref: next
      ? invoiceManaged &&
        paymentStep &&
        (next.name.trim().toLowerCase() !== "contract and deposit" ||
          project.contract_signed)
        ? "#existing-invoices"
        : "#stage-" + next.id
      : "#journey",
    nextLabel: next
      ? `${next.name} · ${next.status}`
      : stages.length
        ? "All milestones complete — review delivery eligibility below"
        : "Add your first milestone",
    invoiceManaged,
  };
}
