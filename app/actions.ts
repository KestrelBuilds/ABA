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
import { createStages } from "@/lib/projects";
import { z } from "zod";
export type Result = { ok: boolean; message: string; link?: string };
function refresh() {
  revalidatePath("/workspace");
  revalidatePath("/portal");
}
async function run(fn: () => Promise<string | void>): Promise<Result> {
  try {
    const message = await fn();
    refresh();
    return { ok: true, message: message ?? "Saved." };
  } catch (e) {
    return {
      ok: false,
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
    const db = await database();
    const { error } = await db.auth.verifyOtp({
      token_hash: token,
      type: "invite",
    });
    if (error)
      return {
        ok: false,
        message:
          "This invitation has expired or was already used. Ask Alex for a new invitation.",
      };
    const { error: acceptError } = await db.rpc("accept_invitation");
    if (acceptError)
      return {
        ok: false,
        message:
          "Your account is signed in, but onboarding is not ready. Please contact Alex.",
      };
  } catch {
    return {
      ok: false,
      message: "The invitation could not be accepted. Please contact Alex.",
    };
  }
  redirect("/portal");
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
          template: createStages(v.type).map((s) => ({
            name: s.name,
            stream: s.stream,
          })),
        })
      ).error,
    );
  });
}
export async function saveStage(form: FormData) {
  return run(async () => {
    const { db } = await identity(true);
    const v = stageInput.parse({
      ...Object.fromEntries(form),
      visible: form.get("visible") === "on",
    });
    const { data, error } = await db
      .from("stages")
      .update({ name: v.name, status: v.status, visible: v.visible })
      .eq("id", v.id)
      .select("id")
      .single();
    checked(error);
    if (!data) throw Error("Milestone not found.");
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
        .filter(([k]) => k.startsWith("answer_"))
        .map(([k, v]) => [k.slice(7), v]),
    );
    const v = questionnaireInput.parse({
      projectId: form.get("projectId"),
      kind: form.get("kind"),
      answers,
    });
    requireCompleteAnswers(v.kind, v.answers);
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
    const origin = await appOrigin();
    const { data: client, error } = await db
      .from("clients")
      .select("id,email")
      .eq("id", id)
      .single();
    checked(error);
    if (!client) throw Error("Client not found.");
    const { data: eligible, error: projectError } = await db
      .from("projects")
      .select("id")
      .eq("client_id", id)
      .eq("contract_signed", true)
      .eq("deposit_paid", true)
      .limit(1);
    checked(projectError);
    if (!eligible?.length)
      throw Error(
        "Record the signed contract and 50% deposit on a project before inviting this client.",
      );
    const service = invitationAdmin();
    const delivery = z
      .enum(["link", "email"])
      .parse(form.get("delivery") ?? "link");
    if (
      delivery === "email" &&
      process.env.SUPABASE_INVITE_EMAIL_READY !== "true"
    )
      throw Error(
        "Invitation emails need the Supabase invite template configured first. Use a private invitation link for now.",
      );
    const invitation =
      delivery === "email"
        ? await service.auth.admin.inviteUserByEmail(client.email, {
            redirectTo: origin + "/auth/confirm",
          })
        : await service.auth.admin.generateLink({
            type: "invite",
            email: client.email,
          });
    const { data, error: inviteError } = invitation;

    if (inviteError || !data.user)
      throw Error(
        "An invitation could not be created. The email may already have an account; manage existing users in Supabase.",
      );
    const { error: saveError } = await db
      .from("invitations")
      .insert({ client_id: id, user_id: data.user.id });
    if (saveError) {
      await service.auth.admin.deleteUser(data.user.id);
      throw Error("Invitation could not be saved. No access was granted.");
    }
    refresh();
    if (delivery === "email")
      return {
        ok: true,
        message:
          "Supabase accepted the invitation email request. Confirm receipt with the client; acceptance does not guarantee delivery.",
      };
    if (!("properties" in data) || !data.properties)
      throw Error(
        "The private invitation link is unavailable. Manage this account in Supabase.",
      );
    return {
      ok: true,
      message:
        "Invitation created. Copy this private, single-use link and send it to the client yourself. Do not post it publicly.",
      link:
        origin +
        "/auth/confirm?token_hash=" +
        encodeURIComponent(
          z.object({ hashed_token: z.string().min(1) }).parse(data.properties)
            .hashed_token,
        ),
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Invitation failed.",
    };
  }
}
export async function setPassword(_: Result, form: FormData): Promise<Result> {
  return run(async () => {
    const { db } = await identity();
    const password = z.string().min(12).max(128).parse(form.get("password"));
    checked((await db.auth.updateUser({ password })).error);
    return "Your password has been updated.";
  });
}
export async function revokeClientAccess(form: FormData) {
  return run(async () => {
    const { db } = await identity(true);
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
