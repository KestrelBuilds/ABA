"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownToLine,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
} from "lucide-react";
import BrandSignature from "./brand-signature";
import BrandMark from "./brand-mark";
import { PasswordForm } from "./auth-forms";
import type { ProspectEntry } from "@/lib/prospects";
import {
  signOut,
  respondToProposal,
  uploadSignedContract,
  type Result,
} from "@/app/actions";
function ProspectForm({
  documentId,
  kind,
}: {
  documentId: string;
  kind: "proposal" | "contract";
}) {
  const [result, setResult] = useState<Result | null>(null),
    [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form
      className="connected-form"
      action={(form) =>
        start(async () => {
          try {
            const value = await (
              kind === "proposal" ? respondToProposal : uploadSignedContract
            )(form);
            setResult(value);
            if (value.ok || value.refresh) router.refresh();
          } catch {
            setResult({
              ok: false,
              message: "Your response could not be sent. Please try again.",
            });
          }
        })
      }
    >
      <fieldset disabled={pending} className="action-fields">
        <input name="documentId" type="hidden" value={documentId} />
        {kind === "proposal" ? (
          <>
            <h4>Let me know what you think</h4>
            <label>
              My response
              <select name="decision">
                <option value="interested">I’d like to proceed</option>
                <option value="question">I have a question</option>
                <option value="declined">I’m not proceeding</option>
              </select>
            </label>
            <label>
              Message
              <textarea name="message" maxLength={2000} />
            </label>
            <p>
              This sends your preference to me. It does not sign a contract or
              confirm payment.
            </p>
          </>
        ) : (
          <>
            <h4>Return your signed contract</h4>
            <p>
              Download the contract, complete/sign it in Acrobat or our agreed
              tool, then save and return the PDF here. PDF only, up to 3 MB.
            </p>
            <label>
              Signed or completed PDF
              <input
                name="file"
                type="file"
                accept="application/pdf"
                required
              />
            </label>
          </>
        )}
        <button className="primary">
          {pending
            ? "Sending…"
            : kind === "proposal"
              ? "Send my proposal response"
              : "Send signed PDF for review"}
        </button>
        {result && (
          <p
            className={result.ok ? "form-result" : "form-result error"}
            role={result.ok ? "status" : "alert"}
          >
            {result.message}
          </p>
        )}
      </fieldset>
    </form>
  );
}
export default function ProspectArea({
  entries,
  preview = false,
  ready = true,
}: {
  entries: ProspectEntry[];
  preview?: boolean;
  ready?: boolean;
}) {
  return (
    <main className="auth-page contract-area-page prospect-page">
      <Link className="logo" href="/" aria-label="Alex Bell Arts home">
        <BrandMark />
      </Link>
      <div className="contract-area-content">
        <header className="prospect-intro">
          <span className="section-kicker">
            ALEX BELL ARTS · YOUR CLIENT SPACE
          </span>
          <h1>Let’s explore your project</h1>
          <p>
            Let’s understand your goals and shape a direction that is right for
            you. Your creative journey opens after I verify your signed contract
            and 50% deposit.
          </p>
        </header>
        {!ready && (
          <p>
            The potential-client area needs its setup update before it can be
            shared.
          </p>
        )}
        {!entries.length && (
          <p>
            No enquiries are currently shared with this account. Please contact
            me if you expected an invitation.
          </p>
        )}
        {entries.map((p) => (
          <section className="panel prospect-project" key={p.project_id}>
            <header className="prospect-project-heading">
              <span className="section-kicker">YOUR PROJECT</span>
              <h2>{p.name}</h2>
              {p.archived_at && (
                <p className="banner">
                  Archived project — read-only. Existing file-release checks
                  still apply.
                </p>
              )}
            </header>
            {preview && !p.enabled && (
              <div className="banner">
                Not shared yet. Enable this potential-client area before
                creating an early invitation.
              </div>
            )}
            {p.enquiry_status === "closed" ? (
              <p>This enquiry is marked as not proceeding.</p>
            ) : (
              <>
                {p.contract_signed && p.deposit_paid ? (
                  <Link
                    className="primary"
                    href={preview ? "#" : "/portal"}
                    aria-disabled={preview}
                    onClick={(e) => {
                      if (preview) e.preventDefault();
                    }}
                  >
                    Your full project portal is ready →
                  </Link>
                ) : (
                  <>
                    <div className="prospect-next-step">
                      <span className="section-kicker">
                        {p.release_step === "discovery"
                          ? "STEP 1 OF 3"
                          : p.release_step === "proposal"
                            ? "STEP 2 OF 3"
                            : "STEP 3 OF 3"}{" "}
                        · GETTING STARTED
                      </span>
                      <h3>
                        {p.release_step === "discovery"
                          ? "Book our discovery call"
                          : p.release_step === "proposal"
                            ? "Your project proposal"
                            : "Contract & deposit"}
                      </h3>
                      <p>
                        {p.release_step === "discovery"
                          ? "We’ll discuss your goals and whether we’re a good fit. I’ll share a proposal here when it’s ready."
                          : p.release_step === "proposal"
                            ? "Take a look at the proposal below, then let me know if you’d like to go ahead or have any questions."
                            : "Download your contract and invoice below. Return your signed PDF and arrange the 50% deposit using the details in the invoice."}
                      </p>
                      <a
                        className={
                          p.release_step === "discovery"
                            ? "primary action-link"
                            : "secondary action-link"
                        }
                        href={p.booking_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <CalendarDays size={18} aria-hidden="true" /> Book a
                        discovery call{" "}
                        <ArrowUpRight size={16} aria-hidden="true" />
                      </a>
                    </div>
                    {p.release_step === "agreement" && (
                      <div
                        className="prospect-checks"
                        aria-label="Project access checks"
                      >
                        {[
                          ["Signed contract", p.contract_signed],
                          ["50% deposit", p.deposit_paid],
                        ].map(([label, verified]) => (
                          <div
                            className={
                              verified
                                ? "access-check is-verified"
                                : "access-check"
                            }
                            key={String(label)}
                          >
                            {verified ? (
                              <CheckCircle2 size={20} aria-hidden="true" />
                            ) : (
                              <Clock3 size={20} aria-hidden="true" />
                            )}
                            <div>
                              <b>{label}</b>
                              <span>
                                {verified
                                  ? "Verified"
                                  : "Awaiting my verification"}
                              </span>
                            </div>
                          </div>
                        ))}
                        <p>
                          Your full journey remains hidden until both are
                          verified.
                        </p>
                      </div>
                    )}
                    {p.documents.length > 0 && (
                      <h3 className="files-heading">Your documents</h3>
                    )}
                    <div className="prospect-documents">
                      {p.documents.map((d) => (
                        <article className="prospect-document" key={d.id}>
                          <header className="document-heading">
                            <span className="document-icon">
                              <FileText size={22} aria-hidden="true" />
                            </span>
                            <div>
                              <h4>{d.document_role}</h4>
                              <p>
                                {d.name} <span>· {d.version_label}</span>
                              </p>
                            </div>
                          </header>
                          <a
                            className="secondary action-link"
                            href={"/files/" + d.id}
                          >
                            <ArrowDownToLine size={17} aria-hidden="true" />{" "}
                            Download {d.document_role.toLowerCase()}
                          </a>
                          {d.document_role === "Proposal" &&
                            (p.responses.some((r) => r.document_id === d.id) ? (
                              <p>
                                Your proposal response has been sent. Contact me
                                if you’d like to change it.
                              </p>
                            ) : (
                              !preview &&
                              !p.archived_at && (
                                <ProspectForm
                                  documentId={d.id}
                                  kind="proposal"
                                />
                              )
                            ))}
                          {d.document_role === "Contract" && (
                            <>
                              {p.returns
                                .filter((a) => a.contract_document_id === d.id)
                                .map((a) => (
                                  <a
                                    className="resource"
                                    key={a.id}
                                    href={"/assets/" + a.id}
                                  >
                                    Your returned copy · {a.name} ↗
                                  </a>
                                ))}
                              {!preview && !p.archived_at && (
                                <ProspectForm
                                  documentId={d.id}
                                  kind="contract"
                                />
                              )}
                            </>
                          )}
                          {d.document_role === "Invoice" && (
                            <p>
                              Follow the payment details in my invoice. I’ll
                              verify receipt; uploading a file does not record a
                              payment.
                            </p>
                          )}
                        </article>
                      ))}
                    </div>
                    {p.release_step !== "discovery" && !p.documents.length && (
                      <p>
                        I’ll share the relevant PDFs here when they’re ready.
                      </p>
                    )}
                  </>
                )}
              </>
            )}
          </section>
        ))}
        {preview ? (
          <p className="preview-note">
            This preview is read-only. The full creative journey is deliberately
            hidden before onboarding.
          </p>
        ) : (
          <>
            <details className="panel">
              <summary>Set my sign-in password</summary>
              <PasswordForm />
            </details>
            <form action={signOut}>
              <button className="secondary">Sign out</button>
            </form>
          </>
        )}
        <BrandSignature />
      </div>
    </main>
  );
}
