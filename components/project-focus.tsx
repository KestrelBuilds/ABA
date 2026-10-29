"use client";
import type { DbProject, WorkspaceData } from "@/lib/workspace";
import { projectFocus } from "@/lib/project-focus";
import { portalStatusLabels } from "@/lib/invitations";

// Open collapsed sections before moving focus, including optional finance tools.
export function openProjectSection(href: string) {
  const target = document.getElementById(href.slice(1));
  if (!target) return;
  let ancestor: HTMLElement | null = target;
  while (ancestor) {
    if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
    ancestor = ancestor.parentElement;
  }
  target.scrollIntoView({ block: "start" });
  target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });
}
export default function ProjectFocus({
  data,
  project,
  onManageClient,
}: {
  data: WorkspaceData;
  project: DbProject;
  onManageClient: () => void;
}) {
  const focus = projectFocus(data, project);
  const link = (href: string, label: string) => (
    <a
      className="resource"
      href={href}
      onClick={() => openProjectSection(href)}
    >
      {label} ↓
    </a>
  );
  return (
    <section className="panel project-focus" aria-label="Project at a glance">
      <h2>Project at a glance</h2>
      <div className="project-focus-grid">
        <div>
          <h3>Next milestone</h3>
          <p>{focus.nextLabel}</p>
          {focus.next && (
            <p>
              {focus.next.stream}
              {!focus.next.visible ? " · Internal only" : ""}
            </p>
          )}
          {link(focus.nextHref, focus.next ? "Open next step" : "Open journey")}
        </div>
        <div>
          <h3>Client portal</h3>
          {focus.portalStatus && (
            <p>
              <span className="status-badge">
                {portalStatusLabels[focus.portalStatus.state]}
              </span>
            </p>
          )}
          <p>
            {focus.deletionPending
              ? "Client deletion is paused. Portal access is revoked; review the client record to retry cleanup."
              : focus.earlyArea
                ? `${focus.earlyArea === "discovery" ? "Discovery booking" : focus.earlyArea === "proposal" ? "Proposal" : focus.earlyArea === "contract" ? "Initial contract" : "Contract & deposit"} area available to invited clients. The full creative journey still needs ${focus.portalMissing.join(" and ")}.`
                : focus.portalMissing.length
                  ? `Locked — needs ${focus.portalMissing.join(" and ")}.`
                  : focus.portalStatus?.state === "connected"
                    ? "Account connected. The full creative journey is available, with shared files following their release rules."
                    : focus.portalStatus?.state === "pending"
                      ? "The full journey is ready. Their invitation is waiting to be accepted."
                      : focus.portalStatus?.state === "expired"
                        ? "The full journey is ready. Create a fresh invitation so the client can connect their account."
                        : focus.portalStatus?.state === "revoked"
                          ? "The full journey is ready, but account access was removed. Reinvite this client only when you’re ready to restore access."
                          : "Eligible for client access. Invitation and sign-in are still required."}
          </p>
          {focus.portalMissing.length &&
          !focus.earlyArea &&
          !focus.deletionPending ? (
            link("#journey", "Review onboarding")
          ) : (
            <button className="secondary" onClick={onManageClient}>
              Manage client invitation
            </button>
          )}
        </div>
        <div>
          <h3>Final delivery</h3>
          <p>
            {focus.deliveryMissing.length
              ? `Locked — needs ${focus.deliveryMissing.join(", ")}.`
              : "Eligible for release. Only shared files in client-visible stages are available."}
          </p>
          {link("#journey", "Review delivery milestones")}
          {focus.invoiceManaged &&
            link("#existing-invoices", "View existing invoice records")}
        </div>
      </div>
    </section>
  );
}
