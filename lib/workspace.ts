import "server-only";
import type { StagePurpose } from "./stage-purpose";
import type { ProspectSpace } from "./prospects";
import type { ClientPortalStatus } from "./invitations";
import { loadFinance, type FinanceData } from "./finance/data";
import { secureUploadsConfigured } from "./supabase/file-intake";
import { identity } from "./supabase/server";
export type DbClient = {
  deletion_pending?: boolean;
  id: string;
  name: string;
  contact: string;
  email: string;
  sector: string;
};
export type DbProject = {
  archived_at?: string | null;
  archived_client_access?: "retain" | "suspend";
  separate_approvals?: boolean;
  id: string;
  client_id: string;
  name: string;
  type: "Brand Identity" | "Website Design" | "Both";
  due: string;
  budget: number;
  contract_signed: boolean;
  deposit_paid: boolean;
  final_paid: boolean;
  final_approved: boolean;
};
export type DbStage = {
  purpose?: StagePurpose | null;
  id: string;
  project_id: string;
  name: string;
  stream: string;
  position: number;
  status: string;
  visible: boolean;
};
export type FileSecurity = {
  scan_state?: "legacy" | "pending" | "clean" | "rejected";
  file_size?: number | null;
  sha256?: string | null;
  content_type?: string | null;
  scanned_at?: string | null;
};
export type PendingUpload = {
  id: string;
  project_id: string;
  stage_id: string | null;
  name: string;
  kind: "document" | "asset" | "contract";
  status: "pending" | "rejected";
  expires_at: string;
};
export type DbDocument = FileSecurity & {
  id: string;
  project_id: string;
  name: string;
  category: string;
  published: boolean;
  stage_id?: string | null;
  document_role?: string;
  version_label?: string;
  review_due?: string | null;
};
export type DbFeedback = {
  id: string;
  document_id: string;
  body: string;
  decision: string;
  approver_name?: string | null;
  reviewed_version?: string | null;
  created_at: string;
};
export type DbQuestionnaire = {
  id: string;
  project_id: string;
  kind: string;
  answers: Record<string, string>;
  submitted_at: string;
};
export type ProjectDetails = {
  project_id: string;
  goal: string;
  deliverables: string;
  exclusions: string;
  approver: string;
  support: string;
};
export type ClientAction = {
  id: string;
  project_id: string;
  title: string;
  due: string | null;
  status: "To do" | "Done";
};
export type ClientAsset = FileSecurity & {
  contract_document_id?: string | null;
  stage_id?: string | null;
  id: string;
  project_id: string;
  name: string;
  created_at: string;
};
export type VerificationEvent = {
  id: string;
  project_id: string | null;
  project_label: string;
  field: string;
  confirmed: boolean;
  recorded_at: string;
  actor_id: string | null;
  reference: string;
  occurred_on: string | null;
  document_id: string | null;
  document_label: string | null;
  invoice_id: string | null;
  source: string;
};
export type WorkspaceData = {
  readOnly?: boolean;
  fileSecurityReady?: boolean;
  secureUploadsConfigured?: boolean;
  pendingUploads?: PendingUpload[];
  lifecycleReady?: boolean;
  verificationHistory?: VerificationEvent[];
  streamApprovals?: {
    project_id: string;
    stream: "Brand Identity" | "Website Design";
    confirmed: boolean;
    checked_at: string;
    checked_by: string | null;
  }[];
  stagePurposesReady?: boolean;
  invitationsReady?: boolean;
  portalStatuses?: ClientPortalStatus[];
  enquiriesReady?: boolean;
  enquiries?: {
    id: string;
    source: string;
    business_name: string;
    contact_name: string;
    email: string;
    status: string;
    fields: { label: string; value: string }[];
    linked_client_id: string | null;
    linked_project_id: string | null;
  }[];
  prospectReady?: boolean;
  prospectSpaces?: ProspectSpace[];
  proposalResponses?: {
    id: string;
    project_id: string;
    document_id: string;
    decision: string;
    message: string;
    created_at: string;
  }[];
  clientDeletionReady?: boolean;
  contractReady?: boolean;
  contractExchanges?: {
    project_id: string;
    stage_id: string;
    enabled: boolean;
  }[];
  finance?: FinanceData;
  stageResources?: {
    stage_id: string;
    instructions: string;
    booking_url: string;
  }[];
  managementReady?: boolean;
  projectDetails?: ProjectDetails[];
  handovers?: { project_id: string; body: string }[];
  clientActions?: ClientAction[];
  assets?: ClientAsset[];
  role: "admin" | "client";
  emailInvitesReady: boolean;
  clients: DbClient[];
  projects: DbProject[];
  stages: DbStage[];
  documents: DbDocument[];
  feedback: DbFeedback[];
  questionnaires: DbQuestionnaire[];
  notes: { project_id: string; body: string }[];
  audit: { id: string; entity: string; action: string; created_at: string }[];
};
export async function loadWorkspace(): Promise<WorkspaceData> {
  const { db, profile } = await identity();
  const invitationCapability =
    profile.role === "admin" ? await db.rpc("client_invitations_ready") : null;
  if (
    invitationCapability?.error &&
    !["PGRST202", "42883"].includes(invitationCapability.error.code)
  )
    throw Error("Client invitation tools could not be checked.");
  const invitationsReady = invitationCapability?.data === true;
  const portalStatuses = invitationsReady
    ? await db.rpc("client_portal_statuses")
    : null;
  if (portalStatuses?.error)
    throw Error("Client access status could not be loaded.");
  const fileCapability = await db.rpc("file_security_ready");
  if (
    fileCapability.error &&
    !["PGRST202", "42883"].includes(fileCapability.error.code)
  )
    throw Error("File security could not be checked.");
  const fileSecurityReady = fileCapability.data === true;
  const pendingUploads = fileSecurityReady
    ? await db
        .from("upload_intakes")
        .select("id,project_id,stage_id,name,kind,status,expires_at")
        .in("status", ["pending", "rejected"])
        .is("discarded_at", null)
        .order("created_at")
        .overrideTypes<PendingUpload[], { merge: false }>()
    : null;
  if (pendingUploads?.error) throw Error("Upload status could not be loaded.");
  const scanColumns = fileSecurityReady
    ? ",scan_state,file_size,sha256,content_type,scanned_at"
    : "";
  const lifecycleCapability = await db.rpc("project_lifecycle_ready");
  if (
    lifecycleCapability.error &&
    !["PGRST202", "42883"].includes(lifecycleCapability.error.code)
  )
    throw Error("Project history and archiving could not be checked.");
  const lifecycleReady = lifecycleCapability.data === true;
  const lifecycle =
    lifecycleReady && profile.role === "admin"
      ? await Promise.all([
          db
            .from("project_verifications")
            .select(
              "id,project_id,project_label,field,confirmed,recorded_at,actor_id,reference,occurred_on,document_id,document_label,invoice_id,source",
            )
            .order("recorded_at", { ascending: false }),
          db
            .from("project_stream_approvals")
            .select("project_id,stream,confirmed,checked_at,checked_by"),
        ])
      : [];
  if (lifecycle.some((r) => r.error))
    throw Error("Project history could not be loaded.");
  const purposeCapability = await db.rpc("stage_purposes_ready");
  if (
    purposeCapability.error &&
    !["PGRST202", "42883"].includes(purposeCapability.error.code)
  )
    throw Error("Stage purposes could not be checked. Please retry.");
  const stagePurposesReady = purposeCapability.data === true;
  const capability = await db.rpc("project_management_ready");
  if (
    capability.error &&
    !["PGRST202", "42883"].includes(capability.error.code)
  )
    throw Error("Project tools could not be checked. Please retry.");
  const managementReady = capability.data === true;
  const enquiryCapability = await db.rpc("enquiries_ready");
  if (
    enquiryCapability.error &&
    !["PGRST202", "42883"].includes(enquiryCapability.error.code)
  )
    throw Error("Enquiries availability could not be checked.");
  const enquiriesReady = enquiryCapability.data === true;
  const enquiries =
    enquiriesReady && profile.role === "admin"
      ? await db
          .from("enquiries")
          .select(
            "id,source,business_name,contact_name,email,status,fields,linked_client_id,linked_project_id",
          )
          .order("received_at", { ascending: false })
      : null;
  if (enquiries?.error) throw Error("Enquiries could not be loaded.");
  const prospectCapability = await db.rpc("prospect_spaces_ready");
  if (
    prospectCapability.error &&
    !["PGRST202", "42883"].includes(prospectCapability.error.code)
  )
    throw Error("Potential-client access could not be checked.");
  const prospectReady = prospectCapability.data === true;
  const prospectData =
    prospectReady && profile.role === "admin"
      ? await Promise.all([
          db
            .from("prospect_spaces")
            .select(
              "project_id,enabled,release_step,enquiry_status,booking_url,proposal_stage_id,contract_stage_id,invoice_stage_id",
            ),
          db
            .from("proposal_responses")
            .select("id,project_id,document_id,decision,message,created_at")
            .order("created_at", { ascending: false }),
        ])
      : [];
  if (prospectData.some((r) => r.error))
    throw Error("Enquiry tracking could not be loaded.");
  const deletionCapability = await db.rpc("client_deletion_ready");
  if (
    deletionCapability.error &&
    !["PGRST202", "42883"].includes(deletionCapability.error.code)
  )
    throw Error("Client deletion availability could not be checked.");
  const clientDeletionReady = deletionCapability.data === true;
  const contractCapability = await db.rpc("contract_area_ready");
  if (
    contractCapability.error &&
    !["PGRST202", "42883"].includes(contractCapability.error.code)
  )
    throw Error("Contract access could not be checked.");
  const contractReady = contractCapability.data === true;
  const contractExchanges =
    contractReady && profile.role === "admin"
      ? await db
          .from("contract_exchanges")
          .select("project_id,stage_id,enabled")
      : null;
  if (contractExchanges?.error)
    throw Error("Contract sharing settings could not be loaded.");
  const finance = await loadFinance(db);
  const resources = finance.ready
    ? await db
        .from("stage_resources")
        .select("stage_id,instructions,booking_url")
    : null;
  if (resources?.error) throw Error("Stage details could not be loaded.");
  const extra = managementReady
    ? await Promise.all([
        db.from("project_details").select("*"),
        db.from("project_handover").select("project_id,body"),
        db
          .from("client_actions")
          .select("id,project_id,title,due,status")
          .order("due"),
        db
          .from("client_assets")
          .select(
            (finance.ready
              ? contractReady
                ? "id,project_id,name,created_at,stage_id,contract_document_id"
                : "id,project_id,name,created_at,stage_id"
              : "id,project_id,name,created_at") + scanColumns,
          )
          .order("created_at")
          .overrideTypes<ClientAsset[], { merge: false }>(),
      ])
    : [];
  if (extra.some((r) => r.error))
    throw Error("Project tools could not be loaded.");
  const results = await Promise.all([
    db
      .from("clients")
      .select(
        clientDeletionReady
          ? "id,name,contact,email,sector,deletion_pending"
          : "id,name,contact,email,sector",
      )
      .order("created_at")
      .overrideTypes<DbClient[], { merge: false }>(),
    db
      .from("projects")
      .select(
        lifecycleReady
          ? "id,client_id,name,type,due,budget,contract_signed,deposit_paid,final_paid,final_approved,archived_at,archived_client_access,separate_approvals"
          : "id,client_id,name,type,due,budget,contract_signed,deposit_paid,final_paid,final_approved",
      )
      .order("created_at")
      .overrideTypes<DbProject[], { merge: false }>(),
    db
      .from("stages")
      .select(
        stagePurposesReady
          ? "id,project_id,name,stream,position,status,visible,purpose"
          : "id,project_id,name,stream,position,status,visible",
      )
      .order("position")
      .overrideTypes<DbStage[], { merge: false }>(),
    db
      .from("documents")
      .select(
        (managementReady
          ? finance.ready
            ? "id,project_id,name,category,published,version_label,review_due,stage_id,document_role"
            : "id,project_id,name,category,published,version_label,review_due"
          : "id,project_id,name,category,published") + scanColumns,
      )
      .order("created_at")
      .overrideTypes<DbDocument[], { merge: false }>(),
    db
      .from("feedback")
      .select(
        managementReady
          ? "id,document_id,body,decision,created_at,approver_name,reviewed_version"
          : "id,document_id,body,decision,created_at",
      )
      .order("created_at", { ascending: false })
      .overrideTypes<DbFeedback[], { merge: false }>(),
    db.from("questionnaires").select("id,project_id,kind,answers,submitted_at"),
    ...(profile.role === "admin"
      ? [
          db.from("project_notes").select("project_id,body"),
          db
            .from("audit_events")
            .select("id,entity,action,created_at")
            .order("created_at", { ascending: false })
            .limit(30),
        ]
      : []),
  ]);
  if (results.some((r) => r.error))
    throw Error(
      "Workspace data could not be loaded. Check the database migrations and access policies.",
    );
  return {
    fileSecurityReady,
    secureUploadsConfigured: secureUploadsConfigured(),
    pendingUploads: pendingUploads?.data ?? [],
    lifecycleReady,
    verificationHistory: lifecycle[0]?.data ?? [],
    streamApprovals: lifecycle[1]?.data ?? [],
    stagePurposesReady,
    invitationsReady,
    portalStatuses: portalStatuses?.data ?? [],
    enquiriesReady,
    enquiries: enquiries?.data ?? [],
    prospectReady,
    prospectSpaces: prospectData[0]?.data ?? [],
    proposalResponses: prospectData[1]?.data ?? [],
    clientDeletionReady,
    contractReady,
    contractExchanges: contractExchanges?.data ?? [],
    finance,
    stageResources: resources?.data ?? [],
    managementReady,
    projectDetails: extra[0]?.data ?? [],
    handovers: extra[1]?.data ?? [],
    clientActions: extra[2]?.data ?? [],
    assets: extra[3]?.data ?? [],
    role: profile.role,
    emailInvitesReady:
      profile.role === "admin" &&
      process.env.SUPABASE_INVITE_EMAIL_READY === "true",
    clients: results[0].data ?? [],
    projects: results[1].data ?? [],
    stages: results[2].data ?? [],
    documents: results[3].data ?? [],
    feedback: results[4].data ?? [],
    questionnaires: results[5].data ?? [],
    notes: results[6]?.data ?? [],
    audit: results[7]?.data ?? [],
  } as WorkspaceData;
}
