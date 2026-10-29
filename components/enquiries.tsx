"use client";
import { useState, type ComponentType, type ReactNode } from "react";
import type { WorkspaceData } from "@/lib/workspace";
import { Inbox, MessageSquare, UserPlus } from "lucide-react";
import {
  addManualEnquiry,
  convertEnquiry,
  updateEnquiry,
  type Result,
} from "@/app/actions";
export default function Enquiries({
  data,
  Form,
}: {
  data: WorkspaceData;
  Form: ComponentType<{
    action: (form: FormData) => Promise<Result>;
    children: ReactNode;
    label?: string;
    className?: string;
  }>;
}) {
  const [filter, setFilter] = useState("open");
  const [notice, setNotice] = useState("");
  return (
    <section className="panel enquiries-panel">
      <header className="section-heading">
        <div>
          <span className="section-kicker">NEW CONVERSATIONS</span>
          <h2>Enquiries</h2>
        </div>
        <span className="status-badge">
          <Inbox size={15} aria-hidden="true" />
          {
            (data.enquiries ?? []).filter((e) =>
              ["new", "reviewing"].includes(e.status),
            ).length
          }{" "}
          to review
        </span>
      </header>
      {notice && (
        <p className="banner" role="status">
          {notice}
        </p>
      )}
      <p>
        Review new Tally submissions or record word-of-mouth enquiries here. No
        client is invited automatically.
      </p>
      {!data.enquiriesReady ? (
        <p>The enquiries SQL update is needed to connect this inbox.</p>
      ) : (
        <>
          <details className="settings-disclosure manual-enquiry">
            <summary>
              <MessageSquare size={17} aria-hidden="true" /> Add a word-of-mouth
              enquiry
            </summary>
            <Form action={addManualEnquiry} label="Save enquiry">
              <label>
                Business name
                <input name="business_name" maxLength={120} required />
              </label>
              <label>
                Contact name
                <input name="contact_name" maxLength={120} required />
              </label>
              <label>
                Email address
                <input name="email" type="email" required />
              </label>
              <label>
                Initial notes
                <textarea name="notes" maxLength={4000} />
              </label>
            </Form>
          </details>
          <label className="enquiry-filter">
            Show enquiries
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="open">New / reviewing</option>
              <option value="converted">Converted to potential projects</option>
              <option value="closed">Not proceeding</option>
              <option value="all">All enquiries</option>
            </select>
          </label>
          {(data.enquiries ?? [])
            .filter(
              (e) =>
                filter === "all" ||
                (filter === "open"
                  ? ["new", "reviewing"].includes(e.status)
                  : e.status === filter),
            )
            .map((e) => (
              <details className="enquiry-card" key={e.id}>
                <summary>
                  <span className="enquiry-title">
                    {e.business_name || e.contact_name || "New enquiry"}
                    <small>
                      {e.source === "tally"
                        ? "Tally submission"
                        : "Word of mouth"}
                    </small>
                  </span>
                  <span
                    className={
                      e.status === "new"
                        ? "status-badge status-new"
                        : "status-badge"
                    }
                  >
                    {e.status === "closed"
                      ? "Not proceeding"
                      : e.status === "converted"
                        ? "Project created"
                        : e.status === "reviewing"
                          ? "Reviewing"
                          : "New"}
                  </span>
                </summary>
                <p className="enquiry-contact">
                  {e.contact_name} · {e.email}
                </p>
                <details className="settings-disclosure enquiry-answers">
                  <summary>View enquiry answers ({e.fields.length})</summary>
                  {e.fields.map((f, i) => (
                    <div className="brief-field" key={i}>
                      <b>{f.label}</b>
                      <p>{f.value || "Not provided"}</p>
                    </div>
                  ))}
                </details>
                {e.status !== "converted" ? (
                  <>
                    <section className="form-section enquiry-status">
                      <h3>Track this conversation</h3>
                      <Form
                        action={updateEnquiry}
                        label="Update enquiry"
                        className="secondary-action"
                      >
                        <input type="hidden" name="id" value={e.id} />
                        <label>
                          Enquiry status
                          <select name="status" defaultValue={e.status}>
                            <option value="new">New</option>
                            <option value="reviewing">Reviewing</option>
                            <option value="closed">Not proceeding</option>
                          </select>
                        </label>
                      </Form>
                    </section>
                    <details className="settings-disclosure enquiry-convert">
                      <summary>
                        <UserPlus size={18} aria-hidden="true" /> Create a
                        potential project
                      </summary>
                      <p>
                        Ready for a discovery call? Create the project first,
                        then choose what to share and invite the client
                        separately.
                      </p>
                      <Form
                        action={async (form) => {
                          const result = await convertEnquiry(form);
                          if (result.ok) setNotice(result.message);
                          return result.ok
                            ? {
                                ...result,
                                message: "Converted to a potential project.",
                              }
                            : result;
                        }}
                        label="Create potential project"
                      >
                        <input type="hidden" name="id" value={e.id} />
                        <label>
                          Client record
                          <select name="existing_client">
                            <option value="">Create a new client record</option>
                            {data.clients
                              .filter((c) => !c.deletion_pending)
                              .map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                          </select>
                        </label>
                        <p>
                          If you select an existing client, their contact
                          details will be kept.
                        </p>
                        <label>
                          Business name
                          <input
                            name="name"
                            defaultValue={e.business_name || e.contact_name}
                            required
                            maxLength={120}
                          />
                        </label>
                        <label>
                          Contact name
                          <input
                            name="contact"
                            defaultValue={e.contact_name}
                            required
                            maxLength={120}
                          />
                        </label>
                        <label>
                          Email address
                          <input
                            name="email"
                            type="email"
                            defaultValue={e.email}
                            required
                          />
                        </label>
                        <input type="hidden" name="sector" value="" />
                        <label>
                          Project name
                          <input name="project_name" required maxLength={120} />
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
                          Estimated project value (£)
                          <input
                            name="budget"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue="0"
                            required
                          />
                        </label>
                        <p>
                          This creates a potential project with no
                          signed-contract or payment flags. Enable its discovery
                          view and create a private invitation when ready.
                        </p>
                      </Form>
                    </details>
                  </>
                ) : (
                  <p>
                    This enquiry has been converted. Manage discovery, proposal
                    release and invitations from its project and client records.
                  </p>
                )}
              </details>
            ))}
          {!(data.enquiries ?? []).some(
            (e) =>
              filter === "all" ||
              (filter === "open"
                ? ["new", "reviewing"].includes(e.status)
                : e.status === filter),
          ) && (
            <div className="enquiry-empty">
              <Inbox size={28} aria-hidden="true" />
              <h3>You’re all caught up</h3>
              <p>
                No enquiries in this view. New form submissions will appear in
                your inbox.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
