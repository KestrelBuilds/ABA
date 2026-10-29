import { redirect } from "next/navigation";
import Link from "next/link";
import { database, configured, identity } from "@/lib/supabase/server";
import { MfaRequiredError } from "@/lib/mfa";
import { PasswordForm } from "@/components/auth-forms";
import BrandMark from "@/components/brand-mark";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Your portal password — Alex Bell Arts",
  robots: { index: false, follow: false },
};
export default async function ResetPassword({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  if (!configured()) redirect("/login");
  const db = await database();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) redirect("/login?error=reset");
  const profile = await db
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile.error) throw Error("Account security could not be checked.");
  if (profile.data?.role === "admin") {
    try {
      await identity();
    } catch (e) {
      if (e instanceof MfaRequiredError) redirect("/account-security");
      throw e;
    }
  }
  const welcome = (await searchParams).welcome === "1";
  return (
    <main className="auth-page">
      <Link className="logo" href="/">
        <BrandMark />
      </Link>
      <section className="panel auth-panel">
        <span className="section-kicker">YOUR ACCOUNT</span>
        <h1>
          {welcome
            ? "Welcome. Let’s set your password."
            : "Choose a new password."}
        </h1>
        <p>
          {welcome
            ? "Your invitation has been accepted. Set a password so you can return to your portal whenever you need."
            : "Use at least 12 characters. Your project access stays controlled by Alex."}
        </p>
        <PasswordForm standalone />
        <Link className="resource" href="/portal">
          Continue to my portal →
        </Link>
      </section>
    </main>
  );
}
