"use client";
import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Result } from "@/app/actions";
import type { PendingUpload } from "@/lib/workspace";
import { UploadQueue } from "./upload-status";
function QueueForm({
  action,
  children,
  label,
}: {
  action: (f: FormData) => Promise<Result>;
  children: ReactNode;
  label?: string;
}) {
  const [message, setMessage] = useState(""),
    [busy, start] = useTransition(),
    router = useRouter();
  return (
    <form
      className="connected-form"
      action={(form) =>
        start(async () => {
          try {
            setMessage((await action(form)).message);
          } catch {
            setMessage("The upload could not be updated. Please retry.");
          } finally {
            router.refresh();
          }
        })
      }
    >
      <fieldset disabled={busy} className="action-fields">
        {children}
        <button type="submit" className="secondary">
          {busy ? "Please wait…" : label}
        </button>
      </fieldset>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
export default function QuarantineInbox({
  uploads,
}: {
  uploads: PendingUpload[];
}) {
  if (!uploads.length) return null;
  return (
    <section className="panel quarantine-inbox">
      <h2>My pending uploads</h2>
      <p>
        These files have not been shared. Retry a security check or discard a
        blocked/expired upload.
      </p>
      {[...new Set(uploads.map((u) => u.project_id))].map((id) => (
        <UploadQueue
          key={id}
          data={{ pendingUploads: uploads }}
          projectId={id}
          Form={QueueForm}
        />
      ))}
    </section>
  );
}
