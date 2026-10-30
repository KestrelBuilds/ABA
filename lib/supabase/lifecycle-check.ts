import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createCheckDocument } from "./check-document";
import {
  assertSignedDownload,
  assertStorageDenied,
  assertStoredBytes,
  fictionalPdf,
} from "./storage-check";
function check(condition: unknown, step: string): asserts condition {
  if (!condition) throw Error(step + " did not pass.");
}
function saved(error: unknown, step: string) {
  if (error) throw Error(step + " could not be completed.");
}
// IDs originate exclusively in checkClientPortals. No service/RLS bypass is used
// here; all assertions use the owner or the two disposable authenticated clients.
export async function checkProjectLifecycle(
  owner: SupabaseClient,
  client: SupabaseClient,
  other: SupabaseClient,
  scope: {
    projectId: string;
    clientId: string;
    userId: string;
    documentId: string;
    combinedProjectId: string;
    combinedDocumentId: string;
    runId: string;
    origin: string;
    secureFiles: boolean;
  },
): Promise<"passed" | "unavailable"> {
  const capability = await owner.rpc("project_lifecycle_ready");
  if (
    capability.error &&
    !["PGRST202", "42883"].includes(capability.error.code)
  )
    throw Error("Project lifecycle capability could not be checked.");
  if (capability.data !== true) return "unavailable";
  const { projectId, documentId, combinedProjectId, combinedDocumentId } =
    scope;
  const path = projectId + "/" + documentId,
    pdf = fictionalPdf();
  const archive = async (archived: boolean, access: "retain" | "suspend") =>
    saved(
      (
        await owner.rpc("archive_project", {
          target: projectId,
          archived,
          client_access: access,
          acknowledged: true,
        })
      ).error,
      "Temporary project archiving",
    );
  const flags = async (id: string) => {
    const result = await owner
      .from("projects")
      .select("contract_signed,deposit_paid,final_paid,final_approved")
      .eq("id", id)
      .single();
    saved(result.error, "Temporary verification read");
    check(result.data, "Temporary project exists");
    return result.data;
  };
  const before = await flags(projectId);
  await archive(true, "retain");
  const retained = await client
    .from("projects")
    .select("id")
    .eq("id", projectId);
  check(
    !retained.error && retained.data?.length === 1,
    "Retained archive project read",
  );
  await assertStoredBytes(client, path, pdf);
  await assertSignedDownload(client, path, pdf, scope.origin);
  const blocked = await client
    .from("feedback")
    .insert({
      document_id: documentId,
      author_id: scope.userId,
      body: "Fictional archived-project write probe",
      decision: "comment",
    })
    .select("id");
  check(blocked.error?.code === "42501", "Retained archive write protection");
  await archive(true, "suspend");
  const suspended = await client
    .from("projects")
    .select("id")
    .eq("id", projectId);
  check(
    !suspended.error && suspended.data?.length === 0,
    "Suspended archive project privacy",
  );
  const hidden = await client
    .from("documents")
    .select("id")
    .eq("id", documentId);
  check(
    !hidden.error && hidden.data?.length === 0,
    "Suspended archive document privacy",
  );
  await assertStorageDenied(client, path, "Suspended archive file protection");
  await assertStorageDenied(other, path, "Unrelated-client archive protection");
  await archive(false, "retain");
  const after = await flags(projectId);
  check(
    Object.entries(before).every(
      ([key, value]) => after[key as keyof typeof after] === value,
    ),
    "Archive preserves verification records",
  );
  await assertStoredBytes(client, path, pdf);
  const restored = await client
    .from("feedback")
    .insert({
      document_id: documentId,
      author_id: scope.userId,
      body: "Fictional restored-project write probe",
      decision: "comment",
    })
    .select("id");
  check(
    !restored.error && restored.data?.length === 1,
    "Restored archive accepts ordinary feedback",
  );

  const reference = "Fictional diagnostic evidence " + scope.runId;
  for (const confirmed of [false, true])
    saved(
      (
        await owner.rpc("verify_project_record", {
          target: projectId,
          record_field: "final_paid",
          confirmed,
          reference,
          occurred_on: null,
          linked_document: documentId,
        })
      ).error,
      "Temporary verification evidence",
    );
  const history = await owner
    .from("project_verifications")
    .select(
      "confirmed,reference,occurred_on,actor_id,recorded_at,document_id,document_label,source",
    )
    .eq("project_id", projectId)
    .eq("field", "final_paid")
    .eq("reference", reference);
  check(
    !history.error &&
      history.data?.length === 2 &&
      history.data.some((e) => e.confirmed) &&
      history.data.some((e) => !e.confirmed) &&
      history.data.every(
        (e) =>
          e.source === "owner_check" &&
          e.occurred_on === null &&
          e.actor_id &&
          Number.isFinite(Date.parse(e.recorded_at)) &&
          e.document_id === documentId &&
          e.document_label,
      ),
    "Dated verification evidence",
  );
  for (const session of [client, other]) {
    const privateHistory = await session
      .from("project_verifications")
      .select("id")
      .eq("project_id", projectId);
    check(
      !privateHistory.error && privateHistory.data?.length === 0,
      "Verification evidence privacy",
    );
  }
  const forged = await client.from("project_verifications").insert({
    project_id: projectId,
    project_label: "Fictional forged evidence",
    field: "final_paid",
    confirmed: true,
    actor_id: scope.userId,
    reference,
    source: "owner_check",
  });
  check(forged.error?.code === "42501", "Client verification-write protection");

  saved(
    (
      await owner.from("projects").insert({
        id: combinedProjectId,
        client_id: scope.clientId,
        name: "Automatic combined-approval check " + scope.runId,
        type: "Both",
        due: "2099-01-01",
        budget: 0,
        contract_signed: true,
        deposit_paid: true,
        separate_approvals: true,
      })
    ).error,
    "Temporary combined project setup",
  );
  await createCheckDocument(
    owner,
    combinedProjectId,
    combinedDocumentId,
    "final",
    true,
    scope.secureFiles,
  );
  const finalPath = combinedProjectId + "/" + combinedDocumentId;
  const approve = async (workstream: string, confirmed: boolean) =>
    saved(
      (
        await owner.rpc("verify_stream_approval", {
          target: combinedProjectId,
          workstream,
          confirmed,
          reference: "Fictional diagnostic approval",
          linked_document: null,
        })
      ).error,
      "Temporary workstream approval",
    );
  await assertStorageDenied(
    client,
    finalPath,
    "Unapproved combined final files",
  );
  await approve("Brand Identity", true);
  check(
    (await flags(combinedProjectId)).final_approved === false,
    "One workstream cannot approve the combined project",
  );
  await assertStorageDenied(
    client,
    finalPath,
    "Brand-only combined final files",
  );
  await approve("Website Design", true);
  check(
    (await flags(combinedProjectId)).final_approved === true,
    "Both workstreams establish overall approval",
  );
  await assertStorageDenied(client, finalPath, "Unpaid combined final files");
  saved(
    (
      await owner.rpc("verify_project_record", {
        target: combinedProjectId,
        record_field: "final_paid",
        confirmed: true,
        reference: "Fictional diagnostic payment",
        occurred_on: null,
        linked_document: null,
      })
    ).error,
    "Temporary combined payment check",
  );
  await assertStoredBytes(client, finalPath, pdf);
  await assertSignedDownload(client, finalPath, pdf, scope.origin);
  await assertStorageDenied(
    other,
    finalPath,
    "Other-client combined final files",
  );
  await approve("Brand Identity", false);
  check(
    (await flags(combinedProjectId)).final_approved === false,
    "Workstream approval removal restores restrictions",
  );
  await assertStorageDenied(
    client,
    finalPath,
    "Revoked combined final approval",
  );
  const tampered = await client
    .from("projects")
    .update({ final_approved: true })
    .eq("id", combinedProjectId)
    .select("id");
  check(
    tampered.error
      ? tampered.error.code === "42501"
      : tampered.data?.length === 0,
    "Client cannot override combined approval",
  );
  check(
    (await flags(combinedProjectId)).final_approved === false,
    "Combined approval integrity",
  );
  const unrelated = await other
    .from("projects")
    .select("id,contract_signed,deposit_paid,final_paid,final_approved");
  check(
    !unrelated.error &&
      unrelated.data?.length === 1 &&
      unrelated.data[0].contract_signed &&
      unrelated.data[0].deposit_paid &&
      !unrelated.data[0].final_paid &&
      !unrelated.data[0].final_approved,
    "Unrelated client's project and verification records remain unchanged",
  );
  return "passed";
}
