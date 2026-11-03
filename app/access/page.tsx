import BrandMark from "@/components/brand-mark";
import BrandSignature from "@/components/brand-signature";
import ContactAlex from "@/components/contact-alex";
import { redirect } from "next/navigation";
import Link from "next/link";
import { database, configured } from "@/lib/supabase/server";
import { signOut } from "@/app/actions";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Portal access — Alex Bell Arts",
  robots: { index: false, follow: false },
};
export default async function Access() {
  if (!configured()) redirect("/login");
  const db = await database();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) redirect("/login");
  const profile = await db
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile.error) throw Error("Account access could not be checked.");
  if (profile.data) redirect("/portal");
  return (
    <main className="auth-page">
      <Link className="logo" href="/" aria-label="Alex Bell Arts home">
        <BrandMark />
      </Link>
      <section className="panel auth-panel">
        <span className="section-kicker">YOUR ACCOUNT</span>
        <h1>Your portal isn’t available yet.</h1>
        {user.email && (
          <div className="signed-in-account">
            <span>Signed in as</span>
            <strong>{user.email}</strong>
          </div>
        )}
        <p>
          You’re signed in, but there isn’t an active client invitation
          connected to this account. Your invitation may have expired, access
          may have been removed, or I may still be preparing your space.
        </p>
        <p>
          Check this email against my invitation. If it differs, sign out and
          use the invited email. If it matches, contact me so I can check your
          invitation and the shared project area. You don’t need to create
          another account.
        </p>
        <Link className="secondary full" href="/portal">
          Check my access again
        </Link>
        <form action={signOut}>
          <button className="secondary full">
            Sign out and use another account
          </button>
        </form>
        <ContactAlex label="Email Alex about portal access" />
      </section>
      <BrandSignature />
    </main>
  );
}
