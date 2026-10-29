import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "ABA Client Portal — Alex Bell Arts",
};
import { MfaRequiredError } from "@/lib/mfa";
import { redirect } from "next/navigation";
import { configured, identity, database } from "@/lib/supabase/server";
import { loadWorkspace } from "@/lib/workspace";
import Link from "next/link";
import { loadProspectArea } from "@/lib/supabase/prospects";
import { loadContractArea } from "@/lib/contracts";
import ConnectedStudio from "@/components/connected-studio";
export const dynamic = "force-dynamic";
export default async function Portal() {
  if (!configured()) redirect("/login");
  const db = await database();
  const auth = await db.auth.getUser();
  if (auth.error || !auth.data.user) redirect("/login");
  await db.rpc("accept_invitation");
  let role: string;
  try {
    role = (await identity()).profile.role;
  } catch (error) {
    if (error instanceof MfaRequiredError) redirect("/account-security");
    redirect("/access");
  }
  if (role === "admin") redirect("/workspace");
  const data = await loadWorkspace();
  const session = await identity();
  const prospects = await loadProspectArea(session.db);
  if (!data.projects.length && prospects.entries.length) redirect("/welcome");
  const contracts = await loadContractArea(session.db);
  if (!data.projects.length && contracts.entries.length) redirect("/contracts");
  return (
    <>
      {prospects.entries.some(
        (p) => !(p.contract_signed && p.deposit_paid),
      ) && (
        <div className="banner">
          <Link href="/welcome">Open my potential-client area →</Link>
        </div>
      )}
      {contracts.entries.some(
        (p) => !(p.contract_signed && p.deposit_paid),
      ) && (
        <div className="banner">
          <Link href="/contracts">
            Review contracts for projects awaiting onboarding →
          </Link>
        </div>
      )}
      <ConnectedStudio data={data} />
    </>
  );
}
