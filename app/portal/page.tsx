import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "ABA Client Portal — Alex Bell Arts",
};
import { MfaRequiredError } from "@/lib/mfa";
import { redirect } from "next/navigation";
import { configured, identity } from "@/lib/supabase/server";
import { loadWorkspace } from "@/lib/workspace";
import Link from "next/link";
import { loadContractArea } from "@/lib/contracts";
import ConnectedStudio from "@/components/connected-studio";
export const dynamic = "force-dynamic";
export default async function Portal() {
  if (!configured()) redirect("/login");
  let role: string;
  try {
    role = (await identity()).profile.role;
  } catch (error) {
    if (error instanceof MfaRequiredError) redirect("/account-security");
    redirect("/login");
  }
  if (role === "admin") redirect("/workspace");
  const data = await loadWorkspace();
  const contracts = await loadContractArea((await identity()).db);
  if (!data.projects.length && contracts.entries.length) redirect("/contracts");
  return (
    <>
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
