import { redirect } from "next/navigation";
import Link from "next/link";
import { identity, configured } from "@/lib/supabase/server";
import MfaPanel from "@/components/mfa-panel";
export const dynamic = "force-dynamic";
export default async function AccountSecurity() {
  if (!configured()) redirect("/login");
  let account;
  try {
    account = await identity(true, true);
  } catch {
    redirect("/login");
  }
  const factors = await account.db.auth.mfa.listFactors();
  const assurance = await account.db.auth.mfa.getAuthenticatorAssuranceLevel();
  if (factors.error || assurance.error)
    throw Error("Account security is unavailable.");
  return (
    <main className="auth-page">
      <section className="panel auth-panel">
        <div className="eyebrow">ABA STUDIO / OWNER SECURITY</div>
        <h1>A little extra protection.</h1>
        <MfaPanel
          factors={factors.data.totp
            .filter((f) => f.status === "verified")
            .map((f) => ({
              id: f.id,
              name: f.friendly_name ?? "Owner authenticator",
            }))}
          verified={assurance.data.currentLevel === "aal2"}
        />
        <Link className="resource" href="/workspace">
          Return to workspace →
        </Link>
      </section>
    </main>
  );
}
