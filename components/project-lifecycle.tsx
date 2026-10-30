"use client";
import type { ComponentType, ReactNode } from "react";
import type { DbProject, WorkspaceData } from "@/lib/workspace";
import { archiveProject, type Result } from "@/app/actions";
const labels: Record<string, string> = {
  contract_signed: "Signed contract",
  deposit_paid: "50% deposit",
  final_paid: "Final payment",
  final_approved: "Overall final approval",
  brand_approved: "Branding approval",
  website_approved: "Website approval",
};
export default function ProjectLifecycle({
  data,
  project,
  Form,
}: {
  data: WorkspaceData;
  project: DbProject;
  Form: ComponentType<{
    action: (f: FormData) => Promise<Result>;
    children: ReactNode;
    label?: string;
    className?: string;
  }>;
}) {
  if (data.role !== "admin") return null;
  const events = (data.verificationHistory ?? []).filter(
    (e) => e.project_id === project.id,
  );
  const undated = (
    ["contract_signed", "deposit_paid", "final_paid", "final_approved"] as const
  ).filter(
    (f) => project[f] && !events.some((e) => e.field === f && e.confirmed),
  );
  return (
    <details className="panel project-lifecycle" id="project-history">
      <summary>Project history & archiving</summary>
      {!data.lifecycleReady ? (
        <p>
          Database update 012 enables archiving and dated verification history.
          Existing projects and checks are unchanged.
        </p>
      ) : (
        <>
          <h3>Verification history</h3>
          <p>
            New checks record who acted and when. Evidence references describe
            what was checked; they are not bank receipts or automatic
            legal-signature verification.
          </p>
          {undated.length > 0 && (
            <p className="helper-note">
              Earlier checks have no recorded date:{" "}
              {undated.map((f) => labels[f]).join(", ")}. No historical dates
              have been invented.
            </p>
          )}
          {events.length ? (
            <ol className="verification-history">
              {events.map((e) => (
                <li key={e.id}>
                  <b>
                    {labels[e.field] ?? e.field} —{" "}
                    {e.confirmed ? "verified" : "verification removed"}
                  </b>
                  <small>
                    {new Date(e.recorded_at).toLocaleString("en-GB", {
                      timeZone: "Europe/London",
                    })}{" "}
                    ·{" "}
                    {e.actor_id
                      ? "Owner action"
                      : "System / no account recorded"}{" "}
                    ·{" "}
                    {e.source === "native_invoice"
                      ? "Existing invoice payment"
                      : e.source === "stream_approval"
                        ? "Workstream check"
                        : e.source === "owner_check"
                          ? "Explicit owner check"
                          : "Project record changed"}
                  </small>
                  {e.reference && <p>{e.reference}</p>}
                  {e.occurred_on && (
                    <p>Evidence date supplied: {e.occurred_on}</p>
                  )}
                  {e.document_label && (
                    <p>Document at the time: {e.document_label}</p>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p>No new verification events recorded yet.</p>
          )}
          <h3>
            {project.archived_at ? "Archived project" : "Archive this project"}
          </h3>
          <p>
            Archiving keeps records and files and removes the project from
            active views. Choose whether existing client access stays available
            as read-only, or is suspended. Hidden/unpublished and final-file
            checks still apply.
          </p>
          <Form
            key={
              project.id +
              String(project.archived_at) +
              project.archived_client_access
            }
            action={archiveProject}
            label={project.archived_at ? "Restore project" : "Archive project"}
          >
            <input type="hidden" name="projectId" value={project.id} />
            <input
              type="hidden"
              name="archived"
              value={String(!project.archived_at)}
            />
            {project.archived_at ? (
              <>
                <input name="client_access" type="hidden" value="retain" />
                <p>
                  Current client access:{" "}
                  {project.archived_client_access === "suspend"
                    ? "suspended"
                    : "retained, read-only"}
                  . Restoring re-enables existing access subject to the usual
                  sharing and verification checks. It does not invite anyone or
                  publish files.
                </p>
              </>
            ) : (
              <label>
                Client access after archiving
                <select name="client_access" defaultValue="" required>
                  <option value="" disabled>
                    Choose client access
                  </option>
                  <option value="retain">
                    Retain existing access, read-only
                  </option>
                  <option value="suspend">
                    Suspend access to this project
                  </option>
                </select>
              </label>
            )}
            <label className="check-row">
              <input name="acknowledged" type="checkbox" required />
              {project.archived_at
                ? "I want to restore this project and its existing access rules."
                : "I understand and confirm the selected client access decision."}
            </label>
          </Form>
        </>
      )}
    </details>
  );
}
