import type { WorkspaceData } from "./workspace";
import { fileVisibility } from "./file-visibility";

export type DeadlineRange = "week" | "month" | "overdue" | "all";
export type WorkspaceDeadline = {
  id: string;
  kind: "project" | "action" | "review";
  title: string;
  projectId: string;
  projectName: string;
  clientName: string;
  date: string;
  daysFromToday: number;
  href: string;
};

export function londonDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function calendarDay(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = Date.parse(value + "T12:00:00Z");
  if (
    !Number.isFinite(time) ||
    new Date(time).toISOString().slice(0, 10) !== value
  )
    return null;
  return Math.floor(time / 86400000);
}

// Owner planning view of already permitted records. It performs no reads/writes,
// schedules no notifications and never treats an estimate as confirmed delivery.
export function workspaceDeadlines(
  data: WorkspaceData,
  today: string,
  range: DeadlineRange = "week",
): { items: WorkspaceDeadline[]; total: number; overdue: number } {
  const empty = { items: [], total: 0, overdue: 0 };
  const current = calendarDay(today);
  if (data.role !== "admin" || current === null) return empty;
  const items: WorkspaceDeadline[] = [];
  for (const project of data.projects) {
    const client = data.clients.find((c) => c.id === project.client_id);
    if (
      !client ||
      client.deletion_pending ||
      project.archived_at ||
      (data.prospectSpaces?.some(
        (s) => s.project_id === project.id && s.enquiry_status === "closed",
      ) &&
        !(project.contract_signed && project.deposit_paid))
    )
      continue;
    const add = (
      kind: WorkspaceDeadline["kind"],
      id: string,
      title: string,
      date: string | null | undefined,
      href: string,
    ) => {
      const day = calendarDay(date);
      if (day === null) return;
      items.push({
        id: kind + "-" + id,
        kind,
        title,
        projectId: project.id,
        projectName: project.name,
        clientName: client.name,
        date: date!,
        daysFromToday: day - current,
        href,
      });
    };
    add(
      "project",
      project.id,
      "Estimated project completion",
      project.due,
      "#journey",
    );
    for (const action of data.clientActions ?? [])
      if (action.project_id === project.id && action.status === "To do")
        add("action", action.id, action.title, action.due, "#client-actions");
    const stages = data.stages.filter((s) => s.project_id === project.id);
    for (const document of data.documents) {
      if (
        document.project_id !== project.id ||
        document.category !== "presentation" ||
        !fileVisibility(
          document,
          project,
          stages,
          data.contractExchanges,
          data.prospectSpaces,
        ).available ||
        data.feedback.some(
          (f) =>
            f.document_id === document.id &&
            ["approved", "changes_requested"].includes(f.decision),
        )
      )
        continue;
      const stage = stages.find((s) => s.id === document.stage_id);
      add(
        "review",
        document.id,
        document.name +
          (document.version_label ? " · " + document.version_label : ""),
        document.review_due,
        stage ? "#stage-" + stage.id : "#documents",
      );
    }
  }
  // Sorting this new array preserves the supplied records and stable tie order.
  items.sort((a, b) => a.date.localeCompare(b.date));
  return {
    total: items.length,
    overdue: items.filter((item) => item.daysFromToday < 0).length,
    items: items.filter(
      (item) =>
        range === "all" ||
        (range === "overdue"
          ? item.daysFromToday < 0
          : item.daysFromToday >= 0 &&
            item.daysFromToday < (range === "week" ? 7 : 30)),
    ),
  };
}
