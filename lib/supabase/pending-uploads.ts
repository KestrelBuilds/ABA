import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PendingUpload } from "../workspace";
export async function loadPendingUploads(
  db: SupabaseClient,
): Promise<PendingUpload[]> {
  const capability = await db.rpc("file_security_ready");
  if (
    capability.error &&
    !["PGRST202", "42883"].includes(capability.error.code)
  )
    throw Error("Upload status could not be checked.");
  if (capability.data !== true) return [];
  const result = await db
    .from("upload_intakes")
    .select("id,project_id,stage_id,name,kind,status,expires_at")
    .in("status", ["pending", "rejected"])
    .is("discarded_at", null)
    .order("created_at");
  if (result.error) throw Error("Upload status could not be loaded.");
  return result.data;
}
