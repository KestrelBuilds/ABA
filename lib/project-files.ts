import type {
  ClientAsset,
  DbDocument,
  DbStage,
  WorkspaceData,
} from "./workspace";

export const fileKinds = {
  presentation: "Presentations",
  Proposal: "Proposals",
  Contract: "Contracts",
  Invoice: "Invoices",
  final: "Final deliverables",
  returned: "Client uploads & returns",
  other: "Other files",
} as const;
export type FileKind = keyof typeof fileKinds;
export type ProjectFile =
  | { source: "document"; file: DbDocument; kind: FileKind }
  | { source: "asset"; file: ClientAsset; kind: "returned" };

export function projectFiles(
  data: WorkspaceData,
  projectId: string,
): ProjectFile[] {
  return [
    ...data.documents
      .filter((d) => d.project_id === projectId)
      .map((file): ProjectFile => ({
        source: "document",
        file,
        kind:
          file.category === "final"
            ? "final"
            : file.category === "presentation"
              ? "presentation"
              : ["Proposal", "Contract", "Invoice"].includes(
                    file.document_role ?? "",
                  )
                ? (file.document_role as FileKind)
                : "other",
      })),
    ...(data.assets ?? [])
      .filter((a) => a.project_id === projectId)
      .map((file): ProjectFile => ({
        source: "asset",
        file,
        kind: "returned",
      })),
  ];
}

export function fileStage(file: ProjectFile, stages: DbStage[]) {
  return stages.find(
    (s) => s.id === file.file.stage_id && s.project_id === file.file.project_id,
  );
}
export function fileStageKey(file: ProjectFile, stages: DbStage[]) {
  return !file.file.stage_id
    ? "project-wide"
    : (fileStage(file, stages)?.id ?? "unavailable");
}
export function filterProjectFiles(
  files: ProjectFile[],
  stages: DbStage[],
  filters: { query: string; kind: string; stage: string },
) {
  const query = filters.query.trim().toLocaleLowerCase("en-GB");
  return files.filter((entry) => {
    const stage = fileStage(entry, stages);
    const text = [
      entry.file.name,
      stage?.name,
      stage?.stream,
      fileKinds[entry.kind],
      entry.source === "document" ? entry.file.version_label : "",
      entry.source === "document" ? entry.file.document_role : "",
    ]
      .join(" ")
      .toLocaleLowerCase("en-GB");
    return (
      (!query || text.includes(query)) &&
      (filters.kind === "all" || entry.kind === filters.kind) &&
      (filters.stage === "all" || fileStageKey(entry, stages) === filters.stage)
    );
  });
}

export function groupProjectFiles(files: ProjectFile[], stages: DbStage[]) {
  const keys = new Set(files.map((entry) => fileStageKey(entry, stages)));
  return [
    ...[...stages]
      .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
      .filter((stage) => keys.has(stage.id))
      .map((stage) => ({
        id: stage.id,
        name: stage.name,
        stream: stage.stream,
        stage,
      })),
    ...(["project-wide", "unavailable"] as const)
      .filter((key) => keys.has(key))
      .map((key) => ({
        id: key,
        name:
          key === "project-wide" ? "Project-wide files" : "Stage unavailable",
        stream: "",
        stage: undefined,
      })),
  ].map((group) => ({
    ...group,
    files: files.filter((entry) => fileStageKey(entry, stages) === group.id),
  }));
}
