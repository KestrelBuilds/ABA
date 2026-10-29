"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
            if (value.ok) router.refresh();
          } catch {
            setResult({
              ok: false,
              message: "Your response could not be sent. Please try again.",
            });
          }
        })
      }
    >
      <fieldset disabled={pending}>
        <input name="documentId" type="hidden" value={documentId} />
        {kind === "proposal" ? (
          <>
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
            <label>
              Signed or completed PDF
              <input
                name="file"
                type="file"
                accept="application/pdf"
                required
              />
            </label>
            <p>
              Download the contract, complete/sign it in Acrobat or our agreed
              tool, then save and return the PDF here. PDF only, up to 3 MB.
            </p>
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
          <p role={result.ok ? "status" : "alert"}>{result.message}</p>
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
    <main className="auth-page contract-area-page">
      <Link className="logo" href="/">
        <BrandMark />
      </Link>
      <div className="contract-area-content">
        <h1>Let’s explore your project</h1>
        <p>
          A place to arrange our discovery call and review the next steps. Your
          creative project journey opens after I verify the signed contract and
          50% deposit.
        </p>
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
          <section className="panel" key={p.project_id}>
            <h2>{p.name}</h2>
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
                    <h3>
                      {p.release_step === "discovery"
                        ? "Book our discovery call"
                        : p.release_step === "proposal"
                          ? "Your project proposal"
                          : "Contract & deposit"}
                    </h3>
                    <a
                      className="resource"
                      href={p.booking_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Book a discovery call ↗
                    </a>
                    {p.release_step === "discovery" && (
                      <p>
                        We’ll discuss your goals and whether we’re a good fit.
                        I’ll share a proposal here when it’s ready.
                      </p>
                    )}
                    {p.release_step === "agreement" && (
                      <p>
                        Signed contract:{" "}
                        {p.contract_signed
                          ? "verified"
                          : "awaiting my verification"}
                        . Deposit:{" "}
                        {p.deposit_paid
                          ? "verified"
                          : "awaiting my verification"}
                        . Your full journey remains hidden until both are
                        verified.
                      </p>
                    )}
                    {p.documents.map((d) => (
                      <article className="business-record" key={d.id}>
                        <h3>
                          {d.document_role} · {d.name} · {d.version_label}
                        </h3>
                        <a className="resource" href={"/files/" + d.id}>
                          Download {d.document_role.toLowerCase()} PDF ↗
                        </a>
                        {d.document_role === "Proposal" &&
                          (p.responses.some((r) => r.document_id === d.id) ? (
                            <p>
                              Your proposal response has been sent. Contact me
                              if you’d like to change it.
                            </p>
                          ) : (
                            !preview && (
                              <ProspectForm documentId={d.id} kind="proposal" />
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
                            {!preview && (
                              <ProspectForm documentId={d.id} kind="contract" />
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
          <p>
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
      </div>
    </main>
  );
}
