import { ArrowDownToLine, FileText } from "lucide-react";
import { uploadClientAsset, type Result } from "@/app/actions";
import { clientUploadsAllowed } from "@/lib/stage-access";
import { fileAvailable } from "@/lib/upload-policy";
import type { WorkspaceData, DbStage } from "@/lib/workspace";
import type { ComponentType, ReactNode } from "react";

type FormProps = {
  action: (form: FormData) => Promise<Result>;
  children: ReactNode;
  label?: string;
  className?: string;
};

export default function VisualIdentityWorkbook({
  data,
  stage,
  Form,
}: {
  data: WorkspaceData;
  stage: DbStage;
  Form: ComponentType<FormProps>;
}) {
  const admin = data.role === "admin";
  const returned = (data.assets ?? [])
    .filter(
      (asset) =>
        asset.project_id === stage.project_id &&
        asset.stage_id === stage.id &&
        asset.name === "Completed Visual Identity Workbook.pdf",
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

  return (
    <section
      className="visual-identity-workbook"
      aria-labelledby="visual-identity-title"
    >
      <header>
        <FileText size={22} aria-hidden="true" />
        <div>
          <h3 id="visual-identity-title">Visual identity workbook</h3>
          <p>
            Tell me what your brand is about, what matters to you and how you
            want people to experience it.
          </p>
        </div>
      </header>
      <a
        className="secondary action-link"
        href={`/workbook/${stage.project_id}`}
      >
        <ArrowDownToLine size={17} aria-hidden="true" /> Download the fillable
        workbook PDF
      </a>
      <p className="helper-note">
        Open the PDF in a PDF reader, complete the fields, save your copy and
        upload it here. The original PDF stays on your device until you return
        your completed copy.
      </p>
      {returned ? (
        <div className="workbook-return-status">
          {fileAvailable(returned) ? (
            <a href={`/assets/${returned.id}`}>
              Completed workbook received · download your returned copy ↗
            </a>
          ) : (
            <span>
              Completed workbook received and awaiting its file check.
            </span>
          )}
          {admin && (
            <small>
              Returned{" "}
              {new Date(returned.created_at).toLocaleDateString("en-GB")}
            </small>
          )}
        </div>
      ) : admin ? (
        <p className="workbook-return-status">
          No completed workbook has been returned yet.
        </p>
      ) : null}
      {!admin && clientUploadsAllowed(stage) && data.stageAccessReady && (
        <Form action={uploadClientAsset} label="Upload completed workbook">
          <input type="hidden" name="projectId" value={stage.project_id} />
          <input type="hidden" name="stageId" value={stage.id} />
          <input
            type="hidden"
            name="returnVisualIdentityWorkbook"
            value="yes"
          />
          <label>
            Completed workbook PDF
            <input
              name="file"
              type="file"
              accept="application/pdf,.pdf"
              required
            />
          </label>
          <p>PDF files up to 3 MB. You can upload a revised copy later.</p>
        </Form>
      )}
      {!admin && !data.stageAccessReady && (
        <p className="helper-note">
          Workbook returns will be available after the onboarding access update
          is enabled.
        </p>
      )}
    </section>
  );
}
