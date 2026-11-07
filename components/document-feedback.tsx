"use client";
import type { ComponentType, ReactNode } from "react";
import type { WorkspaceData, DbProject, DbDocument } from "@/lib/workspace";
import { submitFeedback, type Result } from "@/app/actions";
import { ReviewChecklist } from "./portal-guide";
type FormProps = {
  action: (form: FormData) => Promise<Result>;
  children: ReactNode;
  label?: string;
  className?: string;
};
export default function DocumentFeedback({
  data,
  project,
  document: d,
  Form,
}: {
  data: WorkspaceData;
  project: DbProject;
  document: DbDocument;
  Form: ComponentType<FormProps>;
}) {
  const admin = data.role === "admin";
  return (
    <details className="document-feedback">
      <summary>Feedback & review</summary>{" "}
      {data.feedback
        .filter((f) => f.document_id === d.id)
        .map((f) => (
          <div className="feedback-item" key={f.id}>
            <span className="pill">{f.decision.replaceAll("_", " ")}</span>
            <p>{f.body}</p>
            <small>
              {f.approver_name ?? "Name not recorded"} ·{" "}
              {f.reviewed_version ?? "Historical version not recorded"}
            </small>
            <small>{new Date(f.created_at).toLocaleDateString("en-GB")}</small>
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
              <option value="changes_requested">Request revisions</option>
              {d.category === "presentation" && (
                <option value="approved">Approve this presentation</option>
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
    </details>
  );
}
