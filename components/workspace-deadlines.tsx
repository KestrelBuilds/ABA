"use client";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays } from "lucide-react";
import type { WorkspaceData } from "@/lib/workspace";
import {
  londonDate,
  workspaceDeadlines,
  type DeadlineRange,
} from "@/lib/workspace-deadlines";

const labels = {
  project: "Project estimate",
  action: "Client action",
  review: "Presentation review",
};

export default function WorkspaceDeadlines({
  data,
  onOpen,
}: {
  data: WorkspaceData;
  onOpen: (projectId: string, href: string) => void;
}) {
  const [today, setToday] = useState<string | null>(null);
  const [range, setRange] = useState<DeadlineRange>("week");
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    if (data.role !== "admin") return;
    const update = () => setToday(londonDate());
    update();
    const timer = window.setInterval(update, 60000);
    return () => window.clearInterval(timer);
  }, [data.role]);
  if (data.role !== "admin") return null;
  const result = today ? workspaceDeadlines(data, today, range) : null;
  return (
    <section
      className="panel workspace-deadlines"
      aria-label="Dates & deadlines"
    >
      <header className="section-heading">
        <div>
          <span className="section-kicker">PLAN THE NEXT STEP</span>
          <h2>Dates & deadlines</h2>
        </div>
        <CalendarDays size={24} aria-hidden="true" />
      </header>
      <p>
        Project estimates, open client actions and shared presentations awaiting
        a review response. Dates use UK time; no notifications are sent.
      </p>
      <div className="deadline-controls">
        <label>
          Date range
          <select
            aria-label="Date range"
            value={range}
            onChange={(e) => {
              setRange(e.target.value as DeadlineRange);
              setShowAll(false);
            }}
          >
            <option value="week">Next 7 days (including today)</option>
            <option value="month">Next 30 days (including today)</option>
            <option value="overdue">Overdue only</option>
            <option value="all">All dates</option>
          </select>
        </label>
        {Boolean(result?.overdue) && (
          <button
            type="button"
            className="secondary deadline-overdue"
            aria-pressed={range === "overdue"}
            onClick={() => {
              setRange("overdue");
              setShowAll(false);
            }}
          >
            {result!.overdue} overdue
          </button>
        )}
      </div>
      <p className="deadline-count" role="status">
        {result
          ? `${result.items.length} ${result.items.length === 1 ? "date" : "dates"} in this view`
          : "Loading project dates…"}
      </p>
      {result &&
        (result.items.length ? (
          <ul className="deadline-list">
            {(showAll ? result.items : result.items.slice(0, 6)).map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="deadline-item"
                  onClick={() => onOpen(item.projectId, item.href)}
                >
                  <span className="deadline-meta">
                    <span>{labels[item.kind]}</span>
                    <time dateTime={item.date}>
                      {new Intl.DateTimeFormat("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        timeZone: "Europe/London",
                      }).format(new Date(item.date + "T12:00:00Z"))}
                    </time>
                  </span>
                  <strong>{item.title}</strong>
                  <span className="deadline-project">
                    {item.projectName} · {item.clientName}
                  </span>
                  <span className="deadline-bottom">
                    <span
                      className={
                        "deadline-relative " +
                        (item.daysFromToday < 0
                          ? "deadline-late"
                          : item.daysFromToday === 0
                            ? "deadline-today"
                            : "")
                      }
                    >
                      {item.daysFromToday < 0
                        ? `${-item.daysFromToday} ${item.daysFromToday === -1 ? "day" : "days"} overdue`
                        : item.daysFromToday === 0
                          ? "Today"
                          : item.daysFromToday === 1
                            ? "Tomorrow"
                            : `In ${item.daysFromToday} days`}
                    </span>
                    <span>
                      Open project <ArrowRight size={15} aria-hidden="true" />
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="deadline-empty">
            No dates in this view. Add or adjust dates inside a project, or
            choose a different range.
          </p>
        ))}
      {result && result.items.length > 6 && (
        <button
          type="button"
          className="secondary"
          aria-expanded={showAll}
          onClick={() => setShowAll(!showAll)}
        >
          {showAll
            ? "Show fewer dates"
            : `Show all ${result.items.length} dates`}
        </button>
      )}
      <p className="helper-note">
        Project dates are estimates, not delivery confirmations. They stay
        listed until changed or archived. A presentation leaves this list after
        an approval or revision request; a comment alone does not complete its
        review.
      </p>
    </section>
  );
}
