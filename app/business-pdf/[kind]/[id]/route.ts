import { identity } from "@/lib/supabase/server";
import { businessPdf } from "@/lib/finance/pdf";
import type { Invoice, Proposal } from "@/lib/finance/data";
import { z } from "zod";
export const runtime = "nodejs";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ kind: string; id: string }> },
) {
  try {
    const { kind, id } = z
      .object({ kind: z.enum(["invoice", "proposal"]), id: z.uuid() })
      .parse(await params);
    const { db, profile } = await identity();
    const record = await db
      .from(kind === "invoice" ? "invoices" : "proposals")
      .select("*")
      .eq("id", id)
      .single();
    if (record.error || !record.data)
      return new Response("Document unavailable.", {
        status: 404,
        headers: { "Cache-Control": "private, no-store" },
      });
    const project = await db
      .from("projects")
      .select("name,client_id")
      .eq("id", record.data.project_id)
      .single();
    if (project.error || !project.data)
      return new Response("Document unavailable.", { status: 404 });
    let client = record.data.client_snapshot ?? {},
      seller = record.data.seller_snapshot ?? {};
    if (record.data.status === "Draft" && profile.role === "admin") {
      const [c, f] = await Promise.all([
        db
          .from("clients")
          .select("name,contact,email")
          .eq("id", project.data.client_id)
          .single(),
        db.from("finance_settings").select("*").eq("id", true).maybeSingle(),
      ]);
      if (c.error || f.error) throw Error();
      client = c.data ?? {};
      seller = {
        name: f.data?.seller_name ?? "Alex Bell Arts",
        address: f.data?.seller_address ?? "",
        email: f.data?.seller_email ?? "",
        payment_instructions: f.data?.payment_instructions ?? "",
      };
    }
    const bytes = await businessPdf(
      kind,
      record.data as Proposal | Invoice,
      project.data.name,
      client,
      seller,
    );
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="ABA-${kind}-${id.slice(0, 8)}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(
      "PDF unavailable. Sign in, check access and review any unsupported document characters.",
      { status: 403, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
