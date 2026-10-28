"use client";
import { fileVisibility } from "@/lib/file-visibility";
import ProjectFocus from "./project-focus";
import { projectFocus } from "@/lib/project-focus";
import BrandMark from "@/components/brand-mark";
import {
  useState,
  useTransition,
  useContext,
  createContext,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  ArrowUpRight,
  Check,
  FolderKanban,
  Users,
  LogOut,
  Files,
  LayoutDashboard,
  Wallet,
} from "lucide-react";
import type { WorkspaceData, DbProject } from "@/lib/workspace";
import {
  addClient,
  editClient,
  editProject,
  addProject,
  saveStage,
  saveProjectNotes,
  submitQuestionnaire,
  submitFeedback,
  uploadDocument,
  publishDocument,
  inviteClient,
  revokeClientAccess,
  moveStage,
  addStage,
  removeStage,
  signOut,
  type Result,
} from "@/app/actions";
import JourneyVerification from "./journey-verification";
import {
  stageVerification,
  verifiedStageStatus,
  verificationLabels,
  type VerificationField,
} from "@/lib/journey-verification";
import StageWorkspace from "./stage-workspace";
import BusinessDocuments from "./business-documents";
import ProjectManagement from "./project-management";
import { PortalCheck } from "./portal-check";
import { PasswordForm } from "./auth-forms";
import { statuses } from "@/lib/projects";
const money = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(
    n,
  );
const PreviewContext = createContext(false);
function ActionForm({
  action,
  children,
  label = "Save",
  className = "",
}: {
  action: (f: FormData) => Promise<Result>;
  children: ReactNode;
  label?: string;
  className?: string;
}) {
  const preview = useContext(PreviewContext);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<Result | null>(null);
  const router = useRouter();
  return (
    <form
      className={"connected-form " + className}
      action={(data) =>
        start(async () => {
          if (preview) return;
          try {
            const r = await action(data);
            setResult(r);
            if (r.ok) router.refresh();
          } catch {
            setResult({
              ok: false,
              message: "The request failed. Please try again.",
            });
          }
        })
      }
    >
      <fieldset disabled={preview} className="action-fields">
        {children}
        <button type="submit" className="primary" disabled={pending}>
          {pending ? "Saving…" : label}
        </button>
      </fieldset>
      {result && (
        <div
          className={result.ok ? "form-result" : "form-result error"}
          role="status"
        >
          {result.message}
          {result.link && (
            <label>
              Private invitation link
              <input
                value={result.link}
                readOnly
                aria-label="Private invitation link"
                onFocus={(e) => e.target.select()}
              />
            </label>
          )}
        </div>
      )}
    </form>
  );
}
import { questionnairePrompts, optionalQuestion } from "@/lib/questionnaires";
import PortalGuide, { ReviewChecklist } from "./portal-guide";
import { clientPreview } from "@/lib/client-preview";
export default function ConnectedStudio({
  data,
  preview = false,
}: {
  data: WorkspaceData;
  preview?: boolean;
}) {
  data = {
    ...data,
    stages: data.stages.map((stage) => {
      const project = data.projects.find((p) => p.id === stage.project_id);
      return project
        ? { ...stage, status: verifiedStageStatus(stage, project) }
        : stage;
    }),
  };
  const admin = data.role === "admin";
  const [showPreview, setShowPreview] = useState(false);
  const [view, setView] = useState(admin ? "Overview" : "Projects");
  const [projectId, setProjectId] = useState(data.projects[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState<"client" | "project" | null>(null);
  const project =
    data.projects.find((p) => p.id === projectId) ?? data.projects[0];
  const otherVerificationFields = (
    Object.keys(verificationLabels) as VerificationField[]
  ).filter(
    (field) =>
      project &&
      !data.stages.some(
        (s) =>
          s.project_id === project.id && stageVerification(s).includes(field),
      ),
  );
  const clientFor = (p: DbProject) =>
    data.clients.find((c) => c.id === p.client_id);
  const currentClient = project ? clientFor(project) : null;
  const complete = (p: DbProject) => {
    const stages = data.stages.filter((s) => s.project_id === p.id);
    return stages.length
      ? Math.round(
          (stages.filter((s) => s.status === "Completed").length /
            stages.length) *
            100,
        )
      : 0;
  };
  if (admin && showPreview && project)
    return (
      <>
        <div className="preview-toolbar">
          <div>
            <b>Client preview · {clientFor(project)?.name}</b>
            <span>
              {project.contract_signed && project.deposit_paid
                ? "Read-only preview. You are still signed in as the owner."
                : "Layout preview only: client access is still locked until contract and deposit are recorded."}
            </span>
          </div>
          <button className="primary" onClick={() => setShowPreview(false)}>
            Back to owner workspace
          </button>
        </div>
        <ConnectedStudio data={clientPreview(data, project.id, true)} preview />
      </>
    );
  return (
    <PreviewContext.Provider value={preview}>
      <div className="shell connected">
        <aside className="sidebar">
          <Link className="logo" href="/">
            <BrandMark />
          </Link>
          <div className="workspace-label">
            ALEX BELL ARTS
            <span>{admin ? "PRIVATE WORKSPACE" : "YOUR PROJECT SPACE"}</span>
          </div>
          <nav>
            {(admin
              ? ([
                  ["Overview", LayoutDashboard],
                  ["Projects", FolderKanban],
                  ["Clients", Users],
                  ["Finance", Wallet],
                ] as const)
              : ([["Projects", FolderKanban]] as const)
            ).map(([name, Icon]) => (
              <button
                key={name}
                onClick={() => {
                  setView(name);
                  setCreating(null);
                }}
                className={view === name ? "active" : ""}
              >
                <Icon size={18} />
                {name}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <p className="muted">
              {preview ? (
                "Previewing client view"
              ) : (
                <>Signed in as {admin ? "studio owner" : "client"}</>
              )}
            </p>
            {!preview && (
              <form action={signOut}>
                <button className="secondary full">
                  <LogOut size={14} /> Sign out
                </button>
              </form>
            )}
            <Link className="resource" href="/demo">
              Fictional demo <ArrowUpRight size={14} />
            </Link>
          </div>
        </aside>
        <div className="main-wrap">
          <header className="topbar">
            <span>
              ABA Studio{" "}
              <b>{admin ? "ABA Owner Dashboard" : "ABA Client Portal"}</b>
            </span>
            <span>Private account · Development version</span>
          </header>
          <main>
            <div className="banner">
              Development workspace — use fictional records until hosted
              security checks and deployment review are complete.
            </div>
            <div className="page-heading">
              <div>
                <div className="eyebrow">
                  {admin ? "YOUR STUDIO, IN FOCUS" : "YOUR CREATIVE JOURNEY"}
                </div>
                <h1>
                  {admin
                    ? view === "Overview"
                      ? "ABA Owner Dashboard"
                      : view === "Clients"
                        ? "Good people. Great possibilities."
                        : "Every project, in perspective."
                    : `Hello${currentClient ? ", " + currentClient.contact.split(" ")[0] : ""}.`}
                </h1>
                <p>
                  {admin
                    ? "Projects, people and the details that keep everything moving."
                    : "A little clarity for every step of your project with me."}
                </p>
              </div>
              {admin && (
                <button
                  className="primary"
                  onClick={() =>
                    setCreating(
                      creating
                        ? null
                        : view === "Clients"
                          ? "client"
                          : "project",
                    )
                  }
                >
                  <Plus size={16} />
                  {creating
                    ? "Close form"
                    : view === "Clients"
                      ? "New client"
                      : "New project"}
                </button>
              )}
            </div>
            {admin && project && (
              <div className="owner-preview-entry">
                <button
                  className="secondary"
                  onClick={() => setShowPreview(true)}
                >
                  Preview client portal · {clientFor(project)?.name} ↗
                </button>
                <p>
                  See the Notion-style welcome, brief and guidance for the
                  selected project.
                </p>
              </div>
            )}
            {creating === "client" && (
              <section className="panel">
                <h2>A new conversation.</h2>
                <ActionForm action={addClient} label="Create client">
                  <div className="form-grid">
                    {[
                      ["name", "Business name"],
                      ["contact", "Contact name"],
                      ["email", "Email address"],
                      ["sector", "Business sector"],
                    ].map(([name, label]) => (
                      <label key={name}>
                        {label}
                        <input
                          required={name !== "sector"}
                          type={name === "email" ? "email" : "text"}
                          name={name}
                          maxLength={name === "email" ? 254 : 120}
                        />
                      </label>
                    ))}
                  </div>
                </ActionForm>
              </section>
            )}
            {creating === "project" && (
              <section className="panel">
                <h2>Make room for something good.</h2>
                {data.clients.length ? (
                  <ActionForm action={addProject} label="Create project">
                    <div className="form-grid">
                      <label>
                        Project name
                        <input name="name" required maxLength={120} />
                      </label>
                      <label>
                        Client
                        <select name="clientId">
                          {data.clients.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Workflow
                        <select name="type">
                          <option>Brand Identity</option>
                          <option>Website Design</option>
                          <option value="Both">
                            Brand Identity + Website Design
                          </option>
                        </select>
                      </label>
                      <label>
                        Estimated completion
                        <input name="due" type="date" required />
                      </label>
                      <label>
                        Project value (£)
                        <input
                          name="budget"
                          type="number"
                          min="0"
                          max="10000000"
                          step="0.01"
                          required
                        />
                      </label>
                    </div>
                    <p>
                      All milestones are created automatically. Combined
                      projects share onboarding and have separate creative
                      workstreams.
                    </p>
                  </ActionForm>
                ) : (
                  <p>
                    Create your first client before adding a project.{" "}
                    <button
                      className="text-button"
                      onClick={() => setCreating("client")}
                    >
                      Create a client
                    </button>
                  </p>
                )}
              </section>
            )}
            {admin && view === "Overview" && (
              <>
                <div className="stats">
                  {[
                    ["Projects", data.projects.length],
                    [
                      "Awaiting feedback",
                      new Set(
                        data.stages
                          .filter(
                            (s) =>
                              s.status === "Awaiting Client" ||
                              s.status === "Awaiting Approval",
                          )
                          .map((s) => s.project_id),
                      ).size,
                    ],
                    [
                      "Unreceived project value",
                      money(
                        data.projects.reduce(
                          (n, p) =>
                            n +
                            p.budget *
                              (1 -
                                (p.deposit_paid ? 0.5 : 0) -
                                (p.final_paid ? 0.5 : 0)),
                          0,
                        ),
                      ),
                    ],
                    ["Clients", data.clients.length],
                  ].map(([label, value]) => (
                    <div className="stat" key={label}>
                      <div>{label}</div>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
                <div className="two-col">
                  <section className="panel">
                    <h2>Current projects</h2>
                    {data.projects.length ? (
                      data.projects.map((p) => (
                        <button
                          className="list-row"
                          key={p.id}
                          onClick={() => {
                            setProjectId(p.id);
                            setView("Projects");
                          }}
                        >
                          <span className="avatar pale">
                            {clientFor(p)?.name[0]}
                          </span>
                          <div>
                            <b>{p.name}</b>
                            <small>
                              {clientFor(p)?.name} · {p.type}
                            </small>
                            <small>{projectFocus(data, p).nextLabel}</small>
                          </div>
                          <span className="pill">{complete(p)}%</span>
                          <ArrowUpRight size={15} />
                        </button>
                      ))
                    ) : (
                      <p>
                        Your workspace is empty. Add a fictional client and
                        project to begin testing.
                      </p>
                    )}
                  </section>
                  <section className="panel">
                    <h2>Activity record</h2>
                    {data.audit.slice(0, 12).map((a) => (
                      <div className="activity" key={a.id}>
                        <span />
                        {a.entity.replaceAll("_", " ")} · {a.action}
                        <small>
                          {new Date(a.created_at).toLocaleDateString("en-GB")}
                        </small>
                      </div>
                    ))}
                    {!data.audit.length && (
                      <p>Significant workspace actions will appear here.</p>
                    )}
                  </section>
                </div>
              </>
            )}
            {admin && view === "Clients" && (
              <>
                <label className="search">
                  Search clients
                  <input
                    aria-label="Search clients"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <div className="client-grid">
                  {data.clients
                    .filter((c) =>
                      (c.name + " " + c.contact)
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                    )
                    .map((c) => (
                      <section className="panel client-card" key={c.id}>
                        <span className="avatar pale">{c.name[0]}</span>
                        <h2>{c.name}</h2>
                        <p>
                          {c.contact}
                          <br />
                          {c.email}
                          <br />
                          {c.sector}
                        </p>
                        <p>
                          {
                            data.projects.filter((p) => p.client_id === c.id)
                              .length
                          }{" "}
                          projects
                        </p>
                        <details>
                          <summary>Edit client details</summary>
                          <ActionForm action={editClient} label="Save client">
                            <input type="hidden" name="id" value={c.id} />
                            {(
                              [
                                ["name", "Business name"],
                                ["contact", "Contact name"],
                                ["email", "Email address"],
                                ["sector", "Sector"],
                              ] as const
                            ).map(([name, label]) => (
                              <label key={name}>
                                {label}
                                <input
                                  name={name}
                                  defaultValue={c[name]}
                                  required={name !== "sector"}
                                  type={name === "email" ? "email" : "text"}
                                  maxLength={name === "email" ? 254 : 120}
                                />
                              </label>
                            ))}
                          </ActionForm>
                        </details>
                        <ActionForm
                          action={inviteClient}
                          label="Create invitation"
                        >
                          <input type="hidden" name="clientId" value={c.id} />
                          <label>
                            Invitation delivery
                            <select name="delivery">
                              <option value="link">
                                Create a private link
                              </option>
                              <option
                                value="email"
                                disabled={!data.emailInvitesReady}
                              >
                                Send invitation email
                                {!data.emailInvitesReady
                                  ? " (setup needed)"
                                  : ""}
                              </option>
                            </select>
                          </label>
                          <p>
                            Requires a signed contract and recorded deposit.
                            Choose a private link or, after email-template
                            setup, a Supabase invitation email.
                          </p>
                        </ActionForm>
                        <details>
                          <summary>Revoke portal access</summary>
                          <p>
                            This removes access for every account associated
                            with this client. Their current sessions will no
                            longer return project data.
                          </p>
                          <ActionForm
                            action={revokeClientAccess}
                            label="Revoke this client’s access"
                          >
                            <input type="hidden" name="clientId" value={c.id} />
                          </ActionForm>
                        </details>
                      </section>
                    ))}
                </div>
              </>
            )}
            {admin && view === "Finance" && (
              <BusinessDocuments data={data} Form={ActionForm} />
            )}
            {(view === "Projects" || !admin) && (
              <>
                {data.projects.length ? (
                  <>
                    <label className="project-picker">
                      Your project
                      <select
                        aria-label="Select project"
                        value={project?.id ?? ""}
                        onChange={(e) => setProjectId(e.target.value)}
                      >
                        {data.projects.map((p) => (
                          <option value={p.id} key={p.id}>
                            {clientFor(p)?.name} — {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    {project && (
                      <>
                        {!admin && (
                          <PortalGuide
                            project={project}
                            stages={data.stages}
                            assetsReady={data.managementReady}
                            clientActions={data.clientActions}
                          />
                        )}
                        <ProjectManagement
                          key={project.id}
                          data={data}
                          project={project}
                          Form={ActionForm}
                        />
                        {admin ? (
                          <details className="panel">
                            <summary>
                              Optional built-in proposals & invoices
                            </summary>
                            <BusinessDocuments
                              data={data}
                              project={project}
                              Form={ActionForm}
                            />
                          </details>
                        ) : (
                          <BusinessDocuments
                            data={data}
                            project={project}
                            Form={ActionForm}
                          />
                        )}
                        <div className="project-summary">
                          <div>
                            <div className="eyebrow">{project.type}</div>
                            <h2>{project.name}</h2>
                            <p>
                              Estimated completion:{" "}
                              {new Date(
                                project.due + "T12:00:00",
                              ).toLocaleDateString("en-GB")}
                            </p>
                          </div>
                          <div>
                            <strong>{complete(project)}%</strong>
                            <span>visible milestones complete</span>
                          </div>
                        </div>
                        {admin && (
                          <ProjectFocus
                            data={data}
                            project={project}
                            onManageClient={() => {
                              setView("Clients");
                              setQuery(clientFor(project)?.name ?? "");
                            }}
                          />
                        )}
                        <div className="progress">
                          <i style={{ width: complete(project) + "%" }} />
                        </div>
                        <div className="stream-progress">
                          {[
                            ...new Set(
                              data.stages
                                .filter((s) => s.project_id === project.id)
                                .map((s) => s.stream),
                            ),
                          ].map((stream) => {
                            const stages = data.stages.filter(
                              (s) =>
                                s.project_id === project.id &&
                                s.stream === stream,
                            );
                            const percent = Math.round(
                              (stages.filter((s) => s.status === "Completed")
                                .length /
                                stages.length) *
                                100,
                            );
                            return (
                              <div key={stream}>
                                <span>{stream}</span>
                                <b>{percent}%</b>
                                <div className="progress">
                                  <i style={{ width: percent + "%" }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="project-jumps">
                          <a href="#journey">Milestones</a>
                          <a href="#questionnaires">Questionnaires</a>
                          <a href="#documents">Documents & feedback</a>
                          {admin && <a href="#controls">Project settings</a>}
                        </div>
                        <div className="two-col detail" key={project.id}>
                          <div>
                            <section className="panel">
                              <h2 id="journey">Your project journey</h2>
                              {admin && otherVerificationFields.length > 0 && (
                                <details>
                                  <summary>
                                    Other verification records for customised
                                    workflows
                                  </summary>
                                  <p>
                                    Custom milestones keep their own progress.
                                    These verified records control access;
                                    completing a custom milestone never confirms
                                    a contract or payment.
                                  </p>
                                  <JourneyVerification
                                    data={data}
                                    project={project}
                                    fields={otherVerificationFields}
                                    Form={ActionForm}
                                  />
                                </details>
                              )}
                              {data.stages
                                .filter((s) => s.project_id === project.id)
                                .map((s) =>
                                  admin ? (
                                    <details
                                      className="milestone-disclosure"
                                      id={"stage-" + s.id}
                                      key={s.id}
                                    >
                                      <summary>
                                        <span>
                                          {s.name}
                                          <small>
                                            {s.stream}
                                            {!s.visible
                                              ? " · Internal only"
                                              : ""}
                                          </small>
                                        </span>
                                        <span className="pill">{s.status}</span>
                                      </summary>
                                      <ActionForm
                                        action={saveStage}
                                        label="Save milestone"
                                        className="milestone-form"
                                      >
                                        <input
                                          type="hidden"
                                          name="id"
                                          value={s.id}
                                        />
                                        <div className="eyebrow">
                                          {s.stream}
                                        </div>
                                        <label>
                                          Milestone name
                                          <input
                                            name="name"
                                            defaultValue={s.name}
                                            key={s.name}
                                            required
                                            maxLength={120}
                                          />
                                        </label>
                                        {stageVerification(s).length > 0 && (
                                          <p>
                                            This stage follows the verified
                                            project records below. Renaming it
                                            to a custom name restores ordinary
                                            progress tracking; its verification
                                            controls move to Other verification
                                            records at the top of the journey.
                                          </p>
                                        )}
                                        {stageVerification(s).length > 0 && (
                                          <input
                                            type="hidden"
                                            name="status"
                                            value="Not Started"
                                          />
                                        )}
                                        <div className="form-grid">
                                          <label>
                                            Status
                                            <select
                                              name="status"
                                              disabled={
                                                stageVerification(s).length > 0
                                              }
                                              defaultValue={s.status}
                                              key={s.status}
                                            >
                                              {stageVerification(s).length >
                                                0 && (
                                                <option value={s.status}>
                                                  {s.status} — driven by
                                                  verified records
                                                </option>
                                              )}
                                              {statuses.map((status) => (
                                                <option key={status}>
                                                  {status}
                                                </option>
                                              ))}
                                            </select>
                                          </label>
                                          <label className="check-row">
                                            <input
                                              name="visible"
                                              type="checkbox"
                                              defaultChecked={s.visible}
                                              key={String(s.visible)}
                                            />
                                            Client visible
                                          </label>
                                        </div>
                                      </ActionForm>
                                      <StageWorkspace
                                        data={data}
                                        stage={s}
                                        Form={ActionForm}
                                      />
                                      <div className="stage-tool-row">
                                        <ActionForm
                                          action={moveStage}
                                          label="Move up"
                                        >
                                          <input
                                            type="hidden"
                                            name="id"
                                            value={s.id}
                                          />
                                          <input
                                            type="hidden"
                                            name="direction"
                                            value="-1"
                                          />
                                        </ActionForm>
                                        <ActionForm
                                          action={moveStage}
                                          label="Move down"
                                        >
                                          <input
                                            type="hidden"
                                            name="id"
                                            value={s.id}
                                          />
                                          <input
                                            type="hidden"
                                            name="direction"
                                            value="1"
                                          />
                                        </ActionForm>
                                        <details>
                                          <summary>Remove</summary>
                                          <ActionForm
                                            action={removeStage}
                                            label="Confirm removal"
                                          >
                                            <input
                                              type="hidden"
                                              name="id"
                                              value={s.id}
                                            />
                                          </ActionForm>
                                        </details>
                                      </div>
                                    </details>
                                  ) : (
                                    <details
                                      className="portal-stage-detail"
                                      key={s.id}
                                    >
                                      <summary className="portal-stage">
                                        <span
                                          className={
                                            s.status === "Completed"
                                              ? "stage-check done"
                                              : "stage-check"
                                          }
                                        >
                                          {s.status === "Completed" ? (
                                            <Check size={14} />
                                          ) : (
                                            "·"
                                          )}
                                        </span>
                                        <div>
                                          <b>{s.name}</b>
                                          <small>{s.stream}</small>
                                        </div>
                                        <span className="pill">{s.status}</span>
                                      </summary>
                                      <StageWorkspace
                                        data={data}
                                        stage={s}
                                        Form={ActionForm}
                                      />
                                    </details>
                                  ),
                                )}
                              {admin && (
                                <details>
                                  <summary>Add milestone</summary>
                                  <ActionForm
                                    action={addStage}
                                    label="Add milestone"
                                  >
                                    <input
                                      type="hidden"
                                      name="projectId"
                                      value={project.id}
                                    />
                                    <label>
                                      Milestone name
                                      <input
                                        name="name"
                                        required
                                        maxLength={120}
                                      />
                                    </label>
                                  </ActionForm>
                                </details>
                              )}
                            </section>
                            <section className="panel">
                              <h2 id="questionnaires">
                                Project brief & onboarding
                              </h2>
                              <p>
                                This brief builds on your enquiry and initial
                                chat. Short answers are welcome. For combined
                                work, complete the shared essentials once in
                                Brand discovery. Please arrange account
                                invitations separately rather than sharing
                                passwords.
                              </p>
                              {(["brand", "website", "goodbye"] as const)
                                .filter((kind) =>
                                  kind === "brand"
                                    ? project.type !== "Website Design"
                                    : kind === "website"
                                      ? project.type !== "Brand Identity"
                                      : project.final_paid &&
                                        project.final_approved,
                                )
                                .map((kind) => {
                                  const response = data.questionnaires.find(
                                    (q) =>
                                      q.project_id === project.id &&
                                      q.kind === kind,
                                  );
                                  return (
                                    <details
                                      className="questionnaire"
                                      id={
                                        "questionnaire-" +
                                        project.id +
                                        "-" +
                                        kind
                                      }
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
                                            {new Date(
                                              response.submitted_at,
                                            ).toLocaleDateString("en-GB")}
                                            . Contact Alex if you need to change
                                            an answer.
                                          </p>
                                          {Object.entries(response.answers).map(
                                            ([key, value]) => (
                                              <div className="answer" key={key}>
                                                <b>
                                                  {questionnairePrompts(
                                                    kind,
                                                    project.type,
                                                  ).find(
                                                    ([id]) => id === key,
                                                  )?.[1] ?? key}
                                                </b>
                                                <p>{value}</p>
                                              </div>
                                            ),
                                          )}
                                        </>
                                      ) : admin ? (
                                        <p>
                                          Your client can complete this
                                          questionnaire in their portal.
                                        </p>
                                      ) : (
                                        <ActionForm
                                          action={submitQuestionnaire}
                                          label="Send my answers"
                                        >
                                          <input
                                            type="hidden"
                                            name="projectId"
                                            value={project.id}
                                          />
                                          <input
                                            type="hidden"
                                            name="kind"
                                            value={kind}
                                          />
                                          {questionnairePrompts(
                                            kind,
                                            project.type,
                                          ).map(([key, prompt]) => (
                                            <label key={key}>
                                              {prompt}
                                              <textarea
                                                name={"answer_" + key}
                                                required={
                                                  !optionalQuestion(kind, key)
                                                }
                                                maxLength={4000}
                                              />
                                            </label>
                                          ))}
                                          <p>
                                            Answers are saved once submitted.
                                            Please check them before sending.
                                          </p>
                                        </ActionForm>
                                      )}
                                      {kind === "brand" && (
                                        <a
                                          className="resource"
                                          href="https://tally.so/r/mRAXk9"
                                          target="_blank"
                                          rel="noreferrer"
                                        >
                                          Logo Direction & Inspiration{" "}
                                          <ArrowUpRight size={14} />
                                        </a>
                                      )}
                                      {kind === "goodbye" && (
                                        <a
                                          className="resource"
                                          href="https://tally.so/r/Z9jk9o"
                                          target="_blank"
                                          rel="noreferrer"
                                        >
                                          Existing goodbye form{" "}
                                          <ArrowUpRight size={14} />
                                        </a>
                                      )}
                                    </details>
                                  );
                                })}
                            </section>
                          </div>
                          <div>
                            {admin && (
                              <section className="panel">
                                <h2 id="controls">Project controls</h2>
                                <details>
                                  <summary>Edit project details</summary>
                                  <ActionForm
                                    action={editProject}
                                    label="Save project details"
                                  >
                                    <input
                                      type="hidden"
                                      name="id"
                                      value={project.id}
                                    />
                                    <label>
                                      Project name
                                      <input
                                        name="name"
                                        defaultValue={project.name}
                                        required
                                        maxLength={120}
                                      />
                                    </label>
                                    <label>
                                      Estimated completion
                                      <input
                                        name="due"
                                        type="date"
                                        defaultValue={project.due}
                                        required
                                      />
                                    </label>
                                    <label>
                                      Project value (£)
                                      <input
                                        name="budget"
                                        type="number"
                                        min="0"
                                        max="10000000"
                                        step="0.01"
                                        defaultValue={project.budget}
                                        required
                                      />
                                    </label>
                                    <p>
                                      Workflow type stays fixed to protect
                                      existing milestones and questionnaire
                                      responses.
                                    </p>
                                  </ActionForm>
                                </details>
                                <ActionForm
                                  action={saveProjectNotes}
                                  label="Save internal notes"
                                >
                                  <input
                                    type="hidden"
                                    name="id"
                                    value={project.id}
                                  />
                                  <p>
                                    Access summary:{" "}
                                    {project.contract_signed &&
                                    project.deposit_paid
                                      ? "Client portal unlocked"
                                      : "Client portal locked"}
                                    . Final delivery:{" "}
                                    {project.final_approved &&
                                    project.final_paid
                                      ? "unlocked"
                                      : "locked"}
                                    . Verify records in the project journey.
                                  </p>
                                  {Object.entries(verificationLabels).map(
                                    ([field, label]) => (
                                      <p key={field}>
                                        {label}:{" "}
                                        {project[field as VerificationField]
                                          ? "Verified"
                                          : "Not verified"}
                                      </p>
                                    ),
                                  )}
                                  <label>
                                    Internal notes
                                    <textarea
                                      name="notes"
                                      maxLength={10000}
                                      defaultValue={
                                        data.notes.find(
                                          (n) => n.project_id === project.id,
                                        )?.body ?? ""
                                      }
                                      key={project.id}
                                    />
                                  </label>
                                  <p>
                                    Internal notes are stored separately and
                                    never returned to client accounts.
                                  </p>
                                </ActionForm>
                              </section>
                            )}
                            <section className="panel">
                              <h2>
                                <Files size={18} />{" "}
                                <span id="documents">All project files</span>
                              </h2>
                              <p>
                                The same files shown in your journey, collected
                                here for reference. Upload stage files in their
                                journey stage; files uploaded here have no
                                stage.
                              </p>
                              {admin && (
                                <ActionForm
                                  action={uploadDocument}
                                  label="Upload privately"
                                >
                                  <input
                                    type="hidden"
                                    name="projectId"
                                    value={project.id}
                                  />
                                  <label>
                                    Category
                                    <select name="category">
                                      <option value="presentation">
                                        Design presentation
                                      </option>
                                      <option value="document">
                                        Project document
                                      </option>
                                      <option value="final">
                                        Final deliverable
                                      </option>
                                    </select>
                                  </label>
                                  {data.managementReady && (
                                    <>
                                      <label>
                                        Presentation version
                                        <input
                                          name="version_label"
                                          defaultValue="v1"
                                          required
                                          maxLength={40}
                                        />
                                      </label>
                                      <label>
                                        Feedback due date
                                        <input name="review_due" type="date" />
                                      </label>
                                    </>
                                  )}
                                  <label>
                                    File
                                    <input
                                      type="file"
                                      name="file"
                                      accept="application/pdf,image/png,image/jpeg,image/webp"
                                      required
                                    />
                                  </label>
                                  <p>
                                    PDF, PNG, JPEG or WebP · 3 MB maximum.
                                    Uploads start unpublished.
                                  </p>
                                </ActionForm>
                              )}
                              {!admin && (
                                <p>
                                  Final deliverables appear after your final
                                  approval and payment have been confirmed.
                                </p>
                              )}
                              {(data.assets ?? [])
                                .filter((a) => a.project_id === project.id)
                                .map((a) => (
                                  <div className="document-item" key={a.id}>
                                    <b>{a.name}</b>
                                    <small>
                                      Returned client file ·{" "}
                                      {a.stage_id
                                        ? (data.stages.find(
                                            (s) => s.id === a.stage_id,
                                          )?.name ?? "Stage unavailable")
                                        : "No stage · project-wide"}
                                    </small>
                                    <a
                                      className="resource"
                                      href={"/assets/" + a.id}
                                    >
                                      Download securely{" "}
                                      <ArrowUpRight size={14} />
                                    </a>
                                  </div>
                                ))}
                              {data.documents
                                .filter((d) => d.project_id === project.id)
                                .map((d) => (
                                  <div className="document-item" key={d.id}>
                                    <b>{d.name}</b>
                                    <small>
                                      {d.stage_id
                                        ? (data.stages.find(
                                            (s) => s.id === d.stage_id,
                                          )?.name ?? "Stage unavailable")
                                        : "No stage · project-wide"}{" "}
                                      · {d.category}
                                      {d.version_label
                                        ? " · " + d.version_label
                                        : ""}
                                      {d.review_due
                                        ? " · Review by " +
                                          new Date(
                                            d.review_due + "T12:00:00",
                                          ).toLocaleDateString("en-GB")
                                        : ""}{" "}
                                      {admin &&
                                        (d.published
                                          ? "· Published"
                                          : "· Private draft")}
                                    </small>
                                    {admin && (
                                      <p className="file-visibility">
                                        {
                                          fileVisibility(
                                            d,
                                            project,
                                            data.stages,
                                          ).message
                                        }
                                      </p>
                                    )}
                                    <a
                                      className="resource"
                                      href={"/files/" + d.id}
                                    >
                                      Download securely{" "}
                                      <ArrowUpRight size={14} />
                                    </a>
                                    {admin && (
                                      <ActionForm
                                        action={publishDocument}
                                        label={
                                          d.published
                                            ? "Unpublish"
                                            : "Publish to client"
                                        }
                                      >
                                        <input
                                          type="hidden"
                                          name="id"
                                          value={d.id}
                                        />
                                        <input
                                          type="hidden"
                                          name="published"
                                          value={String(!d.published)}
                                        />
                                      </ActionForm>
                                    )}
                                    {data.feedback
                                      .filter((f) => f.document_id === d.id)
                                      .map((f) => (
                                        <div
                                          className="feedback-item"
                                          key={f.id}
                                        >
                                          <span className="pill">
                                            {f.decision.replaceAll("_", " ")}
                                          </span>
                                          <p>{f.body}</p>
                                          <small>
                                            {f.approver_name ??
                                              "Name not recorded"}{" "}
                                            ·{" "}
                                            {f.reviewed_version ??
                                              "Historical version not recorded"}
                                          </small>
                                          <small>
                                            {new Date(
                                              f.created_at,
                                            ).toLocaleDateString("en-GB")}
                                          </small>
                                        </div>
                                      ))}
                                    {!admin && (
                                      <p>
                                        What is working well? What needs
                                        changing, on which page or slide, and
                                        what outcome should the change achieve?
                                        Check any incorrect text, images, links
                                        or factual details.
                                      </p>
                                    )}
                                    {!admin && (
                                      <ReviewChecklist type={project.type} />
                                    )}
                                    {!admin && (
                                      <ActionForm
                                        action={submitFeedback}
                                        label="Send feedback"
                                      >
                                        <input
                                          type="hidden"
                                          name="documentId"
                                          value={d.id}
                                        />
                                        <label>
                                          My response
                                          <select name="decision">
                                            <option value="comment">
                                              Comment
                                            </option>
                                            <option value="changes_requested">
                                              Request revisions
                                            </option>
                                            <option value="approved">
                                              Approve this presentation
                                            </option>
                                          </select>
                                        </label>
                                        <label>
                                          Feedback
                                          <textarea
                                            name="body"
                                            required
                                            maxLength={4000}
                                          />
                                        </label>
                                        <p>
                                          Approvals are recorded as creative
                                          feedback. They are not legal
                                          signatures.
                                        </p>
                                      </ActionForm>
                                    )}
                                  </div>
                                ))}
                            </section>
                            {!admin && (
                              <section className="panel">
                                <h2>Payment overview</h2>
                                <p>Project value: {money(project.budget)}</p>
                                <p>
                                  Deposit:{" "}
                                  {project.deposit_paid
                                    ? "Received"
                                    : "Awaiting"}
                                  <br />
                                  Final balance:{" "}
                                  {project.final_paid ? "Received" : "Awaiting"}
                                </p>
                                <p>
                                  Online payment is not connected. I’ll share
                                  payment instructions separately.
                                </p>
                              </section>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <section className="panel empty">
                    <h2>
                      {admin
                        ? "Your next chapter is ready."
                        : "Your project is getting ready."}
                    </h2>
                    <p>
                      {admin
                        ? "Create a client, then add their first project."
                        : "A signed contract and recorded 50% deposit are required before your project becomes available. Please contact Alex if you need help."}
                    </p>
                  </section>
                )}
              </>
            )}
            {!admin && project && (
              <PortalGuide
                project={project}
                stages={data.stages}
                part="reference"
              />
            )}
            {!preview && (
              <section className="panel account-panel">
                <h2>My account</h2>
                {admin && (
                  <Link className="resource" href="/account-security">
                    Protect my account with an authenticator →
                  </Link>
                )}
                <a className="resource" href="/account/export">
                  Download my workspace data →
                </a>
                <PasswordForm />
                {admin && <PortalCheck />}
              </section>
            )}
            <footer>
              <span>ABA STUDIO / ALEX BELL ARTS</span>
              <span>Thoughtfully made. Independently run.</span>
            </footer>
          </main>
        </div>
      </div>
    </PreviewContext.Provider>
  );
}
