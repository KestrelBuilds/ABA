import { createServerClient } from "@supabase/ssr";
import { privateFetch } from "./lib/supabase/private-fetch";
import { supabaseSettings } from "./lib/supabase/config";
import { NextResponse, type NextRequest } from "next/server";
// Refresh cookies only. Every protected page/action also validates identity and database policies.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = supabaseSettings();
  if (url && key) {
    const db = createServerClient(url, key, {
      global: { fetch: privateFetch },
      cookieOptions: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
      },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(items) {
          items.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          items.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });
    try {
      await db.auth.getUser();
    } catch {
      /* Protected handlers fail closed if the provider is unavailable. */
    }
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = {
  matcher: [
    "/workspace/:path*",
    "/account-security/:path*",
    "/account/:path*",
    "/reset-password",
    "/access",
    "/welcome",
    "/contracts",
    "/portal/:path*",
    "/files/:path*",
    "/assets/:path*",
    "/business-pdf/:path*",
    "/login",
    "/auth/:path*",
  ],
};
