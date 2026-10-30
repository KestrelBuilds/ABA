"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { WorkspaceData } from "@/lib/workspace";
import { beginSecureUpload, finishSecureUpload } from "@/app/actions";
import {
  MAX_UPLOAD_BYTES,
  uploadAccept,
  uploadMime,
} from "@/lib/upload-policy";
export default function SecureUpload({
  data,
  projectId,
  stageId = null,
  kind,
  defaultCategory = "document",
  defaultRole = "General",
}: {
  data: WorkspaceData;
  projectId: string;
  stageId?: string | null;
  kind: "document" | "asset";
  defaultCategory?: string;
  defaultRole?: string;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [file, setFile] = useState<File | null>(null);
  const router = useRouter();
  const project = data.projects.find((p) => p.id === projectId);
  const readOnly = Boolean(data.readOnly || project?.archived_at);
  if (!data.secureUploadsConfigured)
    return (
      <p className="helper-note">
        {data.role === "admin"
          ? "Uploads are temporarily unavailable until the approved security scanner is connected. Existing permitted downloads remain available."
          : "File uploads are temporarily unavailable. Please contact me if you need to send a file. Existing permitted downloads remain available."}
      </p>
    );
  return (
    <form
      className="connected-form secure-upload"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy || readOnly || !file) return;
        const form = e.currentTarget,
          fields = new FormData(form);
        setBusy(true);
        setMessage("Preparing your private upload…");
        try {
          if (file.size < 1 || file.size > MAX_UPLOAD_BYTES)
            throw Error("Choose a file up to 25 MB.");
          uploadMime(file.name);
          const digest = await crypto.subtle.digest(
            "SHA-256",
            await file.arrayBuffer(),
          );
          const sha256 = Array.from(new Uint8Array(digest), (b) =>
            b.toString(16).padStart(2, "0"),
          ).join("");
          const start = await beginSecureUpload({
            projectId,
            stageId,
            kind,
            name: file.name,
            size: file.size,
            sha256,
            category: String(fields.get("category") ?? defaultCategory),
            role: String(fields.get("document_role") ?? defaultRole),
            version: String(fields.get("version_label") ?? "v1"),
            reviewDue: String(fields.get("review_due") ?? ""),
            originalContract: null,
          });
          if (!start.ok) throw Error(start.message);
          setMessage("Uploading your file privately…");
          const { createClient } = await import("@supabase/supabase-js");
          const client = createClient(start.upload.url, start.upload.key, {
            auth: {
              persistSession: false,
              autoRefreshToken: false,
              detectSessionInUrl: false,
            },
          });
          const uploaded = await client.storage
            .from(start.upload.bucket)
            .uploadToSignedUrl(start.upload.path, start.upload.token, file, {
              contentType: start.upload.mime,
              cacheControl: "0",
              upsert: false,
            });
          if (uploaded.error)
            throw Error(
              "Upload did not finish. Its pending record is available below for cleanup.",
            );
          setMessage("Checking file contents and malware scan…");
          const check = new FormData();
          check.set("uploadId", start.upload.id);
          const result = await finishSecureUpload(check);
          setMessage(result.message);
          if (result.ok) {
            form.reset();
            setFile(null);
          }
        } catch (error) {
          setMessage(
            error instanceof Error
              ? error.message
              : "The upload could not finish.",
          );
        } finally {
          setBusy(false);
          router.refresh();
        }
      }}
    >
      <fieldset className="action-fields" disabled={busy || readOnly}>
        {kind === "document" && (
          <>
            <label>
              Document type
              <select name="document_role" defaultValue={defaultRole}>
                {[
                  "General",
                  "Proposal",
                  "Contract",
                  "Invoice",
                  "Presentation",
                  "Handover",
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Release rule
              <select name="category" defaultValue={defaultCategory}>
                <option value="document">Project document</option>
                <option value="presentation">Design presentation</option>
                <option value="final">
                  Final deliverable — approval and payment required
                </option>
              </select>
            </label>
            <label>
              Version
              <input
                name="version_label"
                defaultValue="v1"
                maxLength={40}
                required
              />
            </label>
            <label>
              Review due (optional)
              <input name="review_due" type="date" />
            </label>
          </>
        )}
        <label>
          File
          <input
            name="file"
            type="file"
            accept={uploadAccept}
            required
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <p>
          PDF, PNG, JPEG, WebP, Illustrator or ZIP · up to 25 MB. Files stay
          unavailable until security checks pass. Sharing, contract and
          final-release checks still apply.
        </p>
        <button type="submit" className="primary" disabled={busy || !file}>
          {busy ? "Uploading / checking…" : "Upload file securely"}
        </button>
      </fieldset>
      {readOnly && <p>This project view is read-only.</p>}
      {message && (
        <p role="status" className="form-result">
          {message}
        </p>
      )}
    </form>
  );
}
