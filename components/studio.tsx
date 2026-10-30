"use client";
import BrandSignature from "./brand-signature";
import BrandMark from "@/components/brand-mark";
import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  Plus,
  LayoutDashboard,
  Users,
  FolderKanban,
  Inbox,
  Wallet,
  Files,
  ArrowLeft,
  Check,
  ChevronRight,
  ExternalLink,
  Menu,
  Search,
  X,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import {
  clients as initialClients,
  seedProjects,
  createStages,
  progress,
  statuses,
  clientStages,
  portalAvailable,
  deliveryAvailable,
  type Project,
  type Client,
  type ProjectType,
} from "@/lib/projects";
const paid = (p: Project) =>
  p.budget * ((p.deposit ? 0.5 : 0) + (p.finalPaid ? 0.5 : 0));
const money = (n: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n);
const nav = [
  ["Overview", LayoutDashboard],
  ["Projects", FolderKanban],
  ["Clients", Users],
  ["Enquiries", Inbox],
  ["Finance", Wallet],
  ["Documents", Files],
] as const;
type Enquiry = { id: string; name: string; service: string; status: string };
export default function Studio() {
  const [view, setView] = useState("Overview");
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [modal, setModal] = useState<"project" | "client" | null>(null);
  const [portal, setPortal] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [enquiries, setEnquiries] = useState<Enquiry[]>([
    {
      id: "e1",
      name: "Serein House",
      service: "Brand Identity + Website",
      status: "New",
    },
    {
      id: "e2",
      name: "North & Kin",
      service: "Brand Identity",
      status: "Discovery call",
    },
  ]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("aba-demo-v1");
      if (saved) {
        const data = JSON.parse(saved);
        if (
          !Array.isArray(data.projects) ||
          !Array.isArray(data.clients) ||
          !Array.isArray(data.enquiries)
        )
          throw Error();
        setProjects(data.projects);
        setClients(data.clients);
        setEnquiries(data.enquiries);
      } else setProjects(seedProjects());
    } catch {
      setProjects(seedProjects());
      setStorageError(
        "Saved demo data could not be loaded. Showing the example projects.",
      );
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem(
          "aba-demo-v1",
          JSON.stringify({ projects, clients, enquiries }),
        );
      } catch {
        setStorageError(
          "Browser storage is unavailable. Changes will last for this visit only.",
        );
      }
  }, [projects, clients, enquiries, ready]);
  useEffect(() => {
    if (!modal) return;
    const prior = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModal(null);
      if (e.key === "Tab" && dialog) {
        const nodes = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            "button,input,select,textarea,a[href]",
          ),
        ).filter((n) => !n.hasAttribute("disabled"));
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      prior?.focus();
    };
  }, [modal]);
  const project = projects.find((p) => p.id === selected) ?? projects[0];
  const client = (p: Project) => clients.find((c) => c.id === p.clientId)!;
  function update(p: Project, action: string) {
    setProjects((old) =>
      old.map((x) =>
        x.id === p.id
          ? { ...p, activity: [action, ...p.activity].slice(0, 30) }
          : x,
      ),
    );
  }
  function go(v: string) {
    setView(v);
    setSelected(null);
    setMobile(false);
    setQuery("");
  }
  function createProject(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const type = f.get("type") as ProjectType;
    const p: Project = {
      id: crypto.randomUUID(),
      name: String(f.get("name")).trim(),
      clientId: String(f.get("client")),
      type,
      due: String(f.get("due")),
      budget: Number(f.get("budget")),
      deposit: false,
      contract: false,
      finalPaid: false,
      stages: createStages(type),
      activity: ["Project created"],
      notes: "",
    };
    if (!p.name) return;
    setProjects([...projects, p]);
    setSelected(p.id);
    setView("Projects");
    setModal(null);
  }
  const filtered = projects.filter((p) =>
    (p.name + " " + client(p)?.name)
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  function cards(list: Project[]) {
    return (
      <div className="project-grid">
        {list.map((p, i) => (
          <button
            key={p.id}
            className="project-card"
            onClick={() => {
              setSelected(p.id);
              setView("Projects");
            }}
          >
            <div className={"art art-" + (i % 3)}>
              {p.type === "Website Design" ? (
                <div className="coffee-mark">
                  fieldwork<span>GOOD COFFEE. GOOD COMPANY.</span>
                  <div className="coffee-lines">◡ ◡ ◡</div>
                </div>
              ) : (
                <div className="forma-mark">
                  forma<span>OBJECTS FOR EVERYDAY RITUALS</span>
                  <div className="sculpture" />
                </div>
              )}
              <span className="art-tag">{p.type}</span>
              <span className="art-arrow">
                <ArrowUpRight size={18} />
              </span>
            </div>
            <div className="card-body">
              <div className="eyebrow">{client(p)?.name}</div>
              <h3>{p.name}</h3>
              <div className="card-meta">
                <span>
                  {p.stages.find((s) => s.status !== "Completed")?.name ??
                    "Project complete"}
                </span>
                <span>{progress(p.stages)}%</span>
              </div>
              <div className="progress">
                <i style={{ width: progress(p.stages) + "%" }} />
              </div>
              <div className="card-bottom">
                <span>
                  Due{" "}
                  {new Date(p.due + "T12:00:00").toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
                <span className="pill">
                  {p.stages.some((s) => s.status === "Awaiting Client")
                    ? "Awaiting client"
                    : "In progress"}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className={portal ? "shell portal-mode" : "shell"}>
      <aside className={mobile ? "sidebar open" : "sidebar"}>
        <a className="logo" href="/">
          <BrandMark />
        </a>
        <div className="workspace-label">
          ALEX BELL ARTS <span>WORKSPACE</span>
        </div>
        <nav>
          {nav.map(([n, Icon]) => (
            <button
              key={n}
              className={view === n && !portal ? "active" : ""}
              onClick={() => {
                setPortal(false);
                go(n);
              }}
            >
              <Icon size={18} />
              {n}
              {n === "Enquiries" && (
                <em>{enquiries.filter((e) => e.status === "New").length}</em>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="portal-callout">
            <span className="small-star">✳</span>
            <h4>The client experience</h4>
            <p>A little clarity. A lot of care.</p>
            <button
              onClick={() => {
                setPortal(true);
                setMobile(false);
              }}
            >
              Preview client portal <ArrowUpRight size={15} />
            </button>
          </div>
          <div className="profile">
            <span className="avatar">AB</span>
            <div>
              Alex Bell<small>Independent designer</small>
            </div>
            <span className="online" />
          </div>
        </div>
      </aside>
      <div className="main-wrap">
        <header className="topbar">
          <button
            className="mobile-menu icon-button"
            aria-label="Toggle navigation"
            onClick={() => setMobile(!mobile)}
          >
            <Menu />
          </button>
          <span>
            Workspace <ChevronRight size={13} />{" "}
            <b>{portal ? "Client portal preview" : view}</b>
          </span>
          <div className="top-right">
            <span className="demo-dot" /> Fictional demo data{" "}
            <span className="avatar small">AB</span>
          </div>
        </header>
        <main>
          {storageError && (
            <div role="alert" className="banner">
              {storageError}
            </div>
          )}
          {notice && (
            <div className="banner" role="status">
              {notice}
              <button
                aria-label="Dismiss message"
                onClick={() => setNotice("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {portal && project ? (
            <>
              <div className="banner">
                Client preview · No sign-in or private access is implemented.
                Use fictional data only.
              </div>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">YOUR CREATIVE JOURNEY</div>
                  <h1>
                    Hello, {client(project)?.contact.split(" ")[0]}
                    <span className="serif">.</span>
                  </h1>
                  <p>
                    A considered space for your project, from first ideas to
                    final details.
                  </p>
                </div>
                <select
                  aria-label="Preview project"
                  value={project.id}
                  onChange={(e) => setSelected(e.target.value)}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {client(p)?.name} — {p.type}
                    </option>
                  ))}
                </select>
              </div>
              {!portalAvailable(project) ? (
                <div className="panel empty">
                  <h2>Your project is getting ready</h2>
                  <p>
                    Your signed contract and 50% deposit are needed before
                    onboarding begins. This is a demonstration gate, not
                    security.
                  </p>
                </div>
              ) : (
                <>
                  <div className="portal-hero">
                    <div className="eyebrow">
                      {client(project)?.name} / {project.type}
                    </div>
                    <h2>{project.name}</h2>
                    <p>I’m here to help bring your next chapter to life.</p>
                    <div className="progress">
                      <i
                        style={{ width: progress(clientStages(project)) + "%" }}
                      />
                    </div>
                    <span>
                      {progress(clientStages(project))}% complete · Based on
                      completed visible milestones
                    </span>
                  </div>
                  <div className="two-col">
                    <section className="panel">
                      <h2>Your project journey</h2>
                      {clientStages(project).map((s) => (
                        <div className="portal-stage" key={s.id}>
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
                              <span>·</span>
                            )}
                          </span>
                          <div>
                            <b>{s.name}</b>
                            <small>{s.stream}</small>
                          </div>
                          <span className="pill">{s.status}</span>
                        </div>
                      ))}
                    </section>
                    <div>
                      <section className="panel">
                        <h2>Your next steps</h2>
                        {project.type !== "Website Design" && (
                          <a
                            className="resource"
                            href="https://tally.so/r/mRAXk9"
                            target="_blank"
                            rel="noreferrer"
                          >
                            AI Logo Direction Exercise{" "}
                            <ExternalLink size={16} />
                          </a>
                        )}
                        {project.type !== "Brand Identity" && (
                          <p>
                            Website brief: collect your page list, content,
                            references and website goals. Native questionnaire
                            planned for Phase 2.
                          </p>
                        )}
                        <p>
                          Feedback and approvals will be available once your
                          secure portal is connected.
                        </p>
                      </section>
                      <section className="panel">
                        <h2>Project documents</h2>
                        <p>
                          Contract, invoice and presentation sharing are
                          demonstration placeholders. No files are uploaded.
                        </p>
                        <h3>Final delivery</h3>
                        <p>
                          {deliveryAvailable(project)
                            ? "Demo release conditions met. Final files will appear here when secure storage is connected."
                            : "Final files remain locked until final approval and the remaining 50% payment are recorded."}
                        </p>
                        {deliveryAvailable(project) && (
                          <a
                            className="resource"
                            href="https://tally.so/r/Z9jk9o"
                            target="_blank"
                            rel="noreferrer"
                          >
                            Goodbye & feedback <ExternalLink size={16} />
                          </a>
                        )}
                      </section>
                    </div>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">YOUR STUDIO, IN FOCUS</div>
                  <h1>
                    {selected && project
                      ? client(project)?.name
                      : view === "Overview"
                        ? "Good things take shape."
                        : view}
                    <span className="serif">
                      {view === "Overview" ? "" : " "}
                    </span>
                  </h1>
                  <p>
                    {selected
                      ? "Every detail, moving in the right direction."
                      : view === "Overview"
                        ? "A little overview of your projects, people and what’s next."
                        : "A considered home for the details of your business."}
                  </p>
                </div>
                <button
                  className="primary"
                  onClick={() =>
                    setModal(view === "Clients" ? "client" : "project")
                  }
                >
                  <Plus size={17} />
                  {view === "Clients" ? "New client" : "New project"}
                </button>
              </div>
              {view === "Overview" && !selected && (
                <>
                  <div className="overview-intro">
                    <span>
                      <span className="online" /> STUDIO OVERVIEW
                    </span>
                    <span>Tuesday, 27 October 2026 · Demo snapshot</span>
                  </div>
                  <div className="stats">
                    {[
                      [
                        "Active projects",
                        projects.filter((p) => progress(p.stages) < 100).length,
                        "Ideas becoming something real.",
                      ],
                      [
                        "Awaiting feedback",
                        projects.filter((p) =>
                          p.stages.some(
                            (s) =>
                              s.status === "Awaiting Client" ||
                              s.status === "Awaiting Approval",
                          ),
                        ).length,
                        "Ready for a fresh pair of eyes.",
                      ],
                      [
                        "Outstanding balance",
                        money(
                          projects.reduce((a, p) => a + p.budget - paid(p), 0),
                        ),
                        "Based on demo payment records.",
                      ],
                      [
                        "Payments recorded",
                        money(projects.reduce((a, p) => a + paid(p), 0)),
                        "All-time fictional receipts.",
                      ],
                    ].map(([title, value, note], i) => (
                      <div className="stat" key={title}>
                        <div>
                          {title}
                          <ArrowUpRight size={16} />
                        </div>
                        <strong>
                          {value}
                          <span>{i < 2 ? " / 0" + (i + 1) : ""}</span>
                        </strong>
                        <small>{note}</small>
                      </div>
                    ))}
                  </div>
                  <div className="section-heading">
                    <div>
                      <h2>
                        On the drawing board{" "}
                        <span>
                          {projects.length.toString().padStart(2, "0")}
                        </span>
                      </h2>
                      <p>The projects you’re bringing to life.</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => go("Projects")}
                    >
                      All projects <ArrowUpRight size={16} />
                    </button>
                  </div>
                  {cards(projects.slice(0, 2))}
                  <div className="two-col lower">
                    <section className="panel">
                      <div className="section-heading">
                        <h2>Coming up next</h2>
                        <span className="eyebrow">PROJECT DEADLINES</span>
                      </div>
                      {projects
                        .slice()
                        .sort((a, b) => a.due.localeCompare(b.due))
                        .map((p) => (
                          <button
                            className="list-row"
                            key={p.id}
                            onClick={() => {
                              setSelected(p.id);
                              setView("Projects");
                            }}
                          >
                            <span className="date-box">
                              {new Date(p.due + "T12:00:00").toLocaleDateString(
                                "en-GB",
                                { month: "short" },
                              )}
                              <b>{p.due.slice(-2)}</b>
                            </span>
                            <div>
                              <b>{p.name}</b>
                              <small>
                                {client(p)?.name} · {p.type}
                              </small>
                            </div>
                            <ArrowUpRight size={17} />
                          </button>
                        ))}
                    </section>
                    <section className="panel">
                      <div className="section-heading">
                        <h2>A new conversation</h2>
                        <Inbox size={18} />
                      </div>
                      {enquiries
                        .filter(
                          (e) => !["Archived", "Declined"].includes(e.status),
                        )
                        .slice(0, 2)
                        .map((e) => (
                          <button
                            key={e.id}
                            className="list-row"
                            onClick={() => go("Enquiries")}
                          >
                            <span className="avatar pale">
                              {e.name.slice(0, 1)}
                            </span>
                            <div>
                              <b>{e.name}</b>
                              <small>{e.service}</small>
                            </div>
                            <span className="pill">{e.status}</span>
                          </button>
                        ))}
                      <a
                        className="text-button"
                        href="https://tally.so/r/mOLMrk"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open public enquiry form <ArrowUpRight size={16} />
                      </a>
                    </section>
                  </div>
                </>
              )}
              {view === "Projects" && !selected && (
                <>
                  <div className="toolbar">
                    <label className="search">
                      <Search size={16} />
                      <input
                        placeholder="Search projects or clients"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </label>
                    <span>{filtered.length} projects</span>
                  </div>
                  {cards(filtered)}
                  {!filtered.length && <p>No projects match your search.</p>}
                </>
              )}
              {selected && project && (
                <>
                  <button
                    className="text-button back"
                    onClick={() => setSelected(null)}
                  >
                    <ArrowLeft size={16} /> Back to projects
                  </button>
                  <div className="project-summary">
                    <div>
                      <span className="eyebrow">{project.type}</span>
                      <h2>{project.name}</h2>
                      <p>
                        {money(project.budget)} project value · Due{" "}
                        {project.due}
                      </p>
                    </div>
                    <div>
                      <strong>{progress(project.stages)}%</strong>
                      <span>milestones complete</span>
                    </div>
                  </div>
                  <div className="progress">
                    <i style={{ width: progress(project.stages) + "%" }} />
                  </div>
                  <div className="two-col detail">
                    <section className="panel">
                      <div className="section-heading">
                        <h2>Workflow & milestones</h2>
                        <button
                          className="text-button"
                          onClick={() =>
                            update(
                              {
                                ...project,
                                stages: [
                                  ...project.stages,
                                  {
                                    id: crypto.randomUUID(),
                                    name: "New milestone",
                                    stream: "Custom",
                                    status: "Not Started",
                                    visible: true,
                                  },
                                ],
                              },
                              "Milestone added",
                            )
                          }
                        >
                          <Plus size={15} /> Add stage
                        </button>
                      </div>
                      <p className="muted">
                        Rename, reorder, change status or choose what appears in
                        the client preview.
                      </p>
                      {project.stages.map((s, i) => (
                        <div className="stage-editor" key={s.id}>
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
                              i + 1
                            )}
                          </span>
                          <div className="stage-main">
                            <small>{s.stream}</small>
                            <input
                              aria-label={"Stage name " + (i + 1)}
                              value={s.name}
                              maxLength={120}
                              onChange={(e) =>
                                update(
                                  {
                                    ...project,
                                    stages: project.stages.map((t) =>
                                      t.id === s.id
                                        ? { ...t, name: e.target.value }
                                        : t,
                                    ),
                                  },
                                  "Milestone renamed",
                                )
                              }
                            />
                            <div className="stage-controls">
                              <select
                                aria-label={"Status for " + s.name}
                                value={s.status}
                                onChange={(e) =>
                                  update(
                                    {
                                      ...project,
                                      stages: project.stages.map((t) =>
                                        t.id === s.id
                                          ? {
                                              ...t,
                                              status: e.target
                                                .value as typeof s.status,
                                            }
                                          : t,
                                      ),
                                    },
                                    s.name + ": " + e.target.value,
                                  )
                                }
                              >
                                {statuses.map((x) => (
                                  <option key={x}>{x}</option>
                                ))}
                              </select>
                              <label>
                                <input
                                  type="checkbox"
                                  checked={s.visible}
                                  onChange={(e) =>
                                    update(
                                      {
                                        ...project,
                                        stages: project.stages.map((t) =>
                                          t.id === s.id
                                            ? {
                                                ...t,
                                                visible: e.target.checked,
                                              }
                                            : t,
                                        ),
                                      },
                                      "Client visibility updated",
                                    )
                                  }
                                />{" "}
                                Client visible
                              </label>
                            </div>
                          </div>
                          <div className="stage-actions">
                            <button
                              aria-label={"Move up " + s.name}
                              disabled={i === 0}
                              onClick={() => {
                                const a = [...project.stages];
                                [a[i - 1], a[i]] = [a[i], a[i - 1]];
                                update(
                                  { ...project, stages: a },
                                  "Milestone reordered",
                                );
                              }}
                            >
                              <ArrowUp size={13} />
                            </button>
                            <button
                              aria-label={"Move down " + s.name}
                              disabled={i === project.stages.length - 1}
                              onClick={() => {
                                const a = [...project.stages];
                                [a[i], a[i + 1]] = [a[i + 1], a[i]];
                                update(
                                  { ...project, stages: a },
                                  "Milestone reordered",
                                );
                              }}
                            >
                              <ArrowDown size={13} />
                            </button>
                            <button
                              aria-label={"Remove " + s.name}
                              onClick={() => {
                                if (confirm("Remove this milestone?"))
                                  update(
                                    {
                                      ...project,
                                      stages: project.stages.filter(
                                        (t) => t.id !== s.id,
                                      ),
                                    },
                                    "Milestone removed",
                                  );
                              }}
                            >
                              <X size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </section>
                    <div>
                      <section className="panel">
                        <h2>Onboarding & payment</h2>
                        <p>
                          Manual demo records only. No payments or signatures
                          are processed.
                        </p>
                        {[
                          ["contract", "Contract signed"],
                          ["deposit", "50% deposit received"],
                          ["finalPaid", "Final 50% received"],
                        ].map(([key, label]) => (
                          <label className="check-row" key={key}>
                            <input
                              type="checkbox"
                              checked={Boolean(project[key as keyof Project])}
                              onChange={(e) =>
                                update(
                                  { ...project, [key]: e.target.checked },
                                  label + " updated",
                                )
                              }
                            />
                            {label}
                          </label>
                        ))}
                        <button
                          className="secondary full"
                          onClick={() => setPortal(true)}
                        >
                          Preview this client’s portal{" "}
                          <ArrowUpRight size={16} />
                        </button>
                      </section>
                      <section className="panel">
                        <h2>Internal notes</h2>
                        <p>
                          Excluded from the client preview. This demo is not a
                          secure private store.
                        </p>
                        <textarea
                          aria-label="Internal project notes"
                          value={project.notes}
                          onChange={(e) =>
                            setProjects(
                              projects.map((p) =>
                                p.id === project.id
                                  ? { ...p, notes: e.target.value }
                                  : p,
                              ),
                            )
                          }
                        />
                      </section>
                      <section className="panel">
                        <h2>Project activity</h2>
                        {project.activity.slice(0, 6).map((a, i) => (
                          <div className="activity" key={i}>
                            <span />
                            {a}
                          </div>
                        ))}
                      </section>
                    </div>
                  </div>
                </>
              )}
              {view === "Clients" && !selected && (
                <>
                  <label className="search">
                    <Search size={16} />
                    <input
                      placeholder="Search clients"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  <div className="client-grid">
                    {clients
                      .filter((c) =>
                        (c.name + c.contact)
                          .toLowerCase()
                          .includes(query.toLowerCase()),
                      )
                      .map((c) => (
                        <section className="panel client-card" key={c.id}>
                          <span className="avatar pale">
                            {c.name.slice(0, 1)}
                          </span>
                          <span className="eyebrow">{c.sector}</span>
                          <h2>{c.name}</h2>
                          <p>
                            {c.contact}
                            <br />
                            {c.email}
                          </p>
                          <div className="client-projects">
                            {projects
                              .filter((p) => p.clientId === c.id)
                              .map((p) => (
                                <button
                                  className="resource"
                                  key={p.id}
                                  onClick={() => {
                                    setSelected(p.id);
                                    setView("Projects");
                                  }}
                                >
                                  {p.name}
                                  <ArrowUpRight size={15} />
                                </button>
                              ))}
                          </div>
                          <small>
                            {projects.filter((p) => p.clientId === c.id).length}{" "}
                            associated projects · Fictional client
                          </small>
                        </section>
                      ))}
                  </div>
                </>
              )}
              {view === "Enquiries" && (
                <section className="panel">
                  <div className="section-heading">
                    <h2>From first hello to next chapter.</h2>
                    <a
                      className="text-button"
                      href="https://tally.so/r/mOLMrk"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Public Tally form <ExternalLink size={15} />
                    </a>
                  </div>
                  <p>
                    Tally opens externally. Submissions are not synced; webhook
                    integration is planned for Phase 2.
                  </p>
                  {enquiries.map((e) => (
                    <div className="list-row" key={e.id}>
                      <span className="avatar pale">{e.name[0]}</span>
                      <div>
                        <b>{e.name}</b>
                        <small>{e.service} · Fictional enquiry</small>
                      </div>
                      <select
                        aria-label={"Enquiry status " + e.name}
                        value={e.status}
                        onChange={(ev) =>
                          setEnquiries(
                            enquiries.map((x) =>
                              x.id === e.id
                                ? { ...x, status: ev.target.value }
                                : x,
                            ),
                          )
                        }
                      >
                        {[
                          "New",
                          "Discovery call",
                          "Proposal sent",
                          "Converted",
                          "Archived",
                          "Declined",
                        ].map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                      <button
                        className="secondary"
                        disabled={e.status === "Converted"}
                        onClick={() => {
                          if (!clients.some((c) => c.name === e.name))
                            setClients([
                              ...clients,
                              {
                                id: crypto.randomUUID(),
                                name: e.name,
                                contact: "Demo contact",
                                email: "contact@example.com",
                                sector: "Creative business",
                              },
                            ]);
                          setEnquiries(
                            enquiries.map((x) =>
                              x.id === e.id ? { ...x, status: "Converted" } : x,
                            ),
                          );
                          setNotice(
                            e.name +
                              " added to Clients. You can now create their project.",
                          );
                        }}
                      >
                        Convert to client
                      </button>
                    </div>
                  ))}
                </section>
              )}
              {view === "Finance" && (
                <section className="panel">
                  <h2>Project finances</h2>
                  <p>
                    Fictional payment tracking. No invoices are generated and no
                    real payments are processed.
                  </p>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Project</th>
                          <th>Value</th>
                          <th>Deposit (50%)</th>
                          <th>Final (50%)</th>
                          <th>Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projects.map((p) => (
                          <tr key={p.id}>
                            <td>
                              <button
                                className="text-button"
                                onClick={() => {
                                  setSelected(p.id);
                                  setView("Projects");
                                }}
                              >
                                {client(p)?.name}
                              </button>
                            </td>
                            <td>{money(p.budget)}</td>
                            <td>
                              {p.deposit ? "Recorded" : "Awaiting"} ·{" "}
                              {money(p.budget / 2)}
                            </td>
                            <td>
                              {p.finalPaid ? "Recorded" : "Awaiting"} ·{" "}
                              {money(p.budget / 2)}
                            </td>
                            <td>{money(p.budget - paid(p))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
              {view === "Documents" && (
                <section className="panel empty">
                  <Files size={35} />
                  <h2>A home for every detail.</h2>
                  <p>
                    Secure document uploads, presentations, contracts and final
                    files are planned for Phase 2.
                    <br />
                    No sample downloads or real file storage are connected yet.
                  </p>
                  <button className="secondary" onClick={() => go("Projects")}>
                    Browse project workflows <ArrowUpRight size={16} />
                  </button>
                </section>
              )}
            </>
          )}
          <BrandSignature />
        </main>
      </div>
      {modal && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <button
              className="close icon-button"
              aria-label="Close dialog"
              onClick={() => setModal(null)}
            >
              <X />
            </button>
            <div className="eyebrow">A NEW CHAPTER</div>
            <h2 id="modal-title">
              {modal === "project"
                ? "Make room for something good."
                : "Meet your next collaborator."}
            </h2>
            <p>Demonstration only. Please use fictional details.</p>
            {modal === "project" ? (
              <form onSubmit={createProject}>
                <label>
                  Project name
                  <input
                    name="name"
                    required
                    maxLength={100}
                    autoFocus
                    placeholder="e.g. A thoughtful new identity"
                  />
                </label>
                <label>
                  Client
                  <select name="client" required>
                    {clients.map((c) => (
                      <option value={c.id} key={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Project workflow
                  <select name="type">
                    <option>Brand Identity</option>
                    <option>Website Design</option>
                    <option value="Both">
                      Brand Identity + Website Design
                    </option>
                  </select>
                </label>
                <div className="form-grid">
                  <label>
                    Project value (£)
                    <input
                      name="budget"
                      type="number"
                      min="0"
                      max="10000000"
                      step="0.01"
                      required
                      defaultValue="3000"
                    />
                  </label>
                  <label>
                    Estimated completion
                    <input name="due" type="date" required />
                  </label>
                </div>
                <p className="muted">
                  Your workflow stages are created automatically. Edit them any
                  time.
                </p>
                <button className="primary full" type="submit">
                  Create project <Plus size={16} />
                </button>
              </form>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  setClients([
                    ...clients,
                    {
                      id: crypto.randomUUID(),
                      name: String(f.get("business")).trim(),
                      contact: String(f.get("contact")).trim(),
                      email: String(f.get("email")),
                      sector: String(f.get("sector")),
                    },
                  ]);
                  setModal(null);
                }}
              >
                {[
                  ["business", "Business name"],
                  ["contact", "Contact name"],
                  ["email", "Email address"],
                  ["sector", "Business sector"],
                ].map(([name, label], i) => (
                  <label key={name}>
                    {label}
                    <input
                      name={name}
                      required
                      maxLength={120}
                      type={name === "email" ? "email" : "text"}
                      autoFocus={i === 0}
                    />
                  </label>
                ))}
                <button className="primary full">
                  Create client <Plus size={16} />
                </button>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
