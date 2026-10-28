import { identity } from "@/lib/supabase/server";
import { uuid } from "@/lib/validation";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const id = uuid.parse((await params).id);
    const { db } = await identity();
    const { data, error } = await db
      .from("client_assets")
      .select("object_path,name")
      .eq("id", id)
      .single();
    if (error || !data)
      return new Response("Asset not found.", {
        status: 404,
        headers: { "Cache-Control": "private, no-store" },
      });
    const signed = await db.storage
      .from("client-assets")
      .createSignedUrl(data.object_path, 60, {
        download: data.name,
        cacheNonce: crypto.randomUUID(),
      });
    if (signed.error || !signed.data)
      return new Response("Asset unavailable.", {
        status: 404,
        headers: { "Cache-Control": "private, no-store" },
      });
    return new Response(null, {
      status: 303,
      headers: {
        Location: signed.data.signedUrl,
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    return new Response("Sign-in and asset access are required.", {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
