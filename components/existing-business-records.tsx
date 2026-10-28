"use client";
import type { ComponentType, ReactNode } from "react";
import type { WorkspaceData, DbProject } from "@/lib/workspace";
import type { Result } from "@/app/actions";
import { markInvoicePaid, voidInvoice } from "@/app/finance-actions";

// Historical records only: no creation, generation, billing settings or templates.
export default function ExistingBusinessRecords({
  data,
  project,
  Form,
}: {
  data: WorkspaceData;
  project: DbProject;
  Form: ComponentType<{
    action: (form: FormData) => Promise<Result>;
    children: ReactNode;
    label?: string;
  }>;
}) {
  const invoices =
    data.finance?.invoices.filter((i) => i.project_id === project.id) ?? [];
  const proposals =
    data.finance?.proposals.filter((p) => p.project_id === project.id) ?? [];
  if (!invoices.length && !proposals.length) return null;
  const owner = data.role === "admin";
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return (
    <details className="panel">
      <summary>Previous generated documents</summary>
      <section id="existing-invoices" aria-label="Previous generated documents">
        <p>
          These are records created before switching to uploaded PDFs. New
          proposals, contracts and invoices belong in their journey stages.
        </p>
        {proposals.map((p) => (
          <article className="business-record" key={p.id}>
            <h3>Previous proposal · revision {p.revision}</h3>
            <p>{p.status}</p>
            <a className="resource" href={`/business-pdf/proposal/${p.id}`}>
              Download previous proposal PDF ↗
            </a>
          </article>
        ))}
        {invoices.map((i) => (
          <article className="business-record" key={i.id}>
            <h3>
              {i.kind} invoice · {i.number ?? "Unissued draft"}
            </h3>
            <p>
              {i.status} ·{" "}
              {new Intl.NumberFormat("en-GB", {
                style: "currency",
                currency: "GBP",
              }).format(i.amount_pence / 100)}
            </p>
            <a className="resource" href={`/business-pdf/invoice/${i.id}`}>
              Download previous invoice PDF ↗
            </a>
            {owner && i.status === "Issued" && (
              <Form action={markInvoicePaid} label="Record full payment">
                <input type="hidden" name="id" value={i.id} />
                <label>
                  Payment received on
                  <input
                    type="date"
                    name="paid_on"
                    defaultValue={today}
                    max={today}
                    required
                  />
                </label>
                <label className="check-row">
                  <input type="checkbox" name="confirmed" required />I have
                  verified receipt of the full amount.
                </label>
                <p>
                  This updates the corresponding payment record without moving
                  money.
                </p>
              </Form>
            )}
            {owner && ["Draft", "Issued"].includes(i.status) && (
              <details>
                <summary>Void unused invoice</summary>
                <p>
                  Only void an unpaid invoice that is no longer valid. Its
                  history will be retained.
                </p>
                <Form action={voidInvoice} label="Confirm void">
                  <input type="hidden" name="id" value={i.id} />
                </Form>
              </details>
            )}
          </article>
        ))}
      </section>
    </details>
  );
}
