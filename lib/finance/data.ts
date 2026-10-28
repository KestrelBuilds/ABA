import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
export type Proposal = {
  id: string;
  project_id: string;
  revision: number;
  status: string;
  scope: string;
  deliverables: string;
  timeline: string;
  revisions: string;
  exclusions: string;
  notes: string;
  total_pence: number;
  client_snapshot: Record<string, string> | null;
  seller_snapshot: Record<string, string> | null;
  shared_at: string | null;
  decision_at: string | null;
};
export type Invoice = {
  id: string;
  project_id: string;
  kind: string;
  number: string | null;
  amount_pence: number;
  status: string;
  issued_on: string | null;
  due_on: string | null;
  paid_on: string | null;
  client_snapshot: Record<string, string> | null;
  seller_snapshot: Record<string, string> | null;
};
export type Seller = {
  seller_name: string;
  seller_address: string;
  seller_email: string;
  payment_instructions: string;
  no_vat_confirmed: boolean;
};
export type Template = {
  id: string;
  name: string;
  scope: string;
  deliverables: string;
  timeline: string;
  revisions: string;
  exclusions: string;
  notes: string;
};
export type FinanceData = {
  ready: boolean;
  proposals: Proposal[];
  invoices: Invoice[];
  templates: Template[];
  seller: Seller | null;
  billing: {
    client_id: string;
    billing_name: string;
    billing_address: string;
  }[];
};
export async function loadFinance(db: SupabaseClient): Promise<FinanceData> {
  const empty: FinanceData = {
    ready: false,
    proposals: [],
    invoices: [],
    templates: [],
    seller: null,
    billing: [],
  };
  const ready = await db.rpc("business_documents_ready");
  if (ready.error) {
    if (["PGRST202", "42883"].includes(ready.error.code)) return empty;
    throw Error("Finance connection could not be checked.");
  }
  if (ready.data !== true) return empty;
  const queries = await Promise.all([
    db.from("proposals").select("*").order("revision", { ascending: false }),
    db.from("invoices").select("*").order("created_at"),
  ]);
  if (queries.some((r) => r.error))
    throw Error("Business documents could not be loaded.");
  return {
    ready: true,
    proposals: queries[0].data ?? [],
    invoices: queries[1].data ?? [],
    templates: [],
    seller: null,
    billing: [],
  } as FinanceData;
}
