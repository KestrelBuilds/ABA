import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "ABA Client Portal — Alex Bell Arts",
};
import { MfaRequiredError } from "@/lib/mfa";
import { redirect } from "next/navigation";
import { configured, identity } from "@/lib/supabase/server";
import { loadWorkspace } from "@/lib/workspace";
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
  return <ConnectedStudio data={data} />;
}
