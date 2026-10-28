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
