"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  runPortalChecks,
  sendOwnerTestEmail,
  type Result,
} from "@/app/actions";
export function PortalCheck() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<Result | null>(null);
  const router = useRouter();
  const [emailPending, startEmail] = useTransition();
  const [emailResult, setEmailResult] = useState<Result | null>(null);
  return (
    <details className="portal-check">
      <summary>Check client portal access</summary>
      <p>
        I can check the connected database using two temporary fictional
        accounts. No emails are sent, your owner account stays signed in, and
        the temporary accounts, files and records are removed afterwards.
      </p>
      <p>
        This checks account access, actual PDF uploads/downloads, private-file
        rules and final-delivery gates. It does not complete the full launch
        security review.
      </p>
      <button
        className="primary"
        disabled={pending || emailPending}
        onClick={() =>
          start(async () => {
            setResult(null);
            try {
              setResult(await runPortalChecks());
            } catch {
              setResult({
                ok: false,
                message:
                  "The check was interrupted. Review any remaining Automatic portal check records in Supabase before retrying.",
              });
            }
            router.refresh();
          })
        }
      >
        {pending ? "Checking client access…" : "Run automatic portal checks"}
      </button>
      {result && (
        <div
          role="status"
          className={result.ok ? "form-result" : "form-result error"}
        >
          {result.message}
        </div>
      )}
      <div className="email-check">
        <h3>Test email delivery</h3>
        <p>
          Send one sign-in email to my signed-in owner account. This does not
          email any clients. Delivery is confirmed only when I receive it and
          successfully open its link in this browser.
        </p>
        <button
          className="secondary"
          disabled={pending || emailPending}
          onClick={() =>
            startEmail(async () => {
              setEmailResult(null);
              try {
                setEmailResult(await sendOwnerTestEmail());
              } catch {
                setEmailResult({
                  ok: false,
                  message:
                    "The email test was interrupted. Check your inbox before retrying.",
                });
              }
            })
          }
        >
          {emailPending ? "Requesting email…" : "Send test sign-in email to me"}
        </button>
        {emailResult && (
          <div
            role="status"
            className={emailResult.ok ? "form-result" : "form-result error"}
          >
            {emailResult.message}
          </div>
        )}
        <p>
          Client invitations currently use a private link that I share myself;
          automatic invitation emails are not enabled.
        </p>
      </div>
    </details>
  );
}
