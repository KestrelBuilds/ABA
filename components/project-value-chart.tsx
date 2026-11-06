"use client";
import { useEffect, useId, useState } from "react";
import { ArrowUpRight, TrendingUp } from "lucide-react";
import type { WorkspaceData } from "@/lib/workspace";
import { workspaceOutlook, type InsightFilter } from "@/lib/workspace-insights";
import { londonDate } from "@/lib/workspace-deadlines";
import { pounds } from "@/lib/finance/money";

const monthLabel = (month: string, short = false) =>
  new Intl.DateTimeFormat("en-GB", {
    month: short ? "short" : "long",
    ...(short ? {} : { year: "numeric" as const }),
    timeZone: "Europe/London",
  }).format(new Date(month + "-01T12:00:00Z"));
const compactPounds = (value: number) =>
  value < 1000
    ? pounds(value)
    : new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "GBP",
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(value / 100);

export default function ProjectValueChart({
  data,
  filter,
  onOpenProject,
}: {
  data: WorkspaceData;
  filter: InsightFilter;
  onOpenProject: (id: string) => void;
}) {
  const [start, setStart] = useState<string | null>(null);
  const [count, setCount] = useState<6 | 12>(6);
  const [selected, setSelected] = useState("");
  const gradient = useId();
  useEffect(() => {
    const update = () => setStart(londonDate().slice(0, 7));
    update();
    const timer = window.setInterval(update, 60000);
    return () => window.clearInterval(timer);
  }, []);
  if (data.role !== "admin") return null;
  const outlook = start ? workspaceOutlook(data, filter, start, count) : null;
  const months = outlook?.months ?? [];
  const current =
    months.find((m) => m.month === selected) ??
    months.find((m) => m.projects.length) ??
    months[0];
  const highest = Math.max(0, ...months.map((m) => m.total));
  const max = Math.max(1, highest);
  const x = (i: number) => 8 + i * (584 / (count - 1));
  const y = (value: number) => 188 - (value / max) * 168;
  const line = (key: "total" | "received") =>
    months.map((m, i) => `${i ? "L" : "M"}${x(i)},${y(m[key])}`).join(" ");
  const total = months.reduce((sum, m) => sum + m.total, 0);
  return (
    <section
      className="panel dashboard-chart value-outlook"
      aria-label="Project value outlook"
    >
      <header className="section-heading">
        <div>
          <span className="chart-kicker">VALUE &amp; TIMING</span>
          <h3>Project value outlook</h3>
        </div>
        <TrendingUp size={22} aria-hidden="true" />
      </header>
      <div className="outlook-summary">
        <div>
          <strong>{pounds(total)}</strong>
          <span>scheduled project value</span>
        </div>
        <label className="chart-range">
          Period
          <select
            aria-label="Outlook period"
            value={count}
            onChange={(e) => {
              setCount(Number(e.target.value) as 6 | 12);
              setSelected("");
            }}
          >
            <option value={6}>Next 6 months</option>
            <option value={12}>Next 12 months</option>
          </select>
        </label>
      </div>
      <p className="chart-description">
        Grouped by estimated completion month. Choose a month to inspect its
        projects.
      </p>
      {outlook && current ? (
        <>
          <div
            className="outlook-plot"
            role="img"
            aria-label={`Current project values by estimated completion month, ${monthLabel(months[0].month)} to ${monthLabel(months.at(-1)!.month)}. Total ${pounds(total)}. Monthly figures and projects are available below.`}
          >
            <div className="outlook-axis" aria-hidden="true">
              <span>{compactPounds(highest)}</span>
              <span>{compactPounds(highest / 2)}</span>
              <span>£0</span>
            </div>
            <svg
              viewBox="0 0 600 200"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a960ff" stopOpacity=".45" />
                  <stop offset="100%" stopColor="#a960ff" stopOpacity=".02" />
                </linearGradient>
              </defs>
              {[20, 104, 188].map((height) => (
                <line
                  key={height}
                  x1="0"
                  y1={height}
                  x2="600"
                  y2={height}
                  className="outlook-gridline"
                />
              ))}
              <path
                d={`${line("total")} L592,188 L8,188 Z`}
                fill={`url(#${gradient})`}
              />
              <path d={line("total")} className="outlook-total-line" />
              <path d={line("received")} className="outlook-received-line" />
              <line
                x1={x(months.indexOf(current))}
                y1="12"
                x2={x(months.indexOf(current))}
                y2="188"
                className="outlook-selection"
              />
              <circle
                cx={x(months.indexOf(current))}
                cy={y(current.total)}
                r="4"
                className="outlook-dot"
              />
            </svg>
          </div>
          <div className="outlook-x-axis" aria-hidden="true">
            {Array.from({ length: 6 }, (_, index) => {
              const position = Math.round((index * (months.length - 1)) / 5);
              return (
                <span
                  key={position}
                  style={{ left: `${(position / (months.length - 1)) * 100}%` }}
                >
                  {monthLabel(months[position].month, true)}
                </span>
              );
            })}
          </div>
          <div className="outlook-legend">
            <span>
              <i className="chart-swatch outlook-total" />
              Project value
            </span>
            <span>
              <i className="chart-swatch outlook-received" />
              Marked received
            </span>
          </div>
          <label className="chart-range outlook-month-picker">
            Inspect month
            <select
              aria-label="Inspect month"
              value={current.month}
              onChange={(event) => setSelected(event.target.value)}
            >
              {months.map((m) => (
                <option key={m.month} value={m.month}>
                  {monthLabel(m.month)} · {m.projects.length}{" "}
                  {m.projects.length === 1 ? "project" : "projects"}
                </option>
              ))}
            </select>
          </label>
          <div className="outlook-detail" aria-live="polite">
            <strong>{monthLabel(current.month)}</strong>
            <span>
              {pounds(current.total)} project value · {pounds(current.received)}{" "}
              marked received
            </span>
          </div>
          {current.projects.length ? (
            <details className="outlook-projects" key={current.month}>
              <summary>
                {current.projects.length}{" "}
                {current.projects.length === 1 ? "project" : "projects"} in this
                month
              </summary>
              {current.projects.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => onOpenProject(p.id)}
                >
                  <span>
                    {p.name}
                    <small>
                      {data.clients.find((c) => c.id === p.client_id)?.name} ·{" "}
                      {pounds(Math.round(Number(p.budget) * 100))}
                    </small>
                  </span>
                  <ArrowUpRight size={16} aria-hidden="true" />
                </button>
              ))}
            </details>
          ) : (
            <p className="chart-description">
              No projects scheduled in this month.
            </p>
          )}
          {(outlook.outsidePeriod > 0 || outlook.undated > 0) && (
            <p className="chart-note">
              {outlook.outsidePeriod}{" "}
              {outlook.outsidePeriod === 1 ? "project" : "projects"} outside
              this period · {outlook.undated} without a valid estimate.
            </p>
          )}
        </>
      ) : (
        <p className="insight-empty">Loading project dates…</p>
      )}
      <p className="chart-note">
        Current project values and payment checks, not revenue earned in each
        month. Estimates can change.
      </p>
    </section>
  );
}
