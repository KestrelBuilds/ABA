import type { WorkspaceData } from "./workspace";
// Owner-only visual projection. Authentication and RLS remain in force separately.
export function clientPreview(
  data: WorkspaceData,
  projectId: string,
  _showPlannedLayout = false,
): WorkspaceData {
  const project = data.projects.find((p) => p.id === projectId);
  const allowed =
    !project?.archived_at || project.archived_client_access !== "suspend";
  const eligible = Boolean(
    allowed && project?.contract_signed && project.deposit_paid,
  );
  const documents = eligible
    ? data.documents.filter(
        (d) =>
          d.project_id === projectId &&
          (!d.scan_state || ["legacy", "clean"].includes(d.scan_state)) &&
          d.published &&
          (!d.stage_id ||
            data.stages.some((s) => s.id === d.stage_id && s.visible)) &&
          (d.category !== "final" ||
            (project!.final_paid && project!.final_approved)),
      )
    : [];
  return {
    readOnly: true,
    fileSecurityReady: data.fileSecurityReady,
    secureUploadsConfigured: data.secureUploadsConfigured,
    pendingUploads: [],
    stageResources: eligible
      ? (data.stageResources ?? []).filter((r) =>
          data.stages.some(
            (s) =>
              s.id === r.stage_id && s.project_id === projectId && s.visible,
          ),
        )
      : [],
    finance: data.finance
      ? {
          ready: data.finance.ready,
          proposals: eligible
            ? data.finance.proposals.filter(
                (p) => p.project_id === projectId && p.status !== "Draft",
              )
            : [],
          invoices: eligible
            ? data.finance.invoices.filter(
                (i) =>
                  i.project_id === projectId &&
                  ["Issued", "Paid"].includes(i.status),
              )
            : [],
          templates: [],
          seller: null,
          billing: [],
        }
      : undefined,
    managementReady: data.managementReady,
    projectDetails: eligible
      ? (data.projectDetails ?? []).filter((d) => d.project_id === projectId)
      : [],
    handovers:
      eligible && project?.final_paid && project.final_approved
        ? (data.handovers ?? []).filter((h) => h.project_id === projectId)
        : [],
    clientActions: eligible
      ? (data.clientActions ?? []).filter((a) => a.project_id === projectId)
      : [],
    assets: eligible
      ? (data.assets ?? []).filter(
          (a) =>
            a.project_id === projectId &&
            (!a.scan_state || ["legacy", "clean"].includes(a.scan_state)) &&
            (!a.stage_id ||
              data.stages.some((s) => s.id === a.stage_id && s.visible)),
        )
      : [],
    role: "client",
    emailInvitesReady: false,
    clients: project
      ? data.clients.filter((c) => c.id === project.client_id)
      : [],
    projects: project && eligible ? [project] : [],
    stages: eligible
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
