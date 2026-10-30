import QuarantineInbox from "@/components/quarantine-inbox";
import { loadPendingUploads } from "@/lib/supabase/pending-uploads";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { z } from "zod";
import { configured, identity } from "@/lib/supabase/server";
import { loadProspectArea } from "@/lib/supabase/prospects";
import { loadContractArea } from "@/lib/contracts";
import { MfaRequiredError } from "@/lib/mfa";
import ContractArea from "@/components/contract-area";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Your contract — Alex Bell Arts",
  robots: { index: false, follow: false },
};
export default async function Contracts({
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
  const preview = session.profile.role === "admin";
  const query = await searchParams;
  const target = z.uuid().safeParse(query.projectId);
  if (preview && !target.success) redirect("/workspace");
  if (!preview && (await loadProspectArea(session.db)).entries.length)
    redirect("/welcome");
  const result = await loadContractArea(
    session.db,
    preview && target.success ? target.data : undefined,
  );
  const pending = preview ? [] : await loadPendingUploads(session.db);
  return (
    <>
      <ContractArea
        entries={result.entries}
        ready={result.ready}
        preview={preview}
      />
      {!preview && (
        <QuarantineInbox
          uploads={pending.filter((u) =>
            result.entries.some(
              (e) => e.project_id === u.project_id && !e.archived_at,
            ),
          )}
        />
      )}
    </>
  );
}
