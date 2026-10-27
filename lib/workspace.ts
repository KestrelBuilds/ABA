import "server-only";
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
};
export type DbFeedback = {
  id: string;
  document_id: string;
  body: string;
  decision: string;
  created_at: string;
};
export type DbQuestionnaire = {
  id: string;
  project_id: string;
  kind: string;
  answers: Record<string, string>;
  submitted_at: string;
};
export type WorkspaceData = {
  role: "admin" | "client";
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
      .select("id,project_id,name,category,published")
      .order("created_at"),
    db
      .from("feedback")
      .select("id,document_id,body,decision,created_at")
      .order("created_at", { ascending: false }),
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
    role: profile.role,
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
