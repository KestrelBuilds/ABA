import type { DbProject, WorkspaceData } from "./workspace";
import { stageVerification, verifiedStageStatus } from "./journey-verification";

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
