"use client";
import { useState, useTransition } from "react";
import { authenticatorQrSource } from "@/lib/mfa";
import { useRouter } from "next/navigation";
import {
  enrollAuthenticator,
  verifyAuthenticator,
  type MfaResult,
} from "@/app/account-security/actions";
export default function MfaPanel({
  factors,
  verified,
}: {
  factors: { id: string; name: string }[];
  verified: boolean;
}) {
  const [result, setResult] = useState<MfaResult | null>(null);
  const [enrollment, setEnrollment] = useState<MfaResult | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <>
      {verified ? (
        <p>Your current session has passed the authenticator check.</p>
      ) : (
        <>
          <p>
            Add an authenticator such as Microsoft Authenticator, Google
            Authenticator or a password manager that supports verification
            codes. Once enabled, owner access requires a current code. Keep your
            authenticator recovery/backup method safe before continuing.
          </p>
          {!factors.length && !enrollment && (
            <button
              className="primary"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await enrollAuthenticator();
                  setResult(r);
                  if (r.ok) setEnrollment(r);
                })
              }
            >
              {pending ? "Preparing…" : "Set up my authenticator"}
            </button>
          )}
          {enrollment?.qr && (
            <img
              className="mfa-qr"
              alt="Private authenticator setup QR code"
              src={authenticatorQrSource(enrollment.qr)}
            />
          )}
          {(factors.length > 0 || enrollment?.factorId) && (
            <form
              action={(form) =>
                start(async () => {
                  const r = await verifyAuthenticator(form);
                  setResult(r);
                  if (r.ok) {
                    setEnrollment(null);
                    router.replace("/workspace");
                    router.refresh();
                  }
                })
              }
            >
              <label>
                Authenticator
                <select name="factorId">
                  {enrollment?.factorId ? (
                    <option value={enrollment.factorId}>
                      ABA Studio owner
                    </option>
                  ) : (
                    factors.map((f) => (
                      <option value={f.id} key={f.id}>
                        {f.name}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <label>
                Six-digit code
                <input
                  name="code"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                />
              </label>
              <button className="primary" disabled={pending}>
                {pending ? "Verifying…" : "Verify & open workspace"}
              </button>
            </form>
          )}
        </>
      )}
      {result && (
        <p
          role="status"
          className={result.ok ? "form-result" : "form-result error"}
        >
          {result.message}
        </p>
      )}
      <p>
        Lost your authenticator? Use your authenticator’s backup/recovery
        method. If unavailable, account recovery must be performed through your
        secured Supabase project administration. There is no email-only bypass
        of this owner protection.
      </p>
    </>
  );
}
