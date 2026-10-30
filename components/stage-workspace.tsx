"use client";
import SecureUpload from "./secure-upload";
import { FileScanStatus, UploadQueue } from "./upload-status";
import { fileAvailable } from "@/lib/upload-policy";
import type { ComponentType, ReactNode } from "react";
import { ArrowDownToLine, FileText } from "lucide-react";
import type { WorkspaceData, DbStage } from "@/lib/workspace";
import type { Result } from "@/app/actions";
import {
  saveStageResources,
  setContractExchange,
  uploadDocument,
  publishDocument,
  uploadClientAsset,
} from "@/app/actions";
import { discoveryBookingUrl } from "@/lib/stage-links";
import JourneyVerification from "./journey-verification";
import { fileVisibility } from "@/lib/file-visibility";
import { stageVerification } from "@/lib/journey-verification";
import { stageGuidance } from "@/lib/stage-copy";
import { stageFileDefaults } from "@/lib/handover";
import { openProjectSection } from "./project-focus";
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
    : /^(discovery call|enquiry stage)$/i.test(stage.name.trim())
      ? discoveryBookingUrl
      : "";
  const project = data.projects.find((p) => p.id === stage.project_id);
  const name = stage.name.toLowerCase();
  const defaults = stageFileDefaults(stage);
  const briefStage =
    /discovery|questionnaire|brief/.test(name) && !name.includes("call");
  const questionnaire = /goodbye/.test(name)
    ? project?.final_paid && project?.final_approved
      ? "goodbye"
      : null
    : name === "onboarding" && stage.stream === "Onboarding" && project
      ? project.type === "Website Design"
        ? "website"
        : "brand"
      : briefStage && stage.stream === "Brand Identity"
        ? "brand"
        : briefStage && stage.stream === "Website Design"
          ? "website"
          : null;
  return (
    <div className="stage-workspace">
      <p>{resource?.instructions || stageGuidance(stage.name)}</p>
      {admin && data.managementReady && defaults.category === "final" && (
        <a
          className="resource"
          href="#handover-preparation"
          onClick={() => openProjectSection("#handover-preparation")}
        >
          Prepare handover & goodbye packet ↓
        </a>
      )}
      {admin && project && stageVerification(stage).length > 0 && (
        <JourneyVerification
          data={data}
          project={project}
          fields={stageVerification(stage)}
          Form={Form}
        />
      )}
      {admin && project && (
        <p className="helper-note stage-access-note">
          Full portal file access:{" "}
          {!(project.contract_signed && project.deposit_paid)
            ? data.prospectSpaces?.some((s) => s.project_id === project.id)
              ? "locked until the signed contract and deposit are verified. Early documents follow the step released in the potential-client area."
              : "locked until the signed contract and deposit are verified. An enabled initial contract area is separate and only exposes shared contracts."
            : !stage.visible
              ? "this stage is internal; its files stay private."
              : "shared files in this stage are available; final deliverables also need verified final approval and payment."}
        </p>
      )}
      {admin &&
        data.contractReady &&
        !data.prospectSpaces?.some((x) => x.project_id === stage.project_id) &&
        (documents.some((d) => d.document_role === "Contract") ||
          data.contractExchanges?.some((x) => x.stage_id === stage.id)) && (
          <details>
            <summary>Initial contract area</summary>
            <p>
              Only shared Contract PDFs with Project document release rules in
              this client-visible stage can be opened before onboarding. Other
              files, stages and questionnaires stay locked. One initial contract
              stage per project.
            </p>
            <Form
              action={setContractExchange}
              label={
                data.contractExchanges?.some(
                  (x) => x.stage_id === stage.id && x.enabled,
                )
                  ? "Disable initial contract area"
                  : "Enable initial contract area"
              }
            >
              <input type="hidden" name="stageId" value={stage.id} />
              <input
                type="hidden"
                name="enabled"
                value={String(
                  !data.contractExchanges?.some(
                    (x) => x.stage_id === stage.id && x.enabled,
                  ),
                )}
              />
              {!data.contractExchanges?.some(
                (x) => x.stage_id === stage.id && x.enabled,
              ) && (
                <label className="check-row">
                  <input name="confirmed" type="checkbox" required />
                  Allow this project’s invited client to download shared
                  contracts and return signed copies before the full portal
                  unlocks.
                </label>
              )}
            </Form>
            {data.contractExchanges?.some(
              (x) => x.stage_id === stage.id && x.enabled,
            ) && (
              <a
                className="resource"
                href={"/contracts?projectId=" + stage.project_id}
              >
                Preview initial contract area ↗
              </a>
            )}
          </details>
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
          {name === "onboarding" && project?.type === "Both" && (
            <a
              className="resource"
              href={"#questionnaire-" + stage.project_id + "-website"}
              onClick={() => {
                const section = document.getElementById(
                  "questionnaire-" + stage.project_id + "-website",
                );
                if (section instanceof HTMLDetailsElement) section.open = true;
              }}
            >
              Open website discovery questionnaire ↓
            </a>
          )}
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
      <h3 className="files-heading">Files for this stage</h3>
      <UploadQueue
        data={data}
        projectId={stage.project_id}
        stageId={stage.id}
        Form={Form}
      />
      {documents.length === 0 && (
        <p>
          No documents have been {admin ? "uploaded" : "shared"} for this stage
          yet.
        </p>
      )}
      {documents.map((d) => (
        <article className="stage-file" key={d.id}>
          <header className="document-heading">
            <span className="document-icon">
              <FileText size={22} aria-hidden="true" />
            </span>
            <div>
              <h4>{d.document_role ?? "Document"}</h4>
              <p>
                {d.name} · {d.version_label ?? "v1"}
              </p>
            </div>
          </header>
          <FileScanStatus file={d} />
          {fileAvailable(d) && (
            <a
              className="secondary action-link"
              href={"/files/" + d.id}
              aria-label={"Download " + d.name}
            >
              <ArrowDownToLine size={17} aria-hidden="true" /> Download file
            </a>
          )}
          {admin && project && (
            <p className="file-visibility">
              {
                fileVisibility(
                  d,
                  project,
                  data.stages,
                  data.contractExchanges,
                  data.prospectSpaces,
                ).message
              }
            </p>
          )}
          {admin && fileAvailable(d) && (
            <Form
              action={publishDocument}
              label={d.published ? "Unpublish file" : "Share file with client"}
              className={d.published ? "secondary-action" : ""}
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
      {assets.length > 0 && <h3 className="files-heading">Client returns</h3>}
      {assets.map((a) => (
        <div className="resource" key={a.id}>
          {fileAvailable(a) ? (
            <a href={"/assets/" + a.id}>Returned client file · {a.name} ↗</a>
          ) : (
            <b>{a.name}</b>
          )}
          <FileScanStatus file={a} />
        </div>
      ))}
      {data.finance?.ready ? (
        <>
          {admin && (
            <>
              <details className="settings-disclosure">
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
              <details className="settings-disclosure stage-upload">
                <summary>Upload my PDF or presentation for this stage</summary>
                {data.fileSecurityReady ? (
                  <SecureUpload
                    data={data}
                    projectId={stage.project_id}
                    stageId={stage.id}
                    kind="document"
                    defaultCategory={defaults.category}
                    defaultRole={defaults.role}
                  />
                ) : (
                  <Form action={uploadDocument} label="Upload to this stage">
                    <input
                      type="hidden"
                      name="projectId"
                      value={stage.project_id}
                    />
                    <input type="hidden" name="stageId" value={stage.id} />
                    <label>
                      Document type
                      <select name="document_role" defaultValue={defaults.role}>
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
                      <select name="category" defaultValue={defaults.category}>
                        <option value="document">Project document</option>
                        <option value="presentation">
                          Design presentation
                        </option>
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
                      drafts until you share them. Proposal, contract and
                      invoice PDFs made in Illustrator belong here. Clients can
                      download shared files and return completed copies in this
                      stage.
                    </p>
                    {defaults.category === "final" && (
                      <p className="helper-note">
                        This stage starts with the Final deliverable rule, so
                        shared files stay locked until final approval and
                        payment are verified. You can change the rule for a file
                        which needs earlier review.
                      </p>
                    )}
                  </Form>
                )}
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
