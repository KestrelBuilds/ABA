"use server";
import { identity } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Result } from "./actions";
const id = z.uuid();
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
      "Owner confirmation is required",
      "Payment date must be today or earlier",
      "Payment reference is too long",
      "Project not found",
      "Use the separate payment checks",
      "Issue the deposit invoice",
      "The generated invoice pair needs reconciliation",
      "Choose a document from this project",
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
export async function markInvoicePaid(form: FormData) {
  return run(async (db) => {
    if (form.get("confirmed") !== "on")
      throw Error(
        "Confirm that the full payment was received before recording it.",
      );
    const invoiceId = id.parse(form.get("id"));
    const paymentDate = z.iso.date().parse(form.get("paid_on"));
    if (form.get("full_upfront") === "on") {
      const invoice = await db
        .from("invoices")
        .select("project_id,kind")
        .eq("id", invoiceId)
        .single();
      check(invoice.error);
      if (invoice.data!.kind !== "Deposit")
        throw Error("Choose the deposit invoice for a full upfront payment.");
      check(
        (
          await db.rpc("verify_full_upfront_payment", {
            target: invoice.data!.project_id,
            payment_date: paymentDate,
            acknowledged: true,
          })
        ).error,
      );
      return;
    }
    check(
      (
        await db.rpc("record_invoice_payment", {
          target: invoiceId,
          payment_date: paymentDate,
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
