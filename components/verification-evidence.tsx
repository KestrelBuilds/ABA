import type { DbProject, WorkspaceData } from "@/lib/workspace";
export default function VerificationEvidence({
  data,
  project,
  workstream,
  dated = true,
}: {
  data: WorkspaceData;
  project: DbProject;
  workstream?: string;
  dated?: boolean;
}) {
  const documents = data.documents.filter(
    (d) =>
      d.project_id === project.id &&
      (!workstream ||
        (d.category === "presentation" &&
          data.stages.some(
            (s) => s.id === d.stage_id && s.stream === workstream,
          ))),
  );
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return (
    <details className="settings-disclosure evidence-fields">
      <summary>Add evidence details (optional)</summary>
      <label>
        Reference or note
        <input
          name="reference"
          maxLength={500}
          placeholder="For example, a payment reference or approval email"
        />
      </label>
      {dated && (
        <label>
          Signature/payment date, if known
          <input name="occurred_on" type="date" max={today} />
        </label>
      )}
      <label>
        Related document
        <select name="documentId" defaultValue="">
          <option value="">No document reference</option>
          {documents.map((d) => (
            <option value={d.id} key={d.id}>
              {d.name} · {d.version_label ?? "v1"}
            </option>
          ))}
        </select>
      </label>
      <p>
        The time of this check is recorded automatically. Leave historical dates
        blank if you do not know them.
      </p>
    </details>
  );
}
