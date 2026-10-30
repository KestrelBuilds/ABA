"use client";
import ProjectFiles from "./project-files";
import Enquiries from "./enquiries";
import ClientAccess from "./client-access";
import ProspectArea from "./prospect-area";
import ProspectManagement from "./prospect-management";
import {
  previewProspect,
  projectRelationship,
  clientRelationship,
  enquiryLabels,
} from "@/lib/prospects";
import DeleteClient from "./delete-client";
import ProjectFocus, { openProjectSection } from "./project-focus";
import WorkspaceAttention from "./workspace-attention";
import WorkspaceInsights from "./workspace-insights";
import { workspaceInsights } from "@/lib/workspace-insights";
import HandoverPreparation from "./handover-preparation";
import type { AttentionDestination } from "@/lib/workspace-attention";
import { projectFocus } from "@/lib/project-focus";
import BrandSignature from "./brand-signature";
import BrandMark from "@/components/brand-mark";
import {
  useState,
  useTransition,
  useContext,
  useEffect,
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
  LayoutDashboard,
  Lock,
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
  moveStage,
  addStage,
  saveStagePurpose,
  removeStage,
  signOut,
  type Result,
} from "@/app/actions";
import JourneyVerification from "./journey-verification";
import { stagePurposes } from "@/lib/stage-purpose";
import {
  stageVerification,
  verifiedStageStatus,
  verificationLabels,
  type VerificationField,
} from "@/lib/journey-verification";
import StageWorkspace from "./stage-workspace";
import ExistingBusinessRecords from "./existing-business-records";
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
import PortalGuide from "./portal-guide";
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
  const [accessClientId, setAccessClientId] = useState("");
  const [projectJump, setProjectJump] = useState("");
  useEffect(() => {
    if (view === "Projects" && projectJump) {
      openProjectSection(projectJump);
      setProjectJump("");
    }
  }, [view, projectId, projectJump]);
  useEffect(() => {
    if (view === "Clients" && accessClientId)
      document
        .getElementById("client-access-" + accessClientId)
        ?.scrollIntoView({ block: "start" });
  }, [view, accessClientId]);
  const [clientNotice, setClientNotice] = useState("");
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
  const openAttention = (destination: AttentionDestination) => {
    if (destination.area === "enquiries") setView("Enquiries");
    else if (destination.area === "client") {
      setQuery(
        data.clients.find((c) => c.id === destination.clientId)?.name ?? "",
      );
      setAccessClientId(destination.clientId);
      setView("Clients");
    } else {
      setProjectId(destination.projectId);
      setView("Projects");
      setProjectJump(destination.href);
    }
  };
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
                : "Read-only potential-client preview. The creative journey is hidden until contract and deposit verification."}
            </span>
          </div>
          <button className="primary" onClick={() => setShowPreview(false)}>
            Back to owner workspace
          </button>
        </div>
        {project.contract_signed && project.deposit_paid ? (
          <ConnectedStudio data={clientPreview(data, project.id)} preview />
        ) : (
          <ProspectArea
            entries={[previewProspect(data, project)]}
            preview
            ready={data.prospectReady ?? false}
          />
        )}
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
                  ["Enquiries", Users],
                  ["Projects", FolderKanban],
                  ["Clients", Users],
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
                      : view === "Enquiries"
                        ? "New conversations start here."
                        : view === "Clients"
                          ? "Clients & connections."
                          : "Ideas into action."
                    : `Hello${currentClient ? ", " + currentClient.contact.split(" ")[0] : ""}.`}
                </h1>
                <p>
                  {admin
                    ? "Projects, people and the details that keep everything moving."
                    : "Your ideas, my thinking and a clear next step. Let’s create something with purpose."}
                </p>
              </div>
              {admin && view !== "Enquiries" && (
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
            {admin && project && view !== "Enquiries" && (
              <div className="owner-preview-entry">
                <button
                  className="secondary"
                  onClick={() => setShowPreview(true)}
                >
                  Preview client portal · {clientFor(project)?.name} ↗
                </button>
                {view === "Projects" && (
                  <button
                    className="primary"
                    onClick={() => {
                      const client = clientFor(project);
                      if (client) {
                        setQuery(client.name);
                        setAccessClientId(client.id);
                        setView("Clients");
                      }
                    }}
                  >
                    <Users size={16} aria-hidden="true" /> Invite / manage
                    client access
                  </button>
                )}
                <p>
                  Preview what this client can see, or open their invitation and
                  account settings.
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
                <h2>Shape the next project.</h2>
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
                <WorkspaceAttention data={data} onOpen={openAttention} />
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
                      money(workspaceInsights(data).value.outstanding / 100),
                    ],
                    ["Clients", data.clients.length],
                  ].map(([label, value]) => (
                    <div className="stat" key={label}>
                      <div>{label}</div>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
                <WorkspaceInsights
                  data={data}
                  onOpenProject={(id) => {
                    setProjectId(id);
                    setView("Projects");
                    setProjectJump("#journey");
                  }}
                />
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
                            <small>
                              {projectRelationship(data, p)} ·{" "}
                              {data.prospectSpaces?.find(
                                (s) => s.project_id === p.id,
                              )
                                ? enquiryLabels[
                                    data.prospectSpaces.find(
                                      (s) => s.project_id === p.id,
                                    )!.enquiry_status
                                  ]
                                : ""}
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
            {admin && view === "Enquiries" && (
              <Enquiries data={data} Form={ActionForm} />
            )}
            {admin && view === "Clients" && (
              <>
                {clientNotice && (
                  <p role="status" className="banner">
                    {clientNotice}
                  </p>
                )}
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
                        <span className="pill">
                          {clientRelationship(data, c.id)}
                        </span>
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
                        {c.deletion_pending && (
                          <p role="status">
                            Deletion paused — client access is revoked. Open
                            Delete client permanently to retry cleanup.
                          </p>
                        )}
                        {!c.deletion_pending && (
                          <>
                            <details>
                              <summary>Edit client details</summary>
                              <ActionForm
                                action={editClient}
                                label="Save client"
                              >
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
                            <ClientAccess
                              client={c}
                              status={data.portalStatuses?.find(
                                (s) => s.client_id === c.id,
                              )}
                              ready={data.invitationsReady ?? false}
                            />
                          </>
                        )}
                        {data.clientDeletionReady && (
                          <DeleteClient
                            client={c}
                            projectCount={
                              data.projects.filter((p) => p.client_id === c.id)
                                .length
                            }
                            fileCount={
                              data.documents.filter((d) =>
                                data.projects.some(
                                  (p) =>
                                    p.id === d.project_id &&
                                    p.client_id === c.id,
                                ),
                              ).length +
                              (data.assets ?? []).filter((a) =>
                                data.projects.some(
                                  (p) =>
                                    p.id === a.project_id &&
                                    p.client_id === c.id,
                                ),
                              ).length
                            }
                            blocked={[
                              ...(data.finance?.invoices ?? []),
                              ...(data.finance?.proposals ?? []),
                            ].some((r) =>
                              data.projects.some(
                                (p) =>
                                  p.id === r.project_id && p.client_id === c.id,
                              ),
                            )}
                            onDeleted={setClientNotice}
                          />
                        )}
                      </section>
                    ))}
                </div>
              </>
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
                        {admin && (
                          <ProspectManagement
                            data={data}
                            project={project}
                            Form={ActionForm}
                          />
                        )}
                        <ProjectManagement
                          key={"management-" + project.id}
                          data={data}
                          project={project}
                          Form={ActionForm}
                        />
                        <ExistingBusinessRecords
                          data={data}
                          project={project}
                          Form={ActionForm}
                        />
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
                              setAccessClientId(project.client_id);
                            }}
                          />
                        )}
                        {admin && (
                          <HandoverPreparation
                            key={"handover-" + project.id}
                            data={data}
                            project={project}
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
                        <div
                          className="two-col detail"
                          key={"journey-" + project.id}
                        >
                          <div>
                            <section className="panel">
                              <h2 id="journey">Your project journey</h2>
                              <p className="section-description">
                                {admin
                                  ? "Open a stage to share files, review client returns and manage progress. Contract and payment checks have their own verification buttons."
                                  : "Open each stage for your files, instructions and next steps."}
                              </p>
                              {admin && otherVerificationFields.length > 0 && (
                                <details id="project-verification">
                                  <summary>Project verification checks</summary>
                                  <p>
                                    Review final creative approval and payment
                                    here before releasing final files and the
                                    goodbye packet. These records also remain
                                    available when stages are customised.
                                    Completing an ordinary milestone never
                                    confirms a contract or payment.
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
                                      className={
                                        s.visible
                                          ? "milestone-disclosure"
                                          : "milestone-disclosure stage-internal"
                                      }
                                      id={"stage-" + s.id}
                                      key={s.id}
                                    >
                                      <summary>
                                        <span className="stage-heading">
                                          {s.name}
                                          <small className="stage-meta">
                                            <span>{s.stream}</span>
                                            {!s.visible && (
                                              <span className="stage-internal-badge">
                                                <Lock
                                                  size={12}
                                                  aria-hidden="true"
                                                />
                                                Internal only
                                              </span>
                                            )}
                                          </small>
                                        </span>
                                        <span className="pill">{s.status}</span>
                                      </summary>
                                      <StageWorkspace
                                        data={data}
                                        stage={s}
                                        Form={ActionForm}
                                      />
                                      {data.stagePurposesReady && (
                                        <details className="settings-disclosure">
                                          <summary>
                                            Stage purpose
                                            {s.purpose == null
                                              ? " — choose purpose"
                                              : ""}
                                          </summary>
                                          <p>
                                            Choose what this stage tracks. Its
                                            name can then change freely. This
                                            choice does not verify a signature,
                                            payment or approval, change sharing,
                                            or release files. Project
                                            verification checks remain available
                                            for unassigned stages.
                                          </p>
                                          <ActionForm
                                            action={saveStagePurpose}
                                            label="Save stage purpose"
                                            key={s.id + String(s.purpose)}
                                          >
                                            <input
                                              type="hidden"
                                              name="id"
                                              value={s.id}
                                            />
                                            <label>
                                              Purpose
                                              <select
                                                name="purpose"
                                                defaultValue={s.purpose ?? ""}
                                                required
                                              >
                                                <option value="" disabled>
                                                  Choose purpose
                                                </option>
                                                {Object.entries(
                                                  stagePurposes,
                                                ).map(([value, label]) => (
                                                  <option
                                                    key={value}
                                                    value={value}
                                                  >
                                                    {label}
                                                  </option>
                                                ))}
                                              </select>
                                            </label>
                                            <label className="check-row">
                                              <input
                                                name="acknowledged"
                                                type="checkbox"
                                                required
                                              />
                                              I understand this does not verify
                                              a contract, approval or payment.
                                            </label>
                                          </ActionForm>
                                        </details>
                                      )}
                                      <details className="settings-disclosure">
                                        <summary>
                                          {stageVerification(s).length > 0
                                            ? "Edit stage settings"
                                            : "Update progress & stage settings"}
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
                                              {data.stagePurposesReady
                                                ? "This stage follows its fixed purpose. Renaming it keeps the same verification checks."
                                                : "This installation still uses standard stage names for these checks. Renamed stages use Project verification checks until the stage-purpose upgrade is applied."}
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
                                                  stageVerification(s).length >
                                                  0
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
                                    </details>
                                  ) : (
                                    <details
                                      className="portal-stage-detail"
                                      id={"stage-" + s.id}
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
                            <ProjectFiles
                              key={"files-" + project.id}
                              data={data}
                              project={project}
                              Form={ActionForm}
                            />
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
            <BrandSignature />
          </main>
        </div>
      </div>
    </PreviewContext.Provider>
  );
}
