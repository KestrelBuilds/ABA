import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
const planSchema = z.object({
  client_id: z.uuid(),
  project_ids: z.array(z.uuid()),
  files: z.array(
    z.object({
      bucket: z.enum(["project-files", "client-assets"]),
      path: z.string().min(1),
    }),
  ),
});
// Identity is checked by the action, and both RPCs independently enforce owner MFA/RLS.
// File paths come only from the server-generated frozen manifest, never from the browser.
export async function deleteClientRecords(
  db: SupabaseClient,
  id: string,
  confirmation: string,
) {
  const prepared = await db.rpc("prepare_client_deletion", {
    target: id,
    confirmation,
  });
  if (prepared.error) {
    const message = prepared.error.message;
    if (
      [
        "Type the exact client business name",
        "This client has generated financial records",
        "Owner access required",
        "Client not found",
      ].some((prefix) => message.startsWith(prefix))
    )
      throw Error(message);
    if (["PGRST202", "42883"].includes(prepared.error.code))
      throw Error("Apply the client-deletion SQL update first.");
    throw Error(
      "Client deletion could not be prepared. No private files were removed.",
    );
  }
  const parsed = planSchema.safeParse(prepared.data);
  if (!parsed.success)
    throw Error(
      "Deletion paused: the stored file list could not be verified. No private files were removed.",
    );
  const plan = parsed.data;
  if (
    plan.client_id !== id ||
    plan.files.some(
      (f) =>
        !plan.project_ids.some((p) => f.path.startsWith(p + "/")) ||
        f.path.split("/").some((part) => part === ".." || part === "."),
    )
  )
    throw Error(
      "Deletion paused: the file list could not be verified. Retry cleanup or contact support.",
    );
  for (const bucket of ["project-files", "client-assets"] as const) {
    const files = [
      ...new Set(
        plan.files.filter((f) => f.bucket === bucket).map((f) => f.path),
      ),
    ];
    for (let offset = 0; offset < files.length; offset += 100) {
      try {
        const result = await db.storage
          .from(bucket)
          .remove(files.slice(offset, offset + 100));
        if (result.error) throw result.error;
      } catch {
        throw Error(
          "Deletion paused during private file cleanup. Access is revoked; retry deletion to finish. Remaining records and audit history have been kept.",
        );
      }
    }
  }
  const finished = await db.rpc("finish_client_deletion", { target: id });
  if (finished.error)
    throw Error(
      "Deletion paused before removing records. Access is revoked; retry deletion to finish. Audit history has been kept.",
    );
}
