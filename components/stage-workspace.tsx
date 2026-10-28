"use client";
import type { ComponentType, ReactNode } from "react";
import type { WorkspaceData, DbStage } from "@/lib/workspace";
import type { Result } from "@/app/actions";
import {
  saveStageResources,
  uploadDocument,
  publishDocument,
  uploadClientAsset,
} from "@/app/actions";
import { discoveryBookingUrl } from "@/lib/stage-links";
import JourneyVerification from "./journey-verification";
import { stageVerification } from "@/lib/journey-verification";
import { stageGuidance } from "@/lib/stage-copy";
type FormProps = {
  action: (form: FormData) => Promise<Result>;
  children: ReactNode;
  label?: string;
  className?: string;
};
export default function StageWorkspace({
  data,
  stage,
  Form,
}: {
  data: WorkspaceData;
  stage: DbStage;
  Form: ComponentType<FormProps>;
}) {
  const admin = data.role === "admin",
    resource = data.stageResources?.find((r) => r.stage_id === stage.id),
    documents = data.documents.filter((d) => d.stage_id === stage.id),
    assets = (data.assets ?? []).filter((a) => a.stage_id === stage.id);
  const booking = resource
    ? resource.booking_url
    : /discovery call/i.test(stage.name)
      ? discoveryBookingUrl
      : "";
  const project = data.projects.find((p) => p.id === stage.project_id);
  const name = stage.name.toLowerCase();
  const briefStage =
    /discovery|questionnaire|brief/.test(name) && !name.includes("call");
  const questionnaire = /goodbye/.test(name)
    ? project?.final_paid && project?.final_approved
      ? "goodbye"
      : null
    : briefStage && stage.stream === "Brand Identity"
      ? "brand"
      : briefStage && stage.stream === "Website Design"
        ? "website"
        : null;
  return (
    <div className="stage-workspace">
      <p>{resource?.instructions || stageGuidance(stage.name)}</p>
      {admin && project && stageVerification(stage).length > 0 && (
        <JourneyVerification
          data={data}
          project={project}
          fields={stageVerification(stage)}
          Form={Form}
        />
      )}
      {admin && project && (
        <p>
          Client file access:{" "}
          {!(project.contract_signed && project.deposit_paid)
            ? "locked until the signed contract and deposit are verified."
            : !stage.visible
              ? "this stage is internal; its files stay private."
              : "shared files in this stage are available; final deliverables also need verified final approval and payment."}
        </p>
      )}
      {booking && (
        <a className="resource" href={booking} target="_blank" rel="noreferrer">
          Book a call with me ↗
        </a>
      )}
      {questionnaire && (
        <>
          <a
            className="resource"
            href={"#questionnaire-" + stage.project_id + "-" + questionnaire}
            onClick={() => {
              const section = document.getElementById(
                "questionnaire-" + stage.project_id + "-" + questionnaire,
              );
              if (section instanceof HTMLDetailsElement) section.open = true;
            }}
          >
            Open{" "}
            {questionnaire === "brand"
              ? "brand discovery"
              : questionnaire === "website"
                ? "website discovery"
                : "goodbye & feedback"}{" "}
            questionnaire ↓
          </a>
          {questionnaire !== "website" && (
            <a
              className="resource"
              href={
                questionnaire === "brand"
                  ? "https://tally.so/r/mRAXk9"
                  : "https://tally.so/r/Z9jk9o"
              }
              target="_blank"
              rel="noreferrer"
            >
              {questionnaire === "brand"
                ? "Logo Direction & Inspiration"
                : "Goodbye & feedback form"}{" "}
              ↗
            </a>
          )}
        </>
      )}
      {documents.length === 0 && (
        <p>
          No documents have been {admin ? "uploaded" : "shared"} for this stage
          yet.
        </p>
      )}
      {documents.map((d) => (
        <article className="stage-file" key={d.id}>
          <a className="resource" href={"/files/" + d.id}>
            {d.document_role ?? "Document"} · {d.name} ·{" "}
            {d.version_label ?? "v1"} ↗
          </a>
          {admin && (
            <Form
              action={publishDocument}
              label={d.published ? "Unpublish file" : "Share file with client"}
            >
              <input type="hidden" name="id" value={d.id} />
              <input
                type="hidden"
                name="published"
                value={String(!d.published)}
              />
              <p>
                {d.published ? "Published" : "Private draft"}
                {d.category === "final"
                  ? " · final approval/payment restrictions apply"
                  : ""}
              </p>
            </Form>
          )}
        </article>
      ))}
      {assets.map((a) => (
        <a className="resource" key={a.id} href={"/assets/" + a.id}>
          Returned client file · {a.name} ↗
        </a>
      ))}
      {data.finance?.ready ? (
        <>
          {admin && (
            <>
              <details>
                <summary>Edit stage instructions & booking link</summary>
                <Form action={saveStageResources} label="Save stage details">
                  <input type="hidden" name="stageId" value={stage.id} />
                  <label>
                    Client instructions
                    <textarea
                      name="instructions"
                      defaultValue={resource?.instructions ?? ""}
                      maxLength={6000}
                    />
                  </label>
                  <label>
                    Public Calendly booking URL
                    <input
                      name="booking_url"
                      type="url"
                      placeholder="https://calendly.com/your-booking-page"
                      defaultValue={booking}
                      maxLength={500}
                    />
                  </label>
                </Form>
              </details>
              <details>
                <summary>Upload my PDF or presentation for this stage</summary>
                <Form action={uploadDocument} label="Upload to this stage">
                  <input
                    type="hidden"
                    name="projectId"
                    value={stage.project_id}
                  />
                  <input type="hidden" name="stageId" value={stage.id} />
                  <label>
                    Document type
                    <select name="document_role">
                      <option>General</option>
                      <option>Proposal</option>
                      <option>Contract</option>
                      <option>Invoice</option>
                      <option>Presentation</option>
                      <option>Handover</option>
                    </select>
                  </label>
                  <label>
                    Release rule
                    <select name="category">
                      <option value="document">Project document</option>
                      <option value="presentation">Design presentation</option>
                      <option value="final">
                        Final deliverable (approval & payment required)
                      </option>
                    </select>
                  </label>
                  <label>
                    Version
                    <input
                      name="version_label"
                      defaultValue="v1"
                      maxLength={40}
                      required
                    />
                  </label>
                  <label>
                    Review date
                    <input name="review_due" type="date" />
                  </label>
                  <label>
                    File
                    <input
                      name="file"
                      type="file"
                      accept="application/pdf,image/png,image/jpeg,image/webp"
                      required
                    />
                  </label>
                  <p>
                    PDFs and supported images up to 3 MB. Uploads are private
                    drafts until you share them. Proposal, contract and invoice
                    PDFs made in Illustrator are welcome; the built-in finance
                    tools are optional.
                  </p>
                </Form>
              </details>
            </>
          )}
          {!admin && (
            <details>
              <summary>Return a completed PDF or upload a file</summary>
              <Form
                action={uploadClientAsset}
                label="Upload my file to this stage"
              >
                <input
                  type="hidden"
                  name="projectId"
                  value={stage.project_id}
                />
                <input type="hidden" name="stageId" value={stage.id} />
                <label>
                  File
                  <input
                    name="file"
                    type="file"
                    accept="application/pdf,image/png,image/jpeg,image/webp"
                    required
                  />
                </label>
                <p>
                  PDFs and supported images up to 3 MB. A returned signed copy
                  will be checked by Alex; uploading it does not automatically
                  sign a contract or confirm payment.
                </p>
              </Form>
            </details>
          )}
        </>
      ) : admin ? (
        <p>
          Stage document tools need the business documents/stage setup upgrade.
          Your current project library still works.
        </p>
      ) : null}
    </div>
  );
}
