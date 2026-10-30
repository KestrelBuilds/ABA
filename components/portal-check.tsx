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
  const [cleanupUnconfirmed, setCleanupUnconfirmed] = useState(false);
  const cleanupNeedsReview =
    (cleanupUnconfirmed ||
      result?.checks?.some(
        (check) =>
          check.label === "Temporary data cleanup" && check.status === "failed",
      )) ??
    false;
  const router = useRouter();
  const [emailPending, startEmail] = useTransition();
  const [emailResult, setEmailResult] = useState<Result | null>(null);
  return (
    <details className="portal-check">
      <summary>Check client portal access</summary>
      <p>
        I can check the connected database using two temporary fictional
        accounts and their own projects/files. No emails are sent and my owner
        account stays signed in. Cleanup is verified before success is reported;
        any cleanup problem is shown here.
      </p>
      <p>
        This checks accounts, questionnaires, private downloads, archive access,
        verification-history privacy and both approvals on combined projects. It
        can take a couple of minutes. Keep this page open until cleanup
        finishes. Email delivery, password recovery, backups and the wider
        launch review need separate checks.
      </p>
      <button
        className="primary"
        disabled={pending || emailPending || cleanupNeedsReview}
        onClick={() =>
          start(async () => {
            setResult(null);
            setCleanupUnconfirmed(false);
            try {
              setResult(await runPortalChecks());
            } catch {
              setCleanupUnconfirmed(true);
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
          {cleanupNeedsReview && (
            <p className="helper-note">
              Review the reported run and finish its cleanup before starting
              another check. Reload this page after that review.
            </p>
          )}
          {result.checks && (
            <ul
              className="portal-check-results"
              aria-label="Portal check results"
            >
              {result.checks.map((check) => (
                <li key={check.label}>
                  <b>{check.label}</b>
                  <span className={"check-result-state check-" + check.status}>
                    {check.status === "passed"
                      ? "Passed"
                      : check.status === "failed"
                        ? "Needs attention"
                        : check.status === "unavailable"
                          ? "Update unavailable"
                          : "Not run"}
                  </span>
                </li>
              ))}
            </ul>
          )}
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
