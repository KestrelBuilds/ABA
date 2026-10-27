"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { runPortalChecks, type Result } from "@/app/actions";
export function PortalCheck() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<Result | null>(null);
  const router = useRouter();
  return (
    <details className="portal-check">
      <summary>Check client portal access</summary>
      <p>
        I can check the connected database using two temporary fictional
        accounts. No emails are sent, your owner account stays signed in, and
        the test accounts and records are removed afterwards.
      </p>
      <p>
        This checks account access and privacy rules. It does not complete the
        full launch security review.
      </p>
      <button
        className="primary"
        disabled={pending}
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
    </details>
  );
}
