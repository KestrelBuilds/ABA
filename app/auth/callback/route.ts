import { NextResponse } from "next/server";
import { database } from "@/lib/supabase/server";
import { resolveAppOrigin } from "@/lib/app-origin";
export async function GET(request: Request) {
  const url = new URL(request.url);
  let origin: string;
  try {
    origin = resolveAppOrigin(
      process.env.APP_ORIGIN,
      process.env.VERCEL_PROJECT_PRODUCTION_URL,
    );
  } catch {
    return NextResponse.redirect(new URL("/login?error=link", url.origin));
  }
  const code = url.searchParams.get("code");
  if (code) {
    try {
      const db = await database();
      const { data, error } = await db.auth.exchangeCodeForSession(code);
      if (!error) {
        if (
          ("redirectType" in data && data.redirectType === "recovery") ||
          url.searchParams.get("next") === "reset-password"
        )
          return NextResponse.redirect(new URL("/reset-password", origin));
        const accepted = await db.rpc("accept_invitation");
        if (!accepted.error)
          return NextResponse.redirect(new URL("/portal", origin));
        return NextResponse.redirect(new URL("/access", origin));
      }
    } catch {
      /* Show a safe retry path. */
    }
  }
  return NextResponse.redirect(new URL("/login?error=link", origin));
}
