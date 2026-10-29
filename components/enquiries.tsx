"use client";
import { useState, type ComponentType, type ReactNode } from "react";
import type { WorkspaceData } from "@/lib/workspace";
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
  }>;
}) {
  const [filter, setFilter] = useState("open");
  const [notice, setNotice] = useState("");
  return (
    <section className="panel">
      <h2>Enquiries</h2>
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
          <details>
            <summary>Add a word-of-mouth enquiry</summary>
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
          <label>
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
              <details className="business-record" key={e.id}>
                <summary>
                  {e.business_name || e.contact_name || "New enquiry"} ·{" "}
                  {e.source === "tally" ? "Tally" : "Manual"} · {e.status}
                </summary>
                <p>
                  {e.contact_name} · {e.email}
                </p>
                {e.fields.map((f, i) => (
                  <div className="brief-field" key={i}>
                    <b>{f.label}</b>
                    <p>{f.value}</p>
                  </div>
                ))}
                {e.status !== "converted" ? (
                  <>
                    <Form action={updateEnquiry} label="Update enquiry">
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
                    <details>
                      <summary>Create a potential project</summary>
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
                        label="Create potential client/project"
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
          ) && <p>No enquiries in this view.</p>}
        </>
      )}
    </section>
  );
}
