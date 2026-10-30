import type { WorkspaceData } from "./workspace";
import { fileVisibility } from "./file-visibility";
export type AttentionDestination =
  | { area: "enquiries" }
  | { area: "client"; clientId: string }
  | { area: "project"; projectId: string; href: string };
export type AttentionItem = {
  id: string;
  title: string;
  detail: string;
  count: number;
  destination: AttentionDestination;
};
// A read-only view of existing records. It never creates tasks, verifies payments or sends messages.
export function workspaceAttention(
  data: WorkspaceData,
  today: string,
): AttentionItem[] {
  if (data.role !== "admin") return [];
  const items: AttentionItem[] = [];
  const activeProjects = data.projects.filter(
    (p) =>
      !p.archived_at &&
      !data.clients.find((c) => c.id === p.client_id)?.deletion_pending &&
      !(
        data.prospectSpaces?.some(
          (s) => s.project_id === p.id && s.enquiry_status === "closed",
        ) && !(p.contract_signed && p.deposit_paid)
      ),
  );
  const enquiries = (data.enquiries ?? []).filter((e) => e.status === "new");
  if (enquiries.length)
    items.push({
      id: "enquiries",
      title: "Review new enquiries",
      detail:
        "Read the enquiry before creating a potential project or invitation.",
      count: enquiries.length,
      destination: { area: "enquiries" },
    });
  for (const p of activeProjects) {
    const target = (href: string): AttentionDestination => ({
      area: "project",
      projectId: p.id,
      href,
    });
    const returns = (data.assets ?? []).filter(
      (a) =>
        a.project_id === p.id &&
        a.contract_document_id &&
        data.documents.some(
          (d) =>
            d.id === a.contract_document_id &&
            d.project_id === p.id &&
            d.document_role === "Contract",
        ),
    );
    if (!p.contract_signed && returns.length) {
      const original = data.documents.find(
        (d) => d.id === returns[0].contract_document_id,
      );
      items.push({
        id: "contract-" + p.id,
        title: "Review returned contract",
        detail:
          p.name + " · Check the returned PDF before verifying the contract.",
        count: returns.length,
        destination: target(
          original?.stage_id ? "#stage-" + original.stage_id : "#documents",
        ),
      });
    }
    const space = data.prospectSpaces?.find((s) => s.project_id === p.id);
    const replies = (data.proposalResponses ?? []).filter(
      (r) => r.project_id === p.id,
    );
    if (
      replies.length &&
      space &&
      space.release_step === "proposal" &&
      space.enquiry_status !== "closed"
    )
      items.push({
        id: "proposal-" + p.id,
        title: "Review proposal response",
        detail:
          p.name +
          " · Update the enquiry status or release the next step after reviewing.",
        count: replies.length,
        destination: target("#potential-client-settings"),
      });
    const overdue = (data.clientActions ?? []).filter(
      (a) =>
        a.project_id === p.id && a.status !== "Done" && a.due && a.due < today,
    );
    if (overdue.length)
      items.push({
        id: "actions-" + p.id,
        title: "Follow up overdue client actions",
        detail: p.name + " · Check in with the client about outstanding tasks.",
        count: overdue.length,
        destination: target("#client-actions"),
      });
    const finals = data.documents.filter(
      (d) => d.project_id === p.id && d.category === "final",
    );
    const unreleased = finals.filter(
      (d) =>
        !fileVisibility(
          d,
          p,
          data.stages,
          data.contractExchanges,
          data.prospectSpaces,
        ).available,
    );
    if (
      p.contract_signed &&
      p.deposit_paid &&
      p.final_approved &&
      p.final_paid &&
      unreleased.length
    )
      items.push({
        id: "delivery-" + p.id,
        title: "Review final file sharing",
        detail:
          p.name +
          " · Final checks are verified. Some final files are drafts or in internal stages.",
        count: unreleased.length,
        destination: target("#handover-preparation"),
      });
  }
  for (const s of data.portalStatuses ?? []) {
    if (
      !s.eligible ||
      !["not_invited", "expired"].includes(s.state) ||
      !activeProjects.some((p) => p.client_id === s.client_id)
    )
      continue;
    const c = data.clients.find((c) => c.id === s.client_id);
    if (c)
      items.push({
        id: "invite-" + c.id,
        title:
          s.state === "expired"
            ? "Refresh expired invitation"
            : "Invite client to their shared area",
        detail: c.name + " · " + c.email,
        count: 1,
        destination: { area: "client", clientId: c.id },
      });
  }
  return items;
}
