"use client";
import SecureUpload from "./secure-upload";
import { FileScanStatus, UploadQueue } from "./upload-status";
import { fileAvailable } from "@/lib/upload-policy";
import { useState, type ComponentType, type ReactNode } from "react";
import { Files, ArrowUpRight, Search } from "lucide-react";
import type { DbProject, WorkspaceData } from "@/lib/workspace";
import {
  uploadDocument,
  publishDocument,
  submitFeedback,
  type Result,
} from "@/app/actions";
import { fileVisibility } from "@/lib/file-visibility";
import {
  fileKinds,
  projectFiles,
  filterProjectFiles,
  groupProjectFiles,
} from "@/lib/project-files";
import { openProjectSection } from "./project-focus";
import { ReviewChecklist } from "./portal-guide";
type FormProps = {
  action: (form: FormData) => Promise<Result>;
  children: ReactNode;
  label?: string;
  className?: string;
};
export default function ProjectFiles({
  data,
  project,
  Form,
}: {
  data: WorkspaceData;
  project: DbProject;
  Form: ComponentType<FormProps>;
}) {
  const admin = data.role === "admin";
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [stage, setStage] = useState("all");
  const files = projectFiles(data, project.id);
  const stages = data.stages.filter((s) => s.project_id === project.id);
  const groups = groupProjectFiles(files, stages);
  const filtered = filterProjectFiles(files, stages, { query, kind, stage });
  const filteredGroups = groupProjectFiles(filtered, stages);
  const filteredView = query.trim() !== "" || kind !== "all" || stage !== "all";
  const reset = () => {
    setQuery("");
    setKind("all");
    setStage("all");
  };
  return (
    <section
      className="panel project-file-library"
      aria-labelledby={"files-title-" + project.id}
    >
      <h2 id={"files-title-" + project.id}>
        <Files size={18} />
        <span id="documents">All project files</span>
      </h2>
      <p>
        {admin
          ? "Find the same files used in the journey, organised by stage. Upload stage files inside their journey stage."
          : "Your shared project files and uploads, organised by journey stage."}
      </p>
      <UploadQueue data={data} projectId={project.id} Form={Form} />
      {admin && (
        <details className="library-upload">
          <summary>Upload a project-wide file</summary>
          <p>
            For files that belong to a particular step, upload inside that
            journey stage instead.
          </p>
          {data.fileSecurityReady ? (
            <SecureUpload data={data} projectId={project.id} kind="document" />
          ) : (
            <Form action={uploadDocument} label="Upload privately">
              <input type="hidden" name="projectId" value={project.id} />
              <label>
                Category
                <select name="category" defaultValue="document">
                  <option value="presentation">Design presentation</option>
                  <option value="document">Project document</option>
                  <option value="final">Final deliverable</option>
                </select>
              </label>
              {data.managementReady && (
                <>
                  <label>
                    Presentation version
                    <input
                      name="version_label"
                      defaultValue="v1"
                      required
                      maxLength={40}
                    />
                  </label>
                  <label>
                    Feedback due date
                    <input name="review_due" type="date" />
                  </label>
                </>
              )}
              <label>
                File
                <input
                  type="file"
                  name="file"
                  accept="application/pdf,image/png,image/jpeg,image/webp"
                  required
                />
              </label>
              <p>
                PDF, PNG, JPEG or WebP · 3 MB maximum. Uploads start
                unpublished.
              </p>
            </Form>
          )}
        </details>
      )}

      {!admin && (
        <p>
          Final deliverables appear after your final approval and payment have
          been confirmed.
        </p>
      )}
      {files.length > 0 && (
        <div className="library-filters">
          <label className="library-search">
            <span>
              <Search size={16} /> Search files
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="File name, stage or version"
            />
          </label>
          <label>
            File type
            <select
              aria-label="File type"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              <option value="all">All file types</option>
              {Object.entries(fileKinds)
                .filter(([key]) => files.some((f) => f.kind === key))
                .map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Journey stage
            <select
              aria-label="Journey stage"
              value={stage}
              onChange={(e) => setStage(e.target.value)}
            >
              <option value="all">All stages</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                  {g.stream ? " · " + g.stream : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <div className="library-result-summary">
        <p role="status" aria-live="polite">
          {filtered.length} of {files.length}{" "}
          {files.length === 1 ? "file" : "files"}
        </p>
        {filteredView && (
          <button type="button" className="secondary" onClick={reset}>
            Clear filters
          </button>
        )}
      </div>
      {files.length === 0 ? (
        <div className="library-empty">
          <h3>{admin ? "No files uploaded yet" : "No shared files yet"}</h3>
          <p>
            {admin
              ? "Open a journey stage to upload your proposal, contract or design work. Each file will also appear here."
              : "I’ll share files here as your project progresses. Your final files stay protected until approval and payment are confirmed."}
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="library-empty">
          <h3>No matching files</h3>
          <p>Try another name, file type or stage.</p>
          <button type="button" className="secondary" onClick={reset}>
            Show all files
          </button>
        </div>
      ) : null}
      {filteredGroups.map((group) => (
        <section
          className="library-stage"
          key={group.id}
          aria-label={group.name + " files"}
        >
          <div className="library-stage-heading">
            <div>
              <h3>{group.name}</h3>
              {group.stream && (
                <small>
                  {group.stream} · {group.files.length}{" "}
                  {group.files.length === 1 ? "file" : "files"}
                  {group.stage && !group.stage.visible
                    ? " · Internal only"
                    : ""}
                </small>
              )}
            </div>
            {group.stage && (
              <a
                className="resource"
                href={"#stage-" + group.id}
                onClick={(event) => {
                  event.preventDefault();
                  openProjectSection("#stage-" + group.id);
                }}
              >
                Open journey stage ↑
              </a>
            )}
          </div>
          {group.files.map((entry) => {
            if (entry.source === "asset") {
              const asset = entry.file;
              const original = asset.contract_document_id
                ? data.documents.find(
                    (d) =>
                      d.id === asset.contract_document_id &&
                      d.project_id === project.id,
                  )
                : null;
              return (
                <div className="document-item" key={"asset-" + asset.id}>
                  <b>{asset.name}</b>
                  <small>
                    {asset.contract_document_id
                      ? "Contract return"
                      : "Client upload"}
                    {original ? " · For " + original.name : ""}
                  </small>
                  {asset.contract_document_id && (
                    <p>
                      Returning a file does not verify a signature or payment. I
                      check these separately.
                    </p>
                  )}
                  <FileScanStatus file={asset} />
                  {fileAvailable(asset) && (
                    <a className="resource" href={"/assets/" + asset.id}>
                      Download client file securely <ArrowUpRight size={14} />
                    </a>
                  )}
                </div>
              );
            }
            const d = entry.file;
            const visibility = fileVisibility(
              d,
              project,
              stages,
              data.contractExchanges,
              data.prospectSpaces,
            );
            return (
              <div className="document-item" key={"document-" + d.id}>
                <b>{d.name}</b>
                <small>
                  {d.document_role && d.document_role !== "General"
                    ? d.document_role
                    : d.category === "presentation"
                      ? "Design presentation"
                      : d.category === "final"
                        ? "Final deliverable"
                        : "Project document"}
                  {d.version_label ? " · " + d.version_label : ""}
                  {d.review_due
                    ? " · Review by " +
                      new Date(d.review_due + "T12:00:00").toLocaleDateString(
                        "en-GB",
                      )
                    : ""}
                </small>
                {admin && (
                  <span className="pill library-sharing">
                    {!d.published
                      ? "Private draft"
                      : visibility.available
                        ? "Available to client"
                        : "Shared · access locked"}
                  </span>
                )}
                {admin && (
                  <p className="file-visibility">{visibility.message}</p>
                )}
                <FileScanStatus file={d} />
                {fileAvailable(d) && (
                  <a className="resource" href={"/files/" + d.id}>
                    Download securely <ArrowUpRight size={14} />
                  </a>
                )}
                {admin && fileAvailable(d) && (
                  <Form
                    action={publishDocument}
                    label={d.published ? "Unpublish" : "Publish to client"}
                  >
                    <input type="hidden" name="id" value={d.id} />
                    <input
                      type="hidden"
                      name="published"
                      value={String(!d.published)}
                    />
                  </Form>
                )}
                {data.feedback
                  .filter((f) => f.document_id === d.id)
                  .map((f) => (
                    <div className="feedback-item" key={f.id}>
                      <span className="pill">
                        {f.decision.replaceAll("_", " ")}
                      </span>
                      <p>{f.body}</p>
                      <small>
                        {f.approver_name ?? "Name not recorded"} ·{" "}
                        {f.reviewed_version ??
                          "Historical version not recorded"}
                      </small>
                      <small>
                        {new Date(f.created_at).toLocaleDateString("en-GB")}
                      </small>
                    </div>
                  ))}
                {!admin && (
                  <p>
                    {d.category === "presentation"
                      ? "What is working well? What needs changing, on which page or slide? Check text, images, links and factual details."
                      : "Have a question about this file? Leave a comment here. Return signed contracts in their journey stage."}
                  </p>
                )}
                {!admin && d.category === "presentation" && (
                  <ReviewChecklist type={project.type} />
                )}
                {!admin && (
                  <Form action={submitFeedback} label="Send feedback">
                    <input type="hidden" name="documentId" value={d.id} />
                    <label>
                      My response
                      <select name="decision">
                        <option value="comment">Comment</option>
                        <option value="changes_requested">
                          Request revisions
                        </option>
                        {d.category === "presentation" && (
                          <option value="approved">
                            Approve this presentation
                          </option>
                        )}
                      </select>
                    </label>
                    <label>
                      Feedback
                      <textarea name="body" required maxLength={4000} />
                    </label>
                    <p>
                      {d.category === "presentation"
                        ? "Approvals are recorded as creative feedback. They are not legal signatures."
                        : "Comments do not verify a signed contract or record a payment."}
                    </p>
                  </Form>
                )}
              </div>
            );
          })}
        </section>
      ))}
    </section>
  );
}
