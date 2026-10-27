import { redirect } from "next/navigation";
import { configured, identity } from "@/lib/supabase/server";
import { loadWorkspace } from "@/lib/workspace";
import ConnectedStudio from "@/components/connected-studio";
export const dynamic = "force-dynamic";
export default async function Workspace() {
  if (!configured()) redirect("/login");
  try {
    await identity(true);
  } catch {
    redirect("/login");
  }
  const data = await loadWorkspace();
  return <ConnectedStudio data={data} />;
}
