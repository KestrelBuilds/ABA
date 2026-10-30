"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PasswordForm } from "./auth-forms";
import BrandMark from "./brand-mark";
import type { ContractEntry } from "@/lib/contracts";
import { uploadSignedContract, signOut, type Result } from "@/app/actions";
function ReturnContract({ id }: { id: string }) {
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form
      className="connected-form"
      action={(form) =>
        start(async () => {
          try {
            const r = await uploadSignedContract(form);
            setResult(r);
            if (r.ok || r.refresh) router.refresh();
          } catch {
            setResult({
              ok: false,
              message: "Upload failed. Please try again.",
            });
          }
        })
      }
    >
      <input type="hidden" name="documentId" value={id} />
      <label>
        Signed or completed PDF
        <input name="file" type="file" accept="application/pdf" required />
      </label>
      <p>
        Save your completed copy from Acrobat, then upload it here. PDF only, up
        to 3 MB. Please do not upload passwords or bank-card details.
      </p>
      <button className="primary" disabled={pending}>
        {pending ? "Uploading…" : "Send signed PDF for review"}
      </button>
      {result && <p role={result.ok ? "status" : "alert"}>{result.message}</p>}
    </form>
  );
}
export default function ContractArea({
  entries,
  ready,
  preview = false,
}: {
  entries: ContractEntry[];
  ready: boolean;
  preview?: boolean;
}) {
  return (
    <main className="auth-page contract-area-page">
      <Link className="logo" href="/">
        <BrandMark />
      </Link>
      <div className="contract-area-content">
        {preview && (
          <div className="banner">
            Read-only preview of the initial contract area. Returning a file
            requires the client’s account.{" "}
            <Link href="/workspace">Back to owner dashboard</Link>
          </div>
        )}
        <h1>Your contract with me</h1>
        <p>
          This area is limited to the contracts I’ve shared with you and your
          returned copies. The full project portal opens after I verify your
          signed contract and deposit.
        </p>
        {!ready ? (
          <section className="panel">
            <p>
              The initial contract area is not connected yet. Please contact me
              for help.
            </p>
          </section>
        ) : !entries.length ? (
          <section className="panel">
            <p>
              No initial contracts are available for this account. Please ask me
              if you expected one.
            </p>
            <Link href="/portal">Check my project portal →</Link>
          </section>
        ) : (
          entries.map((entry) => (
            <section className="panel" key={entry.project_id}>
              <h2>{entry.name}</h2>
              {entry.archived_at && (
                <p className="banner">Archived project — read-only access.</p>
              )}
              <p>{entry.stage_name}</p>
              <p>
                Contract:{" "}
                {entry.contract_signed
                  ? "verified"
                  : "awaiting my verification"}
                . Deposit:{" "}
                {entry.deposit_paid ? "verified" : "awaiting my verification"}.
              </p>
              {entry.contract_signed && entry.deposit_paid && !preview && (
                <Link className="primary" href="/portal">
                  Open my full project portal →
                </Link>
              )}
              {!entry.documents.length && (
                <p>
                  No contracts are currently shared. Please contact me if you
                  need a copy.
                </p>
              )}
              {entry.documents.map((doc) => (
                <article className="business-record" key={doc.id}>
                  <h3>
                    {doc.name} · {doc.version_label}
                  </h3>
                  <a className="resource" href={"/files/" + doc.id}>
                    Download contract PDF ↗
                  </a>
                  <p>
                    Download the PDF, complete and sign it in Adobe Acrobat or
                    the signing tool we agreed on, then save and return that PDF
                    here. Signing takes place outside ABA.
                  </p>
                  {entry.returns
                    .filter((a) => a.contract_document_id === doc.id)
                    .map((a) => (
                      <div className="document-item" key={a.id}>
                        <a className="resource" href={"/assets/" + a.id}>
                          Your returned copy · {a.name} ↗
                        </a>
                        <small>
                          Sent{" "}
                          {new Date(a.created_at).toLocaleDateString("en-GB", {
                            timeZone: "Europe/London",
                          })}
                          . A returned file is not automatically verified.
                        </small>
                      </div>
                    ))}
                  {!preview && !entry.archived_at && (
                    <ReturnContract id={doc.id} />
                  )}
                </article>
              ))}
            </section>
          ))
        )}
        {!preview && (
          <details className="panel">
            <summary>Set my sign-in password</summary>
            <PasswordForm />
          </details>
        )}
        {!preview && (
          <form action={signOut}>
            <button className="secondary">Sign out</button>
          </form>
        )}
      </div>
    </main>
  );
}
