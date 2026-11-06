"use client";
import { useState } from "react";
import ProjectValueChart from "./project-value-chart";
import type { WorkspaceData } from "@/lib/workspace";
import {
  workspaceInsights,
  type InsightFilter,
  type ProjectPhase,
} from "@/lib/workspace-insights";
import { pounds } from "@/lib/finance/money";
import { ArrowUpRight, BarChart3 } from "lucide-react";
const filters: { value: InsightFilter; label: string }[] = [
  { value: "All projects", label: "All projects" },
  { value: "Brand Identity", label: "Branding" },
  { value: "Website Design", label: "Websites" },
  { value: "Both", label: "Combined" },
];
export default function WorkspaceInsights({
  data,
  onOpenProject,
}: {
  data: WorkspaceData;
  onOpenProject: (id: string) => void;
}) {
  const [filter, setFilter] = useState<InsightFilter>("All projects");
  const [expanded, setExpanded] = useState<ProjectPhase | null>(null);
  const [showAll, setShowAll] = useState(false);
  if (data.role !== "admin") return null;
  const { projects, phases, value, progress } = workspaceInsights(data, filter);
  const mostInPhase = Math.max(1, ...phases.map((p) => p.projects.length));
  const percent = value.total
    ? Math.round((value.received / value.total) * 100)
    : 0;
  return (
    <section className="workspace-insights" aria-label="Studio insights">
      <header className="insights-heading">
        <div>
          <span className="section-kicker">THE BIGGER PICTURE</span>
          <h2>Studio at a glance</h2>
        </div>
        <label>
          Show projects
          <select
            aria-label="Show projects"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as InsightFilter);
              setExpanded(null);
              setShowAll(false);
            }}
          >
            {filters.map((f) => (
              <option value={f.value} key={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
      </header>
      <div className="insights-grid">
        <div className="insights-column">
          <ProjectValueChart
            data={data}
            filter={filter}
            onOpenProject={onOpenProject}
          />
          <section
            className="panel dashboard-chart payment-chart"
            aria-label="Project payment progress"
          >
            <header className="section-heading">
              <h3>Project payment progress</h3>
              <span className="status-badge">50 / 50 checks</span>
            </header>
            <div className="payment-overview">
              <div
                className="payment-ring"
                role="img"
                aria-label={`${percent}% of project value marked received`}
                style={{
                  background: value.total
                    ? `conic-gradient(#d4e600 0% ${percent}%, #a960ff ${percent}% 100%)`
                    : "#3a3043",
                }}
              >
                <div>
                  <strong>{percent}%</strong>
                  <span>marked received</span>
                </div>
              </div>
              <div className="payment-value">
                <span>Total project value</span>
                <strong>{pounds(value.total)}</strong>
              </div>
            </div>
            {!value.total && (
              <p className="insight-empty">
                No project value recorded in this view yet.
              </p>
            )}
            <dl className="payment-key">
              <div>
                <dt>
                  <span className="chart-swatch received" />
                  Marked received
                </dt>
                <dd>{pounds(value.received)}</dd>
              </div>
              <div>
                <dt>
                  <span className="chart-swatch outstanding" />
                  Not marked received
                </dt>
                <dd>{pounds(value.outstanding)}</dd>
              </div>
            </dl>
            <p className="chart-note">
              Based on current project values and your deposit/final-payment
              checks. This is a planning view, not an invoice balance or bank
              total.
            </p>
          </section>
        </div>
        <div className="insights-column">
          <section
            className="panel dashboard-chart pipeline-chart"
            aria-label="Projects by phase"
          >
            <header className="section-heading">
              <h3>Where projects stand</h3>
              <span className="status-badge">
                {projects.length}{" "}
                {projects.length === 1 ? "project" : "projects"}
              </span>
            </header>
            <p>
              Based on each project’s next stage and verification checks. Choose
              a bar to see the projects.
            </p>
            {projects.length ? (
              <div className="phase-bars">
                {phases.map((phase) => (
                  <button
                    key={phase.key}
                    type="button"
                    className={"phase-bar phase-" + phase.key}
                    disabled={!phase.projects.length}
                    aria-expanded={expanded === phase.key}
                    aria-controls={"phase-projects-" + phase.key}
                    onClick={() =>
                      setExpanded(expanded === phase.key ? null : phase.key)
                    }
                  >
                    <span className="phase-caption">
                      <span>{phase.label}</span>
                      <b>
                        {phase.projects.length}
                        <span className="sr-only"> projects</span>
                      </b>
                    </span>
                    <span className="phase-track" aria-hidden="true">
                      <span
                        style={{
                          height: `${(phase.projects.length / mostInPhase) * 100}%`,
                        }}
                      />
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="insight-empty">
                <BarChart3 size={28} aria-hidden="true" />
                <p>
                  No projects in this view yet. Your chart will appear when you
                  add one.
                </p>
              </div>
            )}
            {phases.map((phase) => (
              <div
                key={phase.key}
                id={"phase-projects-" + phase.key}
                hidden={expanded !== phase.key}
                className="phase-projects"
              >
                {phase.projects.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onOpenProject(p.id)}
                  >
                    <span>
                      {p.name}
                      <small>
                        {data.clients.find((c) => c.id === p.client_id)?.name}
                      </small>
                    </span>
                    <ArrowUpRight size={16} aria-hidden="true" />
                    <span className="sr-only">Open project</span>
                  </button>
                ))}
              </div>
            ))}
            <p className="chart-note">
              Completed milestones don’t mean a project has been delivered.
              Projects being deleted are excluded.
            </p>
          </section>
          <section
            className="panel dashboard-chart project-progress-chart"
            aria-label="Project milestone progress"
          >
            <header className="section-heading">
              <h3>Project progress</h3>
              <span className="status-badge">{projects.length} active</span>
            </header>
            <p className="chart-description">
              Milestones completed across each project’s workstreams.
            </p>
            {progress.length ? (
              <>
                <div className="project-progress-rows">
                  {(showAll ? progress : progress.slice(0, 5)).map(
                    ({ project, completed, total, percent }) => (
                      <button
                        type="button"
                        key={project.id}
                        onClick={() => onOpenProject(project.id)}
                      >
                        <span className="project-progress-caption">
                          <span>
                            <strong>{project.name}</strong>
                            <small>
                              {
                                data.clients.find(
                                  (c) => c.id === project.client_id,
                                )?.name
                              }
                            </small>
                          </span>
                          <b>
                            {percent}%
                            <ArrowUpRight size={14} aria-hidden="true" />
                          </b>
                        </span>
                        <span
                          className="project-progress-track"
                          aria-hidden="true"
                        >
                          <span style={{ width: `${percent}%` }} />
                        </span>
                        <span className="project-progress-count">
                          {total
                            ? `${completed} of ${total} milestones complete`
                            : "No milestones added"}
                        </span>
                      </button>
                    ),
                  )}
                </div>
                {progress.length > 5 && (
                  <button
                    type="button"
                    className="chart-expand"
                    aria-expanded={showAll}
                    onClick={() => setShowAll(!showAll)}
                  >
                    {showAll
                      ? "Show fewer projects"
                      : `Show all ${progress.length} projects`}
                  </button>
                )}
              </>
            ) : (
              <p className="insight-empty">No projects in this view yet.</p>
            )}
            <p className="chart-note">
              Includes internal milestones. Final file release still requires
              verified approval and payment.
            </p>
          </section>
        </div>
      </div>
    </section>
  );
}
