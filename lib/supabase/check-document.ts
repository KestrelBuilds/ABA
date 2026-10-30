import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { fictionalPdf } from "./storage-check";
import { finishUpload, secureUploadsConfigured } from "./file-intake";
// Only the owner-requested diagnostic calls this with its preallocated random IDs.
// Authenticated uploads avoid leaving signed upload capabilities after cleanup.
export async function createCheckDocument(
  owner: SupabaseClient,
  projectId: string,
  documentId: string,
  category: "document" | "final",
  published: boolean,
  secureFiles: boolean,
) {
  if (secureFiles && !secureUploadsConfigured())
    throw Error(
      "The approved upload scanner must be configured before this check can run.",
    );
  const bytes = Buffer.from(fictionalPdf()),
    path = projectId + "/" + documentId;
  const metadata = secureFiles
    ? await owner.rpc("reserve_file_upload", {
        target: projectId,
        upload_id: documentId,
        upload_kind: "document",
        file_name: "aba-fictional-check.pdf",
        file_size: bytes.length,
        file_hash: createHash("sha256").update(bytes).digest("hex"),
        mime: "application/pdf",
        category_name: category,
      })
    : await owner.from("documents").insert({
        id: documentId,
        project_id: projectId,
        name: "aba-fictional-check.pdf",
        object_path: path,
        category,
        published: false,
      });
  if (metadata.error)
    throw Error("Temporary document setup could not be completed.");
  const uploaded = await owner.storage
    .from("project-files")
    .upload(path, bytes, {
      contentType: "application/pdf",
      cacheControl: "0",
      upsert: false,
    });
  if (uploaded.error)
    throw Error("Temporary private PDF upload could not be completed.");
  if (secureFiles) {
    if ((await finishUpload(owner, documentId)).state !== "clean")
      throw Error("The scanner blocked the fictional diagnostic file.");
  }
  if (published) {
    const shared = await owner
      .from("documents")
      .update({ published: true })
      .eq("id", documentId);
    if (shared.error)
      throw Error("Temporary document sharing could not be completed.");
  }
}
