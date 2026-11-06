"use client";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import type { DbDocument, WorkspaceData } from "@/lib/workspace";
import { savePresentationReviewDate, type Result } from "@/app/actions";

type FormProps = {
  action: (form: FormData) => Promise<Result>;
  children: ReactNode;
  label?: string;
  className?: string;
};

export default function PresentationReviewDate({
  document,
  data,
  Form,
}: {
  document: DbDocument;
  data: WorkspaceData;
  Form: ComponentType<FormProps>;
}) {
  const [due, setDue] = useState(document.review_due ?? "");
  useEffect(() => {
    setDue(document.review_due ?? "");
  }, [document.id, document.review_due]);
  if (document.category !== "presentation" || !data.managementReady)
    return null;
  const responded = data.feedback.some(
    (f) =>
      f.document_id === document.id &&
      (f.decision === "approved" || f.decision === "changes_requested"),
  );
  return (
    <div
      className="presentation-review-date"
      role="group"
      aria-label={"Review date for " + document.name}
    >
      <p>
        {document.review_due ? (
          <>
            Review by{" "}
            <time dateTime={document.review_due}>
              {new Intl.DateTimeFormat("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
                timeZone: "Europe/London",
              }).format(new Date(document.review_due + "T12:00:00Z"))}
            </time>
          </>
        ) : (
          "Review date to be agreed."
        )}
      </p>
      {data.role === "admin" && (
        <details>
          <summary>Change review date</summary>
          <Form
            action={savePresentationReviewDate}
            label="Save review date"
            key={document.id + ":" + (document.review_due ?? "")}
          >
            <input type="hidden" name="id" value={document.id} />
            <label>
              Feedback due date
              <input
                name="review_due"
                type="date"
                value={due}
                onChange={(event) => setDue(event.target.value)}
              />
            </label>
            <p>
              Leave empty to clear the date. Agree changes with your client;
              saving does not send a notification.
            </p>
            {responded && (
              <p>
                This version already has a review response. Changing its date
                keeps that response and does not reopen the review in Dates
                &amp; deadlines. Upload a new version for design changes.
              </p>
            )}
          </Form>
        </details>
      )}
    </div>
  );
}
