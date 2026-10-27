import Link from "next/link";
import { LoginForms } from "@/components/auth-forms";
import { configured } from "@/lib/supabase/server";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="auth-page">
      <Link className="logo" href="/">
        aba<span>STUDIO</span>
      </Link>
      <section className="panel auth-panel">
        <div className="eyebrow">YOUR CREATIVE JOURNEY</div>
        <h1>A little closer to what’s next.</h1>
        <p>A private space for your project with Alex Bell Arts.</p>
        {error && (
          <div className="banner">
            That sign-in link could not be verified. Request a fresh link and
            open it in this browser.
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
