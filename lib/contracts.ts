import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
const contractEntry = z.object({
  project_id: z.uuid(),
  name: z.string(),
  stage_id: z.uuid(),
  stage_name: z.string(),
  contract_signed: z.boolean(),
  deposit_paid: z.boolean(),
  documents: z.array(
    z.object({ id: z.uuid(), name: z.string(), version_label: z.string() }),
  ),
  returns: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      contract_document_id: z.uuid(),
      created_at: z.string(),
    }),
  ),
});
export type ContractEntry = z.infer<typeof contractEntry>;
export async function loadContractArea(db: SupabaseClient, target?: string) {
  const result = await db.rpc("contract_area", { target: target ?? null });
  if (result.error) {
    if (["PGRST202", "42883"].includes(result.error.code))
      return { ready: false, entries: [] as ContractEntry[] };
    throw Error("The contract area could not be loaded. Please try again.");
  }
  return { ready: true, entries: z.array(contractEntry).parse(result.data) };
}
