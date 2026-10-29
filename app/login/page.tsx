import BrandMark from "@/components/brand-mark";
import Link from "next/link";
import { LoginForms } from "@/components/auth-forms";
import { configured } from "@/lib/supabase/server";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; invited?: string }>;
}) {
  const { error, invited } = await searchParams;
  return (
    <main className="auth-page">
      <Link className="logo" href="/">
        <BrandMark />
      </Link>
      <section className="panel auth-panel">
        <div className="eyebrow">YOUR CREATIVE JOURNEY</div>
        <h1>Sign in to ABA Studio.</h1>
        <p>A private space for your project with Alex Bell Arts.</p>
        {invited === "1" && (
          <p className="helper-note">
            Alex has invited your existing account. Use the email from your
            invitation and sign in below. If you haven’t set a password, choose
            Sign in by email instead.
          </p>
        )}
        {error && (
          <div className="banner">
            {error === "reset"
              ? "Open your latest password-reset email first, or request a new one below."
              : "That sign-in link could not be verified. Request a fresh link and open it in this browser."}
          </div>
        )}
        {configured() ? (
          <LoginForms />
        ) : (
          <>
            <div className="banner">
              Secure sign-in is not connected yet. No client accounts are
              available.
            </div>
            <Link className="secondary" href="/setup">
              Connection setup
            </Link>
          </>
        )}
        <Link className="resource" href="/demo">
          Explore the fictional demonstration →
        </Link>
      </section>
    </main>
  );
}
