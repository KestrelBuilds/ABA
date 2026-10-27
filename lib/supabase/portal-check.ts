import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseSettings } from "./config";
import { checkPrivateStorage, assertStorageDenied } from "./storage-check";

type CheckResult = { ok: boolean; message: string };
function requireSuccess(error: unknown, step: string) {
  if (error) throw new Error(step + " could not be completed.");
}
function verify(condition: boolean, step: string) {
  if (!condition) throw new Error(step + " did not pass.");
}

// Called only after the server action validates the owner. Service credentials scaffold
// and clean up isolated fixtures; every access check uses actual client sessions/RLS.
export async function checkClientPortals(
  owner: SupabaseClient,
  service: SupabaseClient,
): Promise<CheckResult> {
  const runId = crypto.randomUUID();
  const clients = [crypto.randomUUID(), crypto.randomUUID()];
  const projects = [crypto.randomUUID(), crypto.randomUUID()];
  const documents = [
    crypto.randomUUID(),
    crypto.randomUUID(),
    crypto.randomUUID(),
  ];
  const paths = documents.map((id) => projects[0] + "/" + id);
  let storageAttempted = false;
  const users: string[] = [];
  const sessions: SupabaseClient[] = [];
  const { url, key } = supabaseSettings();
  let result: CheckResult = {
    ok: false,
    message: "Portal checks did not finish.",
  };
  const cleanupProblems: string[] = [];
  try {
    for (let index = 0; index < 2; index++) {
      const email = `aba-check-${runId}-${index}@example.com`;
      const password = crypto.randomUUID() + crypto.randomUUID();
      const created = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: { aba_test_run: runId },
      });
      requireSuccess(created.error, "Temporary account creation");
      if (!created.data.user)
        throw new Error("Temporary account was not created.");
      users.push(created.data.user.id);
      requireSuccess(
        (
          await owner.from("clients").insert({
            id: clients[index],
            name: `Automatic portal check ${index + 1} (${runId})`,
            contact: "Fictional test account",
            email,
            sector: "Temporary security check",
          })
        ).error,
        "Temporary client setup",
      );
      requireSuccess(
        (
          await owner.from("projects").insert({
            id: projects[index],
            client_id: clients[index],
            name: `Automatic portal check ${runId}`,
            type: index === 0 ? "Brand Identity" : "Website Design",
            due: "2099-01-01",
            budget: 0,
            contract_signed: true,
            deposit_paid: true,
          })
        ).error,
        "Temporary project setup",
      );
      requireSuccess(
        (
          await owner.from("project_notes").insert({
            project_id: projects[index],
            body: "PRIVATE AUTOMATIC TEST NOTE",
          })
        ).error,
        "Internal note setup",
      );
      requireSuccess(
        (
          await owner.from("stages").insert([
            {
              project_id: projects[index],
              name: "Visible test milestone",
              stream: "Test",
              position: 0,
              visible: true,
            },
            {
              project_id: projects[index],
              name: "Hidden test milestone",
              stream: "Test",
              position: 1,
              visible: false,
            },
          ])
        ).error,
        "Milestone setup",
      );
      requireSuccess(
        (
          await owner.from("invitations").insert({
            client_id: clients[index],
            user_id: created.data.user.id,
          })
        ).error,
        "Temporary invitation setup",
      );
      const session = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      sessions.push(session);
      requireSuccess(
        (await session.auth.signInWithPassword({ email, password })).error,
        "Client password sign-in",
      );
      requireSuccess(
        (await session.rpc("accept_invitation")).error,
        "Client invitation acceptance",
      );
    }
    for (let index = 0; index < 2; index++) {
      const session = sessions[index];
      const visible = await session.from("projects").select("id");
      requireSuccess(visible.error, "Project read");
      verify(
        visible.data?.length === 1 && visible.data[0].id === projects[index],
        "Client project isolation",
      );
      const notes = await session
        .from("project_notes")
        .select("project_id")
        .in("project_id", projects);
      requireSuccess(notes.error, "Internal note access check");
      verify(notes.data?.length === 0, "Internal note privacy");
      const stages = await session
        .from("stages")
        .select("id")
        .eq("project_id", projects[index]);
      requireSuccess(stages.error, "Milestone read");
      verify(stages.data?.length === 1, "Hidden milestone privacy");
      const changed = await session
        .from("projects")
        .update({ final_paid: true })
        .eq("id", projects[index])
        .select("id");
      verify(
        changed.error
          ? changed.error.code === "42501"
          : changed.data?.length === 0,
        "Payment write protection",
      );
      const trusted = await owner
        .from("projects")
        .select("final_paid")
        .eq("id", projects[index])
        .single();
      requireSuccess(trusted.error, "Payment verification");
      verify(trusted.data?.final_paid === false, "Payment record integrity");
    }
    requireSuccess(
      (
        await owner.from("documents").insert(
          documents.map((id, index) => ({
            id,
            project_id: projects[0],
            name: "Automatic test document",
            object_path: projects[0] + "/" + id,
            category: index === 2 ? "final" : "document",
            published: index !== 1,
          })),
        )
      ).error,
      "Document metadata setup",
    );
    const visibleDocuments = await sessions[0]
      .from("documents")
      .select("id")
      .in("id", documents);
    requireSuccess(visibleDocuments.error, "Document read");
    verify(
      visibleDocuments.data?.length === 1 &&
        visibleDocuments.data[0].id === documents[0],
      "Unpublished and final-document privacy",
    );
    const otherDocuments = await sessions[1]
      .from("documents")
      .select("id")
      .in("id", documents);
    requireSuccess(otherDocuments.error, "Cross-client document check");
    verify(otherDocuments.data?.length === 0, "Cross-client document privacy");
    storageAttempted = true;
    const anonymous = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await checkPrivateStorage(
      owner,
      sessions[0],
      sessions[1],
      anonymous,
      projects[0],
      documents,
      url,
    );
    requireSuccess(
      (await owner.rpc("revoke_client_access", { target: clients[0] })).error,
      "Access revocation",
    );
    const revoked = await sessions[0].from("projects").select("id");
    requireSuccess(revoked.error, "Revoked-session check");
    verify(revoked.data?.length === 0, "Immediate access revocation");
    await assertStorageDenied(
      sessions[0],
      paths[0],
      "Revoked-client file protection",
    );
    result = {
      ok: true,
      message:
        "Passed: two client sign-ins, invitation acceptance, separate project access, hidden milestones, internal-note privacy, payment protection, document visibility, real PDF uploads/downloads, signed downloads, private-file access, final-payment/approval file gates and access revocation. Email delivery has not been tested by this check.",
    };
  } catch (error) {
    result = {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Portal checks could not finish.",
    };
  } finally {
    // Always target only the random IDs allocated by this run. Never delete existing client records.
    for (const session of sessions) {
      try {
        await session.auth.signOut({ scope: "local" });
      } catch {
        /* Account deletion invalidates access too. */
      }
    }
    const clean = async (
      label: string,
      operation: PromiseLike<{ error: unknown }>,
    ) => {
      try {
        if ((await operation).error) cleanupProblems.push(label);
      } catch {
        cleanupProblems.push(label);
      }
    };
    if (storageAttempted) {
      await clean(
        "temporary files",
        service.storage.from("project-files").remove(paths),
      );
    }
    await clean(
      "projects",
      service.from("projects").delete().in("id", projects),
    );
    await clean(
      "invitations",
      service.from("invitations").delete().in("client_id", clients),
    );
    if (users.length) {
      await clean(
        "profiles",
        service.from("profiles").delete().in("id", users),
      );
      // Preserve audit history while removing references to disposable auth users.
      await clean(
        "test audit references",
        service
          .from("audit_events")
          .update({ actor_id: null })
          .in("actor_id", users),
      );
    }
    await clean("clients", service.from("clients").delete().in("id", clients));
    for (const id of users)
      await clean("accounts", service.auth.admin.deleteUser(id));
  }
  if (cleanupProblems.length)
    return {
      ok: false,
      message:
        result.message +
        ` Temporary cleanup needs attention (${[...new Set(cleanupProblems)].join(", ")}). Check run ${runId} in Supabase before retrying.`,
    };
  return {
    ...result,
    message:
      result.message +
      " Temporary accounts, files and records were removed; the audit history was retained.",
  };
}
