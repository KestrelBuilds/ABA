"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteClient, type Result } from "@/app/actions";
import type { DbClient } from "@/lib/workspace";
export default function DeleteClient({
  client,
  projectCount,
  fileCount,
  blocked,
  onDeleted,
}: {
  client: DbClient;
  projectCount: number;
  fileCount: number;
  blocked: boolean;
  onDeleted: (message: string) => void;
}) {
  const [result, setResult] = useState<Result | null>(null),
    [pending, start] = useTransition();
  const router = useRouter();
  return (
    <details className="client-delete">
      <summary>Delete client permanently</summary>
      {blocked ? (
        <p>
          This client has previous generated financial records. Keep its history
          and revoke access instead.
        </p>
      ) : (
        <>
          <p>
            This permanently removes <b>{client.name}</b>, {projectCount} linked
            project{projectCount === 1 ? "" : "s"}, all their documents, signed
            returns and other uploads ({fileCount} listed files), and client
            access. It cannot be undone.
          </p>
          <p>
            Audit history and the underlying sign-in account are retained for
            security. That account will have no access to this client.
          </p>
          {client.deletion_pending && (
            <p role="status">
              Deletion is paused and access is revoked. Retry to finish removing
              remaining files and records.
            </p>
          )}
          <form
            className="connected-form"
            action={(form) =>
              start(async () => {
                try {
                  const value = await deleteClient(form);
                  setResult(value.ok ? null : value);
                  if (value.ok) onDeleted(value.message);
                } catch {
                  setResult({
                    ok: false,
                    message:
                      "Deletion could not finish. Retry to check cleanup status.",
                  });
                } finally {
                  router.refresh();
                }
              })
            }
          >
            <fieldset disabled={pending}>
              <input name="clientId" type="hidden" value={client.id} />
              <label>
                Type the exact business name to confirm
                <input
                  name="confirmation"
                  required
                  autoComplete="off"
                  maxLength={120}
                />
              </label>
              <label className="check-row">
                <input name="confirmed" type="checkbox" required />I understand
                this permanently removes this client’s projects and files.
              </label>
              <button className="secondary" disabled={pending}>
                {pending
                  ? "Deleting…"
                  : client.deletion_pending
                    ? "Retry client deletion"
                    : "Permanently delete client"}
              </button>
              {result && (
                <p role={result.ok ? "status" : "alert"}>{result.message}</p>
              )}
            </fieldset>
          </form>
        </>
      )}
    </details>
  );
}
