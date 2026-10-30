"use client";
import SecureUpload from "./secure-upload";
import { FileScanStatus } from "./upload-status";
import { fileAvailable } from "@/lib/upload-policy";
import type { ComponentType, ReactNode } from "react";
import type { WorkspaceData, DbProject } from "@/lib/workspace";
import type { Result } from "@/app/actions";
import {
  saveBrief,
  saveClientAction,
  toggleClientAction,
  removeClientAction,
  uploadClientAsset,
} from "@/app/actions";
type FormProps = {
  action: (form: FormData) => Promise<Result>;
  children: ReactNode;
  label?: string;
  className?: string;
};
export default function ProjectManagement({
  data,
  project,
  Form,
}: {
  data: WorkspaceData;
  project: DbProject;
  Form: ComponentType<FormProps>;
}) {
  const admin = data.role === "admin",
    details = data.projectDetails?.find((d) => d.project_id === project.id),
    handover =
      data.handovers?.find((h) => h.project_id === project.id)?.body ?? "";
  if (!data.managementReady)
    return admin ? (
      <div className="banner">
        New project tools need the one-time project management database upgrade.
        Your current projects still work.{" "}
        <a
          href="https://github.com/KestrelBuilds/ABA/blob/main/supabase/migrations/202610280004_project_management.sql"
          target="_blank"
          rel="noreferrer"
        >
          Open setup file ↗
        </a>
      </div>
    ) : null;
  const actions = (data.clientActions ?? []).filter(
    (a) => a.project_id === project.id,
  );
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return (
    <div className="management-grid">
      <section className="panel" id="client-actions">
        <h2>{admin ? "Client actions" : "Your next actions"}</h2>
        <p>
          {admin
            ? "Tasks you’ve requested from this client. Completing an action does not record a payment or approve a design."
            : "These are the agreed tasks I need from you. Completing an action does not mark an invoice paid or approve a design."}
        </p>
        {actions.length ? (
          actions.map((a) => (
            <div className="client-action" key={a.id}>
              <div>
                <b>{a.title}</b>
                <small>
                  {a.due
                    ? "Due " +
                      new Date(a.due + "T12:00:00").toLocaleDateString("en-GB")
                    : "Date to be agreed"}
                  {a.due && a.due < today && a.status !== "Done"
                    ? " · Overdue"
                    : ""}
                </small>
                <span className="pill">{a.status}</span>
              </div>
              <Form
                action={toggleClientAction}
                label={a.status === "Done" ? "Mark to do" : "Mark done"}
              >
                <input type="hidden" name="id" value={a.id} />
                <input
                  type="hidden"
                  name="done"
                  value={String(a.status !== "Done")}
                />
              </Form>
              {admin && (
                <details>
                  <summary>Edit action</summary>
                  <Form action={saveClientAction} label="Save action">
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="projectId" value={project.id} />
                    <label>
                      Action
                      <input
                        name="title"
                        required
                        maxLength={180}
                        defaultValue={a.title}
                      />
                    </label>
                    <label>
                      Due date
                      <input
                        type="date"
                        name="due"
                        defaultValue={a.due ?? ""}
                      />
                    </label>
                  </Form>
                  <Form action={removeClientAction} label="Remove action">
                    <input type="hidden" name="id" value={a.id} />
                  </Form>
                </details>
              )}
            </div>
          ))
        ) : (
          <p>No client actions have been added yet.</p>
        )}
        {admin && (
          <details>
            <summary>Add a client action</summary>
            <Form action={saveClientAction} label="Add action">
              <input type="hidden" name="projectId" value={project.id} />
              <label>
                What needs doing?
                <input name="title" required maxLength={180} />
              </label>
              <label>
                Due date
                <input name="due" type="date" />
              </label>
            </Form>
          </details>
        )}
      </section>
      <section className="panel">
        <h2>Agreed project brief</h2>
        {(
          [
            ["goal", "Project goal"],
            ["deliverables", "Agreed deliverables"],
            ["exclusions", "Outside scope"],
            ["approver", "Nominated approver"],
            ["support", "Agreed support"],
          ] as const
        ).map(([key, label]) => (
          <div className="brief-field" key={key}>
            <b>{label}</b>
            <p>{details?.[key] || "To be confirmed with Alex."}</p>
          </div>
        ))}
        {handover && (
          <div className="brief-field">
            <b>Handover details</b>
            <p>{handover}</p>
          </div>
        )}
        {admin && (
          <details id="edit-project-brief">
            <summary>Edit brief & handover</summary>
            <Form action={saveBrief} label="Save brief">
              <input type="hidden" name="projectId" value={project.id} />
              {(
                [
                  ["goal", "Project goal", 6000],
                  ["deliverables", "Agreed deliverables", 6000],
                  ["exclusions", "Outside scope", 4000],
                  ["approver", "Nominated approver", 120],
                  ["support", "Agreed support", 4000],
                ] as const
              ).map(([key, label, max]) => (
                <label key={key}>
                  {label}
                  <textarea
                    name={key}
                    defaultValue={details?.[key] ?? ""}
                    maxLength={max}
                  />
                </label>
              ))}
              <label>
                Final handover details
                <textarea
                  name="handover"
                  defaultValue={handover}
                  maxLength={6000}
                />
              </label>
              <p>
                Final handover details stay hidden from clients until final
                approval and payment are recorded. Never put passwords in these
                fields.
              </p>
            </Form>
          </details>
        )}
      </section>
      <section className="panel" id="client-assets">
        <h2>Content & asset uploads</h2>
        <p>
          Share approved PDFs and PNG, JPEG or WebP images up to 3 MB each. ZIP,
          design-source and font files need an agreed sharing method for now.
          Please include licence information where relevant and never upload
          passwords.
        </p>
        {data.fileSecurityReady ? (
          <SecureUpload data={data} projectId={project.id} kind="asset" />
        ) : (
          <Form action={uploadClientAsset} label="Upload asset privately">
            <input type="hidden" name="projectId" value={project.id} />
            <label>
              File
              <input
                type="file"
                name="file"
                required
                accept="application/pdf,image/png,image/jpeg,image/webp"
              />
            </label>
          </Form>
        )}
        {(data.assets ?? [])
          .filter((a) => a.project_id === project.id)
          .map((a) => (
            <div key={a.id}>
              <FileScanStatus file={a} />
              {fileAvailable(a) ? (
                <a className="resource" href={"/assets/" + a.id}>
                  {a.name} · Download ↗
                </a>
              ) : (
                <b>{a.name}</b>
              )}
            </div>
          ))}
      </section>
    </div>
  );
}
