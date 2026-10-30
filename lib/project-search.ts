import type { DbProject, WorkspaceData } from "./workspace";
export type ProjectFilters = {
  query: string;
  scope: "active" | "archived" | "all";
  service: "all" | DbProject["type"];
  sort: "current" | "due" | "project" | "client";
};
export const defaultProjectFilters: ProjectFilters = {
  query: "",
  scope: "active",
  service: "all",
  sort: "current",
};
const fold = (value: string) =>
  value.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase("en-GB");
const serviceNames: Record<DbProject["type"], string> = {
  "Brand Identity": "Brand Identity branding",
  "Website Design": "Website Design",
  Both: "Combined Brand Identity Website Design branding",
};
const names = new Intl.Collator("en-GB", {
  numeric: true,
  sensitivity: "base",
});
// Owner-only view of the supplied permitted records. Filtering never fetches
// extra data or changes project/access/verification state.
export function findProjects(
  data: Pick<WorkspaceData, "role" | "projects" | "clients">,
  filters: ProjectFilters,
): { projects: DbProject[]; total: number } {
  if (data.role !== "admin") return { projects: [], total: 0 };
  const clients = new Map(
    data.clients.map((client) => [client.id, client.name]),
  );
  const scoped = data.projects.filter(
    (project) =>
      filters.scope === "all" ||
      (filters.scope === "archived"
        ? Boolean(project.archived_at)
        : !project.archived_at),
  );
  const tokens = fold(filters.query).trim().split(/\s+/).filter(Boolean);
  const matches = scoped.filter((project) => {
    if (filters.service !== "all" && filters.service !== project.type)
      return false;
    const haystack = fold(
      [
        project.name,
        clients.get(project.client_id) ?? "",
        project.type,
        serviceNames[project.type],
      ].join(" "),
    );
    return tokens.every((token) => haystack.includes(token));
  });
  if (filters.sort !== "current") {
    const order = new Map(matches.map((project, index) => [project.id, index]));
    matches.sort((a, b) => {
      const comparison =
        filters.sort === "due"
          ? (a.due || "9999-12-31").localeCompare(b.due || "9999-12-31")
          : filters.sort === "project"
            ? names.compare(a.name, b.name)
            : names.compare(
                clients.get(a.client_id) ?? "",
                clients.get(b.client_id) ?? "",
              );
      return comparison || order.get(a.id)! - order.get(b.id)!;
    });
  }
  return { projects: matches, total: scoped.length };
}
