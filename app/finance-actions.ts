"use server";
import { identity } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Result } from "./actions";
const id = z.uuid(),
  text = (max: number) => z.string().trim().max(max);
function check(error: { message: string } | null) {
  if (error) {
    const known = [
      "Owner access required",
      "Accepted proposal",
      "A current invoice",
      "Only void",
      "Complete",
      "Only draft",
      "Only issued",
      "Invalid proposal",
      "Project value",
      "Invoice pair",
      "Existing manual",
      "Verify final",
      "Payment date",
      "Paid or void",
      "Update payment",
      "Content too long",
    ];
    throw Error(
      known.some((s) => error.message.startsWith(s))
        ? error.message
        : "The finance change could not be saved. Check the setup and try again.",
    );
  }
}
async function run(
  action: (db: Awaited<ReturnType<typeof identity>>["db"]) => Promise<void>,
): Promise<Result> {
  try {
    const { db } = await identity(true);
    const ready = await db.rpc("business_documents_ready");
    if (ready.error || ready.data !== true)
      throw Error("Apply the business documents SQL upgrade first.");
    await action(db);
    revalidatePath("/workspace");
    revalidatePath("/portal");
    return { ok: true, message: "Saved." };
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof z.ZodError
          ? "Please check the form fields."
          : e instanceof Error
            ? e.message
            : "Request failed.",
    };
  }
}
export async function saveSeller(form: FormData) {
  return run(async (db) => {
    const v = z
      .object({
        seller_name: text(180).min(1),
        seller_address: text(1500).min(1),
        seller_email: z.email().max(254),
        payment_instructions: text(1500),
        no_vat_confirmed: z.boolean(),
      })
      .parse({
        ...Object.fromEntries(form),
        no_vat_confirmed: form.get("no_vat_confirmed") === "on",
      });
    check((await db.from("finance_settings").upsert({ id: true, ...v })).error);
  });
}
export async function saveBilling(form: FormData) {
  return run(async (db) => {
    const v = z
      .object({
        client_id: id,
        billing_name: text(180).min(1),
        billing_address: text(1500).min(1),
      })
      .parse(Object.fromEntries(form));
    check((await db.from("client_billing").upsert(v)).error);
  });
}
const content = z.object({
  scope: text(6000),
  deliverables: text(6000),
  timeline: text(3000),
  revisions: text(2000),
  exclusions: text(3000),
  notes: text(3000),
});
export async function saveTemplate(form: FormData) {
  return run(async (db) => {
    const values = content
      .extend({ name: text(120).min(1) })
      .parse(Object.fromEntries(form));
    check((await db.from("proposal_templates").insert(values)).error);
  });
}
export async function createProposal(form: FormData) {
  return run(async (db) => {
    check(
      (
        await db.rpc("new_proposal", {
          target: id.parse(form.get("projectId")),
          template_id: form.get("templateId")
            ? id.parse(form.get("templateId"))
            : null,
        })
      ).error,
    );
  });
}
export async function saveProposal(form: FormData) {
  return run(async (db) => {
    const values = content.parse(Object.fromEntries(form));
    check(
      (
        await db.rpc("save_proposal", {
          target: id.parse(form.get("id")),
          ...Object.fromEntries(
            Object.entries(values).map(([k, v]) => ["new_" + k, v]),
          ),
        })
      ).error,
    );
  });
}
export async function proposalStatus(form: FormData) {
  return run(async (db) => {
    check(
      (
        await db.rpc("change_proposal_status", {
          target: id.parse(form.get("id")),
          new_status: z
            .enum(["Shared", "Accepted", "Declined"])
            .parse(form.get("status")),
        })
      ).error,
    );
  });
}
export async function createInvoices(form: FormData) {
  return run(async (db) => {
    check(
      (
        await db.rpc("create_invoice_pair", {
          target: id.parse(form.get("projectId")),
        })
      ).error,
    );
  });
}
export async function issueInvoice(form: FormData) {
  return run(async (db) => {
    check(
      (
        await db.rpc("issue_invoice", {
          target: id.parse(form.get("id")),
          issue_date: z.iso.date().parse(form.get("issued_on")),
          due_date: z.iso.date().parse(form.get("due_on")),
        })
      ).error,
    );
  });
}
export async function markInvoicePaid(form: FormData) {
  return run(async (db) => {
    if (form.get("confirmed") !== "on")
      throw Error(
        "Confirm that the full payment was received before recording it.",
      );
    check(
      (
        await db.rpc("record_invoice_payment", {
          target: id.parse(form.get("id")),
          payment_date: z.iso.date().parse(form.get("paid_on")),
        })
      ).error,
    );
  });
}
export async function voidInvoice(form: FormData) {
  return run(async (db) => {
    check(
      (await db.rpc("void_invoice", { target: id.parse(form.get("id")) }))
        .error,
    );
  });
}

export async function replaceInvoice(form: FormData) {
  return run(async (db) => {
    check(
      (
        await db.rpc("replace_void_invoice", {
          target: id.parse(form.get("id")),
        })
      ).error,
    );
  });
}
