import { NextResponse } from "next/server";
import { database } from "@/lib/supabase/server";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code) {
    try {
      const db = await database();
      const { error } = await db.auth.exchangeCodeForSession(code);
      if (!error) {
        await db.rpc("accept_invitation");
        return NextResponse.redirect(new URL("/portal", url.origin));
      }
    } catch {
      /* Show a safe retry path. */
    }
  }
  return NextResponse.redirect(new URL("/login?error=link", url.origin));
}
