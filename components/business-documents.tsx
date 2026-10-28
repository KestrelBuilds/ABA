"use client";
import type { ComponentType, ReactNode } from "react";
import type { WorkspaceData, DbProject } from "@/lib/workspace";
import type { Result } from "@/app/actions";
import {
  saveSeller,
  saveBilling,
  saveTemplate,
  createProposal,
  saveProposal,
  proposalStatus,
  createInvoices,
  issueInvoice,
  markInvoicePaid,
  voidInvoice,
  replaceInvoice,
} from "@/app/finance-actions";
import { financeTotals, pounds, splitPayment } from "@/lib/finance/money";
type FormProps = {
  action: (form: FormData) => Promise<Result>;
  children: ReactNode;
  label?: string;
  className?: string;
};
const fields = [
  ["scope", "Scope"],
  ["deliverables", "Deliverables"],
  ["timeline", "Timeline"],
  ["revisions", "Revision allowance"],
  ["exclusions", "Outside scope"],
  ["notes", "Additional notes"],
] as const;
export default function BusinessDocuments({
  data,
  Form,
  project,
}: {
  data: WorkspaceData;
  Form: ComponentType<FormProps>;
  project?: DbProject;
}) {
  const admin = data.role === "admin",
    finance = data.finance;
  if (!finance?.ready)
    return admin ? (
      <section className="panel">
        <h2>Proposals & invoices</h2>
        <p>
          These tools need the one-time business documents database upgrade.
          Your existing workspace still works.
        </p>
        <a
          className="resource"
          href="https://github.com/KestrelBuilds/ABA/blob/main/supabase/migrations/202610280005_business_documents.sql"
          target="_blank"
          rel="noreferrer"
        >
          Open the setup file ↗
        </a>
      </section>
    ) : null;
  const now = new Date(),
    today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now),
    totals = financeTotals(finance.invoices, today.slice(0, 7));
  if (!project)
    return (
      <>
        <div className="stats">
          {[
            ["Outstanding invoices", pounds(totals.outstanding)],
            ["Invoice payments recorded", pounds(totals.received)],
            ["Invoice receipts this month", pounds(totals.monthly)],
            [
              "Issued, unpaid invoices",
              finance.invoices.filter((i) => i.status === "Issued").length,
            ],
          ].map(([label, value]) => (
            <div className="stat" key={label}>
              <div>{label}</div>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        <section className="panel">
          <h2>Invoice ledger</h2>
          <p>
            GBP, manual full-payment records. Drafts and void invoices are
            excluded from totals. Payment-provider reconciliation is not
            connected.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Project</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Download</th>
                </tr>
              </thead>
              <tbody>
                {finance.invoices.map((i) => (
                  <tr key={i.id}>
                    <td>{i.number ?? "Draft"}</td>
                    <td>
                      {data.projects.find((p) => p.id === i.project_id)?.name}
                    </td>
                    <td>{i.kind}</td>
                    <td>{pounds(Number(i.amount_pence))}</td>
                    <td>
                      {i.status}
                      {i.status === "Issued" && i.due_on && i.due_on < today
                        ? " · Overdue"
                        : ""}
                    </td>
                    <td>
                      <a href={"/business-pdf/invoice/" + i.id}>PDF ↗</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="panel">
          <h2>Seller & invoice settings</h2>
          <p>
            Use your legal/trading details and business address. Do not enter
            card details, passwords or API keys. VAT calculations are not
            supported in this version; only confirm the no-VAT box if that is
            correct for your business.
          </p>
          <Form action={saveSeller} label="Save invoice settings">
            {(
              [
                ["seller_name", "Legal name / trading name"],
                ["seller_address", "Business address"],
                ["seller_email", "Business email"],
                ["payment_instructions", "Payment instructions"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                {key === "seller_email" ? (
                  <input
                    name={key}
                    type="email"
                    required
                    defaultValue={finance.seller?.[key] ?? ""}
                  />
                ) : (
                  <textarea
                    name={key}
                    required={key !== "payment_instructions"}
                    maxLength={key === "seller_name" ? 180 : 1500}
                    defaultValue={finance.seller?.[key] ?? ""}
                  />
                )}
              </label>
            ))}
            <label className="check-row">
              <input
                name="no_vat_confirmed"
                type="checkbox"
                defaultChecked={finance.seller?.no_vat_confirmed ?? false}
              />
              I confirm these invoices should not charge VAT.
            </label>
          </Form>
        </section>
        <section className="panel">
          <h2>Reusable proposal templates</h2>
          <p>
            Templates are internal starting points. Every project proposal needs
            a scope and terms review before sharing. No contract or electronic
            signature is generated.
          </p>
          {finance.templates.map((t) => (
            <details key={t.id}>
              <summary>{t.name}</summary>
              {fields.map(([key, label]) => (
                <div key={key}>
                  <b>{label}</b>
                  <p>{t[key]}</p>
                </div>
              ))}
            </details>
          ))}
          <details>
            <summary>Create a proposal template</summary>
            <Form action={saveTemplate} label="Save template">
              <label>
                Template name
                <input name="name" required maxLength={120} />
              </label>
              {fields.map(([key, label]) => (
                <label key={key}>
                  {label}
                  <textarea
                    name={key}
                    maxLength={
                      key === "scope" || key === "deliverables"
                        ? 6000
                        : key === "revisions"
                          ? 2000
                          : 3000
                    }
                  />
                </label>
              ))}
            </Form>
          </details>
        </section>
      </>
    );
  const proposals = finance.proposals.filter(
      (p) => p.project_id === project.id,
    ),
    invoices = finance.invoices.filter((i) => i.project_id === project.id),
    billing = finance.billing.find((b) => b.client_id === project.client_id);
  if (!admin && !proposals.length && !invoices.length) return null;
  return (
    <section className="panel business-documents" id="business-documents">
      <h2>Proposals & invoices</h2>
      <p>
        Your accepted proposal defines the agreed scope. Contracts and legally
        binding signatures remain separate. Proposal/deposit PDFs can be emailed
        manually before onboarding; portal access still requires a signed
        contract and deposit.
      </p>
      {admin && (
        <details>
          <summary>Client billing details</summary>
          <Form action={saveBilling} label="Save billing details">
            <input type="hidden" name="client_id" value={project.client_id} />
            <label>
              Billing name
              <input
                name="billing_name"
                defaultValue={
                  billing?.billing_name ??
                  data.clients.find((c) => c.id === project.client_id)?.name ??
                  ""
                }
                required
                maxLength={180}
              />
            </label>
            <label>
              Billing address
              <textarea
                name="billing_address"
                defaultValue={billing?.billing_address ?? ""}
                required
                maxLength={1500}
              />
            </label>
          </Form>
        </details>
      )}
      <h3>Project proposals</h3>
      {admin && (
        <Form action={createProposal} label="Create draft proposal">
          <input type="hidden" name="projectId" value={project.id} />
          <label>
            Starting point
            <select name="templateId">
              <option value="">Blank project proposal</option>
              {finance.templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        </Form>
      )}
      {proposals.map((p) => (
        <article className="business-record" key={p.id}>
          <h4>Proposal · revision {p.revision}</h4>
          <span className="pill">{p.status}</span>
          <p>
            Project value: {pounds(Number(p.total_pence))} · Deposit{" "}
            {pounds(splitPayment(Number(p.total_pence)).deposit)} / Final{" "}
            {pounds(splitPayment(Number(p.total_pence)).final)}
          </p>
          {fields.map(([key, label]) => (
            <div className="brief-field" key={key}>
              <b>{label}</b>
              <p>{p[key] || "To be confirmed."}</p>
            </div>
          ))}
          <a className="resource" href={"/business-pdf/proposal/" + p.id}>
            Download {p.status === "Draft" ? "draft " : ""}proposal PDF ↗
          </a>
          {admin && p.status === "Draft" && (
            <>
              <details>
                <summary>Edit draft</summary>
                <Form action={saveProposal} label="Save draft">
                  <input type="hidden" name="id" value={p.id} />
                  {fields.map(([key, label]) => (
                    <label key={key}>
                      {label}
                      <textarea
                        name={key}
                        defaultValue={p[key]}
                        maxLength={
                          key === "scope" || key === "deliverables"
                            ? 6000
                            : key === "revisions"
                              ? 2000
                              : 3000
                        }
                      />
                    </label>
                  ))}
                </Form>
              </details>
              <Form
                action={proposalStatus}
                label="Share this revision with client"
              >
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="status" value="Shared" />
                <p>
                  Shared revisions are frozen. Create a new draft for changes.
                  Sharing makes it available in an eligible client portal; it
                  does not send email.
                </p>
              </Form>
            </>
          )}
          {admin && p.status === "Shared" && (
            <Form action={proposalStatus} label="Record proposal decision">
              <input type="hidden" name="id" value={p.id} />
              <label>
                Verified client decision
                <select name="status">
                  <option value="Accepted">Accepted</option>
                  <option value="Declined">Declined</option>
                </select>
              </label>
              <p>
                Record only a decision you have received. This is not a legal
                signature or contract.
              </p>
            </Form>
          )}
        </article>
      ))}
      <h3>50/50 project invoices</h3>
      {admin && !invoices.some((i) => i.status !== "Void") && (
        <Form
          action={createInvoices}
          label="Create draft deposit & final invoices"
        >
          <input type="hidden" name="projectId" value={project.id} />
          <p>
            Amounts snapshot the current project value. Existing manual payment
            records need reconciliation before creating invoices.
          </p>
        </Form>
      )}
      {invoices.map((i) => (
        <article className="business-record" key={i.id}>
          <h4>
            {i.kind} invoice · {i.number ?? "Draft"}
          </h4>
          <span className="pill">{i.status}</span>
          <p>
            {pounds(Number(i.amount_pence))}
            {i.due_on ? " · Due " + i.due_on : ""}
            {i.paid_on ? " · Full payment recorded " + i.paid_on : ""}
          </p>
          <a className="resource" href={"/business-pdf/invoice/" + i.id}>
            Download {i.status === "Draft" ? "draft " : ""}invoice PDF ↗
          </a>
          {admin && i.status === "Draft" && (
            <Form action={issueInvoice} label="Issue invoice">
              <input type="hidden" name="id" value={i.id} />
              <label>
                Issue date
                <input
                  type="date"
                  name="issued_on"
                  defaultValue={today}
                  required
                />
              </label>
              <label>
                Due date
                <input type="date" name="due_on" required min={today} />
              </label>
              <p>
                Check seller and client billing details first. Issued invoice
                amounts and billing snapshots cannot be edited. Final invoices
                require verified creative approval.
              </p>
            </Form>
          )}
          {admin && i.status === "Issued" && (
            <Form action={markInvoicePaid} label="Record full payment">
              <input type="hidden" name="id" value={i.id} />
              <label>
                Payment received on
                <input
                  type="date"
                  name="paid_on"
                  max={today}
                  required
                  defaultValue={today}
                />
              </label>
              <label className="check-row">
                <input type="checkbox" name="confirmed" required />I have
                verified receipt of the full amount.
              </label>
              <p>
                This updates the project’s corresponding payment gate. It does
                not move money.
              </p>
            </Form>
          )}
          {admin && i.status === "Void" && (
            <Form
              action={replaceInvoice}
              label="Create replacement draft (same amount)"
            >
              <input type="hidden" name="id" value={i.id} />
            </Form>
          )}
          {admin && ["Draft", "Issued"].includes(i.status) && (
            <details>
              <summary>Void this invoice</summary>
              <Form action={voidInvoice} label="Confirm void">
                <input type="hidden" name="id" value={i.id} />
                <p>
                  The record is retained. Paid invoices cannot be voided here;
                  refunds/credit notes need separate accounting support.
                </p>
              </Form>
            </details>
          )}
        </article>
      ))}
      {!admin && !proposals.length && !invoices.length && (
        <p>I’ll share your documents here when they are ready.</p>
      )}
    </section>
  );
}
