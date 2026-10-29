import { createClient } from "@supabase/supabase-js";
import { supabaseSettings } from "@/lib/supabase/config";
import { privateFetch } from "@/lib/supabase/private-fetch";
import { verifyTallySignature, tallyEnquiry } from "@/lib/tally-webhook";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const secret = process.env.TALLY_WEBHOOK_SIGNING_SECRET,
    formId = process.env.TALLY_FORM_ID,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY,
    url = supabaseSettings().url;
  const reply = (message: string, status: number) =>
    Response.json(
      { message },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  if (!secret || !formId || !key || !url)
    return reply("Webhook is not configured.", 503);
  const reader = request.body?.getReader();
  if (!reader) return reply("Body required.", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 65536) {
        await reader.cancel();
        return reply("Payload too large.", 413);
      }
      chunks.push(part.value);
    }
  } catch {
    return reply("Invalid body.", 400);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (
    !verifyTallySignature(raw, request.headers.get("tally-signature"), secret)
  )
    return reply("Invalid signature.", 401);
  let enquiry;
  try {
    enquiry = tallyEnquiry(raw, formId);
  } catch {
    return reply("Invalid event or form.", 400);
  }
  // Fixed table/columns only. The service key never reaches a browser and sends no invitations.
  const db = createClient(url, key, {
    global: { fetch: privateFetch },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const saved = await db.rpc("ingest_tally_enquiry", { payload: enquiry });
  if (saved.error)
    return reply("Enquiry could not be stored. Please retry.", 503);
  return reply("Enquiry received.", 200);
}
