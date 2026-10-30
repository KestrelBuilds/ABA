import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseSettings } from "./config";
import { privateFetch } from "./private-fetch";
import { checkCreativeJourney } from "./journey-check";
import { checkPrivateStorage, assertStorageDenied } from "./storage-check";
import { createCheckDocument } from "./check-document";
import { checkProjectLifecycle } from "./lifecycle-check";
import { removeCheckFiles } from "./check-cleanup";
import type { PortalCheckItem } from "../portal-check-results";

type CheckResult = { ok: boolean; message: string; checks?: PortalCheckItem[] };
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
  clientFactory: typeof createClient = createClient,
): Promise<CheckResult> {
  const runId = crypto.randomUUID();
  const clients = [crypto.randomUUID(), crypto.randomUUID()];
  const projects = [crypto.randomUUID(), crypto.randomUUID()];
  const documents = [
    crypto.randomUUID(),
    crypto.randomUUID(),
    crypto.randomUUID(),
  ];
  const combinedProject = crypto.randomUUID(),
    combinedDocument = crypto.randomUUID();
  const allProjects = [...projects, combinedProject];
  const paths = [
    ...documents.map((id) => projects[0] + "/" + id),
    combinedProject + "/" + combinedDocument,
  ];
  const checks: PortalCheckItem[] = [
    "Accounts & project privacy",
    "Questionnaires & feedback",
    "Private files & final delivery",
    "Archives, evidence & combined approvals",
    "Access removal",
    "Temporary data cleanup",
  ].map((label) => ({ label, status: "not_run" }));
  let currentCheck = 0;
  let storageAttempted = false;
  let accountCreationUncertain = false;
  const users: string[] = [];
  const sessions: SupabaseClient[] = [];
  const { url, key } = supabaseSettings();
  let result: CheckResult = {
    ok: false,
    message: "Portal checks did not finish.",
    checks,
  };
  const cleanupProblems: string[] = [];
  try {
    for (let index = 0; index < 2; index++) {
      const email = `aba-check-${runId}-${index}@example.com`;
      const password = crypto.randomUUID() + crypto.randomUUID();
      accountCreationUncertain = true;
      const created = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: { aba_test_run: runId },
      });
      if (
        created.error &&
        [400, 401, 403, 404, 409, 422, 429].includes(created.error.status ?? 0)
      )
        accountCreationUncertain = false;
      requireSuccess(created.error, "Temporary account creation");
      if (!created.data.user?.id)
        throw new Error("Temporary account was not created.");
      users.push(created.data.user.id);
      accountCreationUncertain = false;
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
      const session = clientFactory(url, key, {
        global: { fetch: privateFetch },
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
    checks[0].status = "passed";
    currentCheck = 2;
    const fileCapability = await owner.rpc("file_security_ready");
    if (
      fileCapability.error &&
      !["PGRST202", "42883"].includes(fileCapability.error.code)
    )
      throw Error("Upload security capability could not be checked.");
    const secureFiles = fileCapability.data === true;
    storageAttempted = true;
    for (const [index, id] of documents.entries())
      await createCheckDocument(
        owner,
        projects[0],
        id,
        index === 2 ? "final" : "document",
        index !== 1,
        secureFiles,
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
    currentCheck = 1;
    await checkCreativeJourney(owner, sessions, projects, users, documents[0]);
    checks[1].status = "passed";
    currentCheck = 2;
    storageAttempted = true;
    const anonymous = clientFactory(url, key, {
      global: { fetch: privateFetch },
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
      true,
    );
    checks[2].status = "passed";
    currentCheck = 3;
    checks[3].status = await checkProjectLifecycle(
      owner,
      sessions[0],
      sessions[1],
      {
        projectId: projects[0],
        clientId: clients[0],
        userId: users[0],
        documentId: documents[0],
        combinedProjectId: combinedProject,
        combinedDocumentId: combinedDocument,
        runId,
        origin: url,
        secureFiles,
      },
    );
    currentCheck = 4;
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
    checks[4].status = "passed";
    result = {
      ok: true,
      checks,
      message:
        "Available portal checks passed." +
        (checks[3].status === "unavailable"
          ? " Lifecycle checks were not run because update 012 is unavailable."
          : "") +
        " Email delivery, password recovery, backups and privacy arrangements need separate checks.",
    };
  } catch (error) {
    checks[currentCheck].status = "failed";
    result = {
      ok: false,
      checks,
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
        if (!(await operation).error) return true;
      } catch {
        /* Report below. */
      }
      cleanupProblems.push(label);
      return false;
    };
    if (accountCreationUncertain)
      cleanupProblems.push(
        "temporary account creation outcome unknown — review this run in Auth",
      );
    // Remove the disposable accounts' access even if private-file cleanup fails.
    await clean(
      "invitations",
      service.from("invitations").delete().in("client_id", clients),
    );
    if (users.length) {
      await clean(
        "profiles",
        service.from("profiles").delete().in("id", users),
      );
      await clean(
        "test audit references",
        service
          .from("audit_events")
          .update({ actor_id: null })
          .in("actor_id", users),
      );
    }
    let filesClean = !storageAttempted;
    if (storageAttempted) {
      try {
        filesClean = await removeCheckFiles(service, paths);
      } catch {
        filesClean = false;
      }
      if (!filesClean)
        cleanupProblems.push(
          "private files / verification — project records retained",
        );
    }
    const projectsClean =
      filesClean &&
      (await clean(
        "projects",
        service.from("projects").delete().in("id", allProjects),
      ));
    if (projectsClean)
      await clean(
        "clients",
        service.from("clients").delete().in("id", clients),
      );
    for (const id of users)
      await clean("accounts", service.auth.admin.deleteUser(id));
    checks[5].status = cleanupProblems.length ? "failed" : "passed";
  }
  if (cleanupProblems.length)
    return {
      ok: false,
      checks,
      message:
        (result.ok
          ? "Permission checks passed; cleanup is not complete."
          : result.message) +
        ` Temporary cleanup needs attention (${[...new Set(cleanupProblems)].join(", ")}). Check run ${runId} in Supabase before retrying.`,
    };
  return {
    ...result,
    message:
      result.message +
      " Temporary accounts, files and records were removed; the audit history was retained.",
  };
}
