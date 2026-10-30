import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProspectEntry } from "../prospects";
const entry = z.object({
  project_id: z.uuid(),
  archived_at: z.string().nullable().optional(),
  name: z.string(),
  enabled: z.boolean(),
  release_step: z.enum(["discovery", "proposal", "agreement"]),
  enquiry_status: z.enum([
    "new",
    "discovery",
    "proposal",
    "considering",
    "closed",
  ]),
  booking_url: z.string().url(),
  contract_signed: z.boolean(),
  deposit_paid: z.boolean(),
  documents: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      version_label: z.string(),
      document_role: z.string(),
    }),
  ),
  returns: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      contract_document_id: z.uuid(),
      created_at: z.string(),
    }),
  ),
  responses: z.array(
    z.object({
      document_id: z.uuid(),
      decision: z.string(),
      message: z.string(),
    }),
  ),
});
export async function loadProspectArea(
  db: SupabaseClient,
  target?: string,
): Promise<{ ready: boolean; entries: ProspectEntry[] }> {
  const result = await db.rpc("prospect_area", { target: target ?? null });
  if (result.error) {
    if (["PGRST202", "42883"].includes(result.error.code))
      return { ready: false, entries: [] };
    throw Error("Potential-client area could not be loaded.");
  }
  return { ready: true, entries: z.array(entry).parse(result.data) };
}
