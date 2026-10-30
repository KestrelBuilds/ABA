import type { DbProject, WorkspaceData } from "./workspace";
import { verifiedStageStatus } from "./journey-verification";
import { splitPayment } from "./finance/money";
export const phaseLabels = {
  onboarding: "Enquiry & onboarding",
  branding: "Branding",
  website: "Website design",
  handover: "Final checks & handover",
  complete: "Milestones complete",
  other: "Other / plan stages",
} as const;
export type ProjectPhase = keyof typeof phaseLabels;
export type InsightFilter = "All projects" | DbProject["type"];
function projectPhase(data: WorkspaceData, project: DbProject): ProjectPhase {
  if (!project.contract_signed || !project.deposit_paid) return "onboarding";
  const stages = data.stages
    .filter((s) => s.project_id === project.id)
    .slice()
    .sort((a, b) => a.position - b.position);
  if (!stages.length) return "other";
  const next = stages.find(
    (s) => verifiedStageStatus(s, project) !== "Completed",
  );
  if (!next)
    return project.final_paid && project.final_approved
      ? "complete"
      : "handover";
  switch (next.stream) {
    case "Onboarding":
      return "onboarding";
    case "Brand Identity":
      return "branding";
    case "Website Design":
      return "website";
    case "Delivery":
      return "handover";
    default:
      return "other";
  }
}
// Owner-only projection of current records, never new payment/approval evidence.
export function workspaceInsights(
  data: WorkspaceData,
  filter: InsightFilter = "All projects",
) {
  const projects =
    data.role === "admin"
      ? data.projects.filter(
          (p) =>
            !p.archived_at &&
            !data.clients.some(
              (c) => c.id === p.client_id && c.deletion_pending,
            ) &&
            (filter === "All projects" || p.type === filter),
        )
      : [];
  const phases = (Object.keys(phaseLabels) as ProjectPhase[]).map((key) => ({
    key,
    label: phaseLabels[key],
    projects: projects.filter((p) => projectPhase(data, p) === key),
  }));
  const value = projects.reduce(
    (sum, p) => {
      const total = Math.round(Number(p.budget) * 100);
      const split = splitPayment(total);
      sum.total += total;
      sum.received +=
        (p.deposit_paid ? split.deposit : 0) + (p.final_paid ? split.final : 0);
      return sum;
    },
    { total: 0, received: 0 },
  );
  return {
    projects,
    phases,
    value: { ...value, outstanding: value.total - value.received },
  };
}
