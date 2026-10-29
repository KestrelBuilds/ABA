"use client";
import { useState, useEffect, type ComponentType, type ReactNode } from "react";
import type { DbProject, WorkspaceData } from "@/lib/workspace";
import { enquiryLabels, projectRelationship } from "@/lib/prospects";
import { discoveryBookingUrl } from "@/lib/stage-links";
import { saveProspectSpace, type Result } from "@/app/actions";
export default function ProspectManagement({
  data,
  project,
  Form,
}: {
  data: WorkspaceData;
  project: DbProject;
  Form: ComponentType<{
    action: (form: FormData) => Promise<Result>;
    children: ReactNode;
    label?: string;
  }>;
}) {
  const space = data.prospectSpaces?.find((s) => s.project_id === project.id),
    active = project.contract_signed && project.deposit_paid;
  const [shared, setShared] = useState(space?.enabled ?? false);
  useEffect(
    () => setShared(space?.enabled ?? false),
    [space?.enabled, project.id],
  );
  const stages = data.stages.filter((s) => s.project_id === project.id);
  const guess = (names: string[]) => {
    const matching = stages.filter(
      (s) => s.stream === "Onboarding" && names.includes(s.name),
    );
    return matching.length === 1 ? matching[0].id : "";
  };
  return (
    <details
      className="panel prospect-management"
      id="potential-client-settings"
      open={!active}
    >
      <summary>
        {active
          ? "Pre-project enquiry history"
          : "Potential client · discovery, proposal & onboarding"}
      </summary>
      <p className="section-description">
        {projectRelationship(data, project)}
        {space ? " · " + enquiryLabels[space.enquiry_status] : ""}. The client
        sees only the step you release, not the creative journey.
      </p>
      {!data.prospectReady ? (
        <p>
          The potential-client SQL update is needed before early invitations and
          proposal sharing can be enabled.
        </p>
      ) : (
        <Form action={saveProspectSpace} label="Save potential-client area">
          <input name="projectId" type="hidden" value={project.id} />
          <section className="form-section">
            <h3>1. Sharing & enquiry status</h3>
            <p>
              Choose whether an invited client can open this area. Saving these
              settings does not send an invitation.
            </p>
            <label className="check-row">
              <input
                name="enabled"
                type="checkbox"
                checked={shared}
                onChange={(e) => setShared(e.target.checked)}
              />
              Allow this client’s invited account into the potential-client area
            </label>
            <label>
              Enquiry status
              <select
                name="enquiry_status"
                defaultValue={space?.enquiry_status ?? "new"}
                key={space?.enquiry_status}
              >
                {Object.entries(enquiryLabels).map(([value, label]) => (
                  <option
                    key={value}
                    value={value}
                    disabled={active && value === "closed"}
                  >
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </section>
          <section className="form-section">
            <h3>2. Choose their next step</h3>
            <p>
              Release the next part when you’re ready. The creative journey
              stays hidden until contract and deposit verification.
            </p>
            <label>
              What the potential client can see
              <select
                name="release_step"
                defaultValue={space?.release_step ?? "discovery"}
                key={space?.release_step}
              >
                <option value="discovery">Discovery-call booking only</option>
                <option value="proposal">Discovery + proposal documents</option>
                <option value="agreement">
                  Discovery + proposal + contract & deposit documents
                </option>
              </select>
            </label>
            <label>
              Public Calendly booking URL
              <input
                name="booking_url"
                type="url"
                defaultValue={space?.booking_url ?? discoveryBookingUrl}
                required
              />
            </label>
          </section>
          <details className="settings-disclosure">
            <summary>Choose document stages</summary>
            <p>
              These stages supply the files for each step. Keep the suggested
              stages unless your journey uses a different layout.
            </p>
            {(
              [
                [
                  "proposal_stage_id",
                  "Proposal documents",
                  space?.proposal_stage_id,
                  guess(["Project Proposal"]),
                ],
                [
                  "contract_stage_id",
                  "Contract documents",
                  space?.contract_stage_id,
                  guess(["Contract", "Contract and Deposit"]),
                ],
                [
                  "invoice_stage_id",
                  "Deposit invoice documents",
                  space?.invoice_stage_id,
                  guess(["Invoice", "Contract and Deposit"]),
                ],
              ] as const
            ).map(([name, label, current, fallback]) => (
              <label key={name}>
                {label}
                <select
                  name={name}
                  defaultValue={current ?? fallback ?? ""}
                  key={String(current)}
                >
                  <option value="">No stage selected</option>
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {!s.visible ? " · internal (files stay hidden)" : ""}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <p className="helper-note">
              Only shared Project document files with matching Proposal,
              Contract or Invoice document types in the selected visible stages
              are included. Final files and creative stages remain private. Not
              proceeding closes early access; it does not delete the enquiry or
              send an email.
            </p>
          </details>
        </Form>
      )}
      {(data.proposalResponses ?? [])
        .filter((r) => r.project_id === project.id)
        .map((r) => (
          <div className="feedback-item" key={r.id}>
            <b>
              Proposal response:{" "}
              {r.decision === "interested"
                ? "Would like to proceed"
                : r.decision === "declined"
                  ? "Not proceeding"
                  : "Question"}
            </b>
            <p>{r.message}</p>
            <small>
              Records interest only; not a signed contract or payment. Update
              enquiry status and the released step after reviewing.
            </small>
          </div>
        ))}
    </details>
  );
}
