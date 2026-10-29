"use client";
import { useState } from "react";
import { ArrowRight, Inbox } from "lucide-react";
import type { WorkspaceData } from "@/lib/workspace";
import {
  workspaceAttention,
  type AttentionDestination,
} from "@/lib/workspace-attention";
export default function WorkspaceAttention({
  data,
  onOpen,
}: {
  data: WorkspaceData;
  onOpen: (destination: AttentionDestination) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  if (data.role !== "admin") return null;
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const items = workspaceAttention(data, today);
  return (
    <section
      className="panel workspace-attention"
      aria-label="Needs your attention"
    >
      <header className="section-heading">
        <div>
          <span className="section-kicker">YOUR WORKSPACE</span>
          <h2>Needs your attention</h2>
        </div>
        <span className="status-badge">
          {items.length} {items.length === 1 ? "item" : "items"}
        </span>
      </header>
      <p>
        Enquiries, client replies and sharing tasks, brought together. Open an
        item to review it.
      </p>
      {items.length ? (
        <div className="attention-list">
          {(showAll ? items : items.slice(0, 6)).map((item) => (
            <button
              type="button"
              key={item.id}
              className="attention-item"
              onClick={() => onOpen(item.destination)}
            >
              <span className="attention-count">{item.count}</span>
              <span>
                <b>{item.title}</b>
                <small>{item.detail}</small>
              </span>
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : (
        <div className="attention-empty">
          <Inbox size={22} aria-hidden="true" />
          <p>
            No new enquiries, unchecked contract returns or overdue follow-ups
            here. You can still review each project’s next milestone below.
          </p>
        </div>
      )}
      {items.length > 6 && (
        <button
          className="secondary"
          type="button"
          aria-expanded={showAll}
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? "Show fewer items" : `Show all ${items.length} items`}
        </button>
      )}
    </section>
  );
}
