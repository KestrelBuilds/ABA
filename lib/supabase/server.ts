import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabaseSettings } from "./config";
export function configured() {
  const { url, key } = supabaseSettings();
  return Boolean(url && key);
}
export async function database() {
  if (!configured())
    throw Error("Supabase is not connected. Follow the setup guide.");
  const { url, key } = supabaseSettings();
  const store = await cookies();
  return createServerClient(url, key, {
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
    cookies: {
      getAll: () => store.getAll(),
      setAll(items) {
        try {
          items.forEach(({ name, value, options }) =>
            store.set(name, value, options),
          );
        } catch {
          /* Server Components cannot write cookies. Proxy and auth handlers persist refreshes. */
        }
      },
    },
  });
}
export function invitationAdmin() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret)
    throw Error(
      "Client invitations need the server-only Supabase service key. Add it securely in hosting settings.",
    );
  return createClient(supabaseSettings().url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export async function identity(adminOnly = false) {
  const db = await database();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) throw Error("Please sign in to continue.");
  const { data: profile, error: roleError } = await db
    .from("profiles")
    .select("role,client_id")
    .eq("id", user.id)
    .single();
  if (
    roleError ||
    !profile ||
    !["admin", "client"].includes(profile.role) ||
    (adminOnly && profile.role !== "admin")
  )
    throw Error("You do not have access to this area.");
  return { db, user, profile };
}
