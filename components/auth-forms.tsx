"use client";
import { useActionState } from "react";
import {
  signIn,
  requestSignInLink,
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
      <details>
        <summary>Sign in by email instead</summary>
        <p>For invited accounts. I’ll send a sign-in link through Supabase.</p>
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
    </>
  );
}
export function AcceptInvitation({ token }: { token: string }) {
  const [state, action, pending] = useActionState(confirmInvitation, initial);
  return (
    <form action={action}>
      <input type="hidden" name="token_hash" value={token} />
      <button className="primary full" disabled={pending}>
        {pending ? "Opening your workspace…" : "Accept invitation & sign in"}
      </button>
      <p role="status">{state.message}</p>
    </form>
  );
}
export function PasswordForm() {
  const [state, action, pending] = useActionState(setPassword, initial);
  return (
    <details>
      <summary>Set or change my password</summary>
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
        <button className="secondary" disabled={pending}>
          Save password
        </button>
        <p role="status">{state.message}</p>
      </form>
    </details>
  );
}
