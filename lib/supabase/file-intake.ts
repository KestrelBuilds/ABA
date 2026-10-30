import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { z } from "zod";
import { supabaseSettings } from "./config";
import { privateFetch } from "./private-fetch";
import { validScanner, scanFile } from "../file-scanner";
import { inspectFile } from "../file-inspection";
import {
  MAX_UPLOAD_BYTES,
  uploadMime,
  UploadPendingError,
} from "../upload-policy";
const scanner = () => ({
  url: process.env.UPLOAD_SCAN_URL ?? "",
  key: process.env.UPLOAD_SCAN_KEY ?? "",
  allowLocal: process.env.NODE_ENV !== "production",
});
export function secureUploadsConfigured() {
  return Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY && validScanner(scanner()),
  );
}
function worker() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw Error("The server-only file checker is not configured.");
  return createClient(supabaseSettings().url, secret, {
    global: { fetch: privateFetch },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export const uploadInput = z.object({
  projectId: z.uuid(),
  kind: z.enum(["document", "asset", "contract"]),
  name: z.string().min(1).max(180),
  size: z.number().int().min(1).max(MAX_UPLOAD_BYTES),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  stageId: z.uuid().nullable().default(null),
  category: z.enum(["document", "presentation", "final"]).default("document"),
  role: z
    .enum([
      "General",
      "Proposal",
      "Contract",
      "Invoice",
      "Presentation",
      "Handover",
    ])
    .default("General"),
  version: z.string().trim().min(1).max(40).default("v1"),
  reviewDue: z.union([z.iso.date(), z.literal("")]).default(""),
  originalContract: z.uuid().nullable().default(null),
});
export type UploadInput = z.infer<typeof uploadInput>;
const intakeSchema = z.object({
  id: z.uuid(),
  project_id: z.uuid(),
  kind: z.enum(["document", "asset", "contract"]),
  bucket: z.enum(["project-files", "client-assets"]),
  object_path: z.string(),
  name: z.string(),
  expected_size: z.number().int(),
  expected_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  content_type: z.string(),
  status: z.enum(["pending", "clean", "rejected"]),
  expires_at: z.string(),
});
async function intake(db: SupabaseClient, id: string) {
  const res = await db.rpc("file_intake_for_check", { target: id });
  if (res.error) throw Error("This upload is not available to your account.");
  const u = intakeSchema.parse(res.data);
  if (
    u.id !== id ||
    u.object_path !== u.project_id + "/" + u.id ||
    u.bucket !== (u.kind === "document" ? "project-files" : "client-assets")
  )
    throw Error("The upload reservation could not be verified.");
  return u;
}
export async function reserveUpload(db: SupabaseClient, input: UploadInput) {
  if (!secureUploadsConfigured())
    throw Error(
      "Secure uploads need an approved scanner connection in hosting settings.",
    );
  const v = uploadInput.parse(input),
    id = crypto.randomUUID(),
    mime = uploadMime(v.name);
  if (
    v.kind === "contract" &&
    (mime !== "application/pdf" || v.size > 3 * 1024 * 1024)
  )
    throw Error("Contract returns must be PDFs up to 3 MB.");
  const reserved = await db.rpc("reserve_file_upload", {
    target: v.projectId,
    upload_id: id,
    upload_kind: v.kind,
    file_name: v.name,
    file_size: v.size,
    file_hash: v.sha256,
    mime,
    stage: v.stageId,
    category_name: v.category,
    role_name: v.role,
    version: v.version,
    review_date: v.reviewDue || null,
    original_contract: v.originalContract,
  });
  if (reserved.error)
    throw Error(
      "The upload could not be reserved. Check project access and the selected stage.",
    );
  const bucket = v.kind === "document" ? "project-files" : "client-assets",
    path = v.projectId + "/" + id;
  const signed = await db.storage
    .from(bucket)
    .createSignedUploadUrl(path, { upsert: false });
  if (signed.error || !signed.data)
    throw new UploadPendingError(
      "A private upload link could not be created. Retry or discard the pending upload.",
    );
  return {
    id,
    bucket,
    path,
    token: signed.data.token,
    url: supabaseSettings().url,
    key: supabaseSettings().key,
    mime,
  };
}
export async function finishUpload(db: SupabaseClient, id: string) {
  if (!secureUploadsConfigured())
    throw Error("The upload security scanner is not configured.");
  const u = await intake(db, id);
  if (u.status === "clean")
    return {
      state: "clean" as const,
      message: "File checked and ready. Sharing and release rules still apply.",
    };
  if (u.status === "rejected")
    return {
      state: "rejected" as const,
      message:
        "File blocked by the security checks. Discard it and choose another file.",
    };
  if (Date.parse(u.expires_at) <= Date.now())
    throw Error(
      "This upload reservation expired. Discard it and upload again.",
    );
  const w = worker();
  const downloaded = await w.storage.from(u.bucket).download(u.object_path);
  if (downloaded.error || !downloaded.data)
    throw Error(
      "The uploaded bytes are not available yet. Retry the security check.",
    );
  if (downloaded.data.size > MAX_UPLOAD_BYTES)
    throw Error("The stored file exceeds the security limit.");
  const bytes = Buffer.from(await downloaded.data.arrayBuffer()),
    hash = createHash("sha256").update(bytes).digest("hex");
  let verdict: "clean" | "rejected" = "rejected",
    mime = u.content_type,
    contentValid = false;
  try {
    mime = await inspectFile(bytes, u.name);
    contentValid = true;
  } catch {
    contentValid = false;
  }
  if (
    contentValid &&
    bytes.length === u.expected_size &&
    hash === u.expected_sha256 &&
    mime === u.content_type
  ) {
    try {
      verdict = await scanFile(bytes, u.name, mime, hash, scanner());
    } catch {
      throw Error(
        "The security check could not finish. The file remains quarantined; retry later.",
      );
    }
  }
  const checked = await w.rpc("complete_file_check", {
    target: id,
    verdict,
    verified_size: bytes.length,
    verified_hash: hash,
    verified_mime: mime,
  });
  if (checked.error)
    throw Error(
      "The security result could not be saved. The file remains quarantined.",
    );
  return {
    state: verdict,
    message:
      verdict === "clean"
        ? "File checked and ready. It is still subject to sharing and final-release rules."
        : "File blocked by the security checks. It cannot be downloaded or shared.",
  };
}
export async function discardUpload(db: SupabaseClient, id: string) {
  const u = await intake(db, id);
  if (u.status === "clean")
    throw Error("Only quarantined files can be discarded here.");
  const w = worker();
  const removed = await w.storage.from(u.bucket).remove([u.object_path]);
  if (removed.error)
    throw Error("File cleanup failed. Retry; the record has been kept.");
  const listed = await w.storage
    .from(u.bucket)
    .list(u.project_id, { search: u.id, limit: 10 });
  if (listed.error || listed.data?.some((f) => f.name === u.id))
    throw Error(
      "File cleanup could not be verified. The record has been kept.",
    );
  const finished = await w.rpc("discard_file_intake", { target: id });
  if (finished.error) throw Error("File cleanup could not finish. Retry.");
}
export async function trySmallSecureUpload(
  db: SupabaseClient,
  file: File,
  metadata: Omit<UploadInput, "name" | "size" | "sha256">,
) {
  const ready = await db.rpc("file_security_ready");
  if (ready.error && !["PGRST202", "42883"].includes(ready.error.code))
    throw Error("File security could not be checked.");
  if (ready.data !== true) return false;
  const bytes = Buffer.from(await file.arrayBuffer());
  const hash = createHash("sha256").update(bytes).digest("hex");
  const reserved = await reserveUpload(db, {
    ...metadata,
    name: file.name,
    size: file.size,
    sha256: hash,
  });
  try {
    const uploaded = await db.storage
      .from(reserved.bucket)
      .upload(reserved.path, file, {
        contentType: reserved.mime,
        cacheControl: "0",
        upsert: false,
      });
    if (uploaded.error)
      throw Error(
        "The private upload failed. Its quarantine record was kept for retry or cleanup.",
      );
    const checked = await finishUpload(db, reserved.id);
    if (checked.state !== "clean") throw Error(checked.message);
  } catch (error) {
    throw new UploadPendingError(
      error instanceof Error
        ? error.message
        : "The upload remains pending. Retry or discard it.",
    );
  }
  return true;
}
// Called only after deleteClientRecords has validated the frozen, project-scoped
// manifest. Never accepts a browser-supplied bucket/path or lists other clients.
export async function removeFrozenUploadFiles(
  bucket: "project-files" | "client-assets",
  paths: string[],
) {
  const result = await worker().storage.from(bucket).remove(paths);
  if (result.error) throw Error("Private file cleanup failed.");
}
