import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { z } from "zod";
import { configured, identity } from "@/lib/supabase/server";
import { loadProspectArea } from "@/lib/supabase/prospects";
import { MfaRequiredError } from "@/lib/mfa";
import ProspectArea from "@/components/prospect-area";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Your enquiry — Alex Bell Arts",
  robots: { index: false, follow: false },
};
export default async function Welcome({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  if (!configured()) redirect("/login");
  let session;
  try {
    session = await identity();
  } catch (error) {
    if (error instanceof MfaRequiredError) redirect("/account-security");
    redirect("/login");
  }
  const preview = session.profile.role === "admin",
    query = await searchParams,
    target = z.uuid().safeParse(query.projectId);
  if (preview && !target.success) redirect("/workspace");
  const result = await loadProspectArea(
    session.db,
    preview && target.success ? target.data : undefined,
  );
  return (
    <ProspectArea
      entries={result.entries}
      ready={result.ready}
      preview={preview}
    />
  );
}
