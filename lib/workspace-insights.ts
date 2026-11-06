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
    progress: projects.map((project) => {
      const stages = data.stages.filter((s) => s.project_id === project.id);
      const completed = stages.filter(
        (s) => verifiedStageStatus(s, project) === "Completed",
      ).length;
      return {
        project,
        completed,
        total: stages.length,
        percent: stages.length
          ? Math.round((completed / stages.length) * 100)
          : 0,
      };
    }),
  };
}

// A schedule of current values by estimated completion, never revenue history.
export function workspaceOutlook(
  data: WorkspaceData,
  filter: InsightFilter,
  startMonth: string,
  count: 6 | 12 = 6,
) {
  type Month = {
    month: string;
    total: number;
    received: number;
    projects: DbProject[];
  };
  const months: Month[] = [];
  const empty = { months, outsidePeriod: 0, undated: 0 };
  if (
    data.role !== "admin" ||
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(startMonth) ||
    ![6, 12].includes(count)
  )
    return empty;
  const first = new Date(startMonth + "-01T12:00:00Z");
  if (!Number.isFinite(first.getTime())) return empty;
  for (let i = 0; i < count; i++) {
    const date = new Date(first);
    date.setUTCMonth(date.getUTCMonth() + i);
    if (date.getUTCFullYear() > 9999) return { ...empty, months: [] };
    months.push({
      month: date.toISOString().slice(0, 7),
      total: 0,
      received: 0,
      projects: [],
    });
  }
  let outsidePeriod = 0,
    undated = 0;
  for (const project of workspaceInsights(data, filter).projects) {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(project.due)
      ? new Date(project.due + "T12:00:00Z")
      : null;
    if (
      !date ||
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== project.due
    ) {
      undated++;
      continue;
    }
    const month = months.find((m) => m.month === project.due.slice(0, 7));
    if (!month) {
      outsidePeriod++;
      continue;
    }
    const value = Math.round(Number(project.budget) * 100);
    const split = splitPayment(value);
    month.total += value;
    month.received +=
      (project.deposit_paid ? split.deposit : 0) +
      (project.final_paid ? split.final : 0);
    month.projects.push(project);
  }
  return { months, outsidePeriod, undated };
}
