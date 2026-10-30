"use client";
import type { ComponentType, ReactNode } from "react";
import type { WorkspaceData, DbProject } from "@/lib/workspace";
import VerificationEvidence from "./verification-evidence";
import {
  enableSeparateApprovals,
  verifyStreamApproval,
  verifyJourneyRecord,
  type Result,
} from "@/app/actions";
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
      {data.lifecycleReady &&
        project.type === "Both" &&
        !project.separate_approvals &&
        fields.includes("final_approved") && (
          <details className="settings-disclosure">
            <summary>Use separate branding and website approvals</summary>
            <p>
              Existing overall approval is retained until you choose this.
              Enabling separate checks resets overall final approval and can
              lock final files until both workstreams are checked again.
            </p>
            <Form
              action={enableSeparateApprovals}
              label="Enable separate approval checks"
            >
              <input name="projectId" type="hidden" value={project.id} />
              <label className="check-row">
                <input name="acknowledged" type="checkbox" required />I want to
                replace the overall approval with separate pending checks and
                understand the final-file access effect.
              </label>
            </Form>
          </details>
        )}
      {fields.map((field) => {
        const invoice =
          (field === "deposit_paid" || field === "final_paid") &&
          data.finance?.invoices.find(
            (i) => i.project_id === project.id && i.status !== "Void",
          );
        if (
          field === "final_approved" &&
          data.lifecycleReady &&
          project.separate_approvals
        )
          return (
            <div className="verification-record" key={field}>
              <h4>Final approval — both workstreams</h4>
              <p>
                Check branding and website work separately. Both are required
                for overall approval; final payment is still a separate check.
              </p>
              {(["Brand Identity", "Website Design"] as const).map((stream) => {
                const approved =
                  (data.streamApprovals ?? []).find(
                    (a) => a.project_id === project.id && a.stream === stream,
                  )?.confirmed ?? false;
                return (
                  <div className="stream-verification" key={stream}>
                    <b>{stream}</b>
                    <span
                      className={
                        approved
                          ? "status-badge status-verified"
                          : "status-badge"
                      }
                    >
                      {approved ? "Verified" : "Not verified"}
                    </span>
                    <Form
                      key={stream + String(approved)}
                      action={verifyStreamApproval}
                      label={
                        approved
                          ? "Remove " + stream + " approval"
                          : "Verify " + stream + " approval"
                      }
                    >
                      <input
                        name="projectId"
                        type="hidden"
                        value={project.id}
                      />
                      <input name="workstream" type="hidden" value={stream} />
                      <input
                        name="confirmed"
                        type="hidden"
                        value={String(!approved)}
                      />
                      <VerificationEvidence
                        data={data}
                        project={project}
                        workstream={stream}
                        dated={false}
                      />
                      <label className="check-row">
                        <input type="checkbox" name="acknowledged" required />
                        {approved
                          ? "I intend to remove this workstream approval and restore final-file restrictions."
                          : "I have checked final creative approval for this workstream."}
                      </label>
                    </Form>
                  </div>
                );
              })}
            </div>
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
                {data.lifecycleReady && (
                  <VerificationEvidence
                    data={data}
                    project={project}
                    dated={!project[field]}
                  />
                )}
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
