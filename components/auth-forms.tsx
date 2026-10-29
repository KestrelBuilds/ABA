"use client";
import { useActionState } from "react";
import Link from "next/link";
import {
  signIn,
  requestSignInLink,
  requestPasswordReset,
  confirmInvitation,
  setPassword,
  type Result,
} from "@/app/actions";
const initial: Result = { ok: false, message: "" };
export function LoginForms() {
  const [state, action, pending] = useActionState(signIn, initial);
  const [linkState, linkAction, linkPending] = useActionState(
    requestSignInLink,
    initial,
  );
  const [resetState, resetAction, resetPending] = useActionState(
    requestPasswordReset,
    initial,
  );
  return (
    <>
      <form action={action}>
        <label>
          Email address
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            minLength={8}
            autoComplete="current-password"
            required
          />
        </label>
        <button className="primary full" disabled={pending}>
          {pending ? "Signing in…" : "Sign in to ABA Studio"}
        </button>
        <p role="status">{state.message}</p>
      </form>
      <details className="auth-help">
        <summary>Forgot your password?</summary>
        <p>
          Enter the email Alex invited. I’ll send a link so you can choose a new
          password.
        </p>
        <form action={resetAction}>
          <label>
            Email address
            <input type="email" name="email" autoComplete="email" required />
          </label>
          <button className="secondary full" disabled={resetPending}>
            {resetPending ? "Requesting…" : "Send password-reset link"}
          </button>
          <p role="status">{resetState.message}</p>
        </form>
      </details>
      <details className="auth-help">
        <summary>Sign in by email instead</summary>
        <p>
          Already invited, but haven’t set a password? Request a sign-in link.
          Open the latest email in this browser.
        </p>
        <form action={linkAction}>
          <label>
            Email address
            <input type="email" name="email" autoComplete="email" required />
          </label>
          <button className="secondary full" disabled={linkPending}>
            {linkPending ? "Requesting…" : "Request sign-in link"}
          </button>
          <p role="status">{linkState.message}</p>
        </form>
      </details>
      <p className="auth-guidance">
        New here? Ask Alex for your private invitation. There’s no public
        account registration.
      </p>
    </>
  );
}
export function AcceptInvitation({
  token,
  kind = "invite",
}: {
  token: string;
  kind?: "invite" | "recovery";
}) {
  const [state, action, pending] = useActionState(confirmInvitation, initial);
  return (
    <form action={action}>
      <input type="hidden" name="token_hash" value={token} />
      <input type="hidden" name="type" value={kind} />
      <button className="primary full" disabled={pending}>
        {pending
          ? "Opening your account…"
          : kind === "recovery"
            ? "Continue to reset password"
            : "Accept invitation & sign in"}
      </button>
      <p role="status">{state.message}</p>
      {!state.ok && state.message && (
        <Link className="resource" href="/login">
          Return to sign in or request a fresh password link →
        </Link>
      )}
    </form>
  );
}
export function PasswordForm({ standalone = false }: { standalone?: boolean }) {
  const [state, action, pending] = useActionState(setPassword, initial);
  const form = (
    <form action={action}>
      <label>
        New password (12 characters minimum)
        <input
          name="password"
          type="password"
          minLength={12}
          maxLength={128}
          autoComplete="new-password"
          required
        />
      </label>
      <label>
        Confirm new password
        <input
          name="password_confirm"
          type="password"
          minLength={12}
          maxLength={128}
          autoComplete="new-password"
          required
        />
      </label>
      <button
        className={standalone ? "primary full" : "secondary"}
        disabled={pending}
      >
        {pending ? "Saving…" : "Save password"}
      </button>
      <p role="status">{state.message}</p>
      {state.ok && !standalone && (
        <Link className="resource" href="/portal">
          Open my portal →
        </Link>
      )}
    </form>
  );
  return standalone ? (
    form
  ) : (
    <details>
      <summary>Set or change my password</summary>
      {form}
    </details>
  );
}
