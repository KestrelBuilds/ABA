"use server";
import { requireCompleteAnswers } from "@/lib/questionnaires";
import { revalidatePath } from "next/cache";
import { resolveAppOrigin } from "@/lib/app-origin";
import { redirect } from "next/navigation";
import { database, identity, invitationAdmin } from "@/lib/supabase/server";
import {
  clientInput,
  projectInput,
  stageInput,
  feedbackInput,
  questionnaireInput,
  credentials,
  uuid,
  validateFile,
} from "@/lib/validation";
import { stagePurposes } from "@/lib/stage-purpose";
import { newProjectStages } from "@/lib/workflow-templates";
import { z } from "zod";
import { createClientInvitation } from "@/lib/supabase/client-invitations";
import type { PortalCheckItem } from "@/lib/portal-check-results";
import { UploadPendingError } from "@/lib/upload-policy";
import { stageVerification } from "@/lib/journey-verification";
export type Result = {
  ok: boolean;
  message: string;
  link?: string;
  refresh?: boolean;
  checks?: PortalCheckItem[];
};
function refresh() {
  revalidatePath("/workspace");
  revalidatePath("/portal");
  revalidatePath("/contracts");
  revalidatePath("/welcome");
}
async function run(fn: () => Promise<string | void>): Promise<Result> {
  try {
    const message = await fn();
    refresh();
    return { ok: true, message: message ?? "Saved." };
  } catch (e) {
    if (e instanceof UploadPendingError) refresh();
    return {
      ok: false,
      ...(e instanceof UploadPendingError ? { refresh: true } : {}),
      message:
        e instanceof z.ZodError
          ? "Please check the form fields and try again."
          : e instanceof Error
            ? e.message
            : "Something went wrong. Please try again.",
    };
  }
}
function checked(error: { message: string } | null) {
  if (error)
    throw Error(
      "The change could not be saved. Check your access and try again.",
    );
}
export async function signIn(_: Result, form: FormData): Promise<Result> {
  const v = credentials.safeParse(Object.fromEntries(form));
  if (!v.success)
    return {
      ok: false,
      message: "Enter a valid email and password (at least 8 characters).",
    };
  try {
    const db = await database();
    const { error } = await db.auth.signInWithPassword(v.data);
    if (error)
      return {
        ok: false,
        message:
          "Sign-in failed. Check your details or contact Alex for access.",
      };
  } catch {
    return {
      ok: false,
      message: "Sign-in is not available until Supabase is connected.",
    };
  }
  const db = await database();
  const accepted = await db.rpc("accept_invitation");
  if (accepted.error) redirect("/access");
  redirect("/portal");
}
export async function signOut() {
  const db = await database();
  await db.auth.signOut();
  redirect("/login");
}
export async function requestSignInLink(
  _: Result,
  form: FormData,
): Promise<Result> {
  const email = z.email().safeParse(form.get("email"));
  if (!email.success)
    return { ok: false, message: "Enter a valid email address." };
  try {
    const origin = await appOrigin();
    const db = await database();
    await db.auth.signInWithOtp({
      email: email.data,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: origin + "/auth/callback",
      },
    });
  } catch {
    /* Uniform response prevents account enumeration. */
  }
  return {
    ok: true,
    message:
      "If this email has an invited account, a sign-in link will arrive shortly. Check your spam folder too.",
  };
}
async function appOrigin() {
  return resolveAppOrigin(
    process.env.APP_ORIGIN,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  );
}

export async function confirmInvitation(
  _: Result,
  form: FormData,
): Promise<Result> {
  try {
    const token = z.string().min(20).max(2048).parse(form.get("token_hash"));
    const kind = z
      .enum(["invite", "recovery"])
      .parse(form.get("type") ?? "invite");
    const db = await database();
    const { error } = await db.auth.verifyOtp({
      token_hash: token,
      type: kind,
    });
    if (error)
      return {
        ok: false,
        message:
          kind === "recovery"
            ? "This password-reset link has expired or was already used. Request a fresh one from the sign-in page."
            : "This invitation has expired or was already used. Ask Alex for a new invitation.",
      };
    const { error: acceptError } =
      kind === "recovery" ? { error: null } : await db.rpc("accept_invitation");
    if (acceptError)
      return {
        ok: false,
        message:
          "You’re signed in, but this invitation cannot open a shared client area yet. Please ask Alex to check your invitation.",
      };
  } catch {
    return {
      ok: false,
      message: "The invitation could not be accepted. Please contact Alex.",
    };
  }
  redirect(
    form.get("type") === "recovery"
      ? "/reset-password"
      : "/reset-password?welcome=1",
  );
}
export async function addClient(form: FormData) {
  return run(async () => {
    const { db } = await identity(true);
    const values = clientInput.parse(Object.fromEntries(form));
    checked((await db.from("clients").insert(values)).error);
  });
}
export async function addProject(form: FormData) {
  return run(async () => {
    const { db } = await identity(true);
    const v = projectInput.parse(Object.fromEntries(form));
    checked(
      (
        await db.rpc("create_project", {
          project_name: v.name,
          target_client: v.clientId,
          project_type: v.type,
          due_date: v.due,
          project_budget: v.budget,
          template: newProjectStages(v.type).map((s) => ({
            name: s.name,
            stream: s.stream,
            purpose: s.purpose,
          })),
        })
      ).error,
    );
    return "Project created.";
  });
}
export async function saveStage(form: FormData) {
  return run(async () => {
    const { db } = await identity(true);
    const v = stageInput.parse({
      ...Object.fromEntries(form),
      visible: form.get("visible") === "on",
    });
    const capability = await db.rpc("stage_purposes_ready");
    if (
      capability.error &&
      !["PGRST202", "42883"].includes(capability.error.code)
    )
      throw Error("Stage purposes could not be checked.");
    const current = await db
      .from("stages")
      .select(
        capability.data === true
          ? "name,stream,status,purpose"
          : "name,stream,status",
      )
      .eq("id", v.id)
      .single()
      .overrideTypes<
        Pick<
          import("@/lib/workspace").DbStage,
          "name" | "stream" | "status" | "purpose"
        >,
        { merge: false }
      >();
    checked(current.error);
    if (!current.data) throw Error("Milestone not found.");
    const verified =
      stageVerification(current.data).length ||
      stageVerification({ ...current.data, name: v.name }).length;
    const { data, error } = await db
      .from("stages")
      .update({
        name: v.name,
        status: verified ? current.data.status : v.status,
        visible: v.visible,
      })
      .eq("id", v.id)
      .select("id")
      .single();
    checked(error);
    if (!data) throw Error("Milestone not found.");
  });
}
export async function saveStagePurpose(form: FormData) {
  return run(async () => {
    const { db } = await identity(true);
    const id = uuid.parse(form.get("id"));
    const purpose = z
      .enum(
        Object.keys(stagePurposes) as [
          keyof typeof stagePurposes,
          ...(keyof typeof stagePurposes)[],
        ],
      )
      .parse(form.get("purpose"));
    if (form.get("acknowledged") !== "on")
      throw Error(
        "Confirm that this choice does not verify a contract, approval or payment.",
      );
    const capability = await db.rpc("stage_purposes_ready");
    if (capability.error || capability.data !== true)
      throw Error(
        "Apply the stage-purpose database upgrade before choosing a purpose.",
      );
    checked(
      (
        await db
          .from("stages")
          .update({ purpose })
          .eq("id", id)
          .select("id")
          .single()
      ).error,
    );
    return "Stage purpose saved. Existing verification and access records are unchanged.";
  });
}
export async function verifyJourneyRecord(form: FormData) {
  return run(async () => {
    const { db } = await identity(true);
    if (form.get("acknowledged") !== "on")
      throw Error("Please confirm that you have checked this record.");
    const id = uuid.parse(form.get("projectId"));
    const field = z
      .enum(["contract_signed", "deposit_paid", "final_paid", "final_approved"])
      .parse(form.get("field"));
    const confirmed =
      z.enum(["true", "false"]).parse(form.get("confirmed")) === "true";
    const ready = await db.rpc("project_lifecycle_ready");
    if (ready.error && !["PGRST202", "42883"].includes(ready.error.code))
      throw Error("Verification history could not be checked.");
    if (ready.data === true) {
      checked(
        (
          await db.rpc("verify_project_record", {
            target: id,
            record_field: field,
            confirmed,
            reference: z
              .string()
              .trim()
              .max(500)
              .parse(form.get("reference") ?? ""),
            occurred_on:
              z
                .union([z.iso.date(), z.literal("")])
                .parse(form.get("occurred_on") ?? "") || null,
            linked_document: form.get("documentId")
              ? uuid.parse(form.get("documentId"))
              : null,
          })
        ).error,
      );
      return confirmed
        ? "Verified record and evidence saved."
        : "Verification removed; the history is retained.";
    }
    // Legacy path: database invoice guards remain authoritative.
    checked(
      (
        await db
          .from("projects")
          .update({ [field]: confirmed })
          .eq("id", id)
          .select("id")
          .single()
      ).error,
    );
    return confirmed
      ? "Verified record saved. Journey and access now reflect this record."
      : "Verification removed. Journey and access now reflect this record.";
  });
}
export async function archiveProject(form: FormData) {
  return run(async () => {
    const { db } = await identity(true);
    const target = uuid.parse(form.get("projectId"));
    if (form.get("acknowledged") !== "on")
      throw Error("Acknowledge the archive/access decision first.");
    const archived =
      z.enum(["true", "false"]).parse(form.get("archived")) === "true";
    const client_access = z
      .enum(["retain", "suspend"])
      .parse(form.get("client_access"));
    checked(
      (
        await db.rpc("archive_project", {
          target,
          archived,
          client_access,
          acknowledged: true,
        })
      ).error,
    );
    return archived
      ? "Project archived with your chosen client access. No files or verification records were deleted."
      : "Project restored. Existing sharing and verification requirements still apply.";
  });
}
export async function enableSeparateApprovals(form: FormData) {
  return run(async () => {
    const { db } = await identity(true);
    if (form.get("acknowledged") !== "on")
      throw Error("Acknowledge that both workstreams must be checked again.");
    checked(
      (
        await db.rpc("enable_stream_approvals", {
          target: uuid.parse(form.get("projectId")),
          acknowledged: true,
        })
      ).error,
    );
    return "Separate approval checks enabled. Final files remain locked until both are verified and final payment is received.";
  });
}
export async function verifyStreamApproval(form: FormData) {
  return run(async () => {
    const { db } = await identity(true);
    if (form.get("acknowledged") !== "on")
      throw Error("Confirm you have checked this workstream.");
    checked(
      (
        await db.rpc("verify_stream_approval", {
          target: uuid.parse(form.get("projectId")),
          workstream: z
            .enum(["Brand Identity", "Website Design"])
            .parse(form.get("workstream")),
          confirmed:
            z.enum(["true", "false"]).parse(form.get("confirmed")) === "true",
          reference: z
            .string()
            .trim()
            .max(500)
            .parse(form.get("reference") ?? ""),
          linked_document: form.get("documentId")
            ? uuid.parse(form.get("documentId"))
            : null,
        })
      ).error,
    );
    return "Workstream approval saved. Final approval requires both branding and website checks.";
  });
}
export async function saveProjectNotes(form: FormData) {
  return run(async () => {
    const { db } = await identity(true);
    const project_id = uuid.parse(form.get("id"));
    const body = z.string().max(10000).parse(form.get("notes"));
    checked(
      (
        await db
          .from("project_notes")
          .upsert({ project_id, body }, { onConflict: "project_id" })
      ).error,
    );
  });
}
export async function saveProject(form: FormData) {
  return run(async () => {
    const { db } = await identity(true);
    const id = uuid.parse(form.get("id"));
    const notes = z.string().max(10000).parse(form.get("notes"));
    const values = {
      contract_signed: form.get("contract_signed") === "on",
      deposit_paid: form.get("deposit_paid") === "on",
      final_paid: form.get("final_paid") === "on",
      final_approved: form.get("final_approved") === "on",
    };
    checked(
      (
        await db.rpc("save_project_controls", {
          target: id,
          signed: values.contract_signed,
          deposit: values.deposit_paid,
          final_payment: values.final_paid,
          approved: values.final_approved,
          notes,
        })
      ).error,
    );
  });
}
export async function submitQuestionnaire(form: FormData) {
  return run(async () => {
    const { db, user } = await identity();
    const raw = Object.fromEntries(form);
    const answers = Object.fromEntries(
      Object.entries(raw)
        .filter(
          ([k, value]) =>
            k.startsWith("answer_") &&
            typeof value === "string" &&
            value.trim().length > 0,
        )
        .map(([k, v]) => [k.slice(7), v]),
    );
    const v = questionnaireInput.parse({
      projectId: form.get("projectId"),
      kind: form.get("kind"),
      answers,
    });
    const project = await db
      .from("projects")
      .select("type")
      .eq("id", v.projectId)
      .single();
    checked(project.error);
    requireCompleteAnswers(v.kind, v.answers, project.data!.type);
    checked(
      (
        await db.from("questionnaires").insert({
          project_id: v.projectId,
          kind: v.kind,
          answers: v.answers,
          submitted_by: user.id,
        })
      ).error,
    );
    return "Your answers have been sent to Alex.";
  });
}
export async function submitFeedback(form: FormData) {
  return run(async () => {
    const { db, user } = await identity();
    const v = feedbackInput.parse(Object.fromEntries(form));
    checked(
      (
        await db.from("feedback").insert({
          document_id: v.documentId,
          body: v.body,
          decision: v.decision,
          author_id: user.id,
        })
      ).error,
    );
    return "Your feedback has been recorded. Thank you.";
  });
}
export async function beginSecureUpload(input: unknown) {
  try {
    const { db } = await identity();
    const { reserveUpload, uploadInput } =
      await import("@/lib/supabase/file-intake");
    return {
      ok: true as const,
      upload: await reserveUpload(db, uploadInput.parse(input)),
    };
  } catch (error) {
    return {
      ok: false as const,
      message:
        error instanceof z.ZodError
          ? "Check the file details."
          : error instanceof Error
            ? error.message
            : "Upload could not start.",
    };
  }
}
export async function finishSecureUpload(form: FormData): Promise<Result> {
  try {
    const { db } = await identity();
    const { finishUpload } = await import("@/lib/supabase/file-intake");
    const result = await finishUpload(db, uuid.parse(form.get("uploadId")));
    refresh();
    return { ok: result.state === "clean", message: result.message };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "The file remains quarantined. Retry the check.",
    };
  }
}
export async function discardSecureUpload(form: FormData) {
  return run(async () => {
    const { db } = await identity();
    const { discardUpload } = await import("@/lib/supabase/file-intake");
    await discardUpload(db, uuid.parse(form.get("uploadId")));
    return "Quarantined upload removed after file cleanup.";
  });
}
export async function uploadDocument(form: FormData) {
  return run(async () => {
    const { db } = await identity(true);
    const projectId = uuid.parse(form.get("projectId"));
    const category = z
      .enum(["presentation", "document", "final"])
      .parse(form.get("category"));
    const file = form.get("file");
    if (!(file instanceof File)) throw Error("Choose a file to upload.");
    validateFile(file);
    const id = crypto.randomUUID();
    const path = projectId + "/" + id;
    const capability = await db.rpc("project_management_ready");
    if (
      capability.error &&
      !["PGRST202", "42883"].includes(capability.error.code)
    )
      throw Error("Review settings could not be checked.");
    const review =
      capability.data === true
        ? {
            version_label: z
              .string()
              .trim()
              .min(1)
              .max(40)
              .parse(form.get("version_label") ?? "v1"),
            review_due:
              z
                .union([z.iso.date(), z.literal("")])
                .parse(form.get("review_due") ?? "") || null,
          }
        : {};
    const business = await db.rpc("business_documents_ready");
    if (business.error && !["PGRST202", "42883"].includes(business.error.code))
      throw Error("Stage upload settings could not be checked.");
    const stage =
      business.data === true
        ? {
            stage_id: form.get("stageId")
              ? uuid.parse(form.get("stageId"))
              : null,
            document_role: z
              .enum([
                "General",
                "Proposal",
                "Contract",
                "Invoice",
                "Presentation",
                "Handover",
              ])
              .parse(form.get("document_role") ?? "General"),
          }
        : {};
    const { trySmallSecureUpload } = await import("@/lib/supabase/file-intake");
    if (
      await trySmallSecureUpload(db, file, {
        projectId,
        kind: "document",
        stageId: "stage_id" in stage ? (stage.stage_id ?? null) : null,
        category,
        role:
          "document_role" in stage
            ? (stage.document_role ?? "General")
            : "General",
        version:
          "version_label" in review ? (review.version_label ?? "v1") : "v1",
        reviewDue: "review_due" in review ? (review.review_due ?? "") : "",
        originalContract: null,
      })
    )
      return "File checked and uploaded privately. Share it when ready.";
    // Insert unpublished metadata first: policy requires a known project/document path.
    checked(
      (
        await db.from("documents").insert({
          id,
          project_id: projectId,
          name: file.name.slice(0, 180),
          object_path: path,
          category,
          published: false,
          ...review,
          ...stage,
        })
      ).error,
    );
    const { error } = await db.storage
      .from("project-files")
      .upload(path, file, {
        contentType: file.type,
        cacheControl: "0",
        upsert: false,
      });
    if (error) {
      await db.from("documents").delete().eq("id", id);
      throw Error(
        "The upload failed. Confirm the private storage bucket is configured and try again.",
      );
    }
    return "Uploaded privately. Publish the document when it is ready for your client.";
  });
}
export async function publishDocument(form: FormData) {
  return run(async () => {
    const { db } = await identity(true);
    const id = uuid.parse(form.get("id"));
    checked(
      (
        await db
          .from("documents")
          .update({ published: form.get("published") === "true" })
          .eq("id", id)
      ).error,
    );
  });
}
export async function inviteClient(form: FormData): Promise<Result> {
  try {
    const { db } = await identity(true);
    const id = uuid.parse(form.get("clientId"));
    const result = await createClientInvitation(
      db,
      invitationAdmin,
      id,
      await appOrigin(),
    );
    refresh();
    return result;
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Invitation failed.",
    };
  }
}
export async function setPassword(_: Result, form: FormData): Promise<Result> {
  return run(async () => {
    const db = await database();
    const {
      data: { user },
      error: userError,
    } = await db.auth.getUser();
    if (userError || !user)
      throw Error(
        "Open a fresh password-reset link or sign in before changing your password.",
      );
    const profile = await db
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profile.error) throw Error("Account security could not be checked.");
    if (profile.data?.role === "admin") await identity();
    const password = z.string().min(12).max(128).parse(form.get("password"));
    if (password !== form.get("password_confirm"))
      throw Error("The passwords do not match. Please enter them again.");
    checked((await db.auth.updateUser({ password })).error);
    return "Your password has been updated.";
  });
}
export async function revokeClientAccess(form: FormData) {
  return run(async () => {
    const { db } = await identity(true);
    if (form.get("acknowledged") !== "on")
      throw Error(
        "Confirm that you want to remove this client’s portal access.",
      );
    checked(
      (
        await db.rpc("revoke_client_access", {
          target: uuid.parse(form.get("clientId")),
        })
      ).error,
    );
    return "Client portal access has been revoked. Existing download links expire within 60 seconds.";
  });
}
export async function moveStage(form: FormData) {
  return run(async () => {
    const { db } = await identity(true);
    checked(
      (
        await db.rpc("move_stage", {
          target: uuid.parse(form.get("id")),
          direction: z.coerce
            .number()
            .refine((n) => n === -1 || n === 1)
            .parse(form.get("direction")),
        })
      ).error,
    );
  });
}
export async function addStage(form: FormData) {
  return run(async () => {
    const { db } = await identity(true);
    const projectId = uuid.parse(form.get("projectId"));
    const name = z.string().trim().min(1).max(120).parse(form.get("name"));
    const { data, error } = await db
      .from("stages")
      .select("position")
      .eq("project_id", projectId)
      .order("position", { ascending: false })
      .limit(1);
    checked(error);
    checked(
      (
        await db.from("stages").insert({
          project_id: projectId,
          name,
          stream: "Custom",
          position: (data?.[0]?.position ?? -1) + 1,
        })
      ).error,
    );
  });
}
export async function removeStage(form: FormData) {
  return run(async () => {
    const { db } = await identity(true);
    const capability = await db.rpc("business_documents_ready");
    if (capability.data === true) {
      const stageId = uuid.parse(form.get("id"));
      const [documents, assets] = await Promise.all([
        db.from("documents").select("id").eq("stage_id", stageId).limit(1),
        db.from("client_assets").select("id").eq("stage_id", stageId).limit(1),
      ]);
      checked(documents.error);
      checked(assets.error);
      if (documents.data?.length || assets.data?.length)
        throw Error(
          "This stage has attached files. Keep or hide the stage to preserve its document history.",
        );
    }
    checked(
      (
        await db
          .from("stages")
          .delete()
          .eq("id", uuid.parse(form.get("id")))
      ).error,
    );
  });
}

export async function runPortalChecks(): Promise<Result> {
  // Validate owner privileges before constructing a service-role client.
  try {
    const { db } = await identity(true);
    const { checkClientPortals } = await import("@/lib/supabase/portal-check");
    const result = await checkClientPortals(db, invitationAdmin());
    refresh();
    return result;
  } catch {
    return {
      ok: false,
      message:
        "The automatic check needs your owner sign-in and the server-only Supabase service key in Vercel settings. No client email address is needed. Never paste the key in chat.",
    };
  }
}

export async function sendOwnerTestEmail(): Promise<Result> {
  try {
    const { db, user } = await identity(true);
    if (!user.email)
      return { ok: false, message: "Your owner account has no email address." };
    const origin = await appOrigin();
    const { error } = await db.auth.signInWithOtp({
      email: user.email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: origin + "/auth/callback",
      },
    });
    if (error) {
      if (error.status === 429)
        return {
          ok: false,
          message:
            "Supabase has limited email requests. Wait a few minutes before trying again.",
        };
      return {
        ok: false,
        message:
          "Supabase did not accept the test email request. Check Authentication email/SMTP settings and allowed recipients. No new account was created.",
      };
    }
    return {
      ok: true,
      message:
        "Supabase accepted a sign-in email request for your owner account. Delivery is not yet confirmed: check your inbox and spam folder, then open the link in this same browser. It should return to " +
        origin +
        ". If it opens localhost or another site, set Supabase Authentication → URL Configuration → Site URL to " +
        origin +
        " and add " +
        origin +
        "/auth/callback to Redirect URLs. No client invitation emails were sent.",
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("APP_ORIGIN"))
      return { ok: false, message: error.message };
    if (error instanceof Error && error.message.startsWith("Set APP_ORIGIN"))
      return { ok: false, message: error.message };
    return {
      ok: false,
      message:
        "Sign in as the owner to send a test email. If already signed in, check the Supabase connection.",
    };
  }
}

export async function editClient(form: FormData) {
  return run(async () => {
    const { db } = await identity(true);
    const id = uuid.parse(form.get("id"));
    const values = clientInput.parse(Object.fromEntries(form));
    const existing = await db
      .from("clients")
      .select("email")
      .eq("id", id)
      .single();
    checked(existing.error);
    if (existing.data?.email.toLowerCase() !== values.email.toLowerCase()) {
      const invitations = await db
        .from("invitations")
        .select("id")
        .eq("client_id", id)
        .limit(1);
      checked(invitations.error);
      if (invitations.data?.length)
        throw Error(
          "This client already has an invitation or account. Email changes need an account review; other details can still be updated.",
        );
    }
    const result = await db
      .from("clients")
      .update(values)
      .eq("id", id)
      .select("id")
      .single();
    checked(result.error);
  });
}
export async function editProject(form: FormData) {
  return run(async () => {
    const { db } = await identity(true);
    const id = uuid.parse(form.get("id"));
    const values = projectInput
      .pick({ name: true, due: true, budget: true })
      .parse(Object.fromEntries(form));
    checked(
      (
        await db
          .from("projects")
          .update(values)
          .eq("id", id)
          .select("id")
          .single()
      ).error,
    );
  });
}

async function managementDb(owner = false) {
  const account = await identity(owner);
  const ready = await account.db.rpc("project_management_ready");
  if (ready.error || ready.data !== true)
    throw Error(
      "Apply the project management SQL upgrade first. Existing projects have not been changed.",
    );
  return account;
}
export async function saveBrief(form: FormData) {
  return run(async () => {
    const { db } = await managementDb(true);
    const target = uuid.parse(form.get("projectId"));
    const text = (key: string, max: number) =>
      z
        .string()
        .trim()
        .max(max)
        .parse(form.get(key) ?? "");
    checked(
      (
        await db.rpc("save_portal_brief", {
          target,
          new_goal: text("goal", 6000),
          new_deliverables: text("deliverables", 6000),
          new_exclusions: text("exclusions", 4000),
          new_approver: text("approver", 120),
          new_support: text("support", 4000),
          new_handover: text("handover", 6000),
        })
      ).error,
    );
  });
}
export async function saveClientAction(form: FormData) {
  return run(async () => {
    const { db } = await managementDb(true);
    const project_id = uuid.parse(form.get("projectId"));
    const title = z.string().trim().min(1).max(180).parse(form.get("title"));
    const due =
      z.union([z.iso.date(), z.literal("")]).parse(form.get("due") ?? "") ||
      null;
    const id = form.get("id");
    if (id) {
      checked(
        (
          await db.rpc("edit_client_action", {
            target: uuid.parse(id),
            new_title: title,
            new_due: due,
          })
        ).error,
      );
    } else
      checked(
        (await db.from("client_actions").insert({ project_id, title, due }))
          .error,
      );
  });
}
export async function toggleClientAction(form: FormData) {
  return run(async () => {
    const { db } = await managementDb();
    checked(
      (
        await db.rpc("complete_client_action", {
          target: uuid.parse(form.get("id")),
          done: form.get("done") === "true",
        })
      ).error,
    );
  });
}
export async function removeClientAction(form: FormData) {
  return run(async () => {
    const { db } = await managementDb(true);
    checked(
      (
        await db
          .from("client_actions")
          .delete()
          .eq("id", uuid.parse(form.get("id")))
      ).error,
    );
  });
}
export async function uploadClientAsset(form: FormData) {
  return run(async () => {
    const { db, user } = await managementDb();
    const project_id = uuid.parse(form.get("projectId"));
    const file = form.get("file");
    if (!(file instanceof File)) throw Error("Choose a file.");
    validateFile(file);
    const business = await db.rpc("business_documents_ready");
    const stage =
      business.data === true
        ? {
            stage_id: form.get("stageId")
              ? uuid.parse(form.get("stageId"))
              : null,
          }
        : {};
    const { trySmallSecureUpload } = await import("@/lib/supabase/file-intake");
    if (
      await trySmallSecureUpload(db, file, {
        projectId: project_id,
        kind: "asset",
        stageId: "stage_id" in stage ? (stage.stage_id ?? null) : null,
        category: "document",
        role: "General",
        version: "v1",
        reviewDue: "",
        originalContract: null,
      })
    )
      return "Your file passed its security checks and was uploaded privately.";
    const id = crypto.randomUUID(),
      object_path = project_id + "/" + id;
    checked(
      (
        await db.from("client_assets").insert({
          id,
          project_id,
          uploader_id: user.id,
          ...stage,
          name: file.name.slice(0, 180),
          object_path,
        })
      ).error,
    );
    const uploaded = await db.storage
      .from("client-assets")
      .upload(object_path, file, {
        contentType: file.type,
        cacheControl: "0",
        upsert: false,
      });
    if (uploaded.error) {
      await db.from("client_assets").delete().eq("id", id);
      throw Error(
        "Asset upload failed. Check the private client-assets bucket and try again.",
      );
    }
    return "Your asset was uploaded privately.";
  });
}

export async function saveStageResources(form: FormData) {
  return run(async () => {
    const { db } = await identity(true);
    const { bookingUrl } = await import("@/lib/stage-links");
    const stage_id = uuid.parse(form.get("stageId"));
    const instructions = z
      .string()
      .trim()
      .max(6000)
      .parse(form.get("instructions") ?? "");
    const booking_url = bookingUrl(
      z
        .string()
        .max(500)
        .parse(form.get("booking_url") ?? ""),
    );
    checked(
      (
        await db
          .from("stage_resources")
          .upsert({ stage_id, instructions, booking_url })
      ).error,
    );
  });
}

export async function setContractExchange(form: FormData) {
  return run(async () => {
    const { db } = await identity(true);
    const ready = await db.rpc("contract_area_ready");
    if (ready.data !== true)
      throw Error("Apply the contract-area SQL upgrade first.");
    const stageId = uuid.parse(form.get("stageId"));
    const enabled =
      z.enum(["true", "false"]).parse(form.get("enabled")) === "true";
    if (enabled && form.get("confirmed") !== "on")
      throw Error(
        "Confirm that only shared Contract PDFs in this stage should be accessible before onboarding.",
      );
    const stage = await db
      .from("stages")
      .select("project_id,visible")
      .eq("id", stageId)
      .single();
    checked(stage.error);
    if (!stage.data) throw Error("Stage not found.");
    if (enabled) {
      if (!stage.data.visible)
        throw Error("Make this stage client-visible first.");
      const docs = await db
        .from("documents")
        .select("id")
        .eq("project_id", stage.data.project_id)
        .eq("stage_id", stageId)
        .eq("document_role", "Contract")
        .eq("category", "document")
        .eq("published", true)
        .limit(1);
      checked(docs.error);
      if (!docs.data?.length)
        throw Error(
          "Upload a Contract PDF to this stage with Project document release rules and share it first.",
        );
    }
    checked(
      (
        await db
          .from("contract_exchanges")
          .upsert(
            { project_id: stage.data.project_id, stage_id: stageId, enabled },
            { onConflict: "project_id" },
          )
      ).error,
    );
    return enabled
      ? "Initial contract area enabled. Create/share a private invitation from Clients. Full portal access still requires your contract and deposit verification."
      : "Initial contract area disabled. Existing signed links can remain usable for up to 60 seconds.";
  });
}
export async function uploadSignedContract(form: FormData) {
  return run(async () => {
    const { db, user, profile } = await identity();
    if (profile.role !== "client")
      throw Error("Use a client account to return a signed contract.");
    const documentId = uuid.parse(form.get("documentId"));
    const ready = await db.rpc("contract_area_ready");
    if (ready.data !== true)
      throw Error("The contract area is not available yet.");
    const allowed = await db.rpc("can_read_contract_document", {
      target: documentId,
    });
    if (allowed.error || allowed.data !== true)
      throw Error("This contract is no longer available to your account.");
    const original = await db
      .from("documents")
      .select("project_id,stage_id")
      .eq("id", documentId)
      .single();
    checked(original.error);
    if (!original.data?.stage_id) throw Error("Contract not found.");
    const file = form.get("file");
    if (!(file instanceof File)) throw Error("Choose your completed PDF.");
    validateFile(file);
    if (
      file.type !== "application/pdf" ||
      new TextDecoder().decode(await file.slice(0, 5).arrayBuffer()) !== "%PDF-"
    )
      throw Error("Choose a completed PDF up to 3 MB.");
    const { trySmallSecureUpload } = await import("@/lib/supabase/file-intake");
    if (
      await trySmallSecureUpload(db, file, {
        projectId: original.data.project_id,
        kind: "contract",
        stageId: original.data.stage_id,
        category: "document",
        role: "General",
        version: "v1",
        reviewDue: "",
        originalContract: documentId,
      })
    )
      return "Returned PDF checked and uploaded for my review. It does not verify a signature or payment.";
    const id = crypto.randomUUID(),
      project_id = original.data.project_id,
      object_path = project_id + "/" + id;
    checked(
      (
        await db.from("client_assets").insert({
          id,
          project_id,
          stage_id: original.data.stage_id,
          contract_document_id: documentId,
          uploader_id: user.id,
          name: file.name.slice(0, 180),
          object_path,
        })
      ).error,
    );
    const upload = await db.storage
      .from("client-assets")
      .upload(object_path, file, {
        contentType: "application/pdf",
        cacheControl: "0",
        upsert: false,
      });
    if (upload.error) {
      await db.from("client_assets").delete().eq("id", id);
      throw Error("Your signed PDF could not be uploaded. Please try again.");
    }
    return "Your completed PDF has been sent for my review. Uploading it does not verify the contract or payment; I’ll unlock the full portal after both checks.";
  });
}

export async function deleteClient(form: FormData): Promise<Result> {
  try {
    const { db } = await identity(true);
    const clientId = uuid.parse(form.get("clientId"));
    const confirmation = z
      .string()
      .min(1)
      .max(120)
      .parse(form.get("confirmation"));
    if (form.get("confirmed") !== "on")
      throw Error("Confirm that you understand this deletion is permanent.");
    const { deleteClientRecords } =
      await import("@/lib/supabase/delete-client");
    const security = await db.rpc("file_security_ready");
    if (security.error && !["PGRST202", "42883"].includes(security.error.code))
      throw Error("File security could not be checked before deletion.");
    const { removeFrozenUploadFiles } =
      await import("@/lib/supabase/file-intake");
    await deleteClientRecords(
      db,
      clientId,
      confirmation,
      security.data === true ? removeFrozenUploadFiles : undefined,
    );
    return {
      ok: true,
      message:
        "Client, linked projects and private uploads deleted. Audit history and the sign-in account were retained; client access was removed.",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof z.ZodError
          ? "Check the confirmation fields."
          : error instanceof Error
            ? error.message
            : "Deletion could not finish. Retry cleanup.",
    };
  } finally {
    refresh();
  }
}

export async function saveProspectSpace(form: FormData) {
  return run(async () => {
    const { db } = await identity(true);
    const { bookingUrl } = await import("@/lib/stage-links");
    const stage = (name: string) =>
      form.get(name) ? uuid.parse(form.get(name)) : null;
    const result = await db.rpc("set_prospect_space", {
      target: uuid.parse(form.get("projectId")),
      shared: form.get("enabled") === "on",
      step: z
        .enum(["discovery", "proposal", "agreement"])
        .parse(form.get("release_step")),
      status: z
        .enum(["new", "discovery", "proposal", "considering", "closed"])
        .parse(form.get("enquiry_status")),
      booking: bookingUrl(z.string().min(1).parse(form.get("booking_url"))),
      proposal_stage: stage("proposal_stage_id"),
      contract_stage: stage("contract_stage_id"),
      invoice_stage: stage("invoice_stage_id"),
    });
    if (result.error)
      throw Error(
        "Potential-client settings could not be saved. Check the selected stages and apply the potential-client SQL update. Active projects cannot be marked Not proceeding.",
      );
    return "Enquiry status and client step saved. Create a private invitation under Clients when you are ready; no email was sent.";
  });
}
export async function respondToProposal(form: FormData) {
  return run(async () => {
    const { db, user, profile } = await identity();
    if (profile.role !== "client")
      throw Error("Use a client account to send a proposal response.");
    const document_id = uuid.parse(form.get("documentId"));
    const original = await db
      .from("documents")
      .select("project_id,document_role")
      .eq("id", document_id)
      .single();
    checked(original.error);
    if (original.data?.document_role !== "Proposal")
      throw Error("Proposal unavailable.");
    const result = await db.from("proposal_responses").insert({
      document_id,
      project_id: original.data.project_id,
      actor_id: user.id,
      decision: z
        .enum(["interested", "question", "declined"])
        .parse(form.get("decision")),
      message: z
        .string()
        .trim()
        .max(2000)
        .parse(form.get("message") ?? ""),
    });
    if (result.error)
      throw Error(
        "Your response could not be saved, or one has already been sent. Please contact me if you need to change it.",
      );
    return "Your proposal response has been sent to me. No contract or payment has been confirmed.";
  });
}

export async function addManualEnquiry(form: FormData) {
  return run(async () => {
    const { db } = await identity(true);
    const business_name = z
        .string()
        .trim()
        .min(1)
        .max(120)
        .parse(form.get("business_name")),
      contact_name = z
        .string()
        .trim()
        .min(1)
        .max(120)
        .parse(form.get("contact_name")),
      email = z.email().parse(form.get("email")),
      notes = z
        .string()
        .trim()
        .max(4000)
        .parse(form.get("notes") ?? "");
    checked(
      (
        await db.from("enquiries").insert({
          source: "manual",
          business_name,
          contact_name,
          email,
          fields: notes ? [{ label: "Initial notes", value: notes }] : [],
        })
      ).error,
    );
  });
}
export async function updateEnquiry(form: FormData) {
  return run(async () => {
    const { db } = await identity(true);
    const id = uuid.parse(form.get("id")),
      status = z.enum(["new", "reviewing", "closed"]).parse(form.get("status"));
    checked(
      (
        await db
          .from("enquiries")
          .update({ status })
          .eq("id", id)
          .neq("status", "converted")
          .select("id")
          .single()
      ).error,
    );
  });
}
export async function convertEnquiry(form: FormData) {
  return run(async () => {
    const { db } = await identity(true);
    const client = clientInput.parse(Object.fromEntries(form));
    const project = projectInput.parse({
      name: form.get("project_name"),
      clientId: form.get("id"),
      type: form.get("type"),
      due: form.get("due"),
      budget: form.get("budget"),
    });
    const converted = await db.rpc("convert_enquiry", {
      target: uuid.parse(form.get("id")),
      business: client.name,
      contact: client.contact,
      address: client.email,
      sector_name: client.sector,
      project_name: project.name,
      project_type: project.type,
      due_date: project.due,
      project_budget: project.budget,
      template: newProjectStages(project.type),
      existing_client: form.get("existing_client")
        ? uuid.parse(form.get("existing_client"))
        : null,
    });
    if (converted.error)
      throw Error(
        "The enquiry could not be converted, or it has already been converted. Check the fields and SQL setup.",
      );
    return "Potential project created. Open Projects to enable its discovery view, then create a private invitation under Clients.";
  });
}

export async function requestPasswordReset(
  _: Result,
  form: FormData,
): Promise<Result> {
  const email = z.email().safeParse(form.get("email"));
  if (!email.success)
    return { ok: false, message: "Enter a valid email address." };
  try {
    const db = await database();
    await db.auth.resetPasswordForEmail(email.data, {
      redirectTo: (await appOrigin()) + "/auth/callback",
    });
  } catch {
    /* Uniform response: never disclose whether an account exists. */
  }
  return {
    ok: true,
    message:
      "If an account exists for this email, a password-reset link will arrive shortly. Check your inbox and spam folder, and open the latest link in this browser.",
  };
}
