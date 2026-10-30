"use client";
import { useState } from "react";
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
  if (data.role !== "admin") return null;
  const { projects, phases, value } = workspaceInsights(data, filter);
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
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as InsightFilter);
              setExpanded(null);
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
        <section
          className="panel pipeline-chart"
          aria-label="Projects by phase"
        >
          <header className="section-heading">
            <h3>Where projects stand</h3>
            <span className="status-badge">
              {projects.length} {projects.length === 1 ? "project" : "projects"}
            </span>
          </header>
          <p>
            Based on each project’s next stage and verification checks. Choose a
            bar to see the projects.
          </p>
          {projects.length ? (
            <div className="phase-bars">
              {phases.map((phase) => (
                <div key={phase.key}>
                  <button
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
                          width: `${(phase.projects.length / projects.length) * 100}%`,
                        }}
                      />
                    </span>
                  </button>
                  <div
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
                            {
                              data.clients.find((c) => c.id === p.client_id)
                                ?.name
                            }
                          </small>
                        </span>
                        <ArrowUpRight size={16} aria-hidden="true" />
                        <span className="sr-only">Open project</span>
                      </button>
                    ))}
                  </div>
                </div>
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
          <p className="chart-note">
            Completed milestones don’t mean a project has been delivered.
            Projects being deleted are excluded.
          </p>
        </section>
        <section
          className="panel payment-chart"
          aria-label="Project payment progress"
        >
          <header className="section-heading">
            <h3>Project payment progress</h3>
            <span className="payment-percent">
              {percent}%<small>marked received</small>
            </span>
          </header>
          <div className="payment-value">
            <span>Total project value</span>
            <strong>{pounds(value.total)}</strong>
          </div>
          {value.total ? (
            <div className="payment-track" aria-hidden="true">
              <span
                style={{ width: `${(value.received / value.total) * 100}%` }}
              />
            </div>
          ) : (
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
    </section>
  );
}
