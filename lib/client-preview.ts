import type { WorkspaceData } from "./workspace";
// Owner-only visual projection. Authentication and RLS remain in force separately.
export function clientPreview(
  data: WorkspaceData,
  projectId: string,
  showPlannedLayout = false,
): WorkspaceData {
  const project = data.projects.find((p) => p.id === projectId);
  const eligible = Boolean(project?.contract_signed && project.deposit_paid);
  const documents = eligible
    ? data.documents.filter(
        (d) =>
          d.project_id === projectId &&
          d.published &&
          (d.category !== "final" ||
            (project!.final_paid && project!.final_approved)),
      )
    : [];
  return {
    role: "client",
    emailInvitesReady: false,
    clients: project
      ? data.clients.filter((c) => c.id === project.client_id)
      : [],
    projects: project && (eligible || showPlannedLayout) ? [project] : [],
    stages:
      eligible || showPlannedLayout
        ? data.stages.filter((s) => s.project_id === projectId && s.visible)
        : [],
    documents,
    feedback: data.feedback.filter((f) =>
      documents.some((d) => d.id === f.document_id),
    ),
    questionnaires: eligible
      ? data.questionnaires.filter((q) => q.project_id === projectId)
      : [],
    notes: [],
    audit: [],
  };
}
