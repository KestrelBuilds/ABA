"use client";
import { Search } from "lucide-react";
import {
  defaultProjectFilters,
  type ProjectFilters,
} from "@/lib/project-search";
export default function ProjectFinder({
  filters,
  count,
  total,
  archivesReady,
  onChange,
}: {
  filters: ProjectFilters;
  count: number;
  total: number;
  archivesReady: boolean;
  onChange: (filters: ProjectFilters) => void;
}) {
  const filtered = Object.keys(defaultProjectFilters).some(
    (key) =>
      filters[key as keyof ProjectFilters] !==
      defaultProjectFilters[key as keyof ProjectFilters],
  );
  return (
    <section
      className="panel project-finder"
      aria-labelledby="project-finder-title"
    >
      <h2 id="project-finder-title">
        <Search size={18} aria-hidden="true" /> Find a project
      </h2>
      <div className="project-finder-controls">
        <label>
          Search projects
          <input
            type="search"
            value={filters.query}
            maxLength={180}
            placeholder="Project or client name"
            onChange={(event) =>
              onChange({ ...filters, query: event.target.value })
            }
          />
        </label>
        <label>
          Project type
          <select
            aria-label="Project type"
            value={filters.service}
            onChange={(event) =>
              onChange({
                ...filters,
                service: event.target.value as ProjectFilters["service"],
              })
            }
          >
            <option value="all">All services</option>
            <option value="Brand Identity">Brand Identity</option>
            <option value="Website Design">Website Design</option>
            <option value="Both">Combined branding & website</option>
          </select>
        </label>
        {archivesReady && (
          <label>
            Show projects
            <select
              aria-label="Project list filter"
              value={filters.scope}
              onChange={(event) =>
                onChange({
                  ...filters,
                  scope: event.target.value as ProjectFilters["scope"],
                })
              }
            >
              <option value="active">Active projects</option>
              <option value="archived">Archived projects</option>
              <option value="all">All projects</option>
            </select>
          </label>
        )}
        <label>
          Sort projects
          <select
            aria-label="Sort projects"
            value={filters.sort}
            onChange={(event) =>
              onChange({
                ...filters,
                sort: event.target.value as ProjectFilters["sort"],
              })
            }
          >
            <option value="current">Original order</option>
            <option value="due">Estimated completion — soonest</option>
            <option value="project">Project name — A–Z</option>
            <option value="client">Client name — A–Z</option>
          </select>
        </label>
      </div>
      <div className="project-finder-summary">
        <p role="status">
          Showing {count} of {total} {total === 1 ? "project" : "projects"} in
          this view.
        </p>
        <button
          type="button"
          className="secondary"
          disabled={!filtered}
          onClick={() => onChange({ ...defaultProjectFilters })}
        >
          Clear project filters
        </button>
      </div>
    </section>
  );
}
