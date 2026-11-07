"use client";
import type { ComponentType, ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { submitQuestionnaire, type Result } from "@/app/actions";
import { questionnairePrompts, optionalQuestion } from "@/lib/questionnaires";
import { questionnaireStage } from "@/lib/stage-access";
import type { WorkspaceData, DbStage, DbProject } from "@/lib/workspace";
type FormProps = {
  action: (form: FormData) => Promise<Result>;
  children: ReactNode;
  label?: string;
  className?: string;
};
export default function StageQuestionnaires({
  data,
  stage,
  project,
  Form,
}: {
  data: WorkspaceData;
  stage: DbStage;
  project: DbProject;
  Form: ComponentType<FormProps>;
}) {
  const admin = data.role === "admin";
  const kinds = [
    project.type !== "Website Design" ? "brand" : null,
    project.type !== "Brand Identity" ? "website" : null,
    project.final_paid && project.final_approved ? "goodbye" : null,
  ].filter(Boolean);
  if (
    !kinds.some(
      (kind) =>
        questionnaireStage(data.stages, project, kind!)?.id === stage.id,
    )
  )
    return null;
  return (
    <div className="stage-questionnaires">
      <h3>
        {kinds.includes("goodbye") &&
        questionnaireStage(data.stages, project, "goodbye")?.id === stage.id
          ? "Project feedback"
          : "Your project brief"}
      </h3>
      <p>
        This brief builds on your enquiry and initial chat. Short answers are
        welcome. For combined work, complete the shared essentials once in Brand
        discovery. Please arrange account invitations separately rather than
        sharing passwords.
      </p>
      {(["brand", "website", "goodbye"] as const)
        .filter((kind) =>
          kind === "brand"
            ? project.type !== "Website Design"
            : kind === "website"
              ? project.type !== "Brand Identity"
              : project.final_paid && project.final_approved,
        )
        .filter(
          (kind) =>
            questionnaireStage(data.stages, project, kind)?.id === stage.id,
        )
        .map((kind) => {
          const response = data.questionnaires.find(
            (q) => q.project_id === project.id && q.kind === kind,
          );
          return (
            <details
              className="questionnaire"
              id={"questionnaire-" + project.id + "-" + kind}
              key={project.id + kind}
            >
              <summary>
                {kind === "brand"
                  ? "Brand discovery"
                  : kind === "website"
                    ? "Website discovery"
                    : "Goodbye & feedback"}{" "}
                {response ? "· Submitted" : ""}
              </summary>
              {response ? (
                <>
                  <p>
                    Submitted{" "}
                    {new Date(response.submitted_at).toLocaleDateString(
                      "en-GB",
                    )}
                    . Contact Alex if you need to change an answer.
                  </p>
                  {Object.entries(response.answers).map(([key, value]) => (
                    <div className="answer" key={key}>
                      <b>
                        {questionnairePrompts(kind, project.type).find(
                          ([id]) => id === key,
                        )?.[1] ?? key}
                      </b>
                      <p>{value}</p>
                    </div>
                  ))}
                </>
              ) : admin ? (
                <p>
                  Your client can complete this questionnaire in their portal.
                </p>
              ) : (
                <Form action={submitQuestionnaire} label="Send my answers">
                  <input type="hidden" name="projectId" value={project.id} />
                  <input type="hidden" name="kind" value={kind} />
                  {questionnairePrompts(kind, project.type).map(
                    ([key, prompt]) => (
                      <label key={key}>
                        {prompt}
                        <textarea
                          name={"answer_" + key}
                          required={!optionalQuestion(kind, key)}
                          maxLength={4000}
                        />
                      </label>
                    ),
                  )}
                  <p>
                    Answers are saved once submitted. Please check them before
                    sending.
                  </p>
                </Form>
              )}
              {kind === "brand" && (
                <a
                  className="resource"
                  href="https://tally.so/r/mRAXk9"
                  target="_blank"
                  rel="noreferrer"
                >
                  Logo Direction & Inspiration <ArrowUpRight size={14} />
                </a>
              )}
              {kind === "goodbye" && (
                <a
                  className="resource"
                  href="https://tally.so/r/Z9jk9o"
                  target="_blank"
                  rel="noreferrer"
                >
                  Existing goodbye form <ArrowUpRight size={14} />
                </a>
              )}
            </details>
          );
        })}
    </div>
  );
}
