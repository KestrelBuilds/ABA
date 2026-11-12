import type {
  DbDocument,
  DbProject,
  DbStage,
  WorkspaceData,
} from "./workspace";
import { discoveryBookingUrl } from "./stage-links";
export const enquiryLabels = {
  new: "New enquiry",
  discovery: "Discovery",
  proposal: "Proposal sent",
  considering: "Considering",
  closed: "Not proceeding",
} as const;
export type ProspectSpace = {
  project_id: string;
  enabled: boolean;
  release_step: "discovery" | "proposal" | "agreement";
  enquiry_status: keyof typeof enquiryLabels;
  booking_url: string;
  proposal_stage_id: string | null;
  contract_stage_id: string | null;
  invoice_stage_id: string | null;
};
export type ProspectEntry = Pick<
  ProspectSpace,
  "enabled" | "release_step" | "enquiry_status" | "booking_url"
> & {
  archived_at?: string | null;
  project_id: string;
  name: string;
  contract_signed: boolean;
  deposit_paid: boolean;
  documents: {
    id: string;
    name: string;
    version_label: string;
    document_role: string;
  }[];
  returns: {
    id: string;
    name: string;
    contract_document_id: string;
    created_at: string;
  }[];
  responses: { document_id: string; decision: string; message: string }[];
};
export function prospectDocumentVisible(
  d: DbDocument,
  p: DbProject,
  stages: DbStage[],
  space: ProspectSpace,
) {
  if (
    (d.scan_state && !["legacy", "clean"].includes(d.scan_state)) ||
    (p.archived_at && p.archived_client_access === "suspend") ||
    space.project_id !== p.id ||
    d.project_id !== p.id ||
    !space.enabled ||
    space.enquiry_status === "closed" ||
    !d.published ||
    d.category !== "document" ||
    !stages.some(
      (s) => s.id === d.stage_id && s.project_id === p.id && s.visible,
    )
  )
    return false;
  return (
    (space.release_step !== "discovery" &&
      d.document_role === "Proposal" &&
      d.stage_id === space.proposal_stage_id) ||
    (space.release_step === "agreement" &&
      ((d.document_role === "Contract" &&
        d.stage_id === space.contract_stage_id) ||
        (d.document_role === "Invoice" &&
          d.stage_id === space.invoice_stage_id)))
  );
}
export function previewProspect(
  data: WorkspaceData,
  p: DbProject,
): ProspectEntry {
  const space =
    data.prospectSpaces?.find((x) => x.project_id === p.id) ??
    ({
      project_id: p.id,
      enabled: false,
      release_step: "discovery",
      enquiry_status: "new",
      booking_url: discoveryBookingUrl,
      proposal_stage_id: null,
      contract_stage_id: null,
      invoice_stage_id: null,
    } as ProspectSpace);
  return {
    project_id: p.id,
    archived_at: p.archived_at,
    name: p.name,
    enabled:
      space.enabled &&
      !(p.archived_at && p.archived_client_access === "suspend"),
    release_step: space.release_step,
    enquiry_status: space.enquiry_status,
    booking_url: space.booking_url,
    contract_signed: p.contract_signed,
    deposit_paid: p.deposit_paid,
    documents: data.documents
      .filter((d) => prospectDocumentVisible(d, p, data.stages, space))
      .map((d) => ({
        id: d.id,
        name: d.name,
        version_label: d.version_label ?? "v1",
        document_role: d.document_role ?? "General",
      })),
    returns: [],
    responses: [],
  };
}
export function projectRelationship(data: WorkspaceData, p: DbProject) {
  if (p.archived_at) return "Archived project";
  return p.contract_signed && p.deposit_paid
    ? "Active client"
    : data.prospectSpaces?.find((s) => s.project_id === p.id)
          ?.enquiry_status === "closed"
      ? "Not proceeding"
      : "Potential client";
}

export function clientRelationship(data: WorkspaceData, clientId: string) {
  const projects = data.projects.filter((p) => p.client_id === clientId);
  if (!projects.length) return "Contact";
  const states = projects.map((p) => projectRelationship(data, p));
  if (states.includes("Active client")) return "Active client";
  return states.every((s) => s === "Not proceeding")
    ? "Not proceeding"
    : "Potential client";
}
