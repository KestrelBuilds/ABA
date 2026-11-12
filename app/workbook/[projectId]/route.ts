import { readFile } from "node:fs/promises";
import path from "node:path";
import { uuid } from "@/lib/validation";
import { identity } from "@/lib/supabase/server";

const filename = "ABA Visual Identity Client Workbook.pdf";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const projectId = uuid.parse((await params).projectId);
    const { db } = await identity();
    const { data, error } = await db
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .single();
    if (error || !data)
      return new Response("Workbook not found.", {
        status: 404,
        headers: { "Cache-Control": "private, no-store" },
      });

    const bytes = await readFile(
      path.join(process.cwd(), "private-assets", filename),
    );
    return new Response(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    return new Response("Sign in and project access are required.", {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
