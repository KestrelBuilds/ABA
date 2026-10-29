"use client";
import type { ComponentType, ReactNode } from "react";
import type { WorkspaceData, DbProject } from "@/lib/workspace";
import { verifyJourneyRecord, type Result } from "@/app/actions";
import {
  verificationLabels,
  type VerificationField,
} from "@/lib/journey-verification";
const verificationTitles: Record<VerificationField, string> = {
  contract_signed: "Signed contract",
  deposit_paid: "50% deposit",
  final_approved: "Final approval",
  final_paid: "Final payment",
};
export default function JourneyVerification({
  data,
  project,
  fields,
  Form,
}: {
  data: WorkspaceData;
  project: DbProject;
  fields: VerificationField[];
  Form: ComponentType<{
    action: (form: FormData) => Promise<Result>;
    children: ReactNode;
    label?: string;
    className?: string;
  }>;
}) {
  return (
    <div className="journey-verification">
      <h3>Review & verify</h3>
      <p>
        Confirm only after checking the actual contract, payment or approval.
        Progress changes and uploaded PDFs do not verify these records.
      </p>
      {fields.map((field) => {
        const invoice =
          (field === "deposit_paid" || field === "final_paid") &&
          data.finance?.invoices.find(
            (i) => i.project_id === project.id && i.status !== "Void",
          );
        return (
          <div className="verification-record" key={field}>
            <div className="verification-heading">
              <b>{verificationTitles[field]}</b>
              <span
                className={
                  project[field]
                    ? "status-badge status-verified"
                    : "status-badge"
                }
              >
                {project[field] ? "Verified" : "Not verified"}
              </span>
            </div>
            {invoice ? (
              <p>
                An existing invoice controls this payment. Use its Record full
                payment action in{" "}
                <a href="#existing-invoices">Previous generated documents</a>.
              </p>
            ) : (
              <Form
                key={project.id + field + String(project[field])}
                action={verifyJourneyRecord}
                className={project[field] ? "verification-remove" : ""}
                label={
                  project[field]
                    ? "Remove verification"
                    : field === "contract_signed"
                      ? "Verify signed contract"
                      : field === "deposit_paid"
                        ? "Verify 50% deposit"
                        : field === "final_paid"
                          ? "Verify final payment"
                          : "Verify final approval"
                }
              >
                <input type="hidden" name="projectId" value={project.id} />
                <input type="hidden" name="field" value={field} />
                <input
                  type="hidden"
                  name="confirmed"
                  value={String(!project[field])}
                />
                <label className="check-row">
                  <input name="acknowledged" type="checkbox" required />
                  {project[field]
                    ? "I intend to remove this verification and restore the relevant access restrictions."
                    : verificationLabels[field]}
                </label>
              </Form>
            )}
          </div>
        );
      })}
    </div>
  );
}
