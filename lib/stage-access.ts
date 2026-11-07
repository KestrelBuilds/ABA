import type { DbStage, DbProject, WorkspaceData } from "./workspace";
import { verifiedStageStatus } from "./journey-verification";
export function clientUploadsAllowed(stage: DbStage) {
  return stage.client_uploads_allowed ?? !/goodbye/i.test(stage.name);
}
export function stageUnlocked(data: WorkspaceData, stage: DbStage) {
  if (!data.stageAccessReady) return true;
  if (data.role === "client") return stage.client_unlocked === true;
  const project = data.projects.find((p) => p.id === stage.project_id);
  return (
    !!project &&
    !data.stages.some(
      (s) =>
        s.project_id === stage.project_id &&
        (s.position < stage.position ||
          (s.position === stage.position && s.id < stage.id)) &&
        verifiedStageStatus(s, project) !== "Completed",
    )
  );
}
export function questionnaireStage(
  stages: DbStage[],
  project: DbProject,
  kind: string,
) {
  const sorted = stages
    .filter((s) => s.project_id === project.id)
    .slice()
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  if (kind === "goodbye")
    return (
      sorted.find((s) => !clientUploadsAllowed(s)) ??
      sorted.find((s) => s.position === sorted[sorted.length - 1]?.position)
    );
  return (
    sorted.find(
      (s) =>
        s.stream === "Onboarding" &&
        s.name.trim().toLowerCase() === "onboarding",
    ) ??
    sorted.find(
      (s) =>
        s.stream ===
          (kind === "website" ? "Website Design" : "Brand Identity") &&
        /discovery|questionnaire|brief/i.test(s.name) &&
        !/call/i.test(s.name),
    ) ??
    sorted.find(
      (s) =>
        s.stream === (kind === "website" ? "Website Design" : "Brand Identity"),
    ) ??
    sorted[0]
  );
}
