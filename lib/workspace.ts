import "server-only";
import { loadFinance, type FinanceData } from "./finance/data";
import { identity } from "./supabase/server";
export type DbClient = {
  id: string;
  name: string;
  contact: string;
  email: string;
  sector: string;
};
export type DbProject = {
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
  id: string;
  project_id: string;
  name: string;
  stream: string;
  position: number;
  status: string;
  visible: boolean;
};
export type DbDocument = {
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
export type ClientAsset = {
  stage_id?: string | null;
  id: string;
  project_id: string;
  name: string;
  created_at: string;
};
export type WorkspaceData = {
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
  const capability = await db.rpc("project_management_ready");
  if (
    capability.error &&
    !["PGRST202", "42883"].includes(capability.error.code)
  )
    throw Error("Project tools could not be checked. Please retry.");
  const managementReady = capability.data === true;
  const finance = await loadFinance(db, profile.role === "admin");
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
            finance.ready
              ? "id,project_id,name,created_at,stage_id"
              : "id,project_id,name,created_at",
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
      .select("id,name,contact,email,sector")
      .order("created_at"),
    db
      .from("projects")
      .select(
        "id,client_id,name,type,due,budget,contract_signed,deposit_paid,final_paid,final_approved",
      )
      .order("created_at"),
    db
      .from("stages")
      .select("id,project_id,name,stream,position,status,visible")
      .order("position"),
    db
      .from("documents")
      .select(
        managementReady
          ? finance.ready
            ? "id,project_id,name,category,published,version_label,review_due,stage_id,document_role"
            : "id,project_id,name,category,published,version_label,review_due"
          : "id,project_id,name,category,published",
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
