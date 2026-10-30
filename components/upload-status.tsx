import type { ComponentType, ReactNode } from "react";
import type { FileSecurity, WorkspaceData } from "@/lib/workspace";
import {
  finishSecureUpload,
  discardSecureUpload,
  type Result,
} from "@/app/actions";
export function FileScanStatus({ file }: { file: FileSecurity }) {
  if (!file.scan_state) return null;
  return (
    <p className="helper-note file-scan-status">
      {file.scan_state === "clean"
        ? "Security checks passed. Sharing and release restrictions still apply."
        : file.scan_state === "legacy"
          ? "Existing file — no malware-check history recorded."
          : file.scan_state === "rejected"
            ? "File blocked by security checks. Download and sharing are disabled."
            : "Awaiting security checks. Download and sharing are disabled."}
    </p>
  );
}
export function UploadQueue({
  data,
  projectId,
  stageId,
  Form,
}: {
  data: Pick<WorkspaceData, "readOnly" | "pendingUploads">;
  projectId: string;
  stageId?: string | null;
  Form: ComponentType<{
    action: (f: FormData) => Promise<Result>;
    children: ReactNode;
    label?: string;
    className?: string;
  }>;
}) {
  const uploads = (data.pendingUploads ?? []).filter(
    (u) =>
      u.project_id === projectId &&
      (stageId === undefined || u.stage_id === stageId),
  );
  if (data.readOnly || !uploads.length) return null;
  return (
    <details className="settings-disclosure upload-queue">
      <summary>Uploads awaiting checks / cleanup ({uploads.length})</summary>
      {uploads.map((u) => (
        <div className="quarantined-file" key={u.id}>
          <b>{u.name}</b>
          <p>
            {u.status === "rejected"
              ? "Blocked — choose another file."
              : "Quarantined — not shared or downloadable."}
          </p>
          {u.status === "pending" && Date.parse(u.expires_at) > Date.now() && (
            <Form action={finishSecureUpload} label="Retry security check">
              <input name="uploadId" type="hidden" value={u.id} />
            </Form>
          )}
          <Form
            action={discardSecureUpload}
            label="Discard quarantined upload"
            className="secondary-action"
          >
            <input name="uploadId" type="hidden" value={u.id} />
          </Form>
        </div>
      ))}
    </details>
  );
}
